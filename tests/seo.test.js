import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { NAV } from '../app/lib/paths.js'
import { SITE, canonicalPath, seoOf } from '../app/lib/seo.js'
import en from '../messages/en.json' with { type: 'json' }

const read = (/** @type {string} */ path) => readFileSync(new URL(`../app/${path}`, import.meta.url), 'utf8')

describe('page address', () => {
  test('gives a path one leading slash and no trailing one', () => {
    expect(canonicalPath('/')).toBe('/')
    expect(canonicalPath('')).toBe('/')
    expect(canonicalPath('/methods')).toBe('/methods')
    expect(canonicalPath('methods/')).toBe('/methods')
    expect(canonicalPath('//methods//')).toBe('/methods')
    expect(canonicalPath('/index.html')).toBe('/')
  })
  test('drops the query, so a search or an open character keeps its page canonical', () => {
    expect(canonicalPath('/?q=lung4')).toBe('/')
    expect(canonicalPath('/methods?c=5B57')).toBe('/methods')
  })
})

describe('page SEO', () => {
  test('names the site first on the finder and the page first below it', () => {
    expect(seoOf('', '/')).toEqual({
      title: 'Han Input — Find a Chinese character',
      description: en['find.seo'],
      url: 'https://han.mkpo.li/',
    })
    expect(seoOf('methods', '/methods')).toEqual({
      title: 'Every way in — Han Input',
      description: en['methods.seo'],
      url: 'https://han.mkpo.li/methods',
    })
  })
  test('keeps a detail route’s address under the head of its page', () => {
    expect(seoOf('m', '/m/cangjie5')).toEqual({
      title: 'Every way in — Han Input',
      description: en['methods.seo'],
      url: 'https://han.mkpo.li/m/cangjie5',
    })
    expect(seoOf('v', '/v/16').title).toBe('Every variety — Han Input')
  })
  test('falls back to the finder for a route it does not know', () => {
    expect(seoOf('nope', '/nope')).toEqual(seoOf('', '/nope'))
  })
})

describe('served head', () => {
  const html = read('index.html')
  test('holds the tags the worker rewrites', () => {
    for (const tag of [
      '<title>', '<meta name="description"', '<meta name="robots"',
      '<link rel="canonical"', '<meta property="og:title"', '<meta property="og:description"',
      '<meta property="og:url"', '<meta name="twitter:title"', '<meta name="twitter:description"',
    ]) expect(html).toContain(tag)
  })
  test('describes the finder as the page SEO does', () => {
    expect(html).toContain(`<title>${seoOf('', '/').title}</title>`)
    expect(html).toContain(`<meta name="description" content="${en['find.seo']}">`)
  })
  test('carries a social card', () => {
    expect(html).toContain(`<meta property="og:image" content="${SITE.image}">`)
    expect(html).toContain('<meta property="og:image:width" content="1200">')
    expect(html).toContain('<meta property="og:image:height" content="630">')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(html).toContain(`<meta name="twitter:image" content="${SITE.image}">`)
  })
  test('parses as the site it claims to be', () => {
    const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)
    expect(match).not.toBeNull()
    const data = JSON.parse(/** @type {RegExpExecArray} */ (match)[1])
    expect(data['@type']).toBe('WebSite')
    expect(data.url).toBe('https://han.mkpo.li/')
    expect(data.potentialAction.target).toBe('https://han.mkpo.li/?q={search_term_string}')
  })
})

describe('crawler files', () => {
  test('points robots at the sitemap', () => {
    expect(read('public/robots.txt')).toContain('Sitemap: https://han.mkpo.li/sitemap.xml')
  })
  test('lists every rail page once', () => {
    const locs = [...read('public/sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1])
    const pages = NAV.map(entry => `${SITE.url}/${entry.path}`)
    expect(new Set(locs)).toEqual(new Set(pages))
    expect(locs.length).toBe(pages.length)
  })
  test('keeps the social card in the source tree', () => {
    const card = readFileSync(new URL('../app/public/og.png', import.meta.url))
    expect(card.subarray(1, 4).toString()).toBe('PNG')
  })
})
