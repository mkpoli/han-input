// Where a 字統 catalogue set lives on zi.tools. Its set view takes the set's abbreviation, except
// for the Shuowen view, which opens on a radical and which zi.tools reaches as 篆/zhuan.
const SETS = 'https://zi.tools/?secondary=character_set'
export const pageOf = (/** @type {string} */ abbr) => `${SETS}&set=${encodeURIComponent(abbr)}`

/** @param {{ id: string, abbr: string }} entry @returns {string} */
export function ziSourcePage(entry) {
  if (entry.id === 'swjz') return pageOf('zhuan')
  return pageOf(entry.abbr)
}
