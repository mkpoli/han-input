import { afterEach, describe, expect, test } from 'bun:test'
import { compareCodes } from '../app/lib/charsets.js'
import { clearComposeCache, composeGlyph } from '../app/lib/compose.js'
import {
  RCC_CHARSET_ID,
  RCC_EXPORT_URL,
  clearRccDatasetCache,
  extractUnicodeChar,
  findCharsetsForRccEntry,
  findRccForChar,
  findRccForRecord,
  loadRccDataset,
  mapCharsetRccOverlap,
  parseRccExport,
  rccCharsetEntry,
  rccEncodingToCharsetIds,
  rccMediaUrl,
  unicodeBlockCharsetId,
  withRccCharset,
} from '../app/lib/rcc-data.js'

const SAMPLE_EXPORT = {
  generated_at: '2026-11-25T12:00:00.000Z',
  entries: [
    {
      id: 4,
      ids: '⿳吅工吅',
      cover_key: 'cover4.webp',
      status: 'encoded',
      sightings: 2,
      claims: [
        { kind: 'ids', value: '⿳吅工吅', data: null },
        { kind: 'encoding', value: 'U+5650', data: { charset: 'unicode' } },
        { kind: 'encoding', value: 'WS2024-00100', data: { charset: 'IRG WS2024' } },
        { kind: 'reading', value: 'qì', data: { doculect: 'cmn' } },
        { kind: 'meaning', value: 'vessel', data: null },
      ],
    },
    {
      id: 617,
      ids: '⿱女上',
      cover_key: null,
      status: null,
      sightings: 1,
      claims: [
        { kind: 'ids', value: '⿱女上', data: null },
        { kind: 'encoding', value: 'SJ-001', data: { charset: 'SJ/T 11239—2001' } },
      ],
    },
    {
      id: 999,
      ids: '⿰木木',
      hidden_at: '2026-11-20',
      claims: [],
    },
    {
      id: 1000,
      ids: '⿰水木',
      merged_into: 4,
      claims: [],
    },
  ],
}

describe('RCC dataset parsing and charset mapping', () => {
  afterEach(() => {
    clearRccDatasetCache()
  })

  test('extracts Unicode scalars and maps them to Han Input block charsets', () => {
    expect(extractUnicodeChar('U+5650')).toEqual({ scalar: 'U+5650', char: '噐' })
    expect(extractUnicodeChar('U+5D20(Basic)')).toEqual({ scalar: 'U+5D20', char: '崠' })
    expect(extractUnicodeChar('U+D800')).toBeNull()
    expect(extractUnicodeChar('pending')).toBeNull()
    expect(unicodeBlockCharsetId('噐')).toBe('unicode_basic')
    expect(unicodeBlockCharsetId('𠀀')).toBe('unicode_ext_b')
    expect(unicodeBlockCharsetId('𭛝')).toBe('unicode_ext_f')
  })

  test('maps RCC encoding claims to Han Input charset ids without false aliases', () => {
    expect(rccEncodingToCharsetIds({ charset: 'unicode', code: 'U+5650' })).toEqual(['unicode_basic'])
    expect(rccEncodingToCharsetIds({ charset: 'IRG WS2024', code: 'WS2024-00100' })).toEqual(['ws2024'])
    expect(rccEncodingToCharsetIds({ charset: 'SJ/T 11239—2001', code: '01' })).toEqual(['g_8f'])
    expect(rccEncodingToCharsetIds({ charset: 'gb18030', code: '81308130' })).toEqual([])
    expect(rccEncodingToCharsetIds({ charset: 'big5', code: 'A440' })).toEqual(['hb1'])
    expect(rccEncodingToCharsetIds({ charset: 'big5', code: 'A47F' })).toEqual([])
    expect(rccEncodingToCharsetIds({ charset: 'big5', code: 'C940' })).toEqual(['hb2'])
    expect(rccEncodingToCharsetIds({ charset: 'big5', code: '8140' })).toEqual([])
    expect(rccEncodingToCharsetIds({ charset: 'mj', code: 'MJ059588' })).toEqual(['jmj'])
    expect(rccEncodingToCharsetIds({ charset: 'cns11643', code: '3-2121' })).toEqual(['t3'])
    expect(rccEncodingToCharsetIds({ charset: 'cns11643', code: '16-2121' })).toEqual(['t10'])
    expect(rccEncodingToCharsetIds({ charset: 'cns11643', code: '15-2121' })).toEqual([])
    expect(rccEncodingToCharsetIds({ charset: 'cns11643', code: 'unknown' })).toEqual([])
    expect(rccEncodingToCharsetIds({ charset: 'glyphwiki', code: 'ebag_kxr-01535' })).toEqual(['glyphwiki_ebag'])
    expect(rccEncodingToCharsetIds({ charset: 'glyphwiki', code: 'u2ff0-u4e2a-u4e2a' })).toEqual([])
  })

  test('parses live export entries, filters hidden/merged rows, and builds lookup indexes', () => {
    const dataset = parseRccExport(SAMPLE_EXPORT)
    expect(dataset.entries.map(entry => entry.code)).toEqual(['R+0004', 'R+0269'])
    expect(dataset.counts).toEqual({ total: 2, encoded: 1, unencoded: 1, chars: 1 })
    expect([...dataset.members]).toEqual(['噐'])
    expect(dataset.codes.get('噐')).toBe('R+0004')
    expect(dataset.records.records).toHaveLength(2)
    expect(dataset.records.records[0].rcc?.code).toBe('R+0004')
    expect(dataset.byCharsetId.get('ws2024')?.map(e => e.code)).toEqual(['R+0004'])
    expect(dataset.byCharsetId.get('g_8f')?.map(e => e.code)).toEqual(['R+0269'])
    expect(findRccForChar(dataset, '噐').map(e => e.code)).toEqual(['R+0004'])
    expect(rccMediaUrl('cover4.webp')).toBe('https://rare.glyphatlas.org/media/v2/cover4.webp')
  })

  test('matches other Han Input charsets and proposal records against RCC automatically', () => {
    const dataset = parseRccExport(SAMPLE_EXPORT)
    const record = /** @type {any} */ ({ document: 'n1531', serial: '01887', source: 'G_CYY00497', key: 'ext_d_g_withdrawals:01887' })
    expect(findRccForRecord(dataset, record, '⿱女上').map(e => e.code)).toEqual(['R+0269'])

    const overlap = mapCharsetRccOverlap(dataset, {
      setId: 'ext_d_g_withdrawals',
      members: ['噐', '字'],
      records: [record],
      glyphIdsTable: new Map([['ext_d_g_withdrawals:01887', { ids: '⿱女上', verdict: 'known', by: 'zi.tools' }]]),
    })
    expect(overlap.byChar.get('噐')?.map(e => e.code)).toEqual(['R+0004'])
    expect(overlap.byRecordKey.get('ext_d_g_withdrawals:01887')?.map(e => e.code)).toEqual(['R+0269'])
    expect(overlap.count).toBe(2)

    const wsOverlap = mapCharsetRccOverlap(dataset, { setId: 'ws2024', members: [], records: [] })
    expect(wsOverlap.count).toBe(1)
  })

  test('builds RCC catalogue entry and orders R+XXXX codes numerically', () => {
    const dataset = parseRccExport(SAMPLE_EXPORT)
    const entry = rccCharsetEntry(dataset)
    expect(entry.id).toBe(RCC_CHARSET_ID)
    expect(entry.chars).toBe(1)
    expect(entry.unencoded).toBe(1)
    expect(entry.total).toBe(2)
    expect(withRccCharset([], dataset)).toHaveLength(1)
    expect(compareCodes('R+000A', 'R+10000')).toBeLessThan(0)
    expect(compareCodes('R+0269', 'R+0004')).toBeGreaterThan(0)
  })

  test('loads dataset via fetchImpl and rejects non-ok responses cleanly', async () => {
    expect(RCC_EXPORT_URL).toBe('https://rare.glyphatlas.org/api/export?format=index')
    const okFetch = /** @type {typeof fetch} */ (async () => Response.json({
      dataset: { generated_at: '2026-11-26T14:00:00.000Z' },
      entries: SAMPLE_EXPORT.entries,
    }))
    const loaded = await loadRccDataset({ fetchImpl: okFetch })
    expect(loaded.entries).toHaveLength(2)
    expect(loaded.generatedAt).toBe('2026-11-26T14:00:00.000Z')
    expect(loaded.records.documents[0].date).toBe('2026-11-26')

    const badFetch = /** @type {typeof fetch} */ (async () => new Response('down', { status: 503 }))
    await expect(loadRccDataset({ fetchImpl: badFetch })).rejects.toThrow('RCC export unavailable')

    const errorBodyFetch = /** @type {typeof fetch} */ (async () => Response.json({ error: 'temporarily unavailable' }))
    await expect(loadRccDataset({ fetchImpl: errorBodyFetch })).rejects.toThrow('Invalid RCC export payload')
  })

  test('matches character tiles by charset code even without a Unicode claim', () => {
    const dataset = parseRccExport({
      entries: [
        {
          id: 77,
          ids: '一',
          claims: [{ kind: 'encoding', value: 'A440', data: { charset: 'big5' } }],
        },
      ],
    })
    const overlap = mapCharsetRccOverlap(dataset, {
      setId: 'hb1',
      members: ['一', '丁'],
      codes: new Map([['一', 'A440'], ['丁', 'A442']]),
    })
    expect(overlap.byChar.get('一')?.map(e => e.code)).toEqual(['R+004D'])
    expect(overlap.byChar.has('丁')).toBe(false)
    expect(overlap.matchedCount).toBe(1)
  })

  test('scopes encoding matches to the active charset namespace', () => {
    const dataset = parseRccExport({
      entries: [
        {
          id: 50,
          ids: '⿰木木',
          claims: [{ kind: 'encoding', value: '00100', data: { charset: 'IRG WS2024' } }],
        },
      ],
    })
    const unrelatedRecord = /** @type {any} */ ({ document: 'n1531', serial: '00100', source: 'G_CYY00100', key: 'ext_d_g_withdrawals:00100' })
    expect(findRccForRecord(dataset, unrelatedRecord, null, 'ext_d_g_withdrawals')).toEqual([])

    const sameSetRecord = /** @type {any} */ ({ document: 'ws', serial: '00100', source: 'WS2024-00100', key: 'ws2024:00100' })
    expect(findRccForRecord(dataset, sameSetRecord, null, 'ws2024').map(e => e.code)).toEqual(['R+0032'])
  })

  test('reverse inclusion finds IDS-record charsets like WS2024', async () => {
    const originalFetch = globalThis.fetch
    const dataset = parseRccExport({
      entries: [{ id: 1, ids: '⿰乂丂', claims: [] }],
    })
    const catalogue = /** @type {any[]} */ ([
      {
        id: 'ws2024',
        group: 'Unicode',
        label: 'WS2024',
        names: { en: 'IRG Working Set 2024', zh: 'IRG Working Set 2024', hans: 'IRG Working Set 2024', ja: 'IRG Working Set 2024', ko: 'IRG Working Set 2024' },
        records: { file: '/charsets/ws2024.ids.json', count: 1 },
      },
    ])
    globalThis.fetch = /** @type {typeof fetch} */ (async url => {
      const target = String(url)
      if (target === '/charsets/ws2024.ids.json') {
        return Response.json({ records: [{ document: 'ids', source: '⿰乂丂', kind: 'ids' }] })
      }
      return new Response('not found', { status: 404 })
    })
    try {
      const matches = await findCharsetsForRccEntry(dataset.entries[0], catalogue)
      expect(matches.map(item => item.id)).toEqual(['ws2024'])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('composeGlyph times out stalled jobs and cancels aborted queued jobs without blocking', async () => {
    clearComposeCache()
    try {
      /** @type {string[]} */
      const started = []
      const stalledRuntime = async () => ({
        source: {},
        compose: async (_source, seq) => {
          started.push(seq)
          if (seq.startsWith('STALL')) return new Promise(() => {})
          return { d: `M0 0 ${seq}` }
        },
      })

      // Fill all 8 concurrency slots with stalled jobs using a short timeout, plus an aborted queued job.
      const stalled = Array.from({ length: 8 }, (_, i) => composeGlyph(`STALL${i}`, { timeoutMs: 25, runtime: stalledRuntime }))
      const ac = new AbortController()
      const queuedAborted = composeGlyph('QUEUED_ABORT', { signal: ac.signal, timeoutMs: 200, runtime: stalledRuntime })
      ac.abort()
      const afterStall = composeGlyph('OK_AFTER', { timeoutMs: 200, runtime: stalledRuntime })

      expect(await queuedAborted).toBeNull()
      expect(await Promise.all(stalled)).toEqual(Array(8).fill(null))
      expect(await afterStall).toEqual({ d: 'M0 0 OK_AFTER', cut: null })
      expect(started).not.toContain('QUEUED_ABORT')
    } finally {
      clearComposeCache()
    }
  })
})
