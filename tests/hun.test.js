import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { hunRows } from '../scripts/sources/hun.mjs'
import { groupHun } from '../app/lib/hun.js'

const doc = JSON.parse(readFileSync(new URL('../app/public/hun/readings.json', import.meta.url), 'utf8'))

test('keeps only headwords marked 替, with the reading, other characters and first gloss', () => {
  const rows = hunRows([
    { 漢字: '一【替】', 羅馬字: 'tsi̍t', 異用字: [{ 漢字: '一', 異用字: '蜀' }, { 漢字: '一', 異用字: '蜀' }], 義項: [{ 解說: '數目。' }], 詞目id: '1', 網址: 'u' },
    { 漢字: '一', 羅馬字: 'it', 異用字: [], 義項: [{ 解說: 'not a replacement' }], 詞目id: '2', 網址: 'v' },
    { 漢字: '二【替】', 羅馬字: '', 異用字: [], 義項: [], 詞目id: '3', 網址: 'w' },
    { 漢字: '二【替】三', 羅馬字: 'x', 異用字: [], 義項: [], 詞目id: '4', 網址: 'x' },
    { 漢字: '二【替】', 羅馬字: 'nn̄g', 義項: [], 詞目id: '5', 網址: 'y' },
  ])
  expect(rows).toEqual([
    { char: '一', reading: 'tsi̍t', benzi: ['蜀'], gloss: '數目。', id: '1', url: 'u' },
    { char: '二', reading: 'nn̄g', benzi: [], gloss: '', id: '5', url: 'y' },
  ])
})

test('the committed list holds every 替 headword in the pinned dictionary', () => {
  expect(doc.source.name).toBe('教育部《臺灣台語常用詞辭典》')
  expect(doc.rows.length).toBe(999)
  expect(new Set(doc.rows.map(row => row.char)).size).toBe(914)
  expect(doc.rows.find(row => row.char === '一' && row.reading === 'tsi̍t')).toMatchObject({ benzi: ['蜀'], gloss: '數目。' })
  expect(doc.rows.find(row => row.char === '肉' && row.reading === 'bah')).toMatchObject({ benzi: [], gloss: '動物體中介於皮和骨骼之間的柔韌組織。' })
  expect(doc.rows.every(row => [...row.char].length === 1 && row.reading)).toBe(true)
})

test('groups rows by character in dictionary order and keeps every reading', () => {
  const hun = groupHun(doc)
  expect(hun.entries.length).toBe(914)
  expect(hun.entries[0].char).toBe('一')
  expect(hun.byChar.get('奶').rows.map(row => row.reading)).toEqual(['ling/ni', 'nai', 'ne'])
})
