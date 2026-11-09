// Serves the built app, answers known app paths with index.html, and lets everything else keep
// its 404 so a mistyped address does not look like the home page. A page's own head is written
// before it is sent, so a crawler that runs no script still reads the right title and address.
import { pageOf } from '../app/lib/paths.js'
import { canonicalPath, seoOf } from '../app/lib/seo.js'

/** @param {URL} url @param {Request} request @returns {Request} */
const indexAt = (url, request) => {
  const headers = new Headers(request.headers)
  headers.delete('if-none-match')
  headers.delete('if-modified-since')
  return new Request(new URL('/index.html', url), { method: request.method, headers })
}

/** @param {string} text */
const escaped = text => String(text).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char] ?? char)

/**
 * The app's page with the head of the page its address names.
 * @param {string} html the served index.html
 * @param {string} page
 * @param {string} path
 */
export function withSeo(html, page, path) {
  const { title, description, url } = seoOf(page, path)
  const robots = page === 'notfound' ? 'noindex, nofollow' : 'index, follow'
  /** @type {[RegExp, string][]} */
  const head = [
    [/<title>[\s\S]*?<\/title>/, `<title>${escaped(title)}</title>`],
    [/<meta name="description"[^>]*>/, `<meta name="description" content="${escaped(description)}">`],
    [/<meta name="robots"[^>]*>/, `<meta name="robots" content="${robots}">`],
    [/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${escaped(url)}">`],
    [/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escaped(title)}">`],
    [/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escaped(description)}">`],
    [/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escaped(url)}">`],
    [/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escaped(title)}">`],
    [/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escaped(description)}">`],
  ]
  return head.reduce((out, [pattern, tag]) => out.replace(pattern, () => tag), html)
}

/**
 * An index page whose head names the page the address names.
 * @param {Request} request
 * @param {Response} index
 * @param {string} page
 * @param {string} path
 * @param {number} status
 */
async function responseFor(request, index, page, path, status) {
  const html = await index.text()
  const headers = new Headers(index.headers)
  // The rewritten head is a different body, so its original length and tag no longer apply.
  headers.delete('content-length')
  headers.delete('content-encoding')
  headers.delete('etag')
  return new Response(request.method === 'HEAD' ? null : withSeo(html, page, path), { status, headers })
}

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch: (request: Request) => Promise<Response> } }} env
   * @returns {Promise<Response>}
   */
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    const reads = request.method === 'GET' || request.method === 'HEAD'
    if (response.status !== 404 || !reads) return response
    const url = new URL(request.url)
    const page = pageOf(url.pathname)
    const path = canonicalPath(url.pathname)
    if (page !== 'notfound') {
      const index = await env.ASSETS.fetch(indexAt(url, request))
      return responseFor(request, index, page, path, index.status)
    }
    if (!(request.headers.get('accept') ?? '').includes('text/html')) return response
    const index = await env.ASSETS.fetch(indexAt(url, request))
    return responseFor(request, index, 'notfound', path, 404)
  },
}
