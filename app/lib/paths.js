// The pages in the rail, and the shapes of the detail routes below them. The worker uses the same
// list to tell an app route from a mistyped address.

export const NAV = /** @type {const} */ ([
  { path: '', label: 'nav.find' },
  { path: 'methods', label: 'nav.methods' },
  { path: 'readings', label: 'nav.readings' },
  { path: 'rhymes', label: 'nav.rhymes' },
  { path: 'radicals', label: 'nav.radicals' },
  { path: 'convert', label: 'nav.convert' },
  { path: 'about', label: 'nav.about' },
])

/** @type {Set<string>} */
const PAGES = new Set(NAV.map(entry => entry.path).filter(Boolean))

/** @param {string} path a pathname @returns {boolean} */
export function isAppPath(path) {
  const clean = path.replace(/^\/+|\/+$/g, '')
  if (!clean) return true
  if (PAGES.has(clean)) return true
  return /^[mv]\/[\w-]+$/.test(clean)
}
