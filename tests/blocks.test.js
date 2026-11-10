import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { versionRows } from '../app/lib/ages.js'
import { blockOccupancy, blockRows, planeRows } from '../app/lib/blocks.js'

const char = (/** @type {number} */ point) => String.fromCodePoint(point)

describe('block shares', () => {
  test('groups a set by block, largest first, and keeps the rest apart', () => {
    const rows = blockRows(new Set([char(0x5B57), char(0x20000), char(0x30000), char(0x1D100)]))
    expect(rows.map(row => [row.id, row.count])).toEqual([['uro', 1], ['ext_b', 1], ['ext_g', 1], ['other', 1]])
  })
  test('counts characters that share a block and takes shares of the whole set', () => {
    const rows = blockRows(new Set([char(0x3400), char(0x3401), char(0x20000), char(0x1D100)]))
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

describe('block occupancy', () => {
  const blocks = [
    { id: 'a', label: 'A', start: 0x100, end: 0x103 },
    { id: 'b', label: 'B', start: 0x108, end: 0x109 },
  ]
  test('counts assigned code points and the empty remainder in code point order', () => {
    const rows = blockOccupancy([[0x100, 0x101, '1.1'], [0x103, 0x103, '2.0']], blocks)
    expect(rows.map(row => [row.id, row.total, row.assigned, row.empty])).toEqual([['a', 4, 3, 1], ['b', 2, 0, 2]])
    expect(rows[0].share).toBeCloseTo(0.25)
    expect(rows[1].share).toBe(1)
  })
  test('clips age ranges to the block', () => {
    const rows = blockOccupancy([[0xF0, 0x110, '1.1']], blocks)
    expect(rows.map(row => [row.id, row.assigned])).toEqual([['a', 4], ['b', 2]])
  })
})

describe('plane shares', () => {
  const point = (/** @type {number} */ value) => String.fromCodePoint(value)
  test('counts planes 0 to 3 and keeps higher planes apart', () => {
    const rows = planeRows(new Set([point(0x5B57), point(0x1B170), point(0x20000), point(0x30000), point(0xF0000)]))
    expect(rows.map(row => [row.plane, row.count])).toEqual([[0, 1], [1, 1], [2, 1], [3, 1], [null, 1]])
    expect(rows.every(row => row.share === 1 / 5)).toBe(true)
  })
  test('keeps all four planes for a set in one plane', () => {
    const rows = planeRows(new Set([point(0x5B57)]))
    expect(rows.map(row => [row.plane, row.count, row.share])).toEqual([[0, 1, 1], [1, 0, 0], [2, 0, 0], [3, 0, 0]])
  })
})

describe('script blocks', () => {
  test('names the Latin, kana, radical, stroke and Nushu blocks', () => {
    const rows = blockRows(new Set([0x41, 0x3042, 0x30A2, 0x2F00, 0x2E80, 0x31C0, 0x1B001, 0x1B170].map(point => String.fromCodePoint(point))))
    expect(rows.map(row => row.id)).toEqual(['latin', 'rad_supp', 'kangxi', 'hiragana', 'katakana', 'strokes', 'kana_supp', 'nushu'])
  })
  test('keeps the occupancy table on the CJK ideograph blocks', () => {
    const rows = blockOccupancy([[0x41, 0x41, '1.1']])
    expect(rows.some(row => row.id === 'latin')).toBe(false)
    expect(rows).toHaveLength(13)
  })
})

describe('catalogue blocks', () => {
  test('gives every Unicode block set a named block', () => {
    const catalogue = JSON.parse(readFileSync(new URL('../app/public/charsets/index.json', import.meta.url), 'utf8'))
    for (const set of catalogue.filter(/** @param {{group: string}} entry */ entry => entry.group === 'Unicode blocks')) {
      const members = new Set(readFileSync(new URL(`../app/public/charsets/${set.id}.txt`, import.meta.url), 'utf8'))
      expect({ id: set.id, other: blockRows(members).filter(row => row.id === 'other').length }).toEqual({ id: set.id, other: 0 })
    }
  })
  test('places the last code point of each added block inside it', () => {
    const rows = blockRows(new Set([0x007F, 0x2EFF, 0x2FDF, 0x309F, 0x30FF, 0x31EF, 0x31FF, 0x1AFFF, 0x1B0FF, 0x1B12F, 0x1B16F, 0x1B2FF].map(point => String.fromCodePoint(point))))
    expect(rows.map(row => row.id)).toEqual(['latin', 'rad_supp', 'kangxi', 'hiragana', 'katakana', 'strokes', 'katakana_ext', 'kana_ext_b', 'kana_supp', 'kana_ext_a', 'small_kana', 'nushu'])
  })
})
