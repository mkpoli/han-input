import { describe, test, expect, afterEach } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { mappedMembers, membersText, iwdsMembers, scalarExpressions, idsRecords, columnsOf } from '../scripts/charset-members.mjs'
import { GB12052_UNENCODED, gb12052Members } from '../scripts/sources/charsets-gb12052.mjs'
import { compareCodes, coverageParts, filterAnswer, loadCharsets, loadCharset, loadRecords, sharedCharacters } from '../app/lib/charsets.js'
import { loadChars, findMeaning } from '../app/lib/data.js'
import { cnsSourceSets, unihanTSources } from '../scripts/sources/charsets-cns.mjs'
import { ziSourcePage } from '../scripts/sources/zi-page.mjs'
import { cnsRowCodes, codeText, evidenceCodes, rowCodes } from '../scripts/charset-codes.mjs'

describe('source glyph membership', () => {
  test('uses glyphs, never local draft slots or IDS operands', () => {
    expect(mappedMembers({ rows: [
      ['2FA20', '⿱一木', {}], ['00001', '字', {}], ['00002', '𠀀', {}],
      ['00003', '字', {}], ['00004', '\uE000', {}], ['00005', '字\u{E0100}', {}], ['2FADC', 'リ', {}],
    ] })).toEqual({ members: 'リ字𠀀', total: 7, encoded: 3, unencoded: 2 })
  })
  test('IWDS keeps example roles and skips IDS operands and variation sequences', () => {
    expect(scalarExpressions('⿰歹又字⿱木木𠀀字\u{E0100}')).toEqual(['字', '𠀀'])
    const result = iwdsMembers('<ucv><entry id="1"><components>⿱木木壬</components><unified>字…</unified><single char="⿰歹又">殩</single><note>山</note></entry></ucv>')
    expect([...result.members]).toEqual(['壬', '字', '殩'])
    expect(result.total).toBe(1)
    expect(result.evidence).toContainEqual({ entry: '1', role: 'components', char: '壬' })
    expect(result.members).not.toContain('木')
    expect(result.members).not.toContain('歹')
    expect(result.members).not.toContain('山')
  })
  test('rejects malformed data', () => {
    expect(() => mappedMembers({})).toThrow()
    expect(() => mappedMembers({ rows: [['id', null]] })).toThrow()
    expect(() => idsRecords({})).toThrow()
  })
  test('keeps IDS descriptions as records, not as scalar members', () => {
    expect(idsRecords({ rows: [['1', '⿰亻哥'], ['2', '字'], ['3', '⿱一木']] })).toEqual(['⿰亻哥', '⿱一木'])
  })
})

// Member files hold one member per line, so a jamo sequence stays one member.
const membersOf = (/** @type {string} */ text) => text.split('\n').filter(Boolean)

test('GB 12052 keeps each printed position and drops repeated glyphs', () => {
  const rows = [
    { code: '0101', row: 1, cell: 1, glyph: '\u3000' },
    { code: '0102', row: 1, cell: 2, glyph: '、' },
    { code: '0103', row: 1, cell: 3, glyph: '、' },
    { code: '7233', row: 72, cell: 33, glyph: '壭' },
    { code: '7267', row: 72, cell: 67, glyph: '噕' },
  ]
  const { members, codes } = gb12052Members(rows, new Set(GB12052_UNENCODED))
  expect(members).toEqual(['\u3000', '、'])
  expect(codes).toEqual([{ char: '\u3000', code: '0101' }, { char: '、', code: '0102' }])
})

test('the GK set is the standard table, not the 字統 subset', () => {
  const base = new URL('../app/public/charsets/', import.meta.url)
  const gk = JSON.parse(readFileSync(new URL('index.json', base), 'utf8')).find((/** @type {{id: string}} */ row) => row.id === 'gk')
  expect(gk.chars).toBe(5954)
  expect(gk.total).toBe(5979)
  expect([gk.encoded, gk.unencoded]).toEqual([5954, 2])
  expect(gk.positions).toEqual({ total: 8836, filled: 5979, mapped: 5977 })
  expect(gk.source.url).toBe('https://archive.org/details/GB-T12052-1989')
  const members = membersOf(readFileSync(new URL('gk.txt', base), 'utf8'))
  expect(members).toHaveLength(gk.chars)
  expect(members[0]).toBe('\u3000')
  expect(members).toContain('乫')
  expect(members.filter(member => [...member].length > 1)).toHaveLength(1718)
  const codes = membersOf(readFileSync(new URL('gk.codes.tsv', base), 'utf8'))
  expect(codes).toHaveLength(gk.chars)
  for (const position of GB12052_UNENCODED) expect(codes.some(line => line.endsWith(`\t${position}`))).toBe(false)
  expect(codes.find(line => line.startsWith('乫\t'))).toBe('乫\t7189')
})

test('a Unicode block set counts its whole block as designed positions', () => {
  const catalogue = JSON.parse(readFileSync(new URL('../app/public/charsets/index.json', import.meta.url), 'utf8'))
  const extD = catalogue.find((/** @type {{id: string}} */ row) => row.id === 'unicode_ext_d')
  expect(extD.positions).toEqual({ total: 224, filled: 223, mapped: 223 })
  const hiragana = catalogue.find((/** @type {{id: string}} */ row) => row.id === 'block_hiragana')
  expect(hiragana.positions).toEqual({ total: 96, filled: 93, mapped: 93 })
  const list = catalogue.find((/** @type {{id: string}} */ row) => row.id === 'ws2017')
  expect(list.positions).toBeUndefined()
})

test('coverage parts divide a table by its positions and a list by its characters', () => {
  expect(coverageParts({ total: 8836, filled: 5979, mapped: 5977 }, 5954, 2))
    .toEqual({ positioned: true, total: 8836, inUnicode: 5977, unencoded: 2, unassigned: 2857 })
  expect(coverageParts(null, 4385, 539))
    .toEqual({ positioned: false, total: 4924, inUnicode: 4385, unencoded: 539, unassigned: 0 })
})

test('a member file keeps a code-point sequence whole', () => {
  expect(membersOf(membersText(['가', '가ᇇ', '각']))).toEqual(['가', '가ᇇ', '각'])
  expect(membersText([])).toBe('')
})

test('a browsed row follows the code digit', () => {
  expect(columnsOf('hex')).toBe(16)
  expect(columnsOf('source')).toBe(16)
  expect(columnsOf('kuten')).toBe(10)
  expect(columnsOf('zfill4')).toBe(10)
  expect(columnsOf(undefined)).toBe(10)
})

test('filters every answer channel without changing cached results', () => {
  const answer = {
    clue: { kind: 'code', text: 'zi' }, chars: ['字', '子'], parts: ['子'], meaning: ['字', '子'],
    hits: [{ method: 'a', code: 'zi', exact: true, literal: true, chars: ['字', '子'] }, { method: 'b', code: 'z', chars: ['子'] }],
    readings: [{ n: 1, form: 'zi', chars: ['字', '子'] }, { n: 2, form: 'zi', chars: ['子'] }],
    pua: [
      { source: 'moe', slot: '\uE000', code: '', char: '字' },
      { source: 'cns', slot: '\u{F0001}', code: '19-2122', char: '' },
      { source: 'cbeta', slot: '\u{F0001}', code: 'CB00001', char: '', records: 'cbeta_gaiji' },
    ],
  }
  const filtered = filterAnswer(answer, new Set(['字']), 'cbeta_gaiji')
  expect(filtered.pua.map(reading => reading.source)).toEqual(['moe', 'cbeta'])
  expect(filtered.chars).toEqual(['字'])
  expect(filtered.meaning).toEqual(['字'])
  expect(filtered.parts).toEqual([])
  expect(filtered.hits).toHaveLength(1)
  expect(filtered.hits[0].chars).toEqual(['字'])
  expect(filtered.readings).toHaveLength(1)
  expect(filtered.readings[0].chars).toEqual(['字'])
  expect(answer.hits[0].chars).toEqual(['字', '子'])
})

test('counts the characters two listed sets share', () => {
  const base = new URL('../app/public/charsets/', import.meta.url)
  const read = id => new Set(membersOf(readFileSync(new URL(`${id}.txt`, base), 'utf8')))
  const zhuang = read('g_gzw')
  const plane15 = read('g_fkzz')
  expect(sharedCharacters(zhuang, plane15)).toBe(3590)
  expect(sharedCharacters(plane15, zhuang)).toBe(3590)
  expect(sharedCharacters(zhuang, new Set())).toBe(0)
})

test('selected literal scalars remain searchable outside the general script parser', () => {
  for (const char of ['㇀', '\u3099', 'ー', '㇀㇁']) {
    const answer = { clue: { kind: 'code', text: char }, chars: [], parts: [], meaning: [], hits: [], readings: [], pua: [] }
    expect(filterAnswer(answer, new Set([...char])).chars).toEqual([...char])
    expect(filterAnswer(answer, new Set(['字'])).chars).toEqual([])
  }
})

test('code order reads code points as numbers and other codes as source numbers', () => {
  expect(compareCodes('U+2F800', 'U+F900')).toBeGreaterThan(0)
  expect(compareCodes('U+4E00', 'U+5B57')).toBeLessThan(0)
  expect(compareCodes('1601', '8909')).toBeLessThan(0)
  expect(compareCodes('1-0289', '1-4421')).toBeLessThan(0)
  expect(compareCodes('U+2F800', 'U+F900')).toBe(-compareCodes('U+F900', 'U+2F800'))
})

test('a set code is the source index under its glyph', () => {
  expect(rowCodes([
    ['2B740', '𫝀'], ['0001', '⿰一木'], ['2B740', '𫝀'],
  ], { index: 'hex', source: 'Unicode' }, '𫝀')).toEqual([{ char: '𫝀', code: 'U+2B740' }])
  expect(rowCodes([['A440', '一']], { index: 'hex', source: 'H' }, '一')[0].code).toBe('A440')
  expect(rowCodes([['1601', '一']], { index: 'kuten' }, '一')[0].code).toBe('1601')
  expect(cnsRowCodes([{ cns: '1-4421', unicode: ['4E00', '5B57'] }], '一')).toEqual([{ char: '一', code: '1-4421' }])
  expect(evidenceCodes([{ entry: '1', char: '字' }, { entry: '2', char: '一' }], '字')).toEqual([{ char: '字', code: '1' }])
  expect(codeText([{ char: '字', code: '1-4773' }])).toBe('字\t1-4773\n')
})

test('the snapshot keeps one code per member where the set defines one', () => {
  const base = new URL('../app/public/charsets/', import.meta.url)
  const catalogue = JSON.parse(readFileSync(new URL('index.json', base), 'utf8'))
  const coded = catalogue.filter(row => row.codes)
  expect(coded.length).toBeGreaterThan(240)
  for (const row of coded) {
    const members = new Set(membersOf(readFileSync(new URL(`${row.id}.txt`, base), 'utf8')))
    const lines = readFileSync(new URL(row.codes.replace('/charsets/', ''), base), 'utf8').split('\n').filter(Boolean)
    expect(lines.length).toBeGreaterThan(0)
    const seen = new Set()
    for (const line of lines) {
      const at = line.indexOf('\t')
      const char = line.slice(0, at)
      expect(members.has(char)).toBe(true)
      expect(line.slice(at + 1)).toBeTruthy()
      expect(seen.has(char)).toBe(false)
      seen.add(char)
    }
  }
  const line = (/** @type {string} */ id, /** @type {string} */ char) => readFileSync(new URL(`${id}.codes.tsv`, base), 'utf8').split('\n').find(row => row.startsWith(`${char}\t`))
  expect(line('t1', '字')).toBe('字\t3983')
  expect(line('cns_source_f8744b5cf664', '字')).toBe('字\t1-4773')
  expect(line('hb1', '字')).toBe('字\tA672')
  expect(line('unicode_basic', '字')).toBe('字\tU+5B57')
  expect(line('ext_e_withdrawal_records', '𦱳')).toBe('𦱳\tG_K0642.17')
})

test('CNS categories preserve source labels, decimal planes and private-use evidence', () => {
  const categories = cnsSourceSets('\uFEFF11-4921\t地政\n24-2121\t醫藥\n11-4922\t地政\n1-4421\t常用(96年公布)\n', [
    '11-4921\t5B57\n11-4922\t20000\n24-2121\tF0000\n1-4421\t4E00\n',
  ])
  const land = categories.find(set => set.label === '地政')
  expect(land.members).toBe('字𠀀')
  expect(land.records.map(row => row.cns)).toEqual(['11-4921', '11-4922'])
  expect([land.encoded, land.unencoded]).toEqual([2, 0])
  const medicine = categories.find(set => set.label === '醫藥')
  expect(medicine.members).toBe('\u{F0000}')
  expect(medicine.records).toEqual([{ cns: '24-2121', unicode: ['F0000'] }])
  expect([medicine.encoded, medicine.unencoded]).toEqual([0, 1])
  expect(categories.find(set => set.label === '常用(96年公布)').members).toBe('一')
  expect(cnsSourceSets('1-4421\t常用(96年公布)', ['1-4421\t4E00'])[0].id).toBe(categories.find(set => set.label === '常用(96年公布)').id)
  expect(cnsSourceSets('11-492a\t地政', ['11-492A\t5B57'])[0].members).toBe('字')
  expect(() => cnsSourceSets('999-0000\t地政', [])).toThrow('Invalid CNS grid code')
  expect(() => cnsSourceSets('11-4921\t地政\textra', [])).toThrow('Invalid CNS table row')
  expect(() => cnsSourceSets('11-4921\t地政', ['11-4922\t110000'])).toThrow('Invalid CNS Unicode mapping')
})

test('CNS rows without an assigned scalar keep their private-use glyph slot', () => {
  const categories = cnsSourceSets('11-7E4E\t臺灣台語用字\n11-7E4F\t臺灣台語用字\n', ['11-7E4E\tFFB0F\n11-7E4F\tFFB0E\n'], new Map(), new Set([0xFFB0F, 0xFFB0E]))
  expect([...categories[0].members].map(char => char.codePointAt(0))).toEqual([0xFFB0E, 0xFFB0F])
  expect([...categories[0].members]).toHaveLength(2)
  expect([categories[0].encoded, categories[0].unencoded]).toEqual([0, 2])
})

test('Unihan kIRG_TSource fills a scalar assigned after the bulk release', () => {
  const sources = unihanTSources('U+324D6\tkIRG_TSource\tTB-7D29\nU+2B759\tkIRG_TSource\tT11-7322\n')
  expect(sources.get('TB-7D29')).toBe('324D6')
  expect(sources.get('T11-7322')).toBeUndefined()
  const categories = cnsSourceSets('11-7D29\t臺灣台語用字\n', ['11-7D29\tFFB1B\n'], sources, new Set([0x324D6, 0xFFB1B]))
  expect(categories[0].members).toBe('𲓖')
  expect(categories[0].records[0].crosswalk).toBe('324D6')
  expect([categories[0].encoded, categories[0].unencoded]).toEqual([1, 0])
})

test('snapshot covers every source catalogue and counts match unique scalars', () => {
  const base = new URL('../app/public/charsets/', import.meta.url)
  const catalogue = JSON.parse(readFileSync(new URL('index.json', base), 'utf8'))
  expect(new Set(catalogue.map(row => row.id)).size).toBe(catalogue.length)
  const sources = JSON.parse(readFileSync(new URL('sources.json', base), 'utf8'))
  const referenceIds = sources.inputs.flatMap(input => {
    const match = input.url.match(/^https:\/\/zi.tools\/api\/ma\/ma\/([^/]+)\.json$/)
    return match && match[1] !== 'metadata' ? [match[1]] : []
  })
  expect(referenceIds).toHaveLength(115)
  for (const id of referenceIds) expect(catalogue.some(row => row.id === id)).toBe(true)
  for (const input of sources.inputs) expect(input.sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(catalogue.length).toBe(281)
  expect(catalogue.find(row => row.id === 'block_seal')?.chars).toBe(11328)
  for (const id of ['irgn', 'l2', 'g_fzk', '1k8myqp9o8zxkvdpbqdhrfs6yfx5bk2t']) expect(catalogue.some(row => row.id === id)).toBe(false)
  const cns = catalogue.filter(row => row.group === 'CNS sources')
  const cnsSource = JSON.parse(readFileSync(new URL('cns-sources.json', base), 'utf8'))
  expect(cns).toHaveLength(123)
  expect(cns.reduce((sum, row) => sum + row.total, 0)).toBe(104680)
  for (const category of cnsSource.categories) {
    const set = cns.find(row => row.label === category.label)
    expect(set.total).toBe(category.count)
    const records = readFileSync(new URL(set.source.records.replace('/charsets/', ''), base), 'utf8')
    expect(records).toContain(category.sampleCns)
    expect(records).toContain('數位發展部，CNS11643中文標準交換碼全字庫網站')
  }
  const land = cns.find(row => row.label === '內政部地政用字')
  expect(land.total).toBe(3692)
  expect(land.source.url).toBe('https://www.cns11643.gov.tw/searchSY.jsp?ID=114')
  const taiwan = cns.find(row => row.label === '臺灣台語用字')
  expect(taiwan.chars).toBe(3)
  expect([taiwan.encoded, taiwan.unencoded]).toEqual([1, 2])
  expect(membersOf(readFileSync(new URL(`${taiwan.id}.txt`, base), 'utf8')).map(char => char.codePointAt(0))).toEqual([0x324D6, 0xFFB0E, 0xFFB0F])
  const isPrivateUse = point => point >= 0xE000 && point <= 0xF8FF || point >= 0xF0000 && point <= 0xFFFFD || point >= 0x100000 && point <= 0x10FFFD
  const idsSets = catalogue.filter(row => row.records)
  expect(idsSets.length).toBeGreaterThan(40)
  const gzhs = catalogue.find(row => row.id === 'gzhs')
  expect(gzhs.records.count).toBeGreaterThan(1000)
  const idsFile = JSON.parse(readFileSync(new URL(gzhs.records.file.replace('/charsets/', ''), base), 'utf8'))
  expect(idsFile.records).toHaveLength(gzhs.records.count)
  expect(idsFile.records[0].kind).toBe('ids')
  const ziSets = catalogue.filter(row => row.source.name === '字統網')
  expect(ziSets).toHaveLength(114)
  const ziPages = {
    g0: 'https://zi.tools/?secondary=character_set&set=G0',
    swjz: 'https://zi.tools/?secondary=character_set&set=zhuan',
  }
  for (const row of ziSets) {
    // The source link opens the set on zi.tools; its Shuowen view opens as 篆/zhuan, and the
    // endpoint that supplied the rows stays beside it.
    expect(row.source.url).toBe(ziSourcePage({ id: row.id, abbr: row.label }))
    expect(row.source.dataUrl).toBe(`https://zi.tools/api/ma/ma/${row.id}.json`)
    expect(sources.inputs.some(input => input.url === row.source.dataUrl)).toBe(true)
  }
  for (const [id, url] of Object.entries(ziPages)) expect(ziSets.find(row => row.id === id).source.url).toBe(url)
  for (const row of catalogue) {
    const members = membersOf(readFileSync(new URL(`${row.id}.txt`, base), 'utf8'))
    expect(new Set(members).size).toBe(row.chars)
    expect(members.length).toBe(row.chars)
    expect(row.source.url).toMatch(/^https:\/\//)
    expect(Number.isInteger(row.encoded)).toBe(true)
    expect(Number.isInteger(row.unencoded)).toBe(true)
    // IWDS counts entries for `total`, not example characters.
    if (row.id !== 'iwds') expect(row.encoded + row.unencoded).toBeLessThanOrEqual(row.total)
    if (row.group === 'CNS sources') {
      const lines = readFileSync(new URL(row.source.records.replace('/charsets/', ''), base), 'utf8').split('\n').filter(line => line && !line.startsWith('#')).slice(1)
      let encoded = 0
      let unencoded = 0
      for (const line of lines) {
        const points = (line.split('\t')[1] ?? '').split(/\s+/).filter(Boolean).map(token => parseInt(token.slice(2), 16))
        if (points.some(point => !isPrivateUse(point))) encoded++
        else unencoded++
      }
      expect([row.encoded, row.unencoded]).toEqual([encoded, unencoded])
    }
  }
  expect(catalogue.find(row => row.id === 'unicode_comp_a_tentative').chars).toBe(0)
  const iwds = catalogue.find(row => row.id === 'iwds')
  expect([iwds.encoded, iwds.unencoded]).toEqual([iwds.chars, 0])
  expect(readFileSync(new URL('unicode_ext_e.txt', base), 'utf8')).toContain('𫠠')
  expect(readFileSync(new URL('t1.txt', base), 'utf8')).toContain('字')
  for (const file of readdirSync(base).filter(name => name.endsWith('_records.json'))) {
    const records = JSON.parse(readFileSync(new URL(file, base), 'utf8'))
    const set = catalogue.find(row => row.records?.file === `/charsets/${file}`)
    expect(set).toBeTruthy()
    expect(set.id).toBe(records.id)
    expect(set.total).toBe(records.records.length)
    expect(set.records.count).toBe(records.records.length)
    const glyphs = records.records.filter(record => record.glyph || record.sprite || record.atlas)
    expect(set.records.glyphs).toBe(glyphs.length)
    const glyphSerials = glyphs.map(record => record.serial).filter(Boolean)
    expect(new Set(glyphSerials).size).toBe(glyphSerials.length)
    expect(new Set(glyphs.map(record => record.source)).size).toBe(glyphs.length)
    for (const record of records.records.filter(record => record.glyph)) {
      const png = readFileSync(new URL(record.glyph, base))
      expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      // The Macao Extension E document prints some glyphs in 36–45px boxes; the snapshot keeps
      // the source's own size, so a small box is not a defect.
      expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(32)
      expect(png.readUInt32BE(20)).toBeGreaterThanOrEqual(32)
    }
    for (const record of records.records.filter(record => record.sprite).slice(0, 8)) {
      const sprite = readFileSync(new URL(`ebag-sprites/${record.sprite.sheet}.svg`, base), 'utf8')
      expect(sprite).toContain(`id="${record.sprite.symbol}"`)
    }
    const members = membersOf(readFileSync(new URL(`${set.id}.txt`, base), 'utf8'))
    expect(members.length).toBe(set.chars)
    expect(new Set(members).size).toBe(set.chars)
    expect(new Set(members)).toEqual(new Set(records.records.filter(record => record.mappedUnicode).map(record => String.fromCodePoint(parseInt(record.mappedUnicode.slice(2), 16)))))
  }
  const ebag = catalogue.find(row => row.id === 'glyphwiki_ebag')
  expect(ebag.group).toBe('GlyphWiki')
  expect(ebag.chars).toBe(0)
  expect(ebag.total).toBe(24359)
  expect(ebag.records).toEqual({ file: '/charsets/glyphwiki_ebag_records.json', count: 24359, glyphs: 24356 })
  const ebagRecords = JSON.parse(readFileSync(new URL('glyphwiki_ebag_records.json', base), 'utf8'))
  expect(new Set(ebagRecords.records.map(record => record.source)).size).toBe(24359)
  expect(ebagRecords.records.filter(record => record.sprite)).toHaveLength(24356)
  expect(ebagRecords.records.filter(record => !record.sprite).map(record => record.source)).toEqual(['ebag_s030-528', 'ebag_s042-022', 'ebag_s085-350'])
  expect(ebagRecords.records.every(record => record.source.startsWith('ebag_'))).toBe(true)
  expect(ebagRecords.records.every(record => record.evidenceUrls?.[0] === `https://glyphwiki.org/wiki/${record.source}`)).toBe(true)
  const ebagSource = JSON.parse(readFileSync(new URL('glyphwiki_ebag_source.json', base), 'utf8'))
  expect(ebagSource.dump.sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(ebagSource.dump.url).toBe('https://glyphwiki.org/dump.tar.gz')
  const cbeta = catalogue.find(row => row.id === 'cbeta_gaiji')
  expect(cbeta.group).toBe('CBETA')
  expect([cbeta.chars, cbeta.total, cbeta.encoded, cbeta.unencoded]).toEqual([16607, 31935, 16607, 15328])
  expect(cbeta.records).toEqual({ file: '/charsets/cbeta_gaiji_records.json', count: 31935, glyphs: 28388, search: true })
  const cbetaRecords = JSON.parse(readFileSync(new URL('cbeta_gaiji_records.json', base), 'utf8'))
  expect(cbetaRecords.records.every(record => /^CB\d{5}$/.test(record.source) && (record.composition || record.status))).toBe(true)
  expect(cbetaRecords.records.filter(record => record.status)).toHaveLength(271)
  expect(cbetaRecords.records.some(record => record.mappedUnicode && record.similarUnicode)).toBe(false)
  const cells = new Set(cbetaRecords.records.filter(record => record.atlas).map(record => `${record.atlas.sheet}#${record.atlas.cell}`))
  expect(cells.size).toBe(28388)
  for (const record of cbetaRecords.records.filter(record => record.atlas)) expect(record.atlas.cell).toBeLessThan(256)
  for (const sheet of new Set(cbetaRecords.records.filter(record => record.atlas).map(record => record.atlas.sheet))) {
    expect(readFileSync(new URL(sheet, base)).subarray(1, 4).toString()).toBe('PNG')
  }
  const cbetaCodes = readFileSync(new URL('cbeta_gaiji.codes.tsv', base), 'utf8').trim().split('\n')
  expect(cbetaCodes[0]).toBe('欵\tCB00001')
  const cbetaSource = JSON.parse(readFileSync(new URL('cbeta_gaiji_source.json', base), 'utf8'))
  expect(Object.values(cbetaSource).map(input => input.url)).toEqual([
    'https://raw.githubusercontent.com/cbeta-org/cbeta_gaiji/857156a6d9f37a020d34099447b51a0b72264620/cbeta_gaiji.json',
    'https://codeload.github.com/cbeta-org/gaiji-CB/tar.gz/e402e97cf0065bd3f13854c0b1c92efe23f859c1',
    'file:cbeta-workbooks/CBETA難字庫.xlsx',
    'file:cbeta-workbooks/CBETA難字庫IDS版_1.2.xlsx',
  ])
  const sat = catalogue.find(row => row.id === 'ext_f_sat_withdrawals')
  expect(sat.group).toBe('Proposals')
  expect(sat.chars).toBe(0)
  expect(sat.total).toBe(64)
  expect(sat.records).toEqual({ file: '/charsets/ext_f_sat_records.json', count: 64, glyphs: 64 })
  const pdam5 = catalogue.find(row => row.id === 'ext_c_pdam5_removals')
  expect(pdam5.group).toBe('Proposals')
  expect(pdam5.chars).toBe(0)
  expect(pdam5.total).toBe(67)
  expect(pdam5.records).toEqual({ file: '/charsets/ext_c_pdam5_records.json', count: 67, glyphs: 67 })
  const tWithdrawals = catalogue.find(row => row.id === 'ext_d_withdrawals_1306')
  expect(tWithdrawals.group).toBe('Proposals')
  expect(tWithdrawals.chars).toBe(0)
  expect(tWithdrawals.total).toBe(6545)
  expect([tWithdrawals.encoded, tWithdrawals.unencoded]).toEqual([0, 6545])
  expect(tWithdrawals.records).toEqual({ file: '/charsets/ext_d_withdrawals_1306_records.json', count: 6545, glyphs: 0 })
  const tRecords = JSON.parse(readFileSync(new URL('ext_d_withdrawals_1306_records.json', base), 'utf8'))
  expect(tRecords.records).toHaveLength(6545)
  expect(tRecords.records.every(record => record.document === 'n1306' && !record.glyph)).toBe(true)
  expect(new Set(tRecords.records.map(record => record.sequence)).size).toBe(6545)
  expect(Math.min(...tRecords.records.map(record => Number(record.sequence)))).toBe(1)
  expect(Math.max(...tRecords.records.map(record => Number(record.sequence)))).toBe(6545)
  expect(new Set(tRecords.records.map(record => record.serial)).size).toBe(6544)
  expect(tRecords.records.filter(record => record.serial === '13129')).toHaveLength(2)
  expect(tRecords.records.filter(record => record.source === 'TC-5229')).toHaveLength(2)
  expect(tRecords.records.filter(record => record.source === 'TD-4F5C')).toHaveLength(2)
  const extA = catalogue.find(row => row.id === 'ext_a_j_removals')
  expect(extA.group).toBe('Proposals')
  expect(extA.chars).toBe(0)
  expect(extA.total).toBe(1)
  expect([extA.encoded, extA.unencoded]).toEqual([0, 1])
  expect(extA.records).toEqual({ file: '/charsets/ext_a_j_records.json', count: 1, glyphs: 0 })
  const extARecords = JSON.parse(readFileSync(new URL('ext_a_j_records.json', base), 'utf8'))
  expect(extARecords.records).toEqual([{ source: 'A-2360', document: 'n0424', page: 1 }])
  const unc = catalogue.find(row => row.id === 'unc_utc_withdrawals')
  expect(unc.group).toBe('Proposals')
  expect(unc.chars).toBe(0)
  expect(unc.total).toBe(16)
  expect([unc.encoded, unc.unencoded]).toEqual([0, 16])
  expect(unc.records).toEqual({ file: '/charsets/unc_utc_withdrawals_records.json', count: 16, glyphs: 16 })
  expect(unc.source.url).toBe('https://www.unicode.org/irg/docs/n1525-UNC-UTC-Withdraw.pdf')
  const uncRecords = JSON.parse(readFileSync(new URL('unc_utc_withdrawals_records.json', base), 'utf8'))
  expect(uncRecords.records).toHaveLength(16)
  expect(new Set(uncRecords.records.map(record => record.source)).size).toBe(16)
  expect(uncRecords.records.every(record => record.document === 'n1525' && record.page === 1 && record.glyph)).toBe(true)
  expect(uncRecords.records.some(record => record.serial)).toBe(false)
  expect(uncRecords.records.map(record => record.source)).not.toContain('UTC00855')
  expect(readFileSync(new URL('unc_utc_withdrawals.txt', base), 'utf8')).toBe('')
  const macao = catalogue.find(row => row.id === 'ext_e_macao_missing')
  expect(macao.group).toBe('Proposals')
  expect(macao.chars).toBe(0)
  expect(macao.total).toBe(20)
  expect(macao.records).toEqual({ file: '/charsets/ext_e_macao_records.json', count: 20, glyphs: 20 })
  const f1 = catalogue.find(row => row.id === 'ext_f1_sat_drops')
  expect(f1.group).toBe('Proposals')
  expect(f1.chars).toBe(0)
  expect(f1.total).toBe(50)
  expect(f1.records).toEqual({ file: '/charsets/ext_f1_sat_records.json', count: 50, glyphs: 0 })
  const jmj = catalogue.find(row => row.id === 'ext_f_jmj_withdrawals')
  expect(jmj.group).toBe('Proposals')
  expect(jmj.chars).toBe(0)
  expect(jmj.total).toBe(26)
  expect(jmj.records).toEqual({ file: '/charsets/ext_f_jmj_records.json', count: 26, glyphs: 26 })
  const removal = catalogue.find(row => row.id === 'ext_d_removals')
  expect(removal.group).toBe('Proposals')
  expect(removal.chars).toBe(0)
  expect(removal.total).toBe(78)
  expect(removal.records).toEqual({ file: '/charsets/ext_d_records.json', count: 78, glyphs: 78 })
  const vWithdrawals = catalogue.find(row => row.id === 'ext_d_v_withdrawals')
  expect(vWithdrawals.group).toBe('Proposals')
  expect(vWithdrawals.chars).toBe(0)
  expect(vWithdrawals.total).toBe(107)
  expect(vWithdrawals.records).toEqual({ file: '/charsets/ext_d_v_records.json', count: 107, glyphs: 0 })
  const vRecords = JSON.parse(readFileSync(new URL('ext_d_v_records.json', base), 'utf8'))
  expect(new Set(vRecords.records.map(record => record.serial)).size).toBe(107)
  expect(new Set(vRecords.records.map(record => record.source)).size).toBe(107)
  const c1Withdrawal = catalogue.find(row => row.id === 'ext_c1_jmk_withdrawals')
  expect(c1Withdrawal.group).toBe('Proposals')
  expect(c1Withdrawal.chars).toBe(0)
  expect(c1Withdrawal.total).toBe(1)
  expect(c1Withdrawal.records).toEqual({ file: '/charsets/ext_c1_jmk_withdrawals_records.json', count: 1, glyphs: 0 })
  const c1Records = JSON.parse(readFileSync(new URL('ext_c1_jmk_withdrawals_records.json', base), 'utf8'))
  expect(c1Records.records).toHaveLength(1)
  expect(c1Records.records[0]).toMatchObject({ serial: '08772', source: 'JMK65904', document: 'n1198' })
  expect(c1Records.records[0].glyph).toBeUndefined()
  const gWithdrawals = catalogue.find(row => row.id === 'ext_d_g_withdrawals')
  expect(gWithdrawals.group).toBe('Proposals')
  expect(gWithdrawals.chars).toBe(0)
  expect(gWithdrawals.total).toBe(3215)
  expect(gWithdrawals.records).toEqual({ file: '/charsets/ext_d_g_records.json', count: 3215, glyphs: 3215 })
  const gRecords = JSON.parse(readFileSync(new URL('ext_d_g_records.json', base), 'utf8'))
  expect(new Set(gRecords.records.map(record => record.serial)).size).toBe(3215)
  expect(new Set(gRecords.records.map(record => record.source)).size).toBe(3215)
  expect(new Set(gRecords.records.map(record => record.page))).toEqual(new Set(Array.from({ length: 25 }, (_, index) => index + 2)))
  const proposals = JSON.parse(readFileSync(new URL('ext_e_records.json', base), 'utf8'))
  expect(proposals.complete).toBe(false)
  const n1841 = proposals.records.filter(record => record.document === 'n1841')
  expect(n1841).toHaveLength(134)
  expect(new Set(n1841.map(record => record.serial)).size).toBe(134)
  expect(new Set(n1841.map(record => record.source)).size).toBe(134)
  expect(proposals.records.filter(record => !record.glyph).map(record => record.source ?? record.serial)).toEqual(['V04-486A', 'G_K0642.17', '06721', '06728'])
  const entry = catalogue.find(row => row.id === 'ext_e_withdrawal_records')
  expect(entry.group).toBe('Proposals')
  expect(entry.chars).toBe(3)
  expect(entry.total).toBe(138)
  expect([entry.encoded, entry.unencoded]).toEqual([3, 135])
  expect(entry.records).toEqual({ file: '/charsets/ext_e_records.json', count: 138, glyphs: 134 })
  const mapped = new Set(membersOf(readFileSync(new URL('ext_e_withdrawal_records.txt', base), 'utf8')))
  expect(mapped).toEqual(new Set(['𦱳', String.fromCodePoint(0x2AC66), String.fromCodePoint(0x2AC69)]))
  expect(mapped.has('薓')).toBe(false) // A corrected proposal glyph is not an attested crosswalk.
  expect(readFileSync(new URL('block_nushu.txt', base), 'utf8')).toContain('𛅰')
})

const original = globalThis.fetch
afterEach(() => { globalThis.fetch = original })
test('failed catalogue and payload loads can be retried', async () => {
  globalThis.fetch = async () => new Response('unavailable', { status: 503 })
  await expect(loadCharsets()).rejects.toThrow()
  globalThis.fetch = async () => Response.json([{ id: 'test', names: { en: 'Test' }, chars: 1 }, { id: 'rec', names: { en: 'Records' }, chars: 0, total: 2, records: { file: '/charsets/rec.json', count: 2, glyphs: 1 } }])
  await loadCharsets()
  globalThis.fetch = async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })
  await expect(loadCharset('test')).rejects.toThrow()
  globalThis.fetch = async () => new Response('字')
  expect([...(await loadCharset('test'))]).toEqual(['字'])
  await expect(loadCharset('../bad')).rejects.toThrow('Unknown character set')
})

test('printed records load only for a set that declares them and fail closed', async () => {
  await expect(loadRecords('test')).rejects.toThrow('No records')
  globalThis.fetch = async () => Response.json({ title: 'Records', complete: false, scope: '', documents: [], records: [{ document: 'n', serial: '1' }] })
  await expect(loadRecords('rec')).rejects.toThrow('Incomplete')
  globalThis.fetch = async () => Response.json({ title: 'Records', complete: false, scope: '', documents: [], records: [{ document: 'n', serial: '1' }, { document: 'n', serial: '2' }] })
  expect((await loadRecords('rec')).records).toHaveLength(2)
})

test('search-data failures release caches for the Find retry button', async () => {
  globalThis.fetch = async () => new Response('Unavailable', { status: 503 })
  await expect(loadChars()).rejects.toThrow('Search data unavailable')
  globalThis.fetch = async () => new Response('字\t1\t6\t39.3')
  expect((await loadChars()).get('字')?.strokes).toBe(6)
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  await expect(findMeaning('retry-fixture')).rejects.toThrow('Failed to fetch')
  globalThis.fetch = async () => new Response('retry-fixture\t字')
  expect(await findMeaning('retry-fixture')).toEqual(['字'])
})
