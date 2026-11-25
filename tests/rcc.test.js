import { afterEach, describe, expect, test } from 'bun:test'
import { LINKS } from '../app/lib/links.js'
import {
  cleanIds,
  clearRccCache,
  formatRccCode,
  isIdsSequence,
  matchRccByCode,
  matchRccByIds,
  matchRccByIdsList,
  parseRccCode,
  rccEntryUrl,
  rccLocale,
  rccSearchUrl,
} from '../app/lib/rcc.js'

describe('RCC codes and URLs', () => {
  test('formats positive integer ids as R+XXXX and grows past four digits', () => {
    expect(formatRccCode(1)).toBe('R+0001')
    expect(formatRccCode(4)).toBe('R+0004')
    expect(formatRccCode(0x0831)).toBe('R+0831')
    expect(formatRccCode(0x10000)).toBe('R+10000')
    expect(formatRccCode(0)).toBe('')
    expect(formatRccCode(-3)).toBe('')
    expect(formatRccCode(1.5)).toBe('')
  })

  test('parses canonical R+XXXX codes and rejects malformed or zero ids', () => {
    expect(parseRccCode('R+0004')).toBe(4)
    expect(parseRccCode('r+0269')).toBe(0x0269)
    expect(parseRccCode('Ｒ＋００Ａ１')).toBe(0x00A1)
    expect(parseRccCode('R+10000')).toBe(0x10000)
    expect(parseRccCode('R+0000')).toBeNull()
    expect(parseRccCode('R+00004')).toBeNull()
    expect(parseRccCode('R+004')).toBeNull()
    expect(parseRccCode('U+5650')).toBeNull()
    expect(parseRccCode('天地玄黃')).toBeNull()
  })

  test('builds locale-aware entry and search URLs', () => {
    expect(rccLocale('ja')).toBe('ja')
    expect(rccLocale('zh-Hant')).toBe('zh-Hant')
    expect(rccLocale('fr')).toBe('en')
    expect(rccEntryUrl(4, 'ja')).toBe('https://rare.glyphatlas.org/ja/entry/4')
    expect(rccEntryUrl(617, 'zh-Hans')).toBe('https://rare.glyphatlas.org/zh-Hans/entry/617')
    expect(rccSearchUrl('噐', 'ko')).toBe('https://rare.glyphatlas.org/ko/?q=%E5%99%90')
    expect(rccSearchUrl('  ', 'en')).toBe('https://rare.glyphatlas.org/en')
    const rare = LINKS.find(site => site.key === 'rare')
    expect(rare?.url('噐', 'zh-Hant')).toBe('https://rare.glyphatlas.org/zh-Hant/?q=%E5%99%90')
  })

  test('recognizes valid IDS strings for lookup', () => {
    expect(cleanIds(' ⿰ 米 各 ')).toBe('⿰米各')
    expect(isIdsSequence('⿰米各')).toBe(true)
    expect(isIdsSequence('㇯林木')).toBe(true)
    expect(isIdsSequence('⿰')).toBe(false)
    expect(isIdsSequence('米各')).toBe(false)
    expect(isIdsSequence(`⿰${'一'.repeat(200)}`)).toBe(false)
  })
})

describe('RCC live match lookups', () => {
  afterEach(() => {
    clearRccCache()
  })

  test('normalizes, deduplicates, and sorts /api/match?ids= responses', async () => {
    /** @type {string[]} */
    const seen = []
    const fetchImpl = /** @type {typeof fetch} */ (async url => {
      seen.push(String(url))
      return new Response(JSON.stringify([
        { id: 617, ids: '⿱女上', cover_key: null },
        { id: 12, ids: '⿱女上', cover_key: 'abc.webp' },
        { id: 617, ids: '⿱女上', cover_key: null },
        { id: 0, ids: 'invalid' },
        { id: 'bad' },
      ]), { status: 200 })
    })
    const result = await matchRccByIds(' ⿱ 女 上 ', { fetchImpl })
    expect(seen).toEqual(['https://rare.glyphatlas.org/api/match?ids=%E2%BF%B1%E5%A5%B3%E4%B8%8A'])
    expect(result).toEqual([
      { id: 12, code: 'R+000C', ids: '⿱女上', coverKey: 'abc.webp' },
      { id: 617, code: 'R+0269', ids: '⿱女上', coverKey: null },
    ])
  })

  test('queries /api/match?code= with uppercase U+XXXX and skips invalid codes', async () => {
    /** @type {string[]} */
    const seen = []
    const fetchImpl = /** @type {typeof fetch} */ (async url => {
      seen.push(String(url))
      return new Response(JSON.stringify([{ id: 4, ids: '⿳吅工吅', cover_key: null }]), { status: 200 })
    })
    expect(await matchRccByCode('not-a-code', { fetchImpl })).toEqual([])
    expect(seen).toEqual([])
    expect(await matchRccByCode('u+5650', { fetchImpl })).toEqual([
      { id: 4, code: 'R+0004', ids: '⿳吅工吅', coverKey: null },
    ])
    expect(seen).toEqual(['https://rare.glyphatlas.org/api/match?code=U%2B5650'])
  })

  test('merges unique records across candidate IDS descriptions', async () => {
    const fetchImpl = /** @type {typeof fetch} */ (async url => {
      const ids = new URL(String(url)).searchParams.get('ids')
      if (ids === '⿱女上') return new Response(JSON.stringify([{ id: 617, ids: '⿱女上', cover_key: null }]))
      if (ids === '⿰米各') return new Response(JSON.stringify([{ id: 102, ids: '⿰米各', cover_key: null }, { id: 617, ids: '⿱女上', cover_key: null }]))
      return new Response('[]')
    })
    const merged = await matchRccByIdsList(['⿱女上', 'plain', '⿰米各', '⿱ 女 上'], { fetchImpl })
    expect(merged.map(item => item.code)).toEqual(['R+0066', 'R+0269'])
  })

  test('returns empty array on HTTP errors, network errors, or aborted signals', async () => {
    const failStatus = /** @type {typeof fetch} */ (async () => new Response('error', { status: 500 }))
    const failNetwork = /** @type {typeof fetch} */ (async () => { throw new Error('offline') })
    expect(await matchRccByIds('⿰米各', { fetchImpl: failStatus })).toEqual([])
    expect(await matchRccByIds('⿰米各', { fetchImpl: failNetwork })).toEqual([])

    const controller = new AbortController()
    controller.abort()
    let called = false
    const spy = /** @type {typeof fetch} */ (async () => { called = true; return new Response('[]') })
    expect(await matchRccByIds('⿰米各', { fetchImpl: spy, signal: controller.signal })).toEqual([])
    expect(called).toBe(false)
  })

  test('aborts stalled requests after timeoutMs and returns empty array', async () => {
    let aborted = false
    const stalled = /** @type {typeof fetch} */ ((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        aborted = true
        reject(new DOMException('Aborted', 'AbortError'))
      }, { once: true })
    }))
    expect(await matchRccByIds('⿰米各', { fetchImpl: stalled, timeoutMs: 25 })).toEqual([])
    expect(aborted).toBe(true)
  })
})
