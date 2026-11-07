import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { MOE_PUA, codePoint, convertMoePua } from '../src/pua.js'
import { parseMoeWordbooks } from '../scripts/import_moe_pua.mjs'

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
    expect(convertMoePua('\uE43B')).toEqual({ text: '䀯', converted: 1, unmapped: 0 })
  })
  test('covers every assignment, including supplementary PUA and Han', () => {
    for (const [alias, char] of Object.entries(MOE_PUA.mappings)) {
      expect(alias).toMatch(/^\p{Co}$/u)
      expect([...char]).toHaveLength(1)
      expect(char).not.toMatch(/\p{Co}/u)
      expect(convertMoePua(alias)).toEqual({ text: char, converted: 1, unmapped: 0 })
    }
    expect(convertMoePua('\u{F8FAF}').text).toBe('𰹬')
    expect(convertMoePua('\uE51F').text).toBe('𠊎')
  })
  test('preserves whitespace, line endings, combining marks, HTML, and unmapped PUA', () => {
    const input = 'a\u0301\t字\r\n\uE43B <script> & 😀\uE000\u{FFFFD}\u{100000}'
    expect(convertMoePua(input)).toEqual({
      text: 'a\u0301\t字\r\n䀯 <script> & 😀\uE000\u{FFFFD}\u{100000}', converted: 1, unmapped: 3,
    })
  })
  test('counts occurrences and leaves converted text unchanged on repetition', () => {
    expect(convertMoePua('\uE43B\uE43B')).toEqual({ text: '䀯䀯', converted: 2, unmapped: 0 })
    const result = convertMoePua(Object.keys(MOE_PUA.mappings).join(''))
    expect(result.converted).toBe(59)
    expect(convertMoePua(result.text)).toEqual({ text: result.text, converted: 0, unmapped: 0 })
    expect(convertMoePua('')).toEqual({ text: '', converted: 0, unmapped: 0 })
  })
  test('formats BMP and supplementary code points', () => {
    expect(codePoint('\uE43B')).toBe('U+E43B')
    expect(codePoint('𠊎')).toBe('U+2028E')
    expect(codePoint('\u{F8FAF}')).toBe('U+F8FAF')
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
