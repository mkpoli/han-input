// Where a 字統 catalogue set lives on zi.tools. Its set view takes the set's abbreviation, except
// for the two cases below: hidden document registries are left out of the set tabs, and the Shuowen
// view opens on a radical, which zi.tools reaches as 篆/zhuan.
const SETS = 'https://zi.tools/?secondary=character_set'
export const pageOf = (/** @type {string} */ abbr) => `${SETS}&set=${encodeURIComponent(abbr)}`

/** @param {{ id: string, abbr: string, hidden?: boolean }} entry @returns {string} */
export function ziSourcePage(entry) {
  if (entry.hidden) return 'https://zi.tools/'
  if (entry.id === 'swjz') return pageOf('zhuan')
  return pageOf(entry.abbr)
}
