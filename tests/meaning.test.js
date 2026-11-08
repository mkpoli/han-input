import { afterEach, describe, expect, test } from 'bun:test'
import { addMeaning } from '../scripts/sources/meaning.mjs'
import { findMeaning } from '../app/lib/data.js'
import { wordBucket } from '../src/fold.js'
import { hasHan, SIMPLIFIED } from '../src/script.js'
import { Converter } from 'opencc-js/t2cn'

const toSimplified = Converter(SIMPLIFIED)

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

describe('meaning index', () => {
  test('files a traditional word under its simplified form as well', () => {
    const index = new Map()
    addMeaning(index, '龍頭', 'A', toSimplified)
    expect(index.get('龍頭')).toEqual(new Set(['A']))
    expect(index.get('龙头')).toEqual(new Set(['A']))
  })
  test('lets two ambiguous traditional words share one simplified key', () => {
    const index = new Map()
    addMeaning(index, '髮廊', 'B', toSimplified)
    addMeaning(index, '發廊', 'C', toSimplified)
    expect([...index.get('发廊')]).toEqual(['B', 'C'])
  })
})

describe('meaning search', () => {
  test('finds a gloss written in the other script, from either side', async () => {
    const rows = new Map([
      ['龍頭', '龍頭\tA'],
      ['龙头', '龙头\tAB'],
    ])
    globalThis.fetch = async input => {
      const url = String(input)
      const word = [...rows.keys()].find(key => url.endsWith(`${wordBucket(key)}.gz`))
      return new Response(word ? rows.get(word) : '')
    }
    expect(await findMeaning('龍頭')).toEqual(['A', 'B'])
    expect(await findMeaning('龙头')).toEqual(['A', 'B'])
  })
  test('keeps both characters of an ambiguous conversion', async () => {
    const rows = new Map([
      ['髮廊', '髮廊\tC'],
      ['发廊', '发廊\tD'],
    ])
    globalThis.fetch = async input => {
      const url = String(input)
      if (!url.includes('/data/m/')) return new Response('', { status: 404 })
      const word = [...rows.keys()].find(key => url.endsWith(`${wordBucket(key)}.gz`))
      return new Response(word ? rows.get(word) : '')
    }
    expect(await findMeaning('髮廊')).toEqual(['C', 'D'])
  })
})

describe('Han detection', () => {
  test('sees plane-2 Han that the runtime regex misses', () => {
    expect(hasHan('\u{2B81E}')).toBe(true)
    expect(hasHan('あ')).toBe(false)
    expect(hasHan('plain')).toBe(false)
  })
})
