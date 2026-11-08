import { describe, test, expect, afterEach } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { mappedMembers, iwdsMembers, scalarExpressions } from '../scripts/charset-members.mjs'
import { filterAnswer, loadCharsets, loadCharset } from '../app/lib/charsets.js'
import { loadChars, findMeaning } from '../app/lib/data.js'
import { cnsSourceSets, unihanTSources } from '../scripts/sources/charsets-cns.mjs'

describe('source glyph membership', () => {
  test('uses glyphs, never local draft slots or IDS operands', () => {
    expect(mappedMembers({ rows: [
      ['2FA20', '⿱一木', {}], ['00001', '字', {}], ['00002', '𠀀', {}],
      ['00003', '字', {}], ['00004', '\uE000', {}], ['00005', '字\u{E0100}', {}], ['2FADC', 'リ', {}],
    ] })).toEqual({ members: 'リ字𠀀', total: 7 })
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
  })
})

test('filters every answer channel without changing cached results', () => {
  const answer = {
    clue: { kind: 'code', text: 'zi' }, chars: ['字', '子'], parts: ['子'], meaning: ['字', '子'],
    hits: [{ method: 'a', code: 'zi', exact: true, literal: true, chars: ['字', '子'] }, { method: 'b', code: 'z', chars: ['子'] }],
    readings: [{ n: 1, form: 'zi', chars: ['字', '子'] }, { n: 2, form: 'zi', chars: ['子'] }],
  }
  const filtered = filterAnswer(answer, new Set(['字']))
  expect(filtered.chars).toEqual(['字'])
  expect(filtered.meaning).toEqual(['字'])
  expect(filtered.parts).toEqual([])
  expect(filtered.hits).toHaveLength(1)
  expect(filtered.hits[0].chars).toEqual(['字'])
  expect(filtered.readings).toHaveLength(1)
  expect(filtered.readings[0].chars).toEqual(['字'])
  expect(answer.hits[0].chars).toEqual(['字', '子'])
})

test('selected literal scalars remain searchable outside the general script parser', () => {
  for (const char of ['㇀', '\u3099', 'ー', '㇀㇁']) {
    const answer = { clue: { kind: 'code', text: char }, chars: [], parts: [], meaning: [], hits: [], readings: [] }
    expect(filterAnswer(answer, new Set([...char])).chars).toEqual([...char])
    expect(filterAnswer(answer, new Set(['字'])).chars).toEqual([])
  }
})

test('CNS categories preserve source labels, decimal planes and private-use evidence', () => {
  const categories = cnsSourceSets('\uFEFF11-4921\t地政\n24-2121\t醫藥\n11-4922\t地政\n1-4421\t常用(96年公布)\n', [
    '11-4921\t5B57\n11-4922\t20000\n24-2121\tF0000\n1-4421\t4E00\n',
  ])
  const land = categories.find(set => set.label === '地政')
  expect(land.members).toBe('字𠀀')
  expect(land.records.map(row => row.cns)).toEqual(['11-4921', '11-4922'])
  const medicine = categories.find(set => set.label === '醫藥')
  expect(medicine.members).toBe('\u{F0000}')
  expect(medicine.records).toEqual([{ cns: '24-2121', unicode: ['F0000'] }])
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
})

test('Unihan kIRG_TSource fills a scalar assigned after the bulk release', () => {
  const sources = unihanTSources('U+324D6\tkIRG_TSource\tTB-7D29\nU+2B759\tkIRG_TSource\tT11-7322\n')
  expect(sources.get('TB-7D29')).toBe('324D6')
  expect(sources.get('T11-7322')).toBeUndefined()
  const categories = cnsSourceSets('11-7D29\t臺灣台語用字\n', ['11-7D29\tFFB1B\n'], sources, new Set([0x324D6, 0xFFB1B]))
  expect(categories[0].members).toBe('𲓖')
  expect(categories[0].records[0].crosswalk).toBe('324D6')
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
  expect(referenceIds).toHaveLength(119)
  for (const id of referenceIds) expect(catalogue.some(row => row.id === id)).toBe(true)
  for (const input of sources.inputs) expect(input.sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(catalogue.length).toBe(257)
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
  expect([...readFileSync(new URL(`${taiwan.id}.txt`, base), 'utf8')].map(char => char.codePointAt(0))).toEqual([0x324D6, 0xFFB0E, 0xFFB0F])
  for (const row of catalogue) {
    const members = [...readFileSync(new URL(`${row.id}.txt`, base), 'utf8')]
    expect(new Set(members).size).toBe(row.chars)
    expect(members.length).toBe(row.chars)
    expect(row.source.url).toMatch(/^https:\/\//)
  }
  expect(catalogue.find(row => row.id === 'unicode_comp_a_tentative').chars).toBe(0)
  expect(readFileSync(new URL('unicode_ext_e.txt', base), 'utf8')).toContain('𫠠')
  expect(readFileSync(new URL('t1.txt', base), 'utf8')).toContain('字')
  const withdrawals = JSON.parse(readFileSync(new URL('ext_e_records.json', base), 'utf8'))
  expect(withdrawals.complete).toBe(false)
  expect(withdrawals.n1841.rows).toHaveLength(134)
  expect(new Set(withdrawals.n1841.rows.map(row => row.source)).size).toBe(134)
  const mapped = new Set([...readFileSync(new URL('ext_e_withdrawal_records.txt', base), 'utf8')])
  expect(mapped).toEqual(new Set(['𦱳', String.fromCodePoint(0x2AC66), String.fromCodePoint(0x2AC69)]))
  expect(mapped.has('薓')).toBe(false) // A corrected proposal glyph is not an attested crosswalk.
  expect(readFileSync(new URL('block_nushu.txt', base), 'utf8')).toContain('𛅰')
})

const original = globalThis.fetch
afterEach(() => { globalThis.fetch = original })
test('failed catalogue and payload loads can be retried', async () => {
  globalThis.fetch = async () => new Response('unavailable', { status: 503 })
  await expect(loadCharsets()).rejects.toThrow()
  globalThis.fetch = async () => Response.json([{ id: 'test', names: { en: 'Test' }, chars: 1 }])
  await loadCharsets()
  globalThis.fetch = async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })
  await expect(loadCharset('test')).rejects.toThrow()
  globalThis.fetch = async () => new Response('字')
  expect([...(await loadCharset('test'))]).toEqual(['字'])
  await expect(loadCharset('../bad')).rejects.toThrow('Unknown character set')
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
