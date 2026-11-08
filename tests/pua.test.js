import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { HKSCS_PUA, MOE_PUA, MOE_PUA_VARIANTS, codePoint, convertPua, puaChar, puaChars, puaOf, puaTable } from '../src/pua.js'
import { parseMoeWordbooks } from '../scripts/import_moe_pua.mjs'
import { variantIndex } from '../scripts/import_moe_pua_variants.mjs'

const book = rows => `var wordbooks = ${JSON.stringify(rows)};`

describe('MOE PUA snapshot', () => {
  test('records the official source and its pinned checksum', () => {
    expect(MOE_PUA.source.url).toBe('https://happyhakka.moe.edu.tw/crechar/index.html')
    expect(MOE_PUA.source.dataUrl).toBe('https://happyhakka.moe.edu.tw/crechar/wordbooks.js')
    expect(MOE_PUA.source.sha256).toBe('685336386d696c30114ab779ebafef2bbb56a098f22de60f1f6ef68475d16923')
    expect(Object.keys(MOE_PUA.mappings)).toHaveLength(59)
  })
  test('matches every assignment in the checksum-pinned official source', () => {
    const original = readFileSync(new URL('./fixtures/moe-wordbooks.txt', import.meta.url))
    expect(createHash('sha256').update(original).digest('hex')).toBe(MOE_PUA.source.sha256)
    expect(parseMoeWordbooks(original.toString('utf8'))).toEqual(MOE_PUA.mappings)
  })
  test('converts the official example', () => {
    expect(convertPua('\uE43B')).toEqual({ text: '䀯', converted: 1, unmapped: 0, ambiguous: 0, conflicts: [] })
  })
  test('covers every assignment, including supplementary PUA and Han', () => {
    for (const [alias, char] of Object.entries(MOE_PUA.mappings)) {
      expect(alias).toMatch(/^\p{Co}$/u)
      expect([...char]).toHaveLength(1)
      expect(char).not.toMatch(/\p{Co}/u)
      expect(convertPua(alias)).toEqual({ text: char, converted: 1, unmapped: 0, ambiguous: 0, conflicts: [] })
    }
    expect(convertPua('\u{F8FAF}').text).toBe('𰹬')
    expect(convertPua('\uE51F').text).toBe('𠊎')
  })
  test('preserves whitespace, line endings, combining marks, HTML, and unmapped PUA', () => {
    const input = 'a\u0301\t字\r\n\uE43B <script> & 😀\uE000\u{FFFFD}\u{100000}'
    expect(convertPua(input)).toEqual({
      text: 'a\u0301\t字\r\n䀯 <script> & 😀\uE000\u{FFFFD}\u{100000}', converted: 1, unmapped: 3, ambiguous: 0, conflicts: [],
    })
  })
  test('counts occurrences and leaves converted text unchanged on repetition', () => {
    expect(convertPua('\uE43B\uE43B')).toEqual({ text: '䀯䀯', converted: 2, unmapped: 0, ambiguous: 0, conflicts: [] })
    const result = convertPua(Object.keys(MOE_PUA.mappings).join(''))
    expect(result.converted).toBe(59)
    expect(convertPua(result.text)).toEqual({ text: result.text, converted: 0, unmapped: 0, ambiguous: 0, conflicts: [] })
    expect(convertPua('')).toEqual({ text: '', converted: 0, unmapped: 0, ambiguous: 0, conflicts: [] })
  })
  test('formats BMP and supplementary code points', () => {
    expect(codePoint('\uE43B')).toBe('U+E43B')
    expect(codePoint('𠊎')).toBe('U+2028E')
    expect(codePoint('\u{F8FAF}')).toBe('U+F8FAF')
  })
})

describe('HKSCS', () => {
  test('converts the 1993 PUA assignments, apart from the MOE table', () => {
    expect(convertPua('\uF266', 'hkscs')).toEqual({ text: '䏰', converted: 1, unmapped: 0, ambiguous: 0, conflicts: [] })
    expect(convertPua('\uF266')).toEqual({ text: '\uF266', converted: 0, unmapped: 1, ambiguous: 0, conflicts: [] })
    expect(convertPua('\u{F8FAF}', 'hkscs')).toEqual({ text: '\u{F8FAF}', converted: 0, unmapped: 1, ambiguous: 0, conflicts: [] })
  })
  test('records the table and its provenance', () => {
    expect(HKSCS_PUA.source.sha256).toBe('f52001a4452cc2c790ac5f255b26be3d8d6e24c9a3867f0d271e21f4359bb266')
    expect(Object.keys(HKSCS_PUA.mappings)).toHaveLength(2353)
  })
  test('keeps both characters where a code has two font assignments', () => {
    expect(puaChars('E35C')).toEqual([{ char: '𫝛', source: 'moe' }, { char: '𦀩', source: 'hkscs' }])
    expect(puaChars('F5E7')).toHaveLength(2)
  })
  test('lists a character’s HKSCS code', () => {
    expect(puaOf('䏰')).toEqual([{ code: 'U+F266', char: '䏰', relation: 'own', source: 'hkscs' }])
  })
})

describe('all sources', () => {
  test('converts where the sources agree and leaves conflicts', () => {
    expect(convertPua('\uF266\uE43B', 'all')).toMatchObject({ text: '\uF266\uE43B', converted: 0, unmapped: 0, ambiguous: 2 })
    expect(convertPua('\uE43B\uE51F', 'all')).toMatchObject({ text: '\uE43B\uE51F', converted: 0, unmapped: 0, ambiguous: 2 })
  })
  test('lists every row with its source', () => {
    expect(puaTable('all')).toHaveLength(8613)
    expect(puaTable('moe')).toHaveLength(59)
    expect(puaTable('hkscs').every(row => row.source === 'hkscs')).toBe(true)
  })
})

describe('lookup', () => {
  test('resolves a PUA code point to its character', () => {
    expect(puaChar('E43B')).toBe('䀯')
    expect(puaChar('e43b')).toBe('䀯')
    expect(puaChar('F8FAF')).toBe('𰹬')
    expect(puaChar('FFFF')).toBe('')
    expect(puaChar('ZZZZ')).toBe('')
  })
  test('leaves hex above the code space alone', () => {
    for (const hex of ['FFFFFF', '110000', '123456', 'U+FFFFFF']) expect(puaChar(hex)).toBe('')
  })
  test('lists a character’s own PUA codes', () => {
    expect(puaOf('䀯')).toEqual([{ code: 'U+E43B', char: '䀯', relation: 'own', source: 'moe' }])
    expect(puaOf('雞')).toEqual([{ code: 'U+E463', char: '雞', relation: 'own', source: 'moe' }])
    expect(puaOf('字')).toEqual([])
  })
  test('lists the PUA codes of a variant, and the inverse relation from it', () => {
    expect(puaOf('羶')).toEqual([{ code: 'U+E4DE', char: '羴', relation: 'semantic', source: 'moe', relationSource: 'unihan' }])
    expect(puaOf('鸡')).toEqual([{ code: 'U+E463', char: '雞', relation: 'traditional', source: 'moe', relationSource: 'unihan' }])
    expect(puaOf('鷄')).toEqual([{ code: 'U+E463', char: '雞', relation: 'semantic', source: 'moe', relationSource: 'unihan' }])
  })
  test('records the variant source', () => {
    expect(MOE_PUA_VARIANTS.source.version).toBe('18.0.0')
    expect(MOE_PUA_VARIANTS.source.licence).toBe('Unicode-3.0')
    expect(Object.keys(MOE_PUA_VARIANTS.byChar)).toHaveLength(9)
  })
})

describe('variant index', () => {
  const body = [
    'U+7FB6\tkSemanticVariant\tU+7FB4<kMatthews',
    'U+9E21\tkTraditionalVariant\tU+96DE',
    'U+96DE\tkSimplifiedVariant\tU+9E21',
    'U+4E00\tkCompatibilityVariant\tU+2F00',
    'U+3400\tkSimplifiedVariant\tU+4E00',
    'U+4E01\tkSemanticVariant\tU+3400 U+4E02',
  ].join('\n')
  test('keeps relations that touch a PUA character, named from each side', () => {
    expect(variantIndex(body, new Set(['羴', '雞']))).toEqual({
      羶: [{ char: '羴', relation: 'semantic' }],
      鸡: [{ char: '雞', relation: 'traditional' }],
    })
  })
  test('names the inverse relation when the PUA character is the row’s own', () => {
    const line = 'U+4E00\tkSimplifiedVariant\tU+3400'
    expect(variantIndex(line, new Set(['㐀']))).toEqual({ 一: [{ char: '㐀', relation: 'simplified' }] })
    expect(variantIndex(line, new Set(['一']))).toEqual({ 㐀: [{ char: '一', relation: 'traditional' }] })
  })
  test('reads specialized, Z and multi-target rows, once per relation', () => {
    const rows = [
      'U+3400\tkSpecializedSemanticVariant\tU+4E00',
      'U+4E01\tkZVariant\tU+4E00 U+4E02',
      'U+4E02\tkSemanticVariant\tU+4E00',
    ].join('\n')
    expect(variantIndex(rows, new Set(['一']))).toEqual({
      㐀: [{ char: '一', relation: 'specialized' }],
      丁: [{ char: '一', relation: 'z' }],
      丂: [{ char: '一', relation: 'semantic' }],
    })
    expect(variantIndex('U+4E01\tkZVariant\tU+4E00\nU+4E01\tkZVariant\tU+4E00', new Set(['一']))).toEqual({ 丁: [{ char: '一', relation: 'z' }] })
  })
  test('leaves out characters with no PUA on either side', () => {
    expect(variantIndex(body, new Set(['字']))).toEqual({})
  })
})

describe('MOE data import', () => {
  test('reads both alias fields as JSON, with supplementary characters intact', () => {
    expect(parseMoeWordbooks(book([{ str: '𠊎', str2: '\uE51F', str3: '\u{F8FAF}' }]))).toEqual({ '\uE51F': '𠊎', '\u{F8FAF}': '𠊎' })
  })
  test('rejects executable JavaScript and unrecognized formats', () => {
    expect(() => parseMoeWordbooks('var wordbooks = []; alert(1)')).toThrow('format')
    expect(() => parseMoeWordbooks('var wordbooks = [process.exit()]')).toThrow()
  })
  test('rejects invalid targets and aliases', () => {
    for (const str of ['', '字字', '\uE000']) expect(() => parseMoeWordbooks(book([{ str, str2: '\uE43B', str3: null }]))).toThrow('target')
    for (const str2 of ['', '字', '\uE000\uE001']) expect(() => parseMoeWordbooks(book([{ str: '字', str2, str3: null }]))).toThrow('alias')
  })
  test('rejects conflicting assignments', () => {
    expect(() => parseMoeWordbooks(book([
      { str: '字', str2: '\uE43B', str3: null },
      { str: '文', str2: '\uE43B', str3: null },
    ]))).toThrow('Conflicting')
  })
})
