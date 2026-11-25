// What each page says about itself outside the page: the title a tab and a search result show, the
// one-line description under it, and the address the page answers at. The worker reads this to
// answer a crawler without running the app, and the app reads it to keep the head in step when a
// reader moves between finders without a page load.
import en from '../../messages/en.json' with { type: 'json' }
import ja from '../../messages/ja.json' with { type: 'json' }
import zhHans from '../../messages/zh-Hans.json' with { type: 'json' }
import zhHant from '../../messages/zh-Hant.json' with { type: 'json' }
import ko from '../../messages/ko.json' with { type: 'json' }
import { pageMetadata } from './title.js'

/** @typedef {'en' | 'ja' | 'zh-Hans' | 'zh-Hant' | 'ko'} SeoLocale */

export const SEO_LOCALES = /** @type {const} */ (['en', 'ja', 'zh-Hans', 'zh-Hant', 'ko'])

/** @type {Record<SeoLocale, Record<string, string>>} */
const CATALOGUES = { en, ja, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ko }

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

/** Recognised interface locale tag, or null when omitted or unknown. @param {string | null | undefined} lang @returns {SeoLocale | null} */
export function localeOf(lang) {
  return lang && Object.hasOwn(CATALOGUES, lang) ? /** @type {SeoLocale} */ (lang) : null
}

/** Canonical address for a path in a locale; English keeps the bare path. @param {string} path @param {string | null} [lang] */
export function localizedUrl(path, lang = null) {
  const locale = localeOf(lang)
  const base = SITE.url + canonicalPath(path)
  return locale && locale !== 'en' ? `${base}?lang=${locale}` : base
}

/** Reciprocal hreflang alternates for a page, with English as x-default. @param {string} path */
export function alternatesOf(path) {
  return [
    ...SEO_LOCALES.map(locale => ({ lang: locale, href: localizedUrl(path, locale) })),
    { lang: 'x-default', href: localizedUrl(path, 'en') },
  ]
}

/** The title and description for a page in a given locale (English by default). @param {string} page @param {string | null} [lang] */
export function localizedSeo(page, lang = null) {
  const locale = localeOf(lang) ?? 'en'
  const messages = CATALOGUES[locale]
  const { title, description } = pageMetadata(page)
  const appName = messages['app.name'] ?? CATALOGUES.en['app.name']
  const pageTitle = messages[title] ?? CATALOGUES.en[title]
  return {
    title: title === 'find.seoTitle' ? `${appName} — ${pageTitle}` : `${pageTitle} — ${appName}`,
    description: messages[description] ?? CATALOGUES.en[description],
  }
}

/** The English title and description a crawler that runs no script reads. @param {string} page */
export function englishSeo(page) {
  return localizedSeo(page, 'en')
}

/** The title, description, canonical address and locale of a page. @param {string} page @param {string} [path] @param {string | null} [lang] */
export function seoOf(page, path = page ? `/${page}` : '/', lang = null) {
  const locale = localeOf(lang) ?? 'en'
  return { ...localizedSeo(page, locale), url: localizedUrl(path, locale), locale }
}

/**
 * Put a page's title, description and canonical address into the document, so a reader who moves
 * between finders without a page load still sees the right tab and shares the right link.
 * @param {string} page
 * @param {string} path
 * @param {{ title: string, description: string }} [text] the reader's language, when it has one
 * @param {string | null} [lang]
 */
export function applySeo(page, path = page ? `/${page}` : '/', text = englishSeo(page), lang = null) {
  if (typeof document === 'undefined') return
  const { title, description } = text
  const active = localeOf(lang) ?? 'en'
  const url = localizedUrl(path, active)
  document.title = title
  /** @param {string} selector @param {string} value @param {string} [attribute] */
  const set = (selector, value, attribute = 'content') => {
    const element = document.head.querySelector(selector)
    if (element) element.setAttribute(attribute, value)
  }
  set('meta[name="description"]', description)
  set('link[rel="canonical"]', url, 'href')
  set('meta[name="robots"]', page === 'notfound' ? 'noindex, nofollow' : 'index, follow')
  set('meta[property="og:locale"]', active)
  set('meta[property="og:title"]', title)
  set('meta[property="og:description"]', description)
  set('meta[property="og:url"]', url)
  set('meta[name="twitter:title"]', title)
  set('meta[name="twitter:description"]', description)
}
