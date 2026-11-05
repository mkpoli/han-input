import { describe, expect, test } from 'bun:test'
import { algebraOf, readCin, readRimeDict } from '../scripts/sources/rime.mjs'

describe('readRimeDict', () => {
  test('reads rows after the header and only single characters', () => {
    const text = '---\nname: x\n...\n字\tjnd\t10\n字母\tjnww\n# note\n'
    expect([...readRimeDict(text)]).toEqual([{ char: '字', code: 'jnd', weight: 10 }])
  })
  test('follows the columns the header declares', () => {
    const text = '---\nname: x\ncolumns:\n  - code\n  - text\n...\njnd\t字\n'
    expect([...readRimeDict(text)]).toEqual([{ char: '字', code: 'jnd', weight: 0 }])
  })
})

describe('readCin', () => {
  test('reads between chardef lines', () => {
    const text = '%ename x\n%chardef begin\njnd 字\nab 一二\n%chardef end\nzz 水'
    expect([...readCin(text)]).toEqual([{ char: '字', code: 'jnd', weight: 0 }])
  })
})

const schema = (/** @type {string} */ rules) => `speller:\n  alphabet: x\n  algebra:\n${rules}\ntranslator:\n  preedit_format:\n    - xform/vs/undone/\n`

describe('algebraOf', () => {
  test('applies xform in order', () => {
    expect(algebraOf(schema('    - xform/^zh/v/\n    - xform/ong$/s/'))('zhong')).toEqual(['vs'])
  })
  test('derive keeps the original', () => {
    expect(algebraOf(schema('    - derive/^zh/z/'))('zhong').sort()).toEqual(['zhong', 'zong'])
  })
  test('xlit maps letter for letter', () => {
    expect(algebraOf(schema('    - xlit/ab/xy/'))('aab')).toEqual(['xxy'])
  })
  test('reads only the speller list, leaving the display rules out', () => {
    expect(algebraOf(schema('    - xform/^zh/v/\n    # a comment\n    - xform/ong$/s/'))('zhong')).toEqual(['vs'])
    expect(algebraOf('translator:\n  preedit_format:\n    - xform/a/b/\n')('a')).toEqual(['a'])
  })
})
