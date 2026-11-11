import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { englishSeo } from '../app/lib/seo.js'

const snapshot = JSON.parse(readFileSync(new URL('../data/font-coverage.json', import.meta.url), 'utf8'))
/** @type {[number, number][]} */
const ranges = snapshot.ranges
/** @param {number} point */
const covered = point => ranges.some(([start, end]) => point >= start && point <= end)

describe('coverage page', () => {
  test('names itself in the head', () => {
    const seo = englishSeo('statistics')
    expect(seo.title).toContain('Statistics')
    expect(seo.description.length).toBeGreaterThan(40)
  })

  test('keeps the font snapshot sorted and disjoint', () => {
    expect(ranges.length).toBeGreaterThan(0)
    for (let index = 0; index < ranges.length; index++) {
      const [start, end] = ranges[index]
      expect(start).toBeLessThanOrEqual(end)
      if (index) expect(ranges[index - 1][1]).toBeLessThan(start)
    }
  })

  test('covers common Han and leaves the known gap out', () => {
    expect(covered(0x4E00)).toBe(true)
    expect(covered(0x20000)).toBe(true)
    expect(covered(0x2B81E)).toBe(false)
  })
})
