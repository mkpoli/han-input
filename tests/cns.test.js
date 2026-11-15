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
    expect(Object.keys(codes.get('cns').codes)).toHaveLength(20659)
  })
  test('converts and resolves a CNS PUA code', () => {
    expect(pua.convert('\u{F8FBA}', 'cns')).toEqual({ text: '𳄹', converted: 1, unmapped: 0, ambiguous: 0, conflicts: [] })
    expect(pua.chars('F8FBA')).toEqual([{ char: '𳄹', source: 'cns' }])
  })
})

describe('schemes that share a slot', () => {
  test('keep a CNS row and a CBETA code apart', () => {
    expect(readingsOf(pua, codes, '\u{F0015}')).toEqual([
      { source: 'cns', slot: '\u{F0015}', code: '19-2132', char: '', font: true },
      { source: 'cbeta', slot: '\u{F0015}', code: 'CB00021', char: '', records: 'cbeta_gaiji', set: 'cbeta_gaiji' },
      { source: 'zhonghua', slot: '\u{F0015}', code: '', char: '', ids: '⿰山失', set: 'gzhs' },
    ])
    expect(pua.convert('\u{F0003}', 'cbeta').text).toBe('𮗿')
    expect(pua.convert('\u{F0003}', 'cns').text).toBe('\u{F0003}')
    expect(pua.convert('\u{F0001}', 'all', codes)).toMatchObject({ text: '\u{F0001}', converted: 0, ambiguous: 1 })
    expect(pua.convert('\u{F0001}', 'cbeta', codes)).toMatchObject({ text: '欵', converted: 1 })
    expect(pua.convert('\u{F0001}', 'cns', codes)).toMatchObject({ text: '\u{F0001}', converted: 0, unmapped: 1 })
  })
  test('find a slot by its scheme code', () => {
    expect(slotsOfCode(codes, 'cb00021')).toEqual([{ source: 'cbeta', slot: '\u{F0015}' }])
    expect(slotsOfCode(codes, '15-2D5F')).toEqual([{ source: 'cns', slot: '\u{FFFE1}' }])
  })
  test('cover every CB code', () => {
    expect(Object.keys(codes.get('cbeta').codes)).toHaveLength(31935)
    expect(Object.keys(pua.scheme('cbeta').mappings)).toHaveLength(16607)
  })
})

describe('the 中华书局宋 scheme', () => {
  test('names its slots by a character or an IDS, and claims undescribed ones', () => {
    expect(readingsOf(pua, codes, '\u{F0000}').find(reading => reading.source === 'zhonghua')).toEqual({ source: 'zhonghua', slot: '\u{F0000}', code: '', char: '𬉲', set: 'gzhs' })
    expect(readingsOf(pua, codes, '\u{F0002}').find(reading => reading.source === 'zhonghua')).toEqual({ source: 'zhonghua', slot: '\u{F0002}', code: '', char: '', ids: '⿰日求', set: 'gzhs' })
    expect(readingsOf(pua, codes, '\u{F0CEF}').find(reading => reading.source === 'zhonghua')?.ids).toBe('⿱𫲵口')
    expect(readingsOf(pua, codes, '\u{F0B4F}').find(reading => reading.source === 'zhonghua')).toEqual({ source: 'zhonghua', slot: '\u{F0B4F}', code: '', char: '', set: 'gzhs' })
    expect(pua.convert('\u{F0000}', 'zhonghua', codes).text).toBe('𬉲')
    expect(pua.convert('\u{F9BE2}', 'zhonghua', codes).text).toBe('鸞')
    // In every scheme at once, plane 15 is ambiguous: CBETA's 頴 and the 中华书局宋 slot both claim U+F0002.
    expect(pua.convert('\u{F0002}', 'all', codes).conflicts[0].options).toEqual([
      { char: '頴', source: 'cbeta' },
      { char: '\u{F0002}', source: 'zhonghua', ids: '⿰日求' },
    ])
  })
})
