// The Hokkien 訓用字 rows from the Ministry of Education dictionary, grouped by the character they
// write. A row keeps the reading the dictionary gives, the other characters it records for the word
// and the first gloss, so the page can show what one character stands for.

/** @typedef {{ char: string, reading: string, benzi: string[], gloss: string, id: string, url: string }} HunRow */
/** @typedef {{ name: string, site: string, url: string, version: string, sha256: string, licence: string, licenceUrl: string, retrieved: string, note: string }} HunSource */
/** @typedef {{ char: string, rows: HunRow[] }} HunEntry */
/** @typedef {{ source: HunSource, rows: HunRow[], entries: HunEntry[], byChar: Map<string, HunEntry> }} Hun */

/** Group the rows by character, in the order the dictionary lists them. @param {{ source: HunSource, rows: HunRow[] }} doc @returns {Hun} */
export function groupHun(doc) {
  if (!doc || !doc.source || !Array.isArray(doc.rows)) throw new Error('Invalid hun readings')
  /** @type {Map<string, HunEntry>} */
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

/** @type {Promise<Hun> | null} */
let pending = null
/** @returns {Promise<Hun>} */
export function loadHun() {
  return pending ??= fetch('/hun/readings.json').then(response => {
    if (!response.ok) throw new Error('Hun readings unavailable')
    return response.json()
  }).then(groupHun).catch(error => { pending = null; throw error })
}
