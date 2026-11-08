import { describe, test, expect } from 'bun:test'
import { gSourceOf, noteOf } from '../app/lib/sources.js'

describe('IRG G source labels', () => {
  test('reads Unihan and IRG evidence forms as the same source', () => {
    expect(gSourceOf('gch-0515.02')?.names.en).toBe('Cihai')
    expect(gSourceOf('G_CH102999')?.names.en).toBe('Cihai')
    expect(gSourceOf('gcyy-00487')?.names.en).toBe('Chinese Academy of Surveying and Mapping')
    expect(gSourceOf('G_CYY00487')?.names.en).toBe('Chinese Academy of Surveying and Mapping')
    expect(gSourceOf('gbk-3901630')?.names.en).toBe('Encyclopedia of China')
    expect(gSourceOf('G_BK103006')?.names.en).toBe('Encyclopedia of China')
    expect(gSourceOf('gjz-00002')?.names.en).toBe('Commercial Press')
    expect(gSourceOf('G_GJZ00324')?.names.en).toBe('Commercial Press')
  })

  test('keeps the evidence codes of the current records', () => {
    expect(gSourceOf('G_ZFY00028')?.names.en).toBe('Hanyu Fangyan Dacidian')
    expect(gSourceOf('G_GH100129')?.names.en).toBe('GB/T 15564-1995 (Hong Kong teletext)')
    expect(gSourceOf('V04-486A')).toBeNull()
    expect(gSourceOf('G_K0642.17')?.names.en).toBe('Kangxi Dictionary')
  })

  test('selects a note for the reader, falling back to Chinese and English', () => {
    const cihai = gSourceOf('G_CH102999')
    expect(cihai).not.toBeNull()
    if (!cihai) return
    expect(noteOf(cihai, 'en')).toContain('1999 popular edition')
    expect(noteOf(cihai, 'zh-Hant')).toContain('1999年版普及本')
    expect(noteOf(cihai, 'zh-Hans')).toContain('1999年版普及本')
    expect(noteOf(cihai, 'ja')).toContain('1999年版普及本')
    expect(noteOf(cihai, 'ko')).toContain('1999년')
  })
})
