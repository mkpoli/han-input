import { describe, expect, test } from 'bun:test'
import { parseCns } from '../scripts/import_pua_cns.mjs'
import { loadPua, loadPuaCodes, readingsOf, slotsOfCode } from '../src/pua.js'

const pua = await loadPua()
const codes = await loadPuaCodes()

describe('CNS import', () => {
  test('crosses a PUA code with the T source', () => {
    const table = '7-6662 FFB40\n9-7537 FFB41\n15-2D5F FFFE1\n1-4421 4E00'
    const irg = 'U+2CF02\tkIRG_TSource\tt7-6662\nU+2E2B8\tkIRG_TSource\tt9-7537'
    expect(parseCns(table, irg)).toEqual({
      mappings: { '\u{FFB40}': '𬼂', '\u{FFB41}': '𮊸' },
      codes: { '\u{FFB40}': '7-6662', '\u{FFB41}': '9-7537', '\u{FFFE1}': '15-2D5F' },
    })
  })
  test('keeps the table and its provenance', () => {
    expect(Object.keys(pua.scheme('cns').mappings)).toHaveLength(516)
    expect(pua.scheme('cns').source.sha256).toBe('4502fcf7b433d679dee51127298929543ec7f4aa99be93cd219df1552bc3d2bf')
    expect(Object.keys(codes.get('cns'))).toHaveLength(20659)
  })
  test('converts and resolves a CNS PUA code', () => {
    expect(pua.convert('\u{F8FBA}', 'cns')).toEqual({ text: '𳄹', converted: 1, unmapped: 0, ambiguous: 0, conflicts: [] })
    expect(pua.chars('F8FBA')).toEqual([{ char: '𳄹', source: 'cns' }])
  })
})

describe('schemes that share a slot', () => {
  test('keep a CNS row and a CBETA code apart', () => {
    expect(readingsOf(pua, codes, '\u{F0015}')).toEqual([
      { source: 'cns', slot: '\u{F0015}', code: '19-2132', char: '' },
      { source: 'cbeta', slot: '\u{F0015}', code: 'CB00021', char: '', records: 'cbeta_gaiji' },
    ])
    expect(pua.convert('\u{F0003}', 'cbeta').text).toBe('𮗿')
    expect(pua.convert('\u{F0003}', 'cns').text).toBe('\u{F0003}')
  })
  test('find a slot by its scheme code', () => {
    expect(slotsOfCode(codes, 'cb00021')).toEqual([{ source: 'cbeta', slot: '\u{F0015}' }])
    expect(slotsOfCode(codes, '15-2D5F')).toEqual([{ source: 'cns', slot: '\u{FFFE1}' }])
  })
  test('cover every CB code', () => {
    expect(Object.keys(codes.get('cbeta'))).toHaveLength(31664)
    expect(Object.keys(pua.scheme('cbeta').mappings)).toHaveLength(16607)
  })
})
