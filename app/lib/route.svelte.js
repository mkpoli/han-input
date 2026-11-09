// Where the reader is: the page in the path, the open character in `?c=` (its code point in hex),
// the page's query in `?q=`, Find's character set in `?set=`, and the page of a browsed set in `?p=`.

import { NAV } from './paths.js'
export { NAV }

/** @typedef {{ page: string, method: string, q: string, c: string, set: string, p: number }} Route */

const hex = (/** @type {string} */ char) => (char.codePointAt(0) ?? 0).toString(16).toUpperCase()

/** @returns {Route} */
function read() {
  const path = location.pathname.replace(/^\/+|\/+$/g, '')
  const pagePath = path === 'index.html' ? '' : path
  const params = new URLSearchParams(location.search)
  const c = params.get('c') ?? ''
  const q = params.get('q') ?? ''
  const p = Number.parseInt(params.get('p') ?? '', 10)
  const char = /^[0-9a-f]{4,5}$/i.test(c) ? String.fromCodePoint(parseInt(c, 16)) : ''
  const inner = pagePath.match(/^([mv])\/([\w-]+)$/)
  const known = NAV.some(entry => entry.path === pagePath)
  const page = inner ? inner[1] : known ? pagePath : pagePath ? 'notfound' : ''
  return { page, method: inner?.[2] ?? '', q, c: char, set: page === '' ? params.get('set') ?? '' : '', p: p > 1 ? p : 1 }
}

export const route = $state(read())

/** @param {Route} next */
function href(next) {
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.c) params.set('c', hex(next.c))
  if (next.page === '' && next.set) params.set('set', next.set)
  if (next.page === '' && next.set && !next.q && next.p > 1) params.set('p', String(next.p))
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
  route.p = 1
  history.pushState(null, '', href(route))
  scrollTo(0, 0)
}

/** Close the open character, leaving a record card free to take its place. */
export function close() {
  if (!route.c) return
  route.c = ''
  history.replaceState(null, '', href(route))
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
  route.p = 1
  history.replaceState(null, '', href(route))
}

/** @param {string} id */
export function setCharset(id) {
  if (route.page !== '' || route.set === id) return
  route.set = id
  route.p = 1
  history.pushState(null, '', href(route))
}

/** Show one page of a browsed set in the address, so a reload, a shared link or Back finds it.
 * @param {number} p @param {{ replace?: boolean }} [mode] */
export function setPage(p, mode = {}) {
  if (route.page !== '' || !route.set || !Number.isInteger(p) || p < 1 || route.p === p) return
  route.p = p
  if (mode.replace) history.replaceState(null, '', href(route))
  else history.pushState(null, '', href(route))
}

/** A link into the site. @param {string} page @param {{ method?: string, c?: string, q?: string, set?: string, p?: number }} [at] */
export const link = (page, at = {}) => href({ page, method: at.method ?? '', c: at.c ?? '', q: at.q ?? '', set: at.set ?? '', p: at.p ?? 1 })

addEventListener('popstate', () => Object.assign(route, read()))
