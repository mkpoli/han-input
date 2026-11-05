// Direct-input tables, KANJIDIC2 indices, CNS 全字庫 attributes, and legacy byte encodings computed by the runtime.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fetchOnce } from '../lib.mjs'
import { readRimeDict } from './rime.mjs'

const HAN = /^\p{Script=Han}$/u
/** @param {string} text */
const isHan = text => HAN.test(text)

/** @param {string} text */
const decodeEntities = text => text.replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[/** @type {'amp'} */ (name)])

// --- T-Code and TUT-Code, from the Emacs Lisp tables of the tc package -----------------------------------------

const TC_REF = '5d84e847cf34545a88dc2e1555dac3aef771b21f'
const TC_URL = `https://raw.githubusercontent.com/kanchoku/tc/${TC_REF}/`
/** The 40 keys in the order tc numbers them (row by row on a QWERTY keyboard). */
const TC_KEYS = '1234567890qwertyuiopasdfghjkl;zxcvbnm,./'

/** @typedef {{ items: any[], tail?: any }} Cons */

/** A reader for the few Lisp forms in tc's tables: lists, dotted pairs, vectors, strings, numbers, symbols. @param {string} text @param {number} start index of the opening paren @returns {any} */
function readLisp(text, start) {
  let i = start
  const skip = () => {
    for (;;) {
      while (i < text.length && /\s/.test(text[i])) i++
      if (text[i] === ';') { while (i < text.length && text[i] !== '\n') i++ } else return
    }
  }
  const form = () => {
    skip()
    const c = text[i]
    if (c === '(' || c === '[') {
      const close = c === '(' ? ')' : ']'
      i++
      /** @type {Cons} */
      const cons = { items: [] }
      for (;;) {
        skip()
        if (text[i] === close) { i++; return c === '[' ? cons.items : cons }
        if (i >= text.length) throw new Error('unbalanced Lisp')
        if (c === '(' && text[i] === '.' && /\s/.test(text[i + 1])) { i++; cons.tail = form(); continue }
        cons.items.push(form())
      }
    }
    if (c === '"') {
      let out = ''
      i++
      while (text[i] !== '"') {
        if (text[i] === '\\') i++
        out += text[i++]
      }
      i++
      return out
    }
    if (c === "'") { i++; return form() }
    const begin = i
    while (i < text.length && !/[\s()[\]";]/.test(text[i])) i++
    const token = text.slice(begin, i)
    return /^-?\d+$/.test(token) ? Number(token) : token === 'nil' ? null : token
  }
  return form()
}

/** The first-stroke × second-stroke table: tc stores one string per second stroke, spaces dropped, one character per first stroke. @param {string} text @returns {[string, string][]} */
function twoStroke(text) {
  const form = readLisp(text, text.indexOf('(setq tcode-tbl'))
  /** @type {(string | null)[]} */
  const rows = form.items[2]
  if (rows.length !== 40) throw new Error(`tcode-tbl has ${rows.length} rows`)
  /** @type {[string, string][]} */
  const out = []
  rows.forEach((row, second) => {
    if (row == null) return
    const cells = [...row.replaceAll(' ', '')]
    if (cells.length !== 40) throw new Error(`tcode-tbl row ${second} has ${cells.length} cells`)
    cells.forEach((char, first) => out.push([TC_KEYS[first] + TC_KEYS[second], char]))
  })
  return out
}

/** TUT-Code's longer sequences: a tree of key numbers ending in a character or a 40-cell table for the last stroke. @param {string} text @returns {[string, string][]} */
function overTwoStrokes(text) {
  const form = readLisp(text, text.indexOf('(defconst tut-over-2-strokes-table'))
  /** @type {[string, string][]} */
  const out = []
  /** @param {number[]} seq @param {any} table */
  const walk = (seq, table) => {
    const code = (/** @type {number[]} */ keys) => keys.map(k => TC_KEYS[k]).join('')
    if (typeof table === 'string') out.push([code(seq), table])
    else if (Array.isArray(table)) table.forEach((char, k) => { if (typeof char === 'string') out.push([code([...seq, k]), char]) })
    else if (table && typeof table === 'object') {
      for (const elm of table.items) {
        if (typeof elm.items[0] !== 'number') throw new Error('unexpected shape in tut-over-2-strokes-table')
        walk([...seq, elm.items[0]], elm.tail !== undefined ? elm.tail : { items: elm.items.slice(1) })
      }
    }
  }
  walk([], form.items[2])
  return out
}

/** @param {'tcode' | 'tutcode'} id */
async function tcMethod(id) {
  const file = id === 'tcode' ? 'tc-tbl.el' : 'tutc-tbl.el'
  const text = readFileSync(await fetchOnce(TC_URL + file), 'utf8')
  const entries = twoStroke(text)
  if (id === 'tutcode') entries.push(...overTwoStrokes(text))
  const names = id === 'tcode'
    ? { en: 'T-Code', zh: 'T-Code', ja: 'Tコード' }
    : { en: 'TUT-Code', zh: 'TUT-Code', ja: 'TUT-Code' }
  return /** @type {import('../lib.mjs').Method} */ ({
    id, family: 'direct', keys: TC_KEYS, names,
    about: id === 'tcode' ? 'Two strokes per kanji, first stroke by column and second by row.' : 'Two strokes for common kanji, three or four for the rest.',
    source: {
      name: `kanchoku/tc, ${file}`,
      url: `${TC_URL}${file}`,
      licence: 'GNU General Public License, "either version 2 of the License, or (at your option) any later version" (file header)',
      attribution: id === 'tcode' ? 'Kaoru Maeda, Yasushi Saito and KITAJIMA Akira, 1989–2001' : 'KITAJIMA Akira, 1997–2001',
    },
    entries: entries.filter(([, char]) => isHan(char)),
  })
}

// --- Horenso ---------------------------------------------------------------------------------------------------

const HORENSO_REF = '6800ce7d61991cf538b599ec5cfaf06b8886483f'

async function horenso() {
  const treeUrl = `https://api.github.com/repos/google/horenso/git/trees/${HORENSO_REF}?recursive=1`
  const tree = JSON.parse(readFileSync(await fetchOnce(treeUrl, `horenso-${HORENSO_REF.slice(0, 7)}-tree.json`), 'utf8'))
  /** @type {string[]} */
  const files = tree.tree.filter((/** @type {{ type: string, path: string }} */ n) => n.type === 'blob' && /^code\/kanji\/[^/]+\/[^./]+$/.test(n.path)).map((/** @type {{ path: string }} */ n) => n.path)
  /** @type {[string, string][]} */
  const entries = []
  for (let i = 0; i < files.length; i += 12) {
    const texts = await Promise.all(files.slice(i, i + 12).map(async path =>
      readFileSync(await fetchOnce(`https://raw.githubusercontent.com/google/horenso/${HORENSO_REF}/${path}`, `horenso-${HORENSO_REF.slice(0, 7)}/${path}`), 'utf8')))
    for (const text of texts) {
      for (const line of text.split(/\r?\n/)) {
        const [code, char] = line.split('\t')
        // `_04EBC` rows only hold characters that have no code yet.
        if (code && char && !code.startsWith('_') && isHan(char)) entries.push([code, char])
      }
    }
  }
  return /** @type {import('../lib.mjs').Method} */ ({
    id: 'horenso', family: 'direct', keys: 'a–z ;,./ and Shift',
    names: { en: 'Horenso', zh: 'ほー連想', ja: 'ほー連想' },
    about: 'Radical key, reading key, then a key chosen for the character. Capital letters are typed with Shift.',
    source: {
      name: 'google/horenso, code/kanji',
      url: `https://github.com/google/horenso/tree/${HORENSO_REF}/code/kanji`,
      licence: 'Apache License, Version 2.0',
      attribution: 'Google Inc., 2016',
    },
    entries,
  })
}

// --- KappaJP86 -------------------------------------------------------------------------------------------------

async function kappa() {
  const ref = '491d97ba3b8805568cae03d75e2e0797c4651629'
  const url = `https://raw.githubusercontent.com/zerobikappa/rime-kappajp86/${ref}/kappajp86.dict.yaml`
  /** @type {[string, string][]} */
  const entries = []
  for (const { char, code } of readRimeDict(readFileSync(await fetchOnce(url), 'utf8'))) if (isHan(char)) entries.push([code, char])
  return /** @type {import('../lib.mjs').Method} */ ({
    id: 'kappajp86', family: 'direct', keys: 'a–z',
    names: { en: 'Kappa Japanese Wubi 86', zh: '河童日本語五筆', ja: '河童日本語五筆' },
    source: {
      name: 'zerobikappa/rime-kappajp86, kappajp86.dict.yaml',
      url,
      licence: 'None stated in the repository',
      attribution: '零尾河童 (zerobikappa)',
      version: '0.03',
    },
    entries,
  })
}

// --- KANJIDIC2 -------------------------------------------------------------------------------------------------

const KANJIDIC_URL = 'https://www.edrdg.org/kanjidic/kanjidic2.xml.gz'
const KANJIDIC_SOURCE = {
  name: 'KANJIDIC2',
  url: KANJIDIC_URL,
  licence: 'Creative Commons Attribution-ShareAlike Licence (V4.0)',
  attribution: 'This tool uses the KANJIDIC2 file. This file is the property of the Electronic Dictionary Research and Development Group, and is used in conformance with the Group’s licence (https://www.edrdg.org/edrdg/licence.html).',
}

/** @type {[string, 'q' | 'd', string, string, string, string, string, string?][]} id, kind, attribute, English, 繁體, 日本語, about, keys */
const KANJIDIC = [
  ['skip', 'q', 'skip', 'SKIP code', 'SKIP 碼', 'SKIP コード', 'Jack Halpern’s System of Kanji Indexing by Patterns, as 1-4-3.'],
  ['deroo', 'q', 'deroo', 'De Roo code', 'De Roo 碼', 'ド・ルー・コード', 'Four-digit index of Father Jean De Roo’s 2001 Kanji.'],
  ['sh-desc', 'q', 'sh_desc', 'Spahn–Hadamitzky descriptor', 'Spahn–Hadamitzky 描述碼', 'スパーン・ハダミツキー分類コード', 'Radical, stroke count and form of the Spahn and Hadamitzky kanji dictionary, as 0a7.14.'],
  ['halpern', 'd', 'halpern_njecd', 'Halpern index (NJECD)', 'Halpern 索引（NJECD）', 'ハルペン索引（新日英漢字典）', 'Entry number in Halpern’s New Japanese-English Character Dictionary.'],
  ['heisig', 'd', 'heisig', 'Heisig index', 'Heisig 索引', 'ハイジッヒ番号', 'Frame number in Heisig’s Remembering the Kanji.'],
  ['gakken', 'd', 'gakken', 'Gakken index', '學研索引', '学研漢字辞典番号', 'Entry number in the Gakken Kanji Dictionary.'],
  ['oneill', 'd', 'oneill_names', 'O’Neill index (names)', 'O’Neill 索引（人名）', 'オニール番号（人名）', 'Entry number in O’Neill’s Japanese Names.'],
  ['kd-four-corner', 'q', 'four_corner', 'Four-corner code (KANJIDIC)', '四角號碼（KANJIDIC）', '四角号碼（KANJIDIC）', 'Four-corner code, given with its fifth-corner digit and without it.'],
]

async function kanjidic() {
  const xml = gunzipSync(readFileSync(await fetchOnce(KANJIDIC_URL))).toString('utf8')
  const fields = new Map(KANJIDIC.map(row => [row[0], /** @type {[string, string][]} */ ([])]))
  for (const block of xml.split('<character>').slice(1)) {
    const char = /<literal>([^<]+)<\/literal>/.exec(block)?.[1]
    if (!char || !isHan(char)) continue
    for (const [id, kind, attr] of KANJIDIC) {
      const re = kind === 'q'
        ? new RegExp(`<q_code qc_type="${attr}"[^>]*>([^<]+)</q_code>`, 'g')
        : new RegExp(`<dic_ref dr_type="${attr}"[^>]*>([^<]+)</dic_ref>`, 'g')
      for (const [, value] of block.matchAll(re)) {
        const rows = /** @type {[string, string][]} */ (fields.get(id))
        rows.push([decodeEntities(value), char])
        if (id === 'kd-four-corner' && value.includes('.')) rows.push([value.split('.')[0], char])
      }
    }
  }
  return KANJIDIC.map(([id, , , en, zh, ja, about, keys]) => /** @type {import('../lib.mjs').Method} */ ({
    id, family: 'index', names: { en, zh, ja }, about, keys,
    source: { ...KANJIDIC_SOURCE, version: '2026-309' },
    entries: fields.get(id),
  }))
}

// --- CNS 全字庫 ------------------------------------------------------------------------------------------------

const CNS_ATTRIBUTES = 'https://www.cns11643.gov.tw/opendata/Properties.zip'
const CNS_MAPPING = 'https://www.cns11643.gov.tw/opendata/MapingTables.zip'
const CNS_SOURCE = {
  licence: '政府資料開放授權條款-第1版 (Open Government Data License 1.0)',
  attribution: '數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw。',
}

/** One member of a zip, as text. @param {string} zip @param {string} member */
const unzipText = (zip, member) => execFileSync('unzip', ['-p', zip, member], { maxBuffer: 1 << 30 }).toString('utf8')

/** @param {string} text @returns {[string, string][]} */
const tsv = text => text.split(/\r?\n/).filter(Boolean).map(line => /** @type {[string, string]} */ (line.split('\t')))

/** CNS plane-code (`1-4421`) to the Han characters it maps to; Private Use Area code points and other non-Han are dropped. @param {string} zip @returns {Map<string, string[]>} */
function cnsToUnicode(zip) {
  /** @type {Map<string, string[]>} */
  const map = new Map()
  for (const name of ['BMP', '2', '3', '15']) {
    for (const [cns, hex] of tsv(unzipText(zip, `Unicode/CNS2UNICODE_Unicode ${name}.txt`))) {
      const char = String.fromCodePoint(parseInt(hex, 16))
      if (!isHan(char)) continue
      const list = map.get(cns)
      if (list) { if (!list.includes(char)) list.push(char) } else map.set(cns, [char])
    }
  }
  return map
}

async function cns() {
  const props = await fetchOnce(CNS_ATTRIBUTES)
  const mapping = cnsToUnicode(await fetchOnce(CNS_MAPPING))
  /** @param {string} member @param {(value: string) => string[]} [read] @returns {[string, string][]} */
  const keyed = (member, read = value => [value]) => tsv(unzipText(props, member)).flatMap(([cnsCode, value]) =>
    (mapping.get(cnsCode) ?? []).flatMap(char => read(value).map(code => /** @type {[string, string]} */ ([code, char]))))
  const source = (/** @type {string} */ member) => ({ name: `CNS 全字庫, ${member}`, url: CNS_ATTRIBUTES, ...CNS_SOURCE })

  /** @type {import('../lib.mjs').Method[]} */
  const out = [
    {
      id: 'cns-cangjie', family: 'shape', keys: 'a–y',
      names: { en: 'Cangjie (CNS 全字庫)', zh: '倉頡（全字庫）', ja: '倉頡（全字庫）' },
      source: source('CNS_cangjie.txt'), entries: keyed('CNS_cangjie.txt', value => [value.toLowerCase()]),
    },
    {
      id: 'cns-stroke-order', family: 'index', keys: '1–5',
      names: { en: 'Stroke order (CNS 全字庫)', zh: '筆順（全字庫）', ja: '筆順（全字庫）' },
      about: 'Strokes in writing order: 1 horizontal, 2 vertical, 3 left-falling, 4 dot, 5 turning.',
      source: source('CNS_strokes_sequence.txt'), entries: keyed('CNS_strokes_sequence.txt'),
    },
    {
      id: 'cns-zhuyin', family: 'reading', keys: 'ㄅ–ㄩ ˊˇˋ˙',
      names: { en: 'Zhuyin (CNS 全字庫)', zh: '注音（全字庫）', ja: '注音（全字庫）' },
      source: source('CNS_phonetic.txt'), entries: keyed('CNS_phonetic.txt'),
    },
  ]

  // CNS_pinyin_1 lists each zhuyin syllable with its romanisations, tones as digits (first tone unmarked).
  const syllables = new Map(tsv(unzipText(props, 'CNS_pinyin_1.txt')).map(([zhuyin, ...rest]) => [zhuyin, rest]))
  /** @type {[string, number, string, string, string][]} id, column after the zhuyin, English, 繁體, 日本語 */
  const ROMANISATIONS = [
    ['wade-giles', 3, 'Wade–Giles', '威妥瑪拼音', 'ウェード式'],
    ['yale-mandarin', 2, 'Yale romanization (Mandarin)', '耶魯拼音（國語）', 'イェール式（北京語）'],
    ['zhuyin-ii', 1, 'Zhuyin Second Form (MPS II)', '注音第二式', '注音第二式'],
    ['tongyong', 4, 'Tongyong Pinyin', '通用拼音', '通用ピンイン'],
  ]
  const phonetic = keyed('CNS_phonetic.txt')
  for (const [id, column, en, zh, ja] of ROMANISATIONS) {
    /** @type {[string, string][]} */
    const entries = []
    for (const [zhuyin, char] of phonetic) {
      const row = syllables.get(zhuyin)
      if (row?.[column]) entries.push([row[column], char])
    }
    out.push({
      id, family: 'reading', names: { en, zh, ja }, keys: 'a–z 1–5',
      about: 'Taken from the zhuyin of CNS 全字庫 through its syllable table; first tone unmarked, other tones as digits.',
      source: { name: 'CNS 全字庫, CNS_phonetic.txt with CNS_pinyin_1.txt', url: CNS_ATTRIBUTES, ...CNS_SOURCE },
      entries,
    })
  }
  return out
}

// --- Byte encodings, decoded by the runtime --------------------------------------------------------------------

const COMPUTED = 'Computed from the encoding standard by the runtime’s decoder'

/** Every byte sequence of the given shapes that decodes to exactly one Han character. @param {string} label @param {[number, number][][][]} shapes each shape lists, per byte, the [low, high] ranges it may take @returns {[string, string][]} */
function decodeAll(label, shapes) {
  const decoder = new TextDecoder(label, { fatal: true })
  /** @type {[string, string][]} */
  const out = []
  for (const shape of shapes) {
    const bytes = new Uint8Array(shape.length)
    /** @param {number} depth */
    const fill = depth => {
      if (depth === shape.length) {
        let text
        try { text = decoder.decode(bytes) } catch { return }
        if (isHan(text)) out.push([Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''), text])
        return
      }
      for (const [low, high] of shape[depth]) for (let b = low; b <= high; b++) { bytes[depth] = b; fill(depth + 1) }
    }
    fill(0)
  }
  return out
}

/** @type {[string, string, string, string, string, string, string, [number, number][][][]][]} id, label, English, 繁體, 日本語, about, keys, shapes */
const ENCODINGS = [
  ['gbk-bytes', 'gb18030', 'GBK / GB 18030 bytes', 'GBK／GB 18030 位元組', 'GBK／GB 18030 バイト列', 'Two- and four-byte sequences of GB 18030, which contains GBK, in hex.',
    '0–9 a–f',
    [[[[0x81, 0xfe]], [[0x40, 0x7e], [0x80, 0xfe]]], [[[0x81, 0x84], [0x90, 0xe3]], [[0x30, 0x39]], [[0x81, 0xfe]], [[0x30, 0x39]]]]],
  ['big5-bytes', 'big5', 'Big5 bytes', 'Big5 位元組', 'Big5 バイト列', 'Two-byte sequences of Big5 as the web decodes it, with the HKSCS and ETEN extensions, in hex.',
    '0–9 a–f', [[[[0x81, 0xfe]], [[0x40, 0x7e], [0xa1, 0xfe]]]]],
  ['shiftjis', 'shift_jis', 'Shift_JIS bytes', 'Shift_JIS 位元組', 'シフトJISバイト列', 'Two-byte sequences of Shift_JIS as the web decodes it, in hex.',
    '0–9 a–f', [[[[0x81, 0x9f], [0xe0, 0xfc]], [[0x40, 0x7e], [0x80, 0xfc]]]]],
  ['eucjp', 'euc-jp', 'EUC-JP bytes', 'EUC-JP 位元組', 'EUC-JPバイト列', 'Two-byte sequences of JIS X 0208 and three-byte sequences (8f first) of JIS X 0212, in hex.',
    '0–9 a–f', [[[[0xa1, 0xfe]], [[0xa1, 0xfe]]], [[[0x8f, 0x8f]], [[0xa1, 0xfe]], [[0xa1, 0xfe]]]]],
  ['euckr', 'euc-kr', 'EUC-KR bytes', 'EUC-KR 位元組', 'EUC-KRバイト列', 'Two-byte sequences of KS X 1001 and its Unified Hangul Code extension, in hex.',
    '0–9 a–f', [[[[0x81, 0xfe]], [[0x41, 0xfe]]]]],
]

function encodings() {
  return ENCODINGS.map(([id, label, en, zh, ja, about, keys, shapes]) => /** @type {import('../lib.mjs').Method} */ ({
    id, family: 'encoding', names: { en, zh, ja }, about, keys,
    source: {
      name: `The ${label} decoder of the JavaScript runtime`,
      url: `https://encoding.spec.whatwg.org/#${label}`,
      licence: COMPUTED,
      attribution: 'WHATWG Encoding Standard',
    },
    entries: decodeAll(label, shapes),
  }))
}

/** @returns {Promise<import('../lib.mjs').Method[]>} */
export async function extraMethods() {
  /** @type {import('../lib.mjs').Method[]} */
  const out = []
  /** @param {string} label @param {() => Promise<import('../lib.mjs').Method | import('../lib.mjs').Method[]>} make */
  const attempt = async (label, make) => {
    try { out.push(...[await make()].flat()) } catch (error) { console.warn(`  left out ${label}: ${/** @type {Error} */ (error).message}`) }
  }
  await attempt('tcode', () => tcMethod('tcode'))
  await attempt('tutcode', () => tcMethod('tutcode'))
  await attempt('horenso', horenso)
  await attempt('kappajp86', kappa)
  await attempt('kanjidic2', kanjidic)
  await attempt('cns', cns)
  await attempt('encodings', async () => encodings())
  return out
}
