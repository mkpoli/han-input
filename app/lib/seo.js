// What each page says about itself outside the page: the title a tab and a search result show, the
// one-line description under it, and the address the page answers at. The worker reads this to
// answer a crawler without running the app, and the app reads it to keep the head in step when a
// reader moves between finders without a page load.
import en from '../../messages/en.json' with { type: 'json' }
import { pageMetadata } from './title.js'

/** The English catalogue, read by key. @type {Record<string, string>} */
const MESSAGES = en

export const SITE = {
  name: 'Han Input',
  url: 'https://han.mkpo.li',
  image: 'https://han.mkpo.li/og.png',
}

/** A pathname as an address: one leading slash, no trailing slash, no query. @param {string} path */
export function canonicalPath(path) {
  const clean = String(path).replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '')
  return clean && clean !== 'index.html' ? `/${clean}` : '/'
}

/** The title and description a crawler that runs no script reads. @param {string} page */
export function englishSeo(page) {
  const { title, description } = pageMetadata(page)
  return {
    title: title === 'find.seoTitle'
      ? `${MESSAGES['app.name']} — ${MESSAGES[title]}`
      : `${MESSAGES[title]} — ${MESSAGES['app.name']}`,
    description: MESSAGES[description],
  }
}

/** The English title, description and canonical address of a page. @param {string} page */
export function seoOf(page, path = page ? `/${page}` : '/') {
  return { ...englishSeo(page), url: SITE.url + canonicalPath(path) }
}

/**
 * Put a page's title, description and canonical address into the document, so a reader who moves
 * between finders without a page load still sees the right tab and shares the right link.
 * @param {string} page
 * @param {string} path
 * @param {{ title: string, description: string }} [text] the reader's language, when it has one
 */
export function applySeo(page, path = page ? `/${page}` : '/', text = englishSeo(page)) {
  if (typeof document === 'undefined') return
  const { title, description } = text
  const url = SITE.url + canonicalPath(path)
  document.title = title
  /** @param {string} selector @param {string} value @param {string} [attribute] */
  const set = (selector, value, attribute = 'content') => {
    const element = document.head.querySelector(selector)
    if (element) element.setAttribute(attribute, value)
  }
  set('meta[name="description"]', description)
  set('link[rel="canonical"]', url, 'href')
  set('meta[name="robots"]', page === 'notfound' ? 'noindex, nofollow' : 'index, follow')
  set('meta[property="og:title"]', title)
  set('meta[property="og:description"]', description)
  set('meta[property="og:url"]', url)
  set('meta[name="twitter:title"]', title)
  set('meta[name="twitter:description"]', description)
}
