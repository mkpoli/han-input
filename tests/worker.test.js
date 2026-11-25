import { describe, expect, test } from 'bun:test'
import worker from '../worker/index.js'
import { isAppPath, pageOf } from '../app/lib/paths.js'
import ja from '../messages/ja.json' with { type: 'json' }

const HTML = `<!doctype html><html lang="en"><head>
<title>Han Input — Find a character</title>
<meta name="description" content="Find a Chinese character.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://han.mkpo.li/">
<link rel="alternate" hreflang="en" href="https://han.mkpo.li/">
<link rel="alternate" hreflang="x-default" href="https://han.mkpo.li/">
<meta property="og:locale" content="en">
<meta property="og:title" content="Han Input — Find a character">
<meta property="og:description" content="Find a Chinese character.">
<meta property="og:url" content="https://han.mkpo.li/">
<meta name="twitter:title" content="Han Input — Find a character">
<meta name="twitter:description" content="Find a Chinese character.">
</head><body>app</body></html>`
const env = {
  ASSETS: {
    /** @param {Request} request */
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === '/index.html') return new Response(null, { status: 307, headers: { location: '/' } })
      if (url.pathname === '/') {
        if (request.headers.get('if-none-match') === '"index"') return new Response(null, { status: 304 })
        return new Response(request.method === 'HEAD' ? null : HTML, { status: 200, headers: { 'content-type': 'text/html', etag: '"index"' } })
      }
      return new Response('missing', { status: 404, headers: { 'content-type': 'text/plain' } })
    },
  },
}

/** @param {string} path @param {RequestInit} [init] */
const fetch = (path, init) => worker.fetch(new Request(`https://han.mkpo.li${path}`, init), env)

describe('app paths', () => {
  test('accepts every route the app renders', () => {
    for (const path of ['/', '/methods', '/methods/', '/readings', '/rhymes', '/radicals', '/dialects', '/hun', '/convert', '/composition', '/about', '/m/cangjie5', '/v/16', '/v/16/', '//methods', '//m/cangjie5']) {
      expect(isAppPath(path), path).toBe(true)
    }
  })
  test('leaves a mistyped path to the 404', () => {
    for (const path of ['/nope', '/methods/extra', '/m', '/m/', '/v', '/v/', '/data/missing.json']) {
      expect(isAppPath(path), path).toBe(false)
    }
  })
  test('names the page a path belongs to', () => {
    expect(pageOf('/')).toBe('')
    expect(pageOf('/methods')).toBe('methods')
    expect(pageOf('/m/cangjie5')).toBe('m')
    expect(pageOf('/v/16')).toBe('v')
    expect(pageOf('/nope')).toBe('notfound')
  })
})

describe('worker', () => {
  test('serves a known app path with its own head and hreflang cluster', async () => {
    const response = await fetch('/methods', { headers: { accept: 'text/html' } })
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('<title>Every way in — Han Input</title>')
    expect(html).toContain('<link rel="canonical" href="https://han.mkpo.li/methods">')
    expect(html).toContain('<link rel="alternate" hreflang="ja" href="https://han.mkpo.li/methods?lang=ja">')
    expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://han.mkpo.li/methods">')
    expect(html).toContain('<meta property="og:url" content="https://han.mkpo.li/methods">')
  })
  test('localizes / and subpages for ?lang= and strips ?lang=en from canonical', async () => {
    const homeJa = await (await fetch('/?lang=ja', { headers: { accept: 'text/html' } })).text()
    expect(homeJa).toContain('<html lang="ja">')
    expect(homeJa).toContain(`<title>${ja['app.name']} — ${ja['find.seoTitle']}</title>`)
    expect(homeJa).toContain('<link rel="canonical" href="https://han.mkpo.li/?lang=ja">')
    expect(homeJa).toContain('<meta property="og:locale" content="ja">')
    expect(homeJa).toContain('<link rel="alternate" hreflang="ko" href="https://han.mkpo.li/?lang=ko">')

    const methodsJa = await (await fetch('/methods?lang=ja', { headers: { accept: 'text/html' } })).text()
    expect(methodsJa).toContain(`<title>${ja['methods.title']} — ${ja['app.name']}</title>`)
    expect(methodsJa).toContain('<link rel="canonical" href="https://han.mkpo.li/methods?lang=ja">')

    const methodsEn = await (await fetch('/methods?lang=en', { headers: { accept: 'text/html' } })).text()
    expect(methodsEn).toContain('<link rel="canonical" href="https://han.mkpo.li/methods">')

    const methodsBad = await (await fetch('/methods?lang=xx', { headers: { accept: 'text/html' } })).text()
    expect(methodsBad).toContain('<html lang="en">')
    expect(methodsBad).toContain('<link rel="canonical" href="https://han.mkpo.li/methods">')
  })
  test('keeps a detail route’s own address under its page’s head', async () => {
    const html = await (await fetch('/m/cangjie5', { headers: { accept: 'text/html' } })).text()
    expect(html).toContain('<title>Every way in — Han Input</title>')
    expect(html).toContain('<link rel="canonical" href="https://han.mkpo.li/m/cangjie5">')
    expect(html).toContain('<link rel="alternate" hreflang="ja" href="https://han.mkpo.li/m/cangjie5?lang=ja">')
  })
  test('serves an unknown page as a noindex 404 without hreflang alternates', async () => {
    const response = await fetch('/nope', { headers: { accept: 'text/html' } })
    expect(response.status).toBe(404)
    const html = await response.text()
    expect(html).toContain('<title>Page not found — Han Input</title>')
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">')
    expect(html).not.toContain('hreflang=')
  })
  test('does not let a matching ETag turn the 404 view or / into 304', async () => {
    const headers = { accept: 'text/html', 'if-none-match': '"index"' }
    const missing = await fetch('/nope', { headers })
    expect(missing.status).toBe(404)
    expect(await missing.text()).toContain('Page not found')
    const home = await fetch('/?lang=ja', { headers })
    expect(home.status).toBe(200)
  })
  test('keeps a non-page miss as a plain 404', async () => {
    const response = await fetch('/nope', { headers: { accept: 'application/json' } })
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('missing')
  })
  test('answers HEAD for a known path and a missing page', async () => {
    const known = await fetch('/methods', { method: 'HEAD', headers: { accept: 'text/html' } })
    expect(known.status).toBe(200)
    expect(await known.text()).toBe('')
    const missing = await fetch('/nope', { method: 'HEAD', headers: { accept: 'text/html' } })
    expect(missing.status).toBe(404)
  })
  test('treats a doubled leading slash like the app does', async () => {
    const response = await fetch('//methods', { headers: { accept: 'text/html' } })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<link rel="canonical" href="https://han.mkpo.li/methods">')
  })
})
