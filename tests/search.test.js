import { describe, expect, test } from 'bun:test'
import { answerChars, readClue } from '../app/lib/search.js'

describe('readClue', () => {
  test('resolves a private-use code point to its character', () => {
    expect(readClue('U+E43B', true)).toEqual({ kind: 'pua', text: 'U+E43B', value: 0xE43B, char: '䀯' })
    expect(readClue('u+e51f', true)).toEqual({ kind: 'pua', text: 'u+e51f', value: 0xE51F, char: '𠊎' })
  })
  test('resolves a bare private-use hex code', () => {
    expect(readClue('E43B', true)).toEqual({ kind: 'pua', text: 'E43B', value: 0xE43B, char: '䀯' })
    expect(readClue('f8faf', true)).toEqual({ kind: 'pua', text: 'f8faf', value: 0xF8FAF, char: '𰹬' })
  })
  test('keeps ordinary code points', () => {
    expect(readClue('U+5B57', true)).toEqual({ kind: 'point', text: 'U+5B57', value: 0x5B57 })
  })
  test('keeps hex the MOE table does not assign as a code', () => {
    expect(readClue('E000', true)).toEqual({ kind: 'code', text: 'E000' })
    expect(readClue('A672', true)).toEqual({ kind: 'code', text: 'A672' })
  })
  test('keeps hex beyond the code space as a code point or a code, without throwing', () => {
    expect(readClue('U+FFFFFF', true)).toEqual({ kind: 'point', text: 'U+FFFFFF', value: 0xFFFFFF })
    expect(readClue('FFFFFF', true)).toEqual({ kind: 'code', text: 'FFFFFF' })
    expect(readClue('123456', true)).toEqual({ kind: 'code', text: '123456' })
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
