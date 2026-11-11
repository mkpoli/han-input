import { describe, expect, test } from 'bun:test'
import { GROUP_CHARS, GROUP_HITS, answerChars, groupPages, readClue } from '../app/lib/search.js'

describe('readClue', () => {
  test('resolves a private-use code point to its character', () => {
    expect(readClue('U+E43B', true)).toEqual({ kind: 'pua', text: 'U+E43B', value: 0xE43B, char: '䀯', chars: ['䀯', '𧶏'] })
    expect(readClue('u+e51f', true)).toEqual({ kind: 'pua', text: 'u+e51f', value: 0xE51F, char: '𠊎', chars: ['𠊎', '𪃡'] })
  })
  test('resolves a bare private-use hex code', () => {
    expect(readClue('E43B', true)).toEqual({ kind: 'pua', text: 'E43B', value: 0xE43B, char: '䀯', chars: ['䀯', '𧶏'] })
    expect(readClue('f8faf', true)).toEqual({ kind: 'pua', text: 'f8faf', value: 0xF8FAF, char: '𰹬', chars: ['𰹬'] })
  })
  test('resolves an HKSCS-only code', () => {
    expect(readClue('U+F266', true)).toEqual({ kind: 'pua', text: 'U+F266', value: 0xF266, char: '䏰', chars: ['䏰'] })
  })
  test('keeps both characters where a code has two font assignments', () => {
    expect(readClue('E35C', true).chars).toEqual(['𫝛', '𦀩'])
  })
  test('keeps ordinary code points', () => {
    expect(readClue('U+5B57', true)).toEqual({ kind: 'point', text: 'U+5B57', value: 0x5B57 })
  })
  test('keeps hex the MOE table does not assign as a code', () => {
    expect(readClue('0000', true)).toEqual({ kind: 'code', text: '0000' })
    expect(readClue('A672', true)).toEqual({ kind: 'code', text: 'A672' })
  })
  test('keeps hex beyond the code space as a code point or a code, without throwing', () => {
    expect(readClue('U+FFFFFF', true)).toEqual({ kind: 'point', text: 'U+FFFFFF', value: 0xFFFFFF })
    expect(readClue('FFFFFF', true)).toEqual({ kind: 'code', text: 'FFFFFF' })
    expect(readClue('123456', true)).toEqual({ kind: 'code', text: '123456' })
  })
  test('reads a 破字 formula as its own clue', () => {
    expect(readClue('氵+飛', true)).toEqual({ kind: 'arithmetic', text: '氵+飛' })
    expect(readClue('▼{日/央}', true).kind).toBe('arithmetic')
    expect(readClue('囗@大', true).kind).toBe('arithmetic')
    expect(readClue('cangjie5:jnd', false).kind).toBe('scoped')
    expect(readClue('2026-11-09', true).kind).toBe('code')
  })
})

describe('answerChars', () => {
  test('keeps the ordinary code hits that share a PUA code', () => {
    const answer = {
      clue: { kind: 'pua', text: 'E4DE', char: '羴' },
      chars: ['羴'],
      hits: [{ method: 'big5', code: 'e4de', chars: ['鬿'], exact: true, literal: true }],
      readings: [], meaning: [], parts: [],
    }
    expect(answerChars(/** @type {any} */ (answer))).toEqual(['羴', '鬿'])
  })
  test('adds no code hits to an ordinary clue', () => {
    const answer = {
      clue: { kind: 'text', text: '羴' },
      chars: ['羴'],
      hits: [{ method: 'big5', code: 'e4de', chars: ['鬿'], exact: false, literal: false }],
      readings: [], meaning: [], parts: [],
    }
    expect(answerChars(/** @type {any} */ (answer))).toEqual(['羴'])
  })
})

describe('groupPages', () => {
  /** @param {string} method @param {number[]} sizes */
  const group = (method, sizes) => ({
    method,
    hits: sizes.map((count, at) => ({ method, code: `${method}${at}`, chars: '字'.repeat(count), exact: true, literal: true })),
    literal: true,
    exact: true,
    total: sizes.reduce((sum, count) => sum + count, 0),
  })

  test('keeps groups whole and turns the page on the tile budget', () => {
    const pages = groupPages([group('a', [10, 10]), group('b', [10]), group('c', [10, 10])], 40)
    expect(pages.map(page => page.map(entry => entry.method))).toEqual([['a', 'b'], ['c']])
  })

  test('gives a group larger than the budget its own page', () => {
    const pages = groupPages([group('a', [100]), group('b', [1])], 20)
    expect(pages.map(page => page.map(entry => entry.method))).toEqual([['a'], ['b']])
  })

  test('counts only the codes and characters its section draws', () => {
    const wide = group('wide', Array.from({ length: GROUP_HITS + 4 }, () => GROUP_CHARS + 10))
    expect(groupPages([wide, group('b', [1])], 2).map(page => page.length)).toEqual([1, 1])
  })

  test('fills a page with as many small groups as the budget takes', () => {
    const groups = Array.from({ length: 11 }, (_, at) => group(`m${at}`, [1]))
    expect(groupPages(groups, 4).map(page => page.length)).toEqual([4, 4, 3])
  })

  test('has no page when there are no groups', () => {
    expect(groupPages([])).toEqual([])
  })
})
