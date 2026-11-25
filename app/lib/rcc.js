// Connection to the Rare Character Compendium (https://rare.glyphatlas.org).
// Public record codes follow R+XXXX (four or more uppercase hex digits for positive integer ids)
// and exact lookups use the CORS-open /api/match endpoint for IDS descriptions and Unicode codes.

export const RCC_ORIGIN = 'https://rare.glyphatlas.org'

const SUPPORTED_LOCALES = new Set(['en', 'ja', 'zh-Hans', 'zh-Hant', 'ko', 'vi'])
const IDC_PATTERN = /[\u2FF0-\u2FFF\u31EF]/u
const UNICODE_CODE = /^U\+([0-9A-F]{4,6})$/i
const CACHE_LIMIT = 256
const DEFAULT_TIMEOUT_MS = 8000

/**
 * @typedef {{ id: number, code: string, ids: string | null, coverKey: string | null }} RccMatch
 * @typedef {{ fetchImpl?: typeof fetch, signal?: AbortSignal, timeoutMs?: number }} MatchOptions
 */

/** @type {Map<string, RccMatch[]>} */
const cache = new Map()

/**
 * Map a Han Input locale to a Rare Character Compendium URL locale prefix.
 * @param {string} [locale]
 */
export function rccLocale(locale = 'en') {
  return SUPPORTED_LOCALES.has(locale) ? locale : 'en'
}

/**
 * Format a positive integer RCC record id as R+XXXX (growing past four digits above 0xFFFF).
 * @param {number} id
 */
export function formatRccCode(id) {
  if (!Number.isSafeInteger(id) || id <= 0) return ''
  return `R+${id.toString(16).toUpperCase().padStart(4, '0')}`
}

/**
 * Parse an explicit R+XXXX record code into its positive integer id, or null if invalid.
 * Enforces canonical digit padding (e.g. R+0004, R+10000; rejects R+0000 or R+00004).
 * @param {string} text
 */
export function parseRccCode(text) {
  const typed = text.normalize('NFKC').trim()
  const match = typed.match(/^r\+([0-9a-f]{4,8})$/i)
  if (!match) return null
  const digits = match[1].toUpperCase()
  const id = Number.parseInt(digits, 16)
  if (!Number.isSafeInteger(id) || id <= 0) return null
  return id.toString(16).toUpperCase().padStart(4, '0') === digits ? id : null
}

/**
 * Locale-aware URL for an RCC entry page.
 * @param {number} id
 * @param {string} [locale]
 */
export function rccEntryUrl(id, locale = 'en') {
  return `${RCC_ORIGIN}/${rccLocale(locale)}/entry/${id}`
}

/**
 * Locale-aware URL for searching or opening RCC.
 * @param {string} [query]
 * @param {string} [locale]
 */
export function rccSearchUrl(query = '', locale = 'en') {
  const trimmed = query.trim()
  const base = `${RCC_ORIGIN}/${rccLocale(locale)}`
  return trimmed ? `${base}/?q=${encodeURIComponent(trimmed)}` : base
}

/**
 * Remove whitespace from an IDS string before sending it to RCC.
 * @param {string} text
 */
export function cleanIds(text) {
  return text.replace(/\s+/gu, '')
}

/**
 * Whether a string looks like an IDS sequence accepted by RCC's /api/match?ids= endpoint.
 * @param {string} text
 */
export function isIdsSequence(text) {
  const cleaned = cleanIds(text)
  if (!cleaned || cleaned.length > 200 || [...cleaned].length < 2) return false
  return IDC_PATTERN.test(cleaned)
}

/**
 * Normalize raw /api/match rows into deduplicated, sorted RccMatch records.
 * @param {unknown} payload
 * @returns {RccMatch[]}
 */
function normalizeMatches(payload) {
  if (!Array.isArray(payload)) return []
  /** @type {Map<number, RccMatch>} */
  const byId = new Map()
  for (const row of payload) {
    if (!row || typeof row !== 'object') continue
    const id = /** @type {{ id?: unknown }} */ (row).id
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) continue
    if (byId.has(id)) continue
    const rawIds = /** @type {{ ids?: unknown }} */ (row).ids
    const rawCover = /** @type {{ cover_key?: unknown }} */ (row).cover_key
    byId.set(id, {
      id,
      code: formatRccCode(id),
      ids: typeof rawIds === 'string' && rawIds.trim() ? rawIds.trim() : null,
      coverKey: typeof rawCover === 'string' && rawCover ? rawCover : null,
    })
  }
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

/** @param {string} key @param {RccMatch[]} value */
function remember(key, value) {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, value)
}

/**
 * Shared fetch helper for /api/match queries.
 * @param {string} cacheKey
 * @param {string} url
 * @param {MatchOptions} [options]
 * @returns {Promise<RccMatch[]>}
 */
async function fetchMatches(cacheKey, url, options = {}) {
  const { fetchImpl, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options
  if (signal?.aborted) return []
  const useCache = !fetchImpl
  if (useCache && cache.has(cacheKey)) return cache.get(cacheKey) ?? []
  const fetcher = fetchImpl ?? (typeof fetch === 'function' ? fetch : null)
  if (!fetcher) return []
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = timeoutMs > 0 ? setTimeout(abort, timeoutMs) : null
  try {
    const response = await fetcher(url, { signal: controller.signal })
    if (!response.ok) return []
    const matches = normalizeMatches(await response.json())
    if (useCache) remember(cacheKey, matches)
    return matches
  } catch {
    return []
  } finally {
    if (timer !== null) clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

/**
 * Look up RCC entries matching an exact IDS description.
 * @param {string} ids
 * @param {MatchOptions} [options]
 * @returns {Promise<RccMatch[]>}
 */
export async function matchRccByIds(ids, options = {}) {
  const cleaned = cleanIds(ids)
  if (!isIdsSequence(cleaned)) return []
  return fetchMatches(`ids:${cleaned}`, `${RCC_ORIGIN}/api/match?ids=${encodeURIComponent(cleaned)}`, options)
}

/**
 * Look up RCC entries carrying a Unicode encoding claim for a code point (e.g. U+5650).
 * @param {string} code
 * @param {MatchOptions} [options]
 * @returns {Promise<RccMatch[]>}
 */
export async function matchRccByCode(code, options = {}) {
  const match = code.trim().match(UNICODE_CODE)
  if (!match) return []
  const normalized = `U+${match[1].toUpperCase()}`
  return fetchMatches(`code:${normalized}`, `${RCC_ORIGIN}/api/match?code=${encodeURIComponent(normalized)}`, options)
}

/**
 * Look up RCC entries across several candidate IDS descriptions, merging unique records by id.
 * @param {readonly string[]} idsList
 * @param {MatchOptions} [options]
 * @returns {Promise<RccMatch[]>}
 */
export async function matchRccByIdsList(idsList, options = {}) {
  const candidates = [...new Set(idsList.map(cleanIds).filter(isIdsSequence))]
  if (!candidates.length) return []
  const lists = await Promise.all(candidates.map(ids => matchRccByIds(ids, options)))
  /** @type {Map<number, RccMatch>} */
  const merged = new Map()
  for (const list of lists) {
    for (const item of list) {
      if (!merged.has(item.id)) merged.set(item.id, item)
    }
  }
  return [...merged.values()].sort((a, b) => a.id - b.id)
}

/** Clear the in-memory lookup cache (intended for tests). */
export function clearRccCache() {
  cache.clear()
}
