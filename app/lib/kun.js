// The Hokkien 訓用字 rows from the Ministry of Education dictionary, grouped by the character they
// write. A row keeps the reading the dictionary gives, the other characters it records for the word
// and the first gloss, so the page can show what one character stands for.

/** @typedef {{ char: string, reading: string, benzi: string[], gloss: string, id: string, url: string }} KunRow */
/** @typedef {{ name: string, site: string, url: string, version: string, sha256: string, licence: string, licenceUrl: string, retrieved: string, note: string }} KunSource */
/** @typedef {{ char: string, rows: KunRow[] }} KunEntry */
/** @typedef {{ source: KunSource, rows: KunRow[], entries: KunEntry[], byChar: Map<string, KunEntry> }} Kun */

/** Group the rows by character, in the order the dictionary lists them. @param {{ source: KunSource, rows: KunRow[] }} doc @returns {Kun} */
export function groupKun(doc) {
  if (!doc || !doc.source || !Array.isArray(doc.rows)) throw new Error('Invalid kun readings')
  /** @type {Map<string, KunEntry>} */
  const byChar = new Map()
  for (const row of doc.rows) {
    if (typeof row.char !== 'string' || !row.char || typeof row.reading !== 'string' || !row.reading) continue
    let entry = byChar.get(row.char)
    if (!entry) byChar.set(row.char, entry = { char: row.char, rows: [] })
    entry.rows.push({
      ...row,
      benzi: Array.isArray(row.benzi) ? row.benzi.filter(char => typeof char === 'string' && char) : [],
      gloss: typeof row.gloss === 'string' ? row.gloss : '',
    })
  }
  return { source: doc.source, rows: doc.rows, entries: [...byChar.values()], byChar }
}

/** @type {Promise<Kun> | null} */
let pending = null
/** @returns {Promise<Kun>} */
export function loadKun() {
  return pending ??= fetch('/kun/readings.json').then(response => {
    if (!response.ok) throw new Error('Kun readings unavailable')
    return response.json()
  }).then(groupKun).catch(error => { pending = null; throw error })
}
