# /// script
# requires-python = ">=3.12"
# dependencies = ["openpyxl>=3.1", "xlrd>=2.0"]
# ///
# Imports the headword (字頭) tables compiled from research books on difficult, vulgar and variant
# characters, one character set per book. The tables were privately supplied on 2026-11-14, are copied
# to cache/study-tables/ and are pinned by SHA-256. An encoded headword becomes a member of its set; a
# headword written as an IDS, a private-use character or a component description stays a record that
# Find reaches through its parts.
#   uv run scripts/import_study_tables.py
import csv, hashlib, io, json, os, re, sys, unicodedata
import openpyxl, xlrd

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = os.path.join(ROOT, 'cache', 'study-tables')
OUT = os.path.join(ROOT, 'app', 'public', 'charsets')
SUPPLIED = '2026-11-14'

IDC_BINARY = set('⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽㇯')
IDC_TERNARY = set('⿲⿳')
IDC_UNARY = set('⿾⿿')
IDC = IDC_BINARY | IDC_TERNARY | IDC_UNARY
HAN = re.compile('[⺀-⿟々〇〡-〩〸-〻㇀-㇯㐀-䶿一-鿿豈-﫿\U00020000-\U0003FFFF]')
VARIATION = re.compile('[︀-️\U000E0100-\U000E01EF]')


def is_private(char):
    cp = ord(char)
    return 0xE000 <= cp <= 0xF8FF or 0xF0000 <= cp <= 0xFFFFD or 0x100000 <= cp <= 0x10FFFD


def parse_unit(text, at):
    """The end of the IDS expression, component or character that starts at `at`, or None."""
    if at >= len(text):
        return None
    char = text[at]
    if char in IDC:
        arity = 1 if char in IDC_UNARY else 3 if char in IDC_TERNARY else 2
        end = at + 1
        # An operator may carry a modifier, as in `⿻[1:]` and `⿵⿻[|,x_,_x]`.
        if end < len(text) and text[end] == '[' and text.find(']', end) > 0:
            end = text.index(']', end) + 1
        for _ in range(arity):
            end = parse_unit(text, end)
            if end is None:
                return None
        return end
    end = at + 1
    # A glyph label and a component description, as in `[b]#(-𠃌丨b一)` and `#(-一丨b𠃌)`.
    if char == '[' and text.find(']', at) > 0:
        end = text.index(']', at) + 1
        for opener in ('#(', '%23('):
            if text.startswith(opener, end) and text.find(')', end) > 0:
                end = text.index(')', end) + 1
        return end
    for opener in ('#(', '%23('):
        if text.startswith(opener, at) and text.find(')', at) > 0:
            return text.index(')', at) + 1
    if char == '〈' and text.find('〉', at) > 0:
        return text.index('〉', at) + 1
    while end < len(text) and VARIATION.match(text[end]):
        end += 1
    return end


def units(text):
    """The characters and IDS expressions a cell is made of; None when an expression is unfinished."""
    out, at = [], 0
    while at < len(text):
        end = parse_unit(text, at)
        if end is None:
            return None
        out.append(text[at:end])
        at = end
    return out


def classify(unit):
    """'char' for one assigned-range Han character, 'ids' for an expression, a component description or a
    private-use character kept as text, None for anything else."""
    if len(unit) == 1:
        if is_private(unit):
            return 'ids'
        return 'char' if HAN.match(unit) else None
    if unit[0] in IDC or unit[0] in '[#%〈':
        return 'ids'
    return None


def page(value):
    """A printed page or serial: a float page becomes an integer, text stays as printed."""
    if value is None or value == '':
        return ''
    if isinstance(value, float):
        return str(int(value)) if value == int(value) else str(value)
    return str(value).strip()


class Book:
    def __init__(self, spec):
        self.spec = spec
        self.records = {}
        self.dropped = {}
        self.documents = {}

    def drop(self, reason, text=''):
        self.dropped.setdefault(reason, []).append(text)

    def add(self, document, source, head, related=(), alternates=(), relations=(), status=None):
        """One headword. Returns False when it is a heading, a word or a placeholder."""
        head = head.strip()
        parts = units(head)
        if parts is None and any(char in IDC for char in head):
            parts = [head]  # an unfinished IDS is still the printed headword
            self.drop('unfinished IDS kept', head)
        if parts and len(parts) > 1 and head[0] in IDC:
            parts = [head]  # an IDS with an operand too many is still the printed headword
            self.drop('unfinished IDS kept', head)
        if not parts or len(parts) != 1:
            self.drop('word or heading', head)
            return False
        kind = classify(parts[0])
        if not kind:
            self.drop('placeholder', head)
            return False
        return self.put(document, source, head, kind, related, alternates, relations, status)

    def put(self, document, source, head, kind, related=(), alternates=(), relations=(), status=None):
        key = (document, source, head)
        existing = self.records.get(key)
        related, relations = list(related), list(relations)
        if len(relations) != len(related):
            relations = []
        if existing:
            for i, item in enumerate(related):
                if item not in existing['related'] and item != head:
                    existing['related'].append(item)
                    if relations and existing['relations'] is not None:
                        existing['relations'].append(relations[i])
            for item in alternates:
                if item not in existing['alternates']:
                    existing['alternates'].append(item)
            return True
        self.records[key] = {
            'document': document, 'source': source, 'head': head, 'kind': kind,
            'related': [item for item in related if item != head],
            'relations': [relations[i] for i, item in enumerate(related) if item != head] if relations else None,
            'alternates': [item for item in alternates if item and item != head], 'status': status or None,
        }
        return True


def sheet_rows(path, sheet=0):
    if path.endswith('.xls'):
        book = xlrd.open_workbook(path)
        table = book.sheet_by_index(sheet)
        return [[cell.value if cell.ctype != xlrd.XL_CELL_EMPTY else None for cell in table.row(i)] for i in range(table.nrows)]
    return [list(row) for row in openpyxl.load_workbook(path, read_only=True).worksheets[sheet].iter_rows(values_only=True)]


def text_lines(path):
    raw = open(path, 'rb').read()
    if raw[:2] in (b'\xff\xfe', b'\xfe\xff'):
        text = raw.decode('utf-16')
    elif raw[:3] == b'\xef\xbb\xbf':
        text = raw[3:].decode('utf-8')
    else:
        text = raw.decode('utf-8')
    return text.splitlines()


def cell(row, index):
    if index is None or index >= len(row) or row[index] is None:
        return ''
    value = row[index]
    return page(value) if isinstance(value, (int, float)) else str(value).strip()


def group(book, document, source, forms):
    """Forms the table gives side by side, an unordered group: each is a headword related to the others."""
    seen = []
    for form in forms:
        form = form.strip()
        parts = units(form) if form else None
        if parts and len(parts) == 1 and classify(parts[0]) and form not in seen:
            seen.append(form)
        elif form:
            book.drop('word or heading', form)
    for form in seen:
        book.add(document, source, form, related=[other for other in seen if other != form])


# Readers ---------------------------------------------------------------------------------------------

def read_table(book, path, page_cols, head, alt=(), note=(), skip=1, sheet=0, split=None, filters=(), joiner='/'):
    for row in sheet_rows(path, sheet)[skip:]:
        text = cell(row, head)
        if not text:
            book.drop('empty', '')
            continue
        if any(re.fullmatch(pattern, text) for pattern in filters):
            book.drop('heading', text)
            continue
        source = joiner.join(filter(None, [cell(row, col) for col in page_cols]))
        alternates = []
        if split and split in text:
            text, *rest = [part.strip() for part in text.split(split)]
            alternates += [part for part in rest if part]
        alternates += [cell(row, col) for col in alt if cell(row, col)]
        status = ' '.join(filter(None, [cell(row, col) for col in note])) or None
        book.add('book', source, text, alternates=alternates, status=status)


def read_groups(book, path, page_col=0, first=1, skip=1, sheet=0):
    for row in sheet_rows(path, sheet)[skip:]:
        forms = [cell(row, col) for col in range(first, len(row)) if cell(row, col)]
        if forms:
            group(book, 'book', cell(row, page_col), forms)


def read_head_tab(book, path, header=False, page_first=False):
    for line in text_lines(path)[1 if header else 0:]:
        if not line.strip():
            book.drop('empty', '')
            continue
        head, _, where = line.partition('\t')
        if page_first:
            head, where = where, head
        head = re.sub(r'^[｛{](.*)[｝}]$', r'\1', head.strip().strip('"'))
        if head:
            book.add('book', where.strip(), head)
        else:
            book.drop('empty', line)


def read_yupian(book, path):
    for row in sheet_rows(path)[1:]:
        number = re.match(r'^[０-９0-9]+', cell(row, 0))
        title = re.sub(r'^[０-９0-9]+', '', cell(row, 0))
        if not title:
            continue
        # The book numbers its sources; the digits give their order.
        book.documents.setdefault(title, int(unicodedata.normalize('NFKC', number.group(0))) if number else 0)
        note = cell(row, 3)
        book.add(title, cell(row, 1), cell(row, 2), alternates=[note] if note else [])


def relation_of(text):
    text = text or ''
    match = re.match(r'^「[^」]*」(?:（[^）]*）)?的(.+)$', text)
    if match:
        return match.group(1).strip('，。 ')
    if text.startswith('同'):
        return '同'
    if text.startswith('俗') and text.endswith('字'):
        return '俗字'
    return ''


def read_suihanlu(book, path):
    for row in sheet_rows(path)[0:]:
        head, explained, regular, citation = cell(row, 1), cell(row, 3), cell(row, 4), cell(row, 6)
        if not head:
            book.drop('empty', '')
            continue
        if explained == '' and regular == '' and re.search(r'部$', head):
            book.drop('heading', head)
            continue
        found = re.search(r'第\s*(\d+)\s*页', citation)
        source = f'第{found.group(1)}页' if found else ''
        related = []
        for form in units(re.sub(r'\d+$', '', regular)) or []:
            if classify(form) and form != head and form not in related:
                related.append(form)
        kind = relation_of(explained)
        book.add('book', source, head, related=related, relations=[kind] * len(related) if kind else [], status=explained or None)


def read_jianhua(book, path):
    for row in sheet_rows(path)[1:]:
        head, meaning, same, cited = cell(row, 1), cell(row, 3), cell(row, 4), cell(row, 6)
        found = re.search(r'p\.\s*(\S+)$', cited)
        related = [form for form in units(same) or [] if classify(form)]
        book.add('book', f'p.{found.group(1)}' if found else '', head, related=related, status=meaning or None)


def read_jiagu(book, path):
    for row in sheet_rows(path)[1:]:
        also = cell(row, 3)
        related = [form for form in units(also) or [] if classify(form)] if also else []
        book.add('book', cell(row, 1), cell(row, 2), related=related)


def read_xiaoshuo(book, path):
    for row in sheet_rows(path)[1:]:
        book.add('book', '/'.join(filter(None, [cell(row, 0), cell(row, 1)])), cell(row, 2), alternates=[cell(row, c) for c in (3, 4) if cell(row, c)])


def read_zhiyin(book, path):
    for row in sheet_rows(path)[1:]:
        text = cell(row, 2)
        forms = units(text) or []
        group(book, 'book', '/'.join(filter(None, [cell(row, 0), cell(row, 1)])), forms) if len(forms) > 1 else book.add('book', '/'.join(filter(None, [cell(row, 0), cell(row, 1)])), text)


def read_weixiang(book, path):
    for row in csv.reader(io.StringIO('\n'.join(text_lines(path)[1:]))):
        if len(row) >= 2 and row[0].strip():
            book.add('book', row[1].strip(), row[0].strip())


def read_kangxi(book, path):
    header, entries = None, []
    for line in text_lines(path):
        found = re.fullmatch(r'(〈.*〉)：', line.strip())
        if found:
            header = found.group(1)
            entries.append((header, []))
        elif '\t' in line and header:
            head, _, rest = line.partition('\t')
            where = re.search(r'頁\s*(\d+)\s*第\s*(\d+)', rest)
            entries[-1][1].append((head.strip(), f'頁{where.group(1)}第{where.group(2)}' if where else ''))
        else:
            book.drop('unpaired line', line[:20])
    for header, rows in entries:
        if not rows:
            book.drop('header without entry', header)
            continue
        stand_ins = []
        for head, where in rows:
            if head == header:
                continue
            if head.startswith('〈'):
                book.put('book', where, head, 'ids', related=[header])
                continue
            parts = units(head)
            if parts and len(parts) == 1 and classify(parts[0]) == 'char':
                stand_ins.append(head)
                book.put('book', where, head, 'char', related=[header])
            else:
                book.drop('word or heading', head)
        book.put('book', rows[0][1], header, 'ids', related=stand_ins)


YINAN_MARKS = {'（': ('）', '簡化字'), '［': ('］', '異體字'), '〔': ('〕', '跳轉')}
SUFFIXES = {'T': '台灣字形', 'H': '香港字形', 'J': '日本字形', 'SS': '中易字形'}


def read_yinan(book, path):
    for line in text_lines(path):
        cols = line.split('\t')
        if len(cols) != 6 or not cols[5].startswith('YN'):
            book.drop('legend', line[:20])
            continue
        head, notes, code = cols[2].strip(), cols[3] + cols[4], cols[5].strip()
        status = None
        suffix = re.search(r'([A-Z]{1,2})$', head)
        if suffix and suffix.group(1) in SUFFIXES:
            head, status = head[:-len(suffix.group(1))], SUFFIXES[suffix.group(1)]
        if head.startswith('【'):
            book.drop('word or heading', head)
            continue
        related, relations = [], []
        for open_, body in re.findall(r'([（［〔])([^）］〕]*)[）］〕]', notes):
            kind = YINAN_MARKS[open_][1]
            forms = units(body)
            for form in (forms if forms and len(forms) == 1 else [body]):
                if form and form not in related:
                    related.append(form)
                    relations.append(kind)
        book.add('book', code, head, related=related, relations=relations, status=status)


# One entry per book. `read` is a function above or a (function, options) pair.
EXCERPT = 'An excerpt of the book’s table.'
INCOMPLETE = 'An incomplete table.'
BOOKS = [
    dict(id='study_zhongyi', title='中医古籍用字研究', file='《中医古籍用字研究》字頭.xlsx', sha256='8fbd8186cbc946fb93fef168fa427edf4169ae5950059f99c66450ce5310b230',
         read=(read_table, dict(page_cols=[0], head=1, alt=[2, 3]))),
    dict(id='study_liuchao', title='六朝別字記新編', file='《六朝別字記新編》字頭（不全）v2.xlsx', sha256='1fb1768da18bfd09ce6d0674f89c347e5a99c79d39ca2534c059aca3a9324470', complete=False, scope=INCOMPLETE,
         read=(read_table, dict(page_cols=[0], head=1, alt=[2]))),
    dict(id='study_dazidian_lungao', title='大字典论稿', file='《大字典论稿》難字部分（類推繁体）.xls', sha256='8b2f6feb1d74598f959bbfc683d6ffcea3a3838e5a48a961161d44cd400013ee',
         read=(read_table, dict(page_cols=[0], head=1, split='；'))),
    dict(id='study_zizibu', title='字孳補', file='《字孳補》字頭v2.xls', sha256='8db27ab2a574627edfc6404ea524b46e2ec5420544bf6e60a9b2185d2ee76b02',
         read=(read_table, dict(page_cols=[0, 1], head=2, alt=[3], note=[4], filters=[r'<.*>', r'[\d~]+劃']))),
    dict(id='study_huizhou_suzi', title='徽州文书俗字研究', file='《徽州文书俗字研究》字表節選v2.xls', sha256='0d672203e4b73b62e1ec422190b2dc324c13ad345fbfb37051b4455531f56d8f', complete=False, scope=EXCERPT,
         read=(read_table, dict(page_cols=[0], head=1, alt=[2, 3, 4]))),
    dict(id='study_huizhou_xisu', title='徽州文书稀俗字词例释', file='《徽州文书稀俗字词例释》俗字部分字頭v2.xlsx', sha256='ceba38d47b2ef1689f87712428cdb73b045b656326a408d70d8cc8bbd59800aa',
         read=(read_table, dict(page_cols=[0], head=1, alt=[2, 3, 4, 5, 6]))),
    dict(id='study_dunhuang_suzi', title='敦煌佛典语词和俗字研究', file='《敦煌佛典语词和俗字研究》俗字部分字頭.xlsx', sha256='ba483cf136ff0e8286aab7dadbd2f4fec11e716ca26dc2d88d14195f07172720',
         read=(read_table, dict(page_cols=[0], head=1, alt=[2, 3]))),
    dict(id='study_suihanlu', title='新集藏经音义随函录研究', file='《新集藏经音义随函录研究》字頭v3 釋義・關聯字・字理付.xlsx', sha256='bd9c0eeae2ca25a7625c2deb46b7e58be93e887a457381231542b26071ad980f',
         read=read_suihanlu),
    dict(id='study_mingqing_zishu', title='明清大型字書疑難字考釋與研究', file='《明清大型字書疑難字考釋與研究》下篇字頭.xlsx', sha256='54042593b5f886d6ac71f1592f6e8b421e738d7714e16ed6d09494ee8da42a6a', scope='The lower part of the book.',
         read=(read_table, dict(page_cols=[0], head=1, alt=[2, 3, 4]))),
    dict(id='study_mingqing_xiaoshuo', title='明清小说俗字俗语研究', file='《明清小说俗字俗语研究》字頭（U外58種）.xlsx', sha256='57db67771b0b7dc039e1a030e75fc6130f5a94135131ce5f2e10cba27d6af24d', scope='Headwords outside Unicode.',
         read=read_xiaoshuo),
    dict(id='study_kehong', title='可洪音义研究', file='可洪音义研究异体字表字头.txt', sha256='aa24aa643d4605982914a5ea6b83c97148410a7c4ad5ba1a594976c01f984180',
         read=read_head_tab),
    dict(id='study_zhengzitong', title='正字通异体字研究', file='《正字通异体字研究》字頭.xlsx', sha256='e29d54eed4e949c345744a54acfdd232e3f17da783157087ddeafb7b92ed1ed5',
         read=read_groups),
    dict(id='study_dazidian_nanzikao', title='汉语大字典难字考', file='《汉语大字典难字考》字頭.xlsx', sha256='83d4fdd3a297b8044dbe29d07face58e73d6aeba69ab2007180798b5d3feb272',
         read=(read_table, dict(page_cols=[0], head=1, filters=[r'.+部']))),
    dict(id='study_yupian_suzi', title='玉篇俗字', file='《玉篇俗字》字表U外去重137种.xlsx', sha256='16924b67f2cba2b438a93d41a0822af97f62c5396002bf2b1b2a898de5807303', scope='Headwords outside Unicode, deduplicated.',
         read=read_yupian),
    dict(id='study_jiaguwen_shilin', title='甲骨文字释林', file='《甲骨文字释林》-目录U外字75个.xlsx', sha256='8ef01519cc4b131554d55fd9467bfd59fc0871fc2fd8e406fdc1e3c62b33ec8b', scope='Contents-page headwords outside Unicode.',
         read=read_jiagu),
    dict(id='study_nanzi_sankao', title='疑难字三考', file='《疑难字三考》字头整理表.xlsx', sha256='b44698aff197e295dd2b8e7b2a879c206a214607275366e36e2d12404291085b',
         read=(read_table, dict(page_cols=[0], head=1))),
    dict(id='study_jianhua_xiuding', title='简化汉字修订方案（草案）', file='《简化汉字修订方案（草案）》未录入释义及字形汇总表.xlsx', sha256='7783fad4b3da797dc7aa8ef01c66ea115d87a80984d046dcbc092ae4ecebb0a5', scope='Forms whose meaning is not yet in the dictionary.',
         read=read_jianhua),
    dict(id='study_suitang_muzhi', title='隋唐出土墓志文字研究及整理', file='《隋唐出土墓志文字研究及整理》第15章俗字考字頭.xlsx', sha256='2dd7b2bd91651da19330f12d1997fc43a621c2c1a41b46c6461016e01d157cec', scope='Chapter 15.',
         read=read_groups),
    dict(id='study_yiqiejing', title='一切经音义刻本用字研究', file='一切经音义刻本用字研究-字頭節選.xlsx', sha256='5327a11826a03c2b085005bba4e41d4a035f263cef718298289abf590070b027', complete=False, scope=EXCERPT,
         read=read_groups),
    dict(id='study_donghan_beike', title='东汉碑刻异体字研究', file='东汉碑刻异体字研究-字頭節選.xlsx', sha256='a7741d8b8021a851431c867fccdfbb320e9d8f4292c06189275d584b70f07448', complete=False, scope=EXCERPT,
         read=read_groups),
    dict(id='study_zhiyinpian', title='直音篇', file='直音篇七卷部首-揚州資政左室v2.xlsx', sha256='721423dfb2d950096a14869af1f5fae052ee256c86608c5f265575ee267d88a0', scope='The radicals of the seventh fascicle.',
         read=read_zhiyin),
    dict(id='study_zidanku', title='子弹库帛书', file='子弹库帛书-第九部分-文字編字頭.txt', sha256='a733d9bf5e5b2cd288cd42e1d7bd8958bac4f9a640d178a00bc84c39a471426e', scope='Part 9, the character list.',
         read=(read_head_tab, dict(header=True, page_first=True))),
    dict(id='study_longkan', title='龙龛手镜研究', file='龙龛手镜研究字头.txt', sha256='9f38c97c62c4945f96228ede53f9f61c4abc363b81b6f08c193d86619b407de7',
         read=read_head_tab),
    dict(id='study_dazidian_weixiang', title='汉语大字典音义未详字头', file='汉语大字典_音义未详字头_粗校.txt', sha256='1c1754246e658fdd9b8209861f31563ac8b9d5d78fec1fdcaa9719beef7a513e', scope='A roughly proofread list.',
         read=read_weixiang),
    dict(id='study_kangxi_waizi', title='康熙外字', file='康熙外字.txt', sha256='9c53898dcaa7fb92d12a2c5da88119cf1eb52eef187853099eff599e77957bf1',
         read=read_kangxi),
    dict(id='study_yinan_jianming', title='疑难字简明字典', file='疑难字简明字典 刘叔新 索引.txt', sha256='bae96c395ce0aae3045d8ac8b037c50a928e25fe5bd34d0e013e425b13d6565e', scope='The index of the dictionary.',
         read=read_yinan),
]


def verified(entry):
    path = os.path.join(CACHE, entry['file'])
    with open(path, 'rb') as file:
        if hashlib.sha256(file.read()).hexdigest() != entry['sha256']:
            raise SystemExit(f'Table changed: {path}')
    return path


def encode(record):
    out = {'document': record['document'], 'source': record['source']}
    head = record['head']
    if record['kind'] == 'char':
        out['mappedUnicode'] = f'U+{ord(head[0]):04X}' if len(head) == 1 else None
    else:
        out['ids'] = head
    if record['status']:
        out['status'] = record['status']
    if record['alternates']:
        out['alternates'] = record['alternates']
    if record['related']:
        out['related'] = record['related']
        if record['relations'] and any(record['relations']):
            out['relations'] = record['relations']
    return out


def main():
    only = set(sys.argv[1:])
    for entry in BOOKS:
        if only and entry['id'] not in only:
            continue
        path = verified(entry)
        book = Book(entry)
        function, options = entry['read'] if isinstance(entry['read'], tuple) else (entry['read'], {})
        function(book, path, **options)
        titles = []
        for record in book.records.values():
            if record['document'] not in titles:
                titles.append(record['document'])
        titles.sort(key=lambda title: book.documents.get(title, 0))
        if titles == ['book']:
            ids, docs = {'book': 'book'}, [('book', entry['title'])]
        else:
            ids = {title: f'd{i + 1}' for i, title in enumerate(titles)}
            docs = [(ids[title], title) for title in titles]
        unique = []
        for record in book.records.values():
            item = encode(record)
            item['document'] = ids[record['document']]
            unique.append(item)
        with open(os.path.join(OUT, f'{entry["id"]}_source.json'), 'w', encoding='utf-8') as file:
            json.dump({'workbook': {'url': f'file:study-tables/{entry["file"]}', 'sha256': entry['sha256'], 'supplied': SUPPLIED}}, file, ensure_ascii=False, indent=2)
            file.write('\n')
        name = entry['title']
        with open(os.path.join(OUT, f'{entry["id"]}_records.json'), 'w', encoding='utf-8') as file:
            json.dump({
                'id': entry['id'],
                'group': 'Studies',
                'label': name,
                'names': {'en': name, 'zh': name, 'hans': name, 'ja': name, 'ko': name},
                'source': {'name': name, 'url': ''},
                'recordsNote': False,
                'search': True,
                'title': name,
                'complete': entry.get('complete', True),
                'scope': 'Headwords of the book’s table, one record each: ' + (entry.get('scope') or 'the whole table.'),
                'documents': [{'id': doc, 'document': title, 'title': name, 'source': '', 'date': SUPPLIED, 'url': ''} for doc, title in docs],
                'records': unique,
            }, file, ensure_ascii=False, separators=(',', ':'))
            file.write('\n')
        encoded = sum('mappedUnicode' in item for item in unique)
        members = len({item['mappedUnicode'] for item in unique if 'mappedUnicode' in item})
        related = sum('related' in item for item in unique)
        dropped = {reason: len(rows) for reason, rows in book.dropped.items()}
        print(f'{entry["id"]}: {len(unique)} records, {encoded} encoded ({members} distinct), {len(unique) - encoded} IDS, {related} with related; dropped {dropped}')
        if only:
            for reason, rows in book.dropped.items():
                print('  ', reason, [row for row in rows if row][:30])


if __name__ == '__main__':
    main()
