// Client-side IDS glyph composition via han-compose, backed by the CORS-open serif export.
// Dynamically imports han-compose on first use so initial page load stays small.
// Only visible tiles ask to compose, with bounded concurrency, per-job deadlines,
// queue cancellation on unmount, and an in-memory LRU cache.

export const COMPOSER_BASE = 'https://ids-input-composer.mkpoli.workers.dev/b53713c2da0e-serif-compose-layout-v4-serif-f7+kin'

const CACHE_LIMIT = 1000
const MAX_CONCURRENT = 8
const DEFAULT_TIMEOUT_MS = 15_000

/** @typedef {{ d: string, cut: string | null }} ComposedGlyph */
/** @typedef {{ compose: (source: unknown, ids: string, options?: { fontStyle?: 'sans' | 'serif' }) => Promise<{ d?: string, cut?: string | null, missing?: string[] } | null | undefined>, source: unknown }} ComposerRuntime */
/**
 * @typedef {{
 *   key: string,
 *   started: boolean,
 *   waiters: number,
 *   promise: Promise<ComposedGlyph | null>,
 *   resolve: (value: ComposedGlyph | null) => void,
 *   start: () => void,
 * }} QueuedJob
 */

/** @type {Promise<ComposerRuntime> | null} */
let runtimePromise = null
/** @type {Map<string, ComposedGlyph | null>} */
const cache = new Map()
/** @type {Map<string, QueuedJob>} */
const pending = new Map()
/** @type {QueuedJob[]} */
const queue = []
let active = 0

function getRuntime() {
  if (!runtimePromise) {
    runtimePromise = import('han-compose/loader').then(mod => ({
      compose: mod.compose,
      // Production builds do not bundle the 27 MB unicode/outlines fallback shards; return {}
      // so missing non-Han components degrade cleanly to cover photo / IDS without 404 requests.
      source: mod.fromUrl(COMPOSER_BASE, { load: async () => ({}) }),
    })).catch(err => {
      runtimePromise = null
      throw err
    })
  }
  return runtimePromise
}

/** @param {string} key @param {ComposedGlyph | null} value */
function remember(key, value) {
  cache.delete(key)
  cache.set(key, value)
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

/**
 * Race a promise against a deadline, clearing the timer as soon as the promise settles.
 * @template T
 * @param {Promise<T>} work
 * @param {number} timeoutMs
 * @returns {Promise<T>}
 */
function withTimeout(work, timeoutMs) {
  if (!(timeoutMs > 0)) return work
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Compose timeout')), timeoutMs)
    work.then(
      value => { clearTimeout(timer); resolve(value) },
      error => { clearTimeout(timer); reject(error) },
    )
  })
}

function drain() {
  while (active < MAX_CONCURRENT && queue.length) {
    const next = queue.shift()
    if (!next || next.waiters <= 0) continue
    next.start()
  }
}

/**
 * Compose an IDS description into a serif SVG path (`viewBox="0 0 1000 1000"`).
 * Returns null if the sequence is empty, unsupported, aborted while queued, timed out, or missing required components.
 * @param {string} ids
 * @param {{ signal?: AbortSignal, timeoutMs?: number, runtime?: () => Promise<ComposerRuntime> }} [options]
 * @returns {Promise<ComposedGlyph | null>}
 */
export function composeGlyph(ids, options = {}) {
  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS, runtime = getRuntime } = options
  const clean = ids.normalize('NFC').replace(/\s+/gu, '')
  if (!clean || signal?.aborted) return Promise.resolve(null)
  if (cache.has(clean)) {
    const hit = cache.get(clean) ?? null
    cache.delete(clean)
    cache.set(clean, hit)
    return Promise.resolve(hit)
  }

  let job = pending.get(clean)
  if (!job) {
    /** @type {(value: ComposedGlyph | null) => void} */
    let resolveJob = () => {}
    const promise = new Promise(resolve => { resolveJob = resolve })
    /** @type {QueuedJob} */
    const created = {
      key: clean,
      started: false,
      waiters: 0,
      promise,
      resolve: resolveJob,
      start() {
        if (created.started) return
        created.started = true
        active++
        ;(async () => {
          try {
            const { compose, source } = await withTimeout(runtime(), timeoutMs)
            const drawn = await withTimeout(compose(source, clean, { fontStyle: 'serif' }), timeoutMs)
            if (!drawn?.d || drawn.missing?.length) {
              remember(clean, null)
              return null
            }
            const result = { d: drawn.d, cut: drawn.cut || null }
            remember(clean, result)
            return result
          } catch {
            return null
          }
        })().then(result => {
          if (pending.get(clean) === created) pending.delete(clean)
          created.resolve(result)
        }).finally(() => {
          active--
          drain()
        })
      },
    }
    job = created
    pending.set(clean, job)
    queue.push(job)
  }

  job.waiters++
  drain()

  if (!signal) return job.promise

  return new Promise(resolve => {
    const activeJob = job
    const onAbort = () => {
      activeJob.waiters = Math.max(0, activeJob.waiters - 1)
      if (!activeJob.started && activeJob.waiters === 0) {
        const idx = queue.indexOf(activeJob)
        if (idx >= 0) queue.splice(idx, 1)
        if (pending.get(clean) === activeJob) pending.delete(clean)
        activeJob.resolve(null)
      }
      resolve(null)
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    activeJob.promise.then(result => {
      signal.removeEventListener('abort', onAbort)
      resolve(result)
    })
  })
}

/** Clear cached SVG paths and queued jobs (intended for tests). */
export function clearComposeCache() {
  cache.clear()
  pending.clear()
  queue.length = 0
  active = 0
  runtimePromise = null
}
