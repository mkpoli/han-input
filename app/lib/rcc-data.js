// Live dataset loader for the Rare Character Compendium (https://rare.glyphatlas.org).
// Powers RCC as a first-class character set in Han Input, renders live RCC entries, and computes
// automatic bidirectional membership between RCC and Han Input's other character sets.
import { convertArithmetic } from '../../src/arithmetic.js'
import { BLOCKS } from './blocks.js'
import { codesOf } from './data.js'
import { loadDialects } from './dialects.js'
import { loadGlyphIdsByIds } from './glyph-ids.js'
import { RCC_ORIGIN, cleanIds, formatRccCode } from './rcc.js'

export const RCC_CHARSET_ID = 'rcc'
export const RCC_CHARSET_GROUP = 'Rare Character Compendium'
export const RCC_EXPORT_URL = `${RCC_ORIGIN}/api/export?format=json`

const EXPORT_TIMEOUT_MS = 20000
const UNICODE_VALUE = /^U\+([0-9A-F]{4,6})(?:\b|\s|\(|$)/i

/**
 * @typedef {{ charset: string, code: string }} RccEncoding
 * @typedef {{ value: string, doculect: string | null }} RccReading
 * @typedef {{
 *   id: number,
 *   code: string,
 *   ids: string | null,
 *   allIds: string[],
 *   layout: string | null,
 *   coverKey: string | null,
 *   status: string | null,
 *   description: string | null,
 *   radical: string | null,
 *   strokes: number | null,
 *   firstYear: string | null,
 *   sightings: number,
 *   encodings: RccEncoding[],
 *   mappedUnicode?: string,
 *   mappedChar: string,
 *   readings: RccReading[],
 *   meanings: string[],
 *   tags: string[],
 * }} RccEntry
 * @typedef {{
 *   entries: RccEntry[],
 *   byId: Map<number, RccEntry>,
 *   byChar: Map<string, RccEntry[]>,
 *   byIds: Map<string, RccEntry[]>,
 *   byCharsetEncoding: Map<string, RccEntry[]>,
 *   byCharsetId: Map<string, RccEntry[]>,
 *   members: Set<string>,
 *   codes: Map<string, string>,
 *   records: import('./charsets.js').ProposalRecords,
 *   counts: { total: number, encoded: number, unencoded: number, chars: number },
 *   generatedAt: string,
 * }} RccDataset
 */

/** @param {string | null | undefined} coverKey */
export function rccMediaUrl(coverKey) {
  return coverKey ? `${RCC_ORIGIN}/media/v2/${encodeURIComponent(coverKey)}` : ''
}

/**
 * Extract a valid Unicode scalar and character from an RCC encoding claim value (e.g. "U+5D20(Basic)").
 * @param {string} value
 * @returns {{ scalar: string, char: string } | null}
 */
export function extractUnicodeChar(value) {
  const match = value.trim().match(UNICODE_VALUE)
  if (!match) return null
  const cp = Number.parseInt(match[1], 16)
  if (!Number.isSafeInteger(cp) || cp < 0 || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) return null
  return {
    scalar: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
    char: String.fromCodePoint(cp),
  }
}

/** Map a Unicode block id from `blocks.js` to its charset id in Han Input's catalogue. */
const BLOCK_TO_CHARSET = /** @type {Record<string, string>} */ ({
  uro: 'unicode_basic',
  ext_a: 'unicode_ext_a',
  ext_b: 'unicode_ext_b',
  ext_c: 'unicode_ext_c',
  ext_d: 'unicode_ext_d',
  ext_e: 'unicode_ext_e',
  ext_f: 'unicode_ext_f',
  ext_g: 'unicode_ext_g',
  ext_h: 'unicode_ext_h',
  ext_i: 'unicode_ext_i',
  ext_j: 'unicode_ext_j',
  compat: 'block_cjk_compatibility_ideographs',
  compat_supp: 'block_cjk_compatibility_ideographs_supplement',
  rad_supp: 'block_cjk_radicals_supplement',
  kangxi: 'block_kangxi_radicals',
  hiragana: 'block_hiragana',
  katakana: 'block_katakana',
  strokes: 'block_cjk_strokes',
  katakana_ext: 'block_katakana_phonetic_extensions',
  kana_ext_b: 'block_kana_extended_b',
  kana_supp: 'block_kana_supplement',
  kana_ext_a: 'block_kana_extended_a',
  small_kana: 'block_small_kana_extension',
  nushu: 'block_nushu',
  seal: 'block_seal',
})

/**
 * Find the Unicode block charset id for a single character, or null if outside Han Input's block sets.
 * @param {string} char
 */
export function unicodeBlockCharsetId(char) {
  const point = char.codePointAt(0)
  if (point === undefined) return null
  const block = BLOCKS.find(item => point >= item.start && point <= item.end)
  return block ? BLOCK_TO_CHARSET[block.id] ?? null : null
}

/** Exact CNS 11643 decimal plane number → Han Input charset id (planes 16–24 use hex labels t10–t18). */
const CNS_PLANE_TO_CHARSET = /** @type {Record<number, string>} */ ({
  1: 't1',
  2: 't2',
  3: 't3',
  4: 't4',
  5: 't5',
  6: 't6',
  7: 't7',
  9: 't9',
  16: 't10',
  17: 't11',
  18: 't12',
  19: 't13',
  24: 't18',
})

/** @param {string} code */
function cnsCharsetId(code) {
  const plane = code.trim().match(/^(\d{1,2})-[0-9A-F]{4}$/i)
  return plane ? CNS_PLANE_TO_CHARSET[Number(plane[1])] ?? null : null
}

/** @param {string} code */
function big5CharsetId(code) {
  const match = code.trim().match(/^(?:0x)?([0-9A-F]{4})$/i)
  if (!match) return null
  const value = Number.parseInt(match[1], 16)
  if (value >= 0xA440 && value <= 0xC67E) return 'hb1'
  if (value >= 0xC940 && value <= 0xF9D5) return 'hb2'
  return null
}

/**
 * Map an RCC encoding claim `{ charset, code }` to matching Han Input charset id(s).
 * Only claims whose namespace and code range match a specific Han Input table are returned.
 * @param {RccEncoding} encoding
 * @returns {string[]}
 */
export function rccEncodingToCharsetIds(encoding) {
  const norm = encoding.charset.trim().toLowerCase().replace(/[—–−]/g, '-').replace(/\s+/g, ' ')
  const code = encoding.code.trim()
  if (norm === 'unicode' || norm === 'iso10646') {
    const parsed = extractUnicodeChar(code)
    const blockId = parsed ? unicodeBlockCharsetId(parsed.char) : null
    return blockId ? [blockId] : []
  }
  if (norm === 'irg ws2024' || norm === 'ws2024') return ['ws2024']
  if (norm === 'irg ws2021' || norm === 'ws2021') return ['ws2021']
  if (norm === 'irg ws2017' || norm === 'ws2017') return ['ws2017']
  if (norm === 'irg ws2015' || norm === 'ws2015') return ['ws2015']
  if (norm === 'sj/t 11239-2001') return ['g_8f']
  if (norm === 'gb2312' || norm === 'gb/t 2312') return ['g0']
  if (norm === 'big5-hkscs' || norm === 'hkscs') return ['h']
  if (norm === 'big5') {
    const id = big5CharsetId(code)
    return id ? [id] : []
  }
  if (norm === 'jis0208' || norm === 'jis x 0208') return ['j0']
  if (norm === 'jis0213' || norm === 'jis x 0213') return ['j3']
  if (norm === 'ksx1001' || norm === 'ks x 1001') return ['k0']
  if (norm === 'mj') return ['jmj']
  if (norm === 'cbeta') return ['cbeta_gaiji']
  if (norm === 'glyphwiki' && /^ebag_/i.test(code)) return ['glyphwiki_ebag']
  if (norm === 'cns11643' || norm === 'tca-cns') {
    const id = cnsCharsetId(code)
    return id ? [id] : []
  }
  return []
}

/** @param {string} value */
const normKey = value => value.trim().toUpperCase()

/**
 * Parse a raw `/api/export?format=json` document into an indexed `RccDataset`.
 * @param {unknown} doc
 * @returns {RccDataset}
 */
export function parseRccExport(doc) {
  const rawEntries = Array.isArray(doc)
    ? doc
    : doc && typeof doc === 'object' && Array.isArray(/** @type {{ entries?: unknown }} */ (doc).entries)
      ? /** @type {{ entries: unknown[] }} */ (doc).entries
      : []
  const generatedAt = doc && typeof doc === 'object' && typeof /** @type {{ generated_at?: unknown }} */ (doc).generated_at === 'string'
    ? /** @type {{ generated_at: string }} */ (doc).generated_at
    : ''

  /** @type {RccEntry[]} */
  const entries = []
  /** @type {Map<number, RccEntry>} */
  const byId = new Map()
  /** @type {Map<string, RccEntry[]>} */
  const byChar = new Map()
  /** @type {Map<string, RccEntry[]>} */
  const byIds = new Map()
  /** @type {Map<string, RccEntry[]>} */
  const byCharsetEncoding = new Map()
  /** @type {Map<string, RccEntry[]>} */
  const byCharsetId = new Map()
  /** @type {Set<string>} */
  const members = new Set()
  /** @type {Map<string, string>} */
  const codes = new Map()
  let encoded = 0

  /** @template K @param {Map<K, RccEntry[]>} map @param {K} key @param {RccEntry} item */
  const push = (map, key, item) => {
    let list = map.get(key)
    if (!list) map.set(key, list = [])
    if (!list.includes(item)) list.push(item)
  }

  for (const row of rawEntries) {
    if (!row || typeof row !== 'object') continue
    const raw = /** @type {Record<string, any>} */ (row)
    const id = raw.id
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) continue
    if (raw.hidden_at || raw.merged_into) continue
    if (byId.has(id)) continue

    const code = formatRccCode(id)
    const claims = Array.isArray(raw.claims) ? raw.claims : []
    /** @type {Set<string>} */
    const idsSet = new Set()
    if (typeof raw.ids === 'string' && raw.ids.trim()) idsSet.add(cleanIds(raw.ids))
    /** @type {RccEncoding[]} */
    const encodings = []
    /** @type {RccReading[]} */
    const readings = []
    /** @type {string[]} */
    const meanings = []
    /** @type {string[]} */
    const tags = []
    /** @type {string | undefined} */
    let mappedUnicode
    let mappedChar = ''

    for (const claim of claims) {
      if (!claim || typeof claim !== 'object') continue
      const kind = claim.kind
      const value = typeof claim.value === 'string' ? claim.value.trim() : ''
      if (!value) continue
      if (kind === 'ids') {
        idsSet.add(cleanIds(value))
      } else if (kind === 'encoding') {
        const charset = typeof claim.data?.charset === 'string' ? claim.data.charset.trim() : ''
        if (charset) {
          encodings.push({ charset, code: value })
          if (!mappedUnicode && /^(?:unicode|iso10646)$/i.test(charset)) {
            const parsed = extractUnicodeChar(value)
            if (parsed) {
              mappedUnicode = parsed.scalar
              mappedChar = parsed.char
            }
          }
        }
      } else if (kind === 'reading') {
        const doculect = typeof claim.data?.doculect === 'string' && claim.data.doculect.trim() ? claim.data.doculect.trim() : null
        readings.push({ value, doculect })
      } else if (kind === 'meaning') {
        if (!meanings.includes(value)) meanings.push(value)
      } else if (kind === 'tag') {
        if (!tags.includes(value)) tags.push(value)
      }
    }

    const allIds = [...idsSet]
    const entry = /** @type {RccEntry} */ ({
      id,
      code,
      ids: allIds[0] ?? null,
      allIds,
      layout: typeof raw.layout === 'string' && raw.layout ? raw.layout : null,
      coverKey: typeof raw.cover_key === 'string' && raw.cover_key ? raw.cover_key : null,
      status: typeof raw.status === 'string' && raw.status ? raw.status : null,
      description: typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : null,
      radical: typeof raw.radical === 'string' && raw.radical.trim() ? raw.radical.trim() : null,
      strokes: typeof raw.strokes === 'number' && Number.isFinite(raw.strokes) ? raw.strokes : null,
      firstYear: typeof raw.first_year === 'string' && raw.first_year ? raw.first_year : null,
      sightings: typeof raw.sightings === 'number' && Number.isFinite(raw.sightings) ? raw.sightings : 0,
      encodings,
      mappedUnicode,
      mappedChar,
      readings,
      meanings,
      tags,
    })

    entries.push(entry)
    byId.set(id, entry)
    if (mappedChar) {
      encoded++
      members.add(mappedChar)
      if (!codes.has(mappedChar)) codes.set(mappedChar, code)
      push(byChar, mappedChar, entry)
    }
    for (const seq of allIds) push(byIds, seq, entry)
    for (const enc of encodings) {
      const normalized = normKey(enc.code)
      for (const charsetId of rccEncodingToCharsetIds(enc)) {
        push(byCharsetId, charsetId, entry)
        push(byCharsetEncoding, `${charsetId}\t${normalized}`, entry)
      }
    }
  }

  entries.sort((a, b) => a.id - b.id)

  /** @type {import('./charsets.js').ProposalDocument} */
  const rccDoc = {
    id: RCC_CHARSET_ID,
    document: 'Rare Character Compendium',
    title: 'Rare Character Compendium',
    source: 'rare.glyphatlas.org',
    date: generatedAt.slice(0, 10),
    url: `${RCC_ORIGIN}/`,
  }

  /** @type {import('./charsets.js').ProposalRecords} */
  const records = {
    title: 'Rare Character Compendium',
    complete: true,
    scope: 'Live dataset from rare.glyphatlas.org.',
    documents: [rccDoc],
    records: entries.map(entry => ({
      serial: String(entry.id),
      source: entry.code,
      document: RCC_CHARSET_ID,
      ids: entry.ids ?? undefined,
      mappedUnicode: entry.mappedUnicode,
      status: entry.status ?? undefined,
      key: `${RCC_CHARSET_ID}:${entry.id}`,
      rcc: entry,
    })),
  }

  return {
    entries,
    byId,
    byChar,
    byIds,
    byCharsetEncoding,
    byCharsetId,
    members,
    codes,
    records,
    counts: {
      total: entries.length,
      encoded,
      unencoded: entries.length - encoded,
      chars: members.size,
    },
    generatedAt,
  }
}

/** @type {Promise<RccDataset> | null} */
let pendingDataset = null
/** @type {RccDataset | null} */
let cachedDataset = null

/**
 * Load the live Rare Character Compendium dataset in the browser (shared promise, cached for the session).
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [options]
 * @returns {Promise<RccDataset>}
 */
export function loadRccDataset(options = {}) {
  const { fetchImpl, timeoutMs = EXPORT_TIMEOUT_MS } = options
  if (!fetchImpl && cachedDataset) return Promise.resolve(cachedDataset)
  if (!fetchImpl && pendingDataset) return pendingDataset

  const fetcher = fetchImpl ?? (typeof fetch === 'function' ? fetch : null)
  if (!fetcher) return Promise.reject(new Error('Fetch unavailable'))

  const run = (async () => {
    const controller = new AbortController()
    const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null
    try {
      const response = await fetcher(RCC_EXPORT_URL, { signal: controller.signal })
      if (!response.ok) throw new Error(`RCC export unavailable (${response.status})`)
      const dataset = parseRccExport(await response.json())
      if (!fetchImpl) cachedDataset = dataset
      return dataset
    } finally {
      if (timer !== null) clearTimeout(timer)
    }
  })()

  if (!fetchImpl) {
    pendingDataset = run.catch(error => {
      pendingDataset = null
      throw error
    })
    return pendingDataset
  }
  return run
}

/** Synchronous access to the live dataset if already loaded. */
export function getCachedRccDataset() {
  return cachedDataset
}

/** @type {Map<string, Promise<Map<string, string[]>>>} */
const idsRecordsIndexCache = new Map()

/**
 * Lazily build a reverse index (`cleaned IDS -> charsetId[]`) from every catalogue charset whose
 * records file stores IDS entries directly (`*.ids.json`, excluding `dialect_*` covered by `dialect_rows.json`).
 * @param {import('./charsets.js').Charset[]} catalogue
 * @returns {Promise<Map<string, string[]>>}
 */
function loadIdsRecordsByIds(catalogue) {
  const targets = catalogue
    .filter(set => set.id !== RCC_CHARSET_ID && !set.id.startsWith('dialect_') && set.records?.file?.endsWith('.ids.json'))
    .map(set => ({ id: set.id, file: /** @type {string} */ (set.records?.file) }))
  if (!targets.length || typeof fetch !== 'function') return Promise.resolve(new Map())
  const cacheKey = targets.map(t => `${t.id}:${t.file}`).join('|')
  let pending = idsRecordsIndexCache.get(cacheKey)
  if (!pending) {
    pending = (async () => {
      /** @type {Map<string, Set<string>>} */
      const reverse = new Map()
      const CONCURRENCY = 6
      let cursor = 0
      const worker = async () => {
        while (cursor < targets.length) {
          const item = targets[cursor++]
          try {
            const response = await fetch(item.file)
            if (!response.ok) continue
            const data = await response.json()
            const rows = Array.isArray(data?.records) ? data.records : []
            for (const row of rows) {
              const rawSeq = typeof row?.ids === 'string' && row.ids.trim()
                ? row.ids
                : row?.kind === 'ids' && typeof row?.source === 'string' && row.source.trim()
                  ? row.source
                  : ''
              if (!rawSeq) continue
              const cleaned = cleanIds(rawSeq)
              if (!cleaned) continue
              let sets = reverse.get(cleaned)
              if (!sets) reverse.set(cleaned, sets = new Set())
              sets.add(item.id)
            }
          } catch { /* unavailable or offline ids file */ }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker()))
      return new Map([...reverse].map(([ids, sets]) => [ids, [...sets]]))
    })()
    idsRecordsIndexCache.set(cacheKey, pending)
  }
  return pending
}

/** Clear cached RCC dataset and reverse indexes (intended for tests). */
export function clearRccDatasetCache() {
  pendingDataset = null
  cachedDataset = null
  idsRecordsIndexCache.clear()
}

/**
 * Build the catalogue metadata entry for RCC as a character set in Han Input.
 * @param {RccDataset | null} [dataset]
 * @returns {import('./charsets.js').Charset}
 */
export function rccCharsetEntry(dataset = cachedDataset) {
  const counts = dataset?.counts ?? { total: 0, encoded: 0, unencoded: 0, chars: 0 }
  return {
    id: RCC_CHARSET_ID,
    group: RCC_CHARSET_GROUP,
    label: 'RCC',
    names: {
      en: 'Rare Character Compendium',
      zh: '珍字集覽',
      hans: '珍字集览',
      ja: '珍字集覧',
      ko: '진자집람',
    },
    chars: counts.chars,
    total: counts.total,
    encoded: counts.encoded,
    unencoded: counts.unencoded,
    live: true,
    records: {
      file: RCC_EXPORT_URL,
      count: counts.total,
      glyphs: counts.total,
    },
    recordsNote: false,
    source: {
      name: 'Rare Character Compendium',
      url: `${RCC_ORIGIN}/`,
      dataUrl: RCC_EXPORT_URL,
      licence: 'CC BY-SA 4.0',
    },
  }
}

/**
 * Return a catalogue list with the live RCC charset appended (or updated with live counts).
 * @param {import('./charsets.js').Charset[]} charsets
 * @param {RccDataset | null} [dataset]
 */
export function withRccCharset(charsets, dataset = cachedDataset) {
  const without = charsets.filter(set => set.id !== RCC_CHARSET_ID)
  return [...without, rccCharsetEntry(dataset)]
}

/**
 * Find RCC entries matching a single Unicode character.
 * @param {RccDataset | null} dataset
 * @param {string} char
 * @returns {RccEntry[]}
 */
export function findRccForChar(dataset, char) {
  return dataset ? dataset.byChar.get(char) ?? [] : []
}

/**
 * Find RCC entries matching a Han Input proposal/dialect/gaiji record (by Unicode, IDS, or
 * namespace-scoped encoding code).
 * @param {RccDataset | null} dataset
 * @param {import('./charsets.js').ProposalRecord} record
 * @param {string | null} [reviewedIds]
 * @param {string} [setId]
 * @returns {RccEntry[]}
 */
export function findRccForRecord(dataset, record, reviewedIds = null, setId = '') {
  if (!dataset) return []
  if (record.rcc) return [record.rcc]
  /** @type {Map<number, RccEntry>} */
  const found = new Map()
  /** @param {RccEntry[] | undefined} list */
  const add = list => {
    if (!list) return
    for (const item of list) if (!found.has(item.id)) found.set(item.id, item)
  }

  if (record.mappedUnicode) {
    const parsed = extractUnicodeChar(record.mappedUnicode)
    if (parsed) add(dataset.byChar.get(parsed.char))
  }

  const convertedIds = record.composition ? convertArithmetic(record.composition, 'general').ids : ''
  const idsCandidates = [reviewedIds, record.ids, record.kind === 'ids' ? record.source : null, record.workbook?.ids, record.workbook?.idsMachine, convertedIds]
  for (const seq of idsCandidates) {
    if (typeof seq === 'string' && seq.trim()) add(dataset.byIds.get(cleanIds(seq)))
  }

  if (setId) {
    for (const code of [record.source, record.serial]) {
      if (typeof code === 'string' && code.trim() && record.kind !== 'ids') {
        add(dataset.byCharsetEncoding.get(`${setId}\t${normKey(code)}`))
      }
    }
  }

  return [...found.values()].sort((a, b) => a.id - b.id)
}

/**
 * Compute automatic RCC inclusion maps for a browsed Han Input character set.
 * @param {RccDataset | null} dataset
 * @param {{ setId: string, members?: string[], records?: import('./charsets.js').ProposalRecord[], glyphIdsTable?: Map<string, import('./glyph-ids.js').GlyphIds> }} input
 */
export function mapCharsetRccOverlap(dataset, { setId, members = [], records = [], glyphIdsTable }) {
  /** @type {Map<string, RccEntry[]>} */
  const byChar = new Map()
  /** @type {Map<string, RccEntry[]>} */
  const byRecordKey = new Map()
  /** @type {Set<number>} */
  const uniqueIds = new Set()

  if (!dataset || setId === RCC_CHARSET_ID) return { byChar, byRecordKey, count: 0, matchedCount: 0 }

  for (const char of members) {
    const hits = dataset.byChar.get(char)
    if (hits?.length) {
      byChar.set(char, hits)
      for (const hit of hits) uniqueIds.add(hit.id)
    }
  }

  for (const record of records) {
    const key = record.key ?? `${setId}:${record.serial || record.source || ''}`
    const reviewed = record.key ? glyphIdsTable?.get(record.key)?.ids ?? null : null
    const hits = findRccForRecord(dataset, record, reviewed, setId)
    if (hits.length) {
      byRecordKey.set(key, hits)
      for (const hit of hits) uniqueIds.add(hit.id)
    }
  }

  for (const claimed of dataset.byCharsetId.get(setId) ?? []) {
    uniqueIds.add(claimed.id)
  }

  return { byChar, byRecordKey, count: uniqueIds.size, matchedCount: byChar.size + byRecordKey.size }
}

/** @typedef {{ id: string, label: string, names: import('./charsets.js').Charset['names'], code?: string }} MatchedCharset */

/**
 * Find other Han Input character sets that include an RCC entry, combining RCC encoding claims,
 * Unicode block membership, Han Input standard codes, glyph-ids, and dialect rows.
 * @param {RccEntry} entry
 * @param {import('./charsets.js').Charset[]} catalogue
 * @returns {Promise<MatchedCharset[]>}
 */
export async function findCharsetsForRccEntry(entry, catalogue) {
  const byId = new Map(catalogue.filter(set => set.id !== RCC_CHARSET_ID).map(set => [set.id, set]))
  /** @type {Map<string, MatchedCharset>} */
  const found = new Map()

  /** @param {string} id @param {string} [code] */
  const add = (id, code) => {
    const set = byId.get(id)
    if (!set) return
    const existing = found.get(id)
    if (!existing) found.set(id, { id: set.id, label: set.label, names: set.names, ...(code ? { code } : {}) })
    else if (code && !existing.code) existing.code = code
  }

  // 1. Direct encoding claims recorded on the RCC entry itself.
  for (const enc of entry.encodings) {
    for (const charsetId of rccEncodingToCharsetIds(enc)) add(charsetId, enc.code)
  }

  // 2. Unicode block & standard encoding codes from Han Input for mapped Unicode characters.
  if (entry.mappedChar) {
    const blockId = unicodeBlockCharsetId(entry.mappedChar)
    if (blockId) add(blockId, entry.mappedUnicode)
    try {
      const charCodes = await codesOf(entry.mappedChar)
      if (charCodes.has('gb2312')) add('g0', charCodes.get('gb2312')?.[0])
      if (charCodes.has('big5')) {
        for (const big5Code of charCodes.get('big5') ?? []) {
          const big5Id = big5CharsetId(big5Code)
          if (big5Id) add(big5Id, big5Code)
        }
      }
      if (charCodes.has('cns')) {
        for (const cnsCode of charCodes.get('cns') ?? []) {
          const cnsId = cnsCharsetId(cnsCode)
          if (cnsId) add(cnsId, cnsCode)
        }
      }
      if (charCodes.has('irg-g')) {
        for (const gCode of charCodes.get('irg-g') ?? []) {
          const prefix = gCode.split('-')[0]?.toLowerCase()
          if (prefix && byId.has(prefix)) add(prefix, gCode)
        }
      }
      if (charCodes.has('irg-j')) {
        for (const jCode of charCodes.get('irg-j') ?? []) {
          const prefix = jCode.split('-')[0]?.toLowerCase()
          if (prefix && byId.has(prefix)) add(prefix, jCode)
        }
      }
      if (charCodes.has('irg-k')) {
        for (const kCode of charCodes.get('irg-k') ?? []) {
          const prefix = kCode.split('-')[0]?.toLowerCase()
          if (prefix && byId.has(prefix)) add(prefix, kCode)
        }
      }
      if (charCodes.has('irg-v')) {
        for (const vCode of charCodes.get('irg-v') ?? []) {
          const prefix = vCode.split('-')[0]?.toLowerCase()
          if (prefix && byId.has(prefix)) add(prefix, vCode)
        }
      }
      if (charCodes.has('irg-h')) add('h', charCodes.get('irg-h')?.[0])
    } catch { /* local codes bucket unavailable */ }
  }

  // 3. Unencoded proposal, IDS-record, and dialect sets matching this entry's IDS or mapped character.
  if (entry.allIds.length || entry.mappedChar) {
    const [glyphByIds, idsRecordsByIds, dialects] = await Promise.all([
      loadGlyphIdsByIds().catch(() => new Map()),
      entry.allIds.length ? loadIdsRecordsByIds(catalogue).catch(() => new Map()) : Promise.resolve(new Map()),
      loadDialects().catch(() => null),
    ])
    for (const seq of entry.allIds) {
      for (const setId of glyphByIds.get(seq) ?? []) add(setId)
      for (const setId of idsRecordsByIds.get(seq) ?? []) add(setId)
      const dialectRow = dialects?.byKey.get(seq)
      if (dialectRow) for (const setId of dialectRow.sets) add(setId)
    }
    if (entry.mappedChar) {
      const dialectRow = dialects?.byKey.get(entry.mappedChar)
      if (dialectRow) for (const setId of dialectRow.sets) add(setId)
    }
  }

  return [...found.values()]
}

/**
 * Convert an RccEntry into a ProposalRecord + ProposalDocument pair for opening in ProposalCard.
 * @param {RccEntry} entry
 * @returns {{ record: import('./charsets.js').ProposalRecord, document: import('./charsets.js').ProposalDocument }}
 */
export function rccEntryToProposal(entry) {
  /** @type {import('./charsets.js').ProposalDocument} */
  const document = {
    id: RCC_CHARSET_ID,
    document: 'Rare Character Compendium',
    title: 'Rare Character Compendium',
    source: 'rare.glyphatlas.org',
    date: '',
    url: `${RCC_ORIGIN}/`,
  }
  /** @type {import('./charsets.js').ProposalRecord} */
  const record = {
    serial: String(entry.id),
    source: entry.code,
    document: RCC_CHARSET_ID,
    ids: entry.ids ?? undefined,
    mappedUnicode: entry.mappedUnicode,
    status: entry.status ?? undefined,
    key: `${RCC_CHARSET_ID}:${entry.id}`,
    rcc: entry,
  }
  return { record, document }
}
