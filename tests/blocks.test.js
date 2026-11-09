import { describe, expect, test } from 'bun:test'
import { blockRows } from '../app/lib/blocks.js'

const char = (/** @type {number} */ point) => String.fromCodePoint(point)

describe('block shares', () => {
  test('groups a set by block, largest first, and keeps the rest apart', () => {
    const rows = blockRows(new Set([char(0x5B57), char(0x20000), char(0x30000), char(0x1B170)]))
    expect(rows.map(row => [row.id, row.count])).toEqual([['uro', 1], ['ext_b', 1], ['ext_g', 1], ['other', 1]])
  })
  test('counts characters that share a block and takes shares of the whole set', () => {
    const rows = blockRows(new Set([char(0x3400), char(0x3401), char(0x20000), char(0x1B170)]))
    expect(rows.map(row => [row.id, row.count, row.share])).toEqual([['ext_a', 2, 0.5], ['ext_b', 1, 0.25], ['other', 1, 0.25]])
  })
  test('places the last code point of each block inside it', () => {
    expect(blockRows(new Set([char(0x4DBF), char(0x4E00), char(0x9FFF), char(0xFAFF), char(0x3347F)])).map(row => row.id))
      .toEqual(['uro', 'ext_a', 'compat', 'ext_j'])
  })
  test('returns nothing for an empty set', () => {
    expect(blockRows(new Set())).toEqual([])
  })
})
