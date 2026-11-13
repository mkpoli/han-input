import { expect, test } from 'bun:test'
import { STROKE_KEYS, STROKE_METHODS, nextKeys } from '../src/strokes.js'

test('numbers the five stroke classes in their order', () => {
  expect(STROKE_KEYS.map(key => key.digit + key.stroke).join(' ')).toBe('1㇐ 2㇑ 3㇒ 4㇔ 5㇕')
  expect([...STROKE_METHODS]).toEqual(['wubihua', 'cns-stroke-order'])
})

test('names the keys a code goes on with', () => {
  const rows = ['1', '11', '1121', '251', '53'].map(folded => ({ folded }))
  expect([...nextKeys(rows, '')].sort()).toEqual(['1', '2', '5'])
  expect([...nextKeys(rows, '1')]).toEqual(['1'])
  expect([...nextKeys(rows, '112')]).toEqual(['1'])
  expect([...nextKeys(rows, '1121')]).toEqual([])
  expect([...nextKeys(rows, '3')]).toEqual([])
})
