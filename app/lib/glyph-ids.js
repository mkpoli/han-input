// Reviewed descriptions of the printed glyphs, from ids-input's glyph-ids table. Loaded on the first
// record card that asks.

/** @typedef {{ ids: string, verdict: 'known' | 'model' | 'written', by: string }} GlyphIds */

/** @type {Promise<Map<string, GlyphIds>> | null} */
let table = null

/** @returns {Promise<Map<string, GlyphIds>>} */
function load() {
  table ??= fetch('/charsets/glyph-ids.json')
    .then(response => response.ok ? response.json() : { glyphs: {} })
    .then(data => new Map(Object.entries(data.glyphs).map(([key, [ids, verdict, by]]) => [key, { ids, verdict, by }])))
    .catch(() => { table = null; return new Map() })
  return table
}

/** The reviewed description of a record, if it has one. @param {string | undefined} key */
export async function glyphIds(key) {
  return key ? (await load()).get(key) ?? null : null
}

/** Where a known description comes from: its source's name and page. @param {string} by */
export function sourceOf(by) {
  const [name, ref = ''] = by.split(' ')
  if (name === 'zi.tools') return { name: 'zi.tools', url: ref }
  if (name === 'babelstone') return { name: 'BabelStone', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT' }
  return null
}
