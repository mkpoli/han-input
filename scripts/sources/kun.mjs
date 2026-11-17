// The rows of the Ministry of Education dictionary that mark a headword 替 (替代字): the character,
// its reading, the other characters the entry records and its first gloss.
const MARK = '【替】'

/** @typedef {{ char: string, reading: string, benzi: string[], gloss: string, id: string, url: string }} KunRow */

/** @param {unknown} json KipSutianData.json @returns {KunRow[]} */
export function kunRows(json) {
  if (!Array.isArray(json)) throw new Error('KipSutianData.json is not an array')
  /** @type {KunRow[]} */
  const rows = []
  for (const entry of json) {
    const head = entry?.['漢字']
    if (typeof head !== 'string' || !head.endsWith(MARK)) continue
    const char = head.slice(0, -MARK.length)
    if ([...char].length !== 1) continue
    const reading = entry['羅馬字']
    if (typeof reading !== 'string' || !reading) continue
    const benzi = [...new Set((entry['異用字'] ?? []).map((/** @type {any} */ row) => row?.['異用字']).filter((/** @type {unknown} */ value) => typeof value === 'string' && value))]
    const gloss = entry['義項']?.[0]?.['解說']
    rows.push({
      char, reading, benzi,
      gloss: typeof gloss === 'string' ? gloss : '',
      id: String(entry['詞目id']),
      url: String(entry['網址'] ?? ''),
    })
  }
  return rows
}
