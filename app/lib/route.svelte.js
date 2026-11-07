// Where the reader is: the page in the path, the open character in `?c=` (its code point in hex),
// the page's query in `?q=`, and Find's character set in `?set=`.

export const NAV = /** @type {const} */ ([
  { path: '', label: 'nav.find' },
  { path: 'methods', label: 'nav.methods' },
  { path: 'readings', label: 'nav.readings' },
  { path: 'rhymes', label: 'nav.rhymes' },
  { path: 'radicals', label: 'nav.radicals' },
  { path: 'convert', label: 'nav.convert' },
  { path: 'about', label: 'nav.about' },
])

/** @typedef {{ page: string, method: string, q: string, c: string, set: string }} Route */

const hex = (/** @type {string} */ char) => (char.codePointAt(0) ?? 0).toString(16).toUpperCase()

/** @returns {Route} */
function read() {
  const path = location.pathname.replace(/^\/+|\/+$/g, '')
  const params = new URLSearchParams(location.search)
  const c = params.get('c') ?? ''
  const q = params.get('q') ?? ''
  const char = /^[0-9a-f]{4,5}$/i.test(c) ? String.fromCodePoint(parseInt(c, 16)) : ''
  const inner = path.match(/^([mv])\/([\w-]+)$/)
  const known = NAV.some(entry => entry.path === path)
  const page = inner ? inner[1] : known ? path : ''
  return { page, method: inner?.[2] ?? '', q, c: char, set: page === '' ? params.get('set') ?? '' : '' }
}

export const route = $state(read())

/** @param {Route} next */
function href(next) {
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.c) params.set('c', hex(next.c))
  if (next.page === '' && next.set) params.set('set', next.set)
  const search = params.toString()
  const path = next.method ? `${next.page}/${next.method}` : next.page
  return `/${path}${search ? `?${search}` : ''}`
}

/** Go to a page; the open character stays open. @param {string} page @param {string} [method] */
export function go(page, method = '') {
  route.page = page
  route.method = method
  route.q = ''
  route.set = ''
  history.pushState(null, '', href(route))
  scrollTo(0, 0)
}

/** @param {string} char */
export function open(char) {
  if (route.c === char) return
  route.c = char
  history.replaceState(null, '', href(route))
}

/** @param {string} q */
export function setQuery(q) {
  route.q = q
  history.replaceState(null, '', href(route))
}

/** @param {string} id */
export function setCharset(id) {
  if (route.page !== '' || route.set === id) return
  route.set = id
  history.pushState(null, '', href(route))
}

/** A link into the site. @param {string} page @param {{ method?: string, c?: string, q?: string, set?: string }} [at] */
export const link = (page, at = {}) => href({ page, method: at.method ?? '', c: at.c ?? '', q: at.q ?? '', set: at.set ?? '' })

addEventListener('popstate', () => Object.assign(route, read()))
