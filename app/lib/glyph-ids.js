// Reviewed descriptions of the printed glyphs, from ids-input's glyph-ids table. Loaded on the first
// record card that asks.

/** @typedef {{ ids: string, verdict: 'known' | 'model' | 'written', by: string }} GlyphIds */

/** @type {Promise<Map<string, GlyphIds>> | null} */
let table = null
/** @type {Promise<Map<string, string[]>> | null} */
let byIdsCache = null

/** @returns {Promise<Map<string, GlyphIds>>} */
export function loadGlyphIdsTable() {
  table ??= fetch('/charsets/glyph-ids.json')
    .then(response => {
      if (!response.ok) throw new Error(`glyph-ids.json: ${response.status}`)
      return response.json()
    })
    .then(data => new Map(Object.entries(data.glyphs).map(([key, [ids, verdict, by]]) => [key, { ids, verdict, by }])))
    .catch(() => { table = null; byIdsCache = null; return new Map() })
  return table
}

/** Reverse map from cleaned IDS to the charset ids in glyph-ids.json that carry it. @returns {Promise<Map<string, string[]>>} */
export function loadGlyphIdsByIds() {
  byIdsCache ??= loadGlyphIdsTable().then(map => {
    /** @type {Map<string, Set<string>>} */
    const reverse = new Map()
    for (const [key, entry] of map) {
      const colon = key.indexOf(':')
      if (colon <= 0 || !entry.ids) continue
      const setId = key.slice(0, colon)
      const cleaned = entry.ids.replace(/\s+/gu, '')
      let sets = reverse.get(cleaned)
      if (!sets) reverse.set(cleaned, sets = new Set())
      sets.add(setId)
    }
    return new Map([...reverse].map(([ids, sets]) => [ids, [...sets]]))
  })
  return byIdsCache
}

/** The reviewed description of a record, if it has one. @param {string | undefined} key */
export async function glyphIds(key) {
  return key ? (await loadGlyphIdsTable()).get(key) ?? null : null
}

/** Where a known description comes from: its source's name and page. @param {string} by */
export function sourceOf(by) {
  const [name, ref = ''] = by.split(' ')
  if (name === 'zi.tools') return { name: 'zi.tools', url: ref }
  if (name === 'babelstone') return { name: 'BabelStone', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT' }
  return null
}
