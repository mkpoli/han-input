// The pages in the rail, and the shapes of the detail routes below them. The worker uses the same
// list to tell an app route from a mistyped address.

export const NAV = /** @type {const} */ ([
  { path: '', label: 'nav.find' },
  { path: 'methods', label: 'nav.methods' },
  { path: 'readings', label: 'nav.readings' },
  { path: 'rhymes', label: 'nav.rhymes' },
  { path: 'radicals', label: 'nav.radicals' },
  { path: 'dialects', label: 'nav.dialects' },
  { path: 'convert', label: 'nav.convert' },
  { path: 'composition', label: 'nav.composition' },
  { path: 'about', label: 'nav.about' },
])

/** @type {Set<string>} */
const PAGES = new Set(NAV.map(entry => entry.path).filter(Boolean))

/**
 * The page a path names: a rail page, the page a detail route belongs to, or `notfound`.
 * @param {string} path a pathname
 * @returns {string}
 */
export function pageOf(path) {
  const clean = path.replace(/^\/+|\/+$/g, '')
  if (!clean) return ''
  if (PAGES.has(clean)) return clean
  const detail = /^([mv])\/[\w-]+$/.exec(clean)
  return detail ? detail[1] : 'notfound'
}

/** @param {string} path a pathname @returns {boolean} */
export function isAppPath(path) {
  return pageOf(path) !== 'notfound'
}
