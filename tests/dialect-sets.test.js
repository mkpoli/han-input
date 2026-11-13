import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fangyanziRows, openIdsRows, writeDialectSets } from '../scripts/sources/charsets-dialect.mjs'

const base = new URL('../app/public/charsets/', import.meta.url)
const members = (/** @type {string} */ id) => new Set(readFileSync(new URL(`${id}.txt`, base), 'utf8').split('\n').filter(Boolean))

test('a dialect set keeps the strict tier and leaves ordinary characters out', () => {
  expect(members('dialect_yue')).toContain('嘅')
  expect(members('dialect_yue')).toContain('咗')
  expect(members('dialect_guan')).toContain('甭')
  expect(members('dialect_wu')).toContain('嫑')
  expect(members('dialect_wu')).toContain('㬟')
  // 乞 and 比 sit only in the broad tier, which gives ordinary characters a dialect sense.
  expect(members('dialect_hakka').has('乞')).toBe(false)
  expect(members('dialect_wu').has('比')).toBe(false)
})

test('the Min sets split by where the list reads each row', () => {
  const min = members('dialect_min')
  for (const id of ['dialect_min_dong', 'dialect_min_nan']) for (const char of members(id)) expect(min).toContain(char)
  expect(members('dialect_min_dong')).toContain('乇')
})

test('a row with only an IDS becomes a record, never a member', () => {
  const rows = fangyanziRows([
    { type: '嚴式', char: '', ids: '⿱十八', group: ['吴'], pinyin: { 金華: 'tɛ' } },
    { type: '寬式', char: '比', group: ['吳'], pinyin: {} },
  ])
  expect(rows).toEqual([{ char: '', ids: '⿱十八', group: ['吳'], cities: ['金華'] }])
  const gukja = openIdsRows('ids\tchar\tcodepoint\tgroup\n⿱加乙\t乫\tU+4E6B\tkorean\n⿱乙丁\t\t\tkorean\n⿰土下\t圷\tU+5737\tkokuji\n', 'korean')
  expect(gukja.map(row => row.char || row.ids)).toEqual(['乫', '⿱乙丁'])
  const catalogue = JSON.parse(readFileSync(new URL('index.json', base), 'utf8'))
  const gukjaSet = catalogue.find((/** @type {{id: string}} */ row) => row.id === 'dialect_gukja')
  expect(gukjaSet.unencoded).toBe(gukjaSet.records.count)
})

test('a dialect set counts every source row, repeated characters included', () => {
  const out = mkdtempSync(join(tmpdir(), 'dialect-'))
  const rows = [
    { type: '嚴式', char: '乜', group: ['粵'], pinyin: { 廣州: 'mɐt' } },
    { type: '嚴式', char: '乜', group: ['粵'], pinyin: { 廣州: 'mɛ' } },
    { type: '嚴式', char: '', ids: '⿰口乜', group: ['粵'], pinyin: { 廣州: 'x' } },
    ...['官', '晉', '吳', '徽', '贛', '湘', '客', '平'].map(group => ({ type: '嚴式', char: '甭', group: [group], pinyin: {} })),
    { type: '嚴式', char: '乇', group: ['閩'], pinyin: { 福州: 'noʔ', 廈門: 'x' } },
  ]
  const openIds = 'ids\tchar\tcodepoint\tgroup\n⿰土下\t圷\tU+5737\tkokuji\n⿱加乙\t乫\tU+4E6B\tkorean\n'
  const catalogue = /** @type {any[]} */ ([])
  writeDialectSets(catalogue, { fangyanzi: rows, openIds }, out, text => text)
  const yue = catalogue.find(row => row.id === 'dialect_yue')
  expect([yue.chars, yue.unencoded, yue.total]).toEqual([1, 1, 3])
  rmSync(out, { recursive: true })
})
