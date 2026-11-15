// What every source module shares: pinned downloads, and the shape of a method.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/** The pinned downloads and the privately supplied files. HAN_INPUT_CACHE names a copy kept outside the checkout, so a fresh one can build. */
export const CACHE = process.env.HAN_INPUT_CACHE || join(import.meta.dirname, '..', 'cache')
/** A build's scratch directory, its own for each run so two builds over one cache do not write into each other. @param {string} name */
export const scratch = name => join(tmpdir(), `han-input-${name}-${process.pid}`)

/** @typedef {{ en: string, zh?: string, hans?: string, ja?: string, ko?: string }} Names */
/**
 * @typedef {{ name: string, url: string, licence: string, attribution?: string, version?: string, note?: string }} Source
 * @typedef {'shape' | 'reading' | 'extended' | 'historical' | 'direct' | 'index' | 'encoding'} Family
 * @typedef {{ id: string, family: Family, names: Names, source: Source, about?: string, keys?: string, tone?: 'pinyin', entries: Iterable<[string, string]> }} Method
 */

/** Download once, into cache/, under its own name; a digest pins what was fetched. @param {string} url @param {string} [as] @returns {Promise<string>} the local path */
export async function fetchOnce(url, as) {
  const path = join(CACHE, as ?? url.replace(/^https?:\/\//, '').replace(/[^\w.\-]+/g, '_'))
  if (existsSync(path)) return path
  mkdirSync(dirname(path), { recursive: true })
  const response = await fetch(url, { signal: AbortSignal.timeout(300_000) })
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  writeFileSync(path, new Uint8Array(await response.arrayBuffer()))
  console.log(`  fetched ${url}`)
  return path
}

/** @param {string} path */
export const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex')
