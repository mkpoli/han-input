import { describe, expect, test } from 'bun:test'
import { parseFrequency } from '../scripts/sources/frequency.mjs'
import { rankChars, UNLISTED } from '../scripts/sources/unihan.mjs'

/** @param {Record<string, Record<string, string>>} table field to character to value */
const fieldsOf = table => new Map(Object.entries(table).map(([field, values]) => [field, new Map(Object.entries(values))]))

const fields = fieldsOf({
  kRSUnicode: { 一: '1.0', 丁: '1.1', 丂: '1.1', 丄: '1.1', 㐀: '1.4', 㐁: '1.5', 㐂: '1.5', 𠀀: '1.0' },
  kTotalStrokes: { 一: '1', 丁: '2', 丂: '9', 丄: '2', 㐀: '5', 㐁: '6', 㐂: '3', 𠀀: '3' },
  kGradeLevel: { 一: '1' },
  kUnihanCore2020: { 丁: 'G', 丂: 'G' },
})
const positions = new Map([['一', 1], ['丂', 5], ['㐁', 9], ['丁', 12]])
const rank = (/** @type {string} */ char) => rankChars(fields, positions).find(row => row[0] === char)?.[1]

describe('rankChars', () => {
  test('is tier, then corpus position, then strokes, in one number', () => {
    expect(rank('一')).toBe(1 * 1e7 + 1 * 100 + 1)
    expect(rank('丁')).toBe(30 * 1e7 + 12 * 100 + 2)
  })
  test('puts the commoner character first within a tier, whatever the strokes', () => {
    expect(rank('丂')).toBeLessThan(/** @type {number} */ (rank('丁')))
  })
  test('puts characters the corpus lacks after the listed ones of their tier, fewer strokes first', () => {
    expect(rank('㐁')).toBeLessThan(/** @type {number} */ (rank('㐂')))
    expect(rank('㐂')).toBeLessThan(/** @type {number} */ (rank('㐀')))
    expect(rank('㐀')).toBe(50 * 1e7 + UNLISTED * 100 + 5)
  })
  test('keeps every tier ahead of the next whatever the corpus says', () => {
    expect(rank('丁')).toBeLessThan(/** @type {number} */ (rank('丄')))
    expect(rank('丄')).toBeLessThan(/** @type {number} */ (rank('㐁')))
    expect(rank('㐀')).toBeLessThan(/** @type {number} */ (rank('𠀀')))
  })
})

describe('parseFrequency', () => {
  test('numbers characters from the commonest, equal counts sharing a position', () => {
    const positions = parseFrequency('\uFEFFUnicode编码,汉字,频率\r\n0x4e4b,之,30\r\n0x4e0d,不,20\r\n0x4e00,一,20\r\n0x4e01,丁,5\r\n')
    expect([...positions]).toEqual([['之', 1], ['不', 2], ['一', 2], ['丁', 4]])
  })
  test('refuses a row whose code is not its character', () => {
    expect(() => parseFrequency('Unicode编码,汉字,频率\n0x4e4b,不,3\n')).toThrow()
  })
})
