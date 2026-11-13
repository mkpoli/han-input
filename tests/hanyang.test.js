import { describe, expect, test } from 'bun:test'
import { parseHanyang } from '../scripts/import_pua_hanyang.mjs'
import { loadPua } from '../src/pua.js'

const pua = await loadPua()

describe('Hanyang import', () => {
  test('reads the object literal', () => {
    expect(parseHanyang('"use strict";\nexports.default = {"\\ue0bc": "\\u115f\\u1161\\u11ae"};')).toEqual({ '\uE0BC': '\u115F\u1161\u11AE' })
  })
  test('keeps the table and its provenance', () => {
    expect(Object.keys(pua.scheme('hanyang').mappings)).toHaveLength(5661)
    expect(pua.scheme('hanyang').source.sha256).toBe('6f7b71bc8a22bb3fcffb7a420c1282e555501db4f84cbeeb7d6c227529db7be9')
  })
  test('converts jamo sequences and does not feed the character lookup', () => {
    expect(pua.convert('\uE0BD', 'hanyang')).toEqual({ text: '\u115F\u1161\uD7CD', converted: 1, unmapped: 0, ambiguous: 0, conflicts: [] })
    expect(pua.convert('\uE0BC', 'all')).toMatchObject({ text: '\uE0BC', converted: 0, unmapped: 0, ambiguous: 1 })
    expect(pua.chars('E0BC')).toEqual([{ char: '𡉏', source: 'hkscs' }])
  })
})
