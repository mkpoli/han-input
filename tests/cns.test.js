import { describe, expect, test } from 'bun:test'
import { parseCns } from '../scripts/import_pua_cns.mjs'
import { CNS_PUA, convertPua, puaChars } from '../src/pua.js'

describe('CNS import', () => {
  test('crosses a PUA code with the T source', () => {
    const table = '7-6662 FFB40\n9-7537 FFB41'
    const irg = 'U+2CF02\tkIRG_TSource\tt7-6662\nU+2E2B8\tkIRG_TSource\tt9-7537'
    expect(parseCns(table, irg)).toEqual({ '\u{FFB40}': '𬼂', '\u{FFB41}': '𮊸' })
  })
  test('keeps the table and its provenance', () => {
    expect(Object.keys(CNS_PUA.mappings)).toHaveLength(516)
    expect(CNS_PUA.source.sha256).toBe('baf46bb1606872b59ad90e580e0d729d250a1bc3ff3c9f9d47ef8b7e89e73893')
  })
  test('converts and resolves a CNS PUA code', () => {
    expect(convertPua('\u{F8FBA}', 'cns')).toEqual({ text: '𳄹', converted: 1, unmapped: 0, ambiguous: 0, conflicts: [] })
    expect(puaChars('F8FBA')).toEqual([{ char: '𳄹', source: 'cns' }])
  })
})
