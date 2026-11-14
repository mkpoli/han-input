// The dialect-character sets as one list: every character or IDS once, with the doculects that use it
// and the source rows behind each use. The sets come from the catalogue; the rows from the same build.
import { loadCharsets } from './charsets.js'

export const DIALECT_GROUP = 'Dialect characters'

/** One hue per doculect, used for its chip, its dot and its tag. */
export const HUES = /** @type {Record<string, number>} */ ({
  dialect_guan: 250, dialect_jin: 55, dialect_wu: 150, dialect_hui: 95, dialect_gan: 30, dialect_xiang: 0,
  dialect_hakka: 120, dialect_yue: 20, dialect_min: 200, dialect_min_dong: 225, dialect_min_nan: 180,
  dialect_ping: 75, dialect_kokuji: 330, dialect_gukja: 290,
})

/** 閩語 holds every Min row; a row it shares with 閩東語 or 閩南語 is one doculect's, not two. */
const MIN = 'dialect_min'
const MIN_PARTS = ['dialect_min_dong', 'dialect_min_nan']

/** @typedef {{ char: string, ids?: string, sets: string[], def?: string, readings?: [string, string][], note?: string }} DialectRow */
/** @typedef {{ key: string, char: string, sets: string[], doculects: number, rows: DialectRow[] }} DialectEntry */
/** @typedef {{ sets: import('./charsets.js').Charset[], entries: DialectEntry[], byKey: Map<string, DialectEntry> }} Dialects */

/** The doculects rows count as together. Each row is one doculect per tag, except that a Min row
 * read at Fuzhou or Xiamen counts there and not again as 閩語. @param {{ sets: string[] }[]} rows */
export function doculects(rows) {
  const tags = new Set(rows.flatMap(row => row.sets.some(id => MIN_PARTS.includes(id)) ? row.sets.filter(id => id !== MIN) : row.sets))
  return tags.size
}

/** Group the rows by character, or by IDS where the row has no character, in catalogue order.
 * @param {import('./charsets.js').Charset[]} sets @param {DialectRow[]} rows @returns {Dialects} */
export function groupDialects(sets, rows) {
  const order = new Map(sets.map((set, i) => [set.id, i]))
  /** @type {Map<string, DialectEntry>} */
  const byKey = new Map()
  for (const row of rows) {
    const key = row.char || row.ids || ''
    if (!key) continue
    let entry = byKey.get(key)
    if (!entry) byKey.set(key, entry = { key, char: row.char, sets: [], doculects: 0, rows: [] })
    entry.rows.push(row)
    for (const id of row.sets) if (!entry.sets.includes(id)) entry.sets.push(id)
  }
  const entries = [...byKey.values()]
  for (const entry of entries) {
    entry.sets.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    entry.doculects = doculects(entry.rows)
  }
  return { sets, entries, byKey }
}

/** @type {Promise<Dialects> | null} */
let pending = null
/** @returns {Promise<Dialects>} */
export function loadDialects() {
  return pending ??= Promise.all([
    loadCharsets(),
    fetch('/charsets/dialect_rows.json').then(response => {
      if (!response.ok) throw new Error('Dialect rows unavailable')
      return response.json()
    }),
  ]).then(([catalogue, rows]) => {
    if (!Array.isArray(rows)) throw new Error('Invalid dialect rows')
    return groupDialects(catalogue.filter(set => set.group === DIALECT_GROUP), rows)
  }).catch(error => { pending = null; throw error })
}

