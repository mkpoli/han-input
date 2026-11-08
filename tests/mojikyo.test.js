import { describe, expect, test } from 'bun:test'
import { parseMojikyo } from '../scripts/sources/mojikyo.mjs'

const body = [
  '0000*\t00\t \t062000\t\t',
  '0020\t20\t \t062000\t\t',
  '4E9C\tE4BA9C\t亜\t010202\t\t',
  '4E9D\tE4BA9D\t亜\t010203\tduplicate\t',
  '3042\tE38182\tあ\t080001\t\t',
].join('\n')

describe('parseMojikyo', () => {
  test('reads code point and six-digit number', () => {
    expect(parseMojikyo(body)).toEqual([['062000', '\u0000'], ['062000', ' '], ['010202', '亜'], ['010203', '亝'], ['080001', 'あ']])
  })
  test('skips rows without a number', () => {
    expect(parseMojikyo('4E9C\tE4BA9C\t亜\t---\t\t')).toEqual([])
  })
})
