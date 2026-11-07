import { describe, expect, test } from 'bun:test'
import { readClue } from '../app/lib/search.js'

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
})
