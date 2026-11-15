import { expect, test } from 'bun:test'
import { openStrokeRows } from '../scripts/sources/open-strokes.mjs'

const induced = [
  'char\tcodepoint\torders\tbasis\tfrom\tsource\tids\tlent',
  '⺛\tU+2E9B\t1535\twithin\t旡\tcns11643\t\t',
  '龹\tU+9FB9\t431134\tborrowed\trime-stroke\tcns11643\t\trime-stroke',
  '𫥎\tU+2B94E\t3525135444 3525134544\tids\t⿱免⺀\tcns11643\tbabelstone-ids yi-bai-ids\t',
  '⺛\tU+2E9B\thzpz\twithin\t旡\trime-stroke\t\t',
  '說\tU+8AAA\t41112513425135\tids\t⿰訁兌\tkanjivg\tbabelstone-ids\tcns11643',
  '',
].join('\n')
const entered = [
  'char\tcodepoint\torders\tbasis\tby\tsource\tdate',
  '〡\tU+3021\t2\t\tmkpoli\tcns11643\t2026-11-15',
  '',
].join('\n')

test('reads the orders written for CNS, one code per way of writing a character', () => {
  expect(openStrokeRows(induced, entered)).toEqual([
    ['1535', '⺛'], ['431134', '龹'], ['3525135444', '𫥎'], ['3525134544', '𫥎'], ['2', '〡'],
  ])
})

test('leaves the rows of the other sources to their own symbols', () => {
  expect(openStrokeRows(induced, entered, 'rime-stroke')).toEqual([['hzpz', '⺛']])
  expect(openStrokeRows(induced, entered, 'kanjivg')).toEqual([['41112513425135', '說']])
})
