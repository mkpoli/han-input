// The interface's language. Every string the interface shows is a key in `messages/<locale>.json`;
// the page picks the language from `?lang=`, then the browser, and keeps the choice.
import en from '../../messages/en.json' with { type: 'json' }
import ja from '../../messages/ja.json' with { type: 'json' }
import zhHans from '../../messages/zh-Hans.json' with { type: 'json' }
import zhHant from '../../messages/zh-Hant.json' with { type: 'json' }
import ko from '../../messages/ko.json' with { type: 'json' }

/** @typedef {'en' | 'ja' | 'zh-Hans' | 'zh-Hant' | 'ko'} Locale */

export const LOCALES = /** @type {const} */ ([
  { key: 'en', name: 'English' },
  { key: 'ja', name: '日本語' },
  { key: 'zh-Hans', name: '简体中文' },
  { key: 'zh-Hant', name: '繁體中文' },
  { key: 'ko', name: '한국어' },
])

/** @type {Record<Locale, Record<string, string>>} */
const CATALOGUES = { en, ja, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ko }
const KEY = 'han-input:locale'

/** @param {string} wanted */
function match(wanted) {
  const tag = wanted.toLowerCase()
  if (tag.startsWith('zh')) return /hant|tw|hk|mo/.test(tag) ? 'zh-Hant' : 'zh-Hans'
  if (tag.startsWith('ja')) return 'ja'
  if (tag.startsWith('ko')) return 'ko'
  return 'en'
}

const asked = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null
const kept = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
const initial = /** @type {Locale} */ (asked && LOCALES.some(l => l.key === asked) ? asked
  : kept && LOCALES.some(l => l.key === kept) ? kept
  : match(typeof navigator !== 'undefined' ? navigator.language : 'en'))

export const i18n = $state({ locale: initial })

/** @param {Locale} locale */
export function setLocale(locale) {
  i18n.locale = locale
  try { localStorage.setItem(KEY, locale) } catch { /* the choice lasts this visit */ }
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}

if (typeof document !== 'undefined') document.documentElement.lang = initial

/** @param {string} key @param {Record<string, string | number>} [params] */
export function t(key, params) {
  const text = CATALOGUES[i18n.locale]?.[key] ?? CATALOGUES.en[key] ?? key
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (whole, name) => name in params ? String(params[name]) : whole)
}

/**
 * A method's name in the reader's language: its own names are mostly Chinese, so a language with no
 * name of its own reads the traditional form.
 * @param {{ en: string, zh?: string, hans?: string, ja?: string, ko?: string }} names
 */
export function nameOf(names) {
  const { locale } = i18n
  if (locale === 'en') return names.en
  if (locale === 'zh-Hans') return names.hans ?? names.zh ?? names.en
  if (locale === 'zh-Hant') return names.zh ?? names.en
  if (locale === 'ja') return names.ja ?? names.zh ?? names.en
  return names.ko ?? names.zh ?? names.en
}
