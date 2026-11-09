import { describe, expect, test } from 'bun:test'
import { versionRows } from '../app/lib/ages.js'
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

describe('version shares', () => {
  const ranges = /** @type {[number, number, string][]} */ ([
    [0x41, 0x5A, '1.1'],
    [0x61, 0x7A, '2.0'],
    [0x20000, 0x2A6D6, '3.1'],
    [0x2A6D7, 0x2A6DD, '13.0'],
    [0x2A6DE, 0x2A6DF, '14.0'],
  ])
  const point = (/** @type {number} */ value) => String.fromCodePoint(value)

  test('groups characters by the version that first assigned them', () => {
    const rows = versionRows(new Set([point(0x41), point(0x42), point(0x61)]), ranges)
    expect(rows.map(row => [row.version, row.count])).toEqual([['1.1', 2], ['2.0', 1]])
    expect(rows[0].share).toBeCloseTo(2 / 3)
    expect(rows[1].share).toBeCloseTo(1 / 3)
  })

  test('orders versions numerically and merges consecutive points', () => {
    const rows = versionRows(new Set([point(0x2A6D7), point(0x20000), point(0x2A6D8)]), ranges)
    expect(rows.map(row => row.version)).toEqual(['3.1', '13.0'])
    expect(rows[1].ranges).toEqual([{ start: 0x2A6D7, end: 0x2A6D8, count: 2 }])
  })

  test('keeps a gap as two ranges', () => {
    const rows = versionRows(new Set([point(0x41), point(0x43)]), ranges)
    expect(rows[0].ranges).toEqual([{ start: 0x41, end: 0x41, count: 1 }, { start: 0x43, end: 0x43, count: 1 }])
  })

  test('returns nothing for an empty set', () => {
    expect(versionRows(new Set(), ranges)).toEqual([])
  })
})
