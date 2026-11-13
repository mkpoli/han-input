import { describe, expect, test } from 'bun:test'
import { parseGb18030 } from '../scripts/import_pua_gb18030.mjs'
import { loadPua } from '../src/pua.js'

const pua = await loadPua()

describe('GB 18030 import', () => {
  test('reads the three-column rows', () => {
    expect(parseGb18030('  0xA6D9 -> U+E78D -> U+FE10\n  0xFE51 -> U+E816 -> U+20087\n')).toEqual({ '\uE78D': '\uFE10', '\uE816': '\u{20087}' })
  })
  test('keeps the table and its provenance', () => {
    expect(Object.keys(pua.scheme('gb18030').mappings)).toHaveLength(24)
    expect(pua.scheme('gb18030').source.sha256).toBe('eef77189966159ee82e1207856c86a0b36818dfb7b61bd7462bfeea0bd88a3f3')
  })
  test('converts and resolves a GB 18030 PUA code', () => {
    expect(pua.convert('\uE78D', 'gb18030')).toEqual({ text: '\uFE10', converted: 1, unmapped: 0, ambiguous: 0, conflicts: [] })
    expect(pua.chars('E78E')).toEqual([{ char: '\uFE12', source: 'gb18030' }])
  })
})
