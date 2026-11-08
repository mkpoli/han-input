// Serves the built app, answers known app paths with index.html, and lets everything else keep
// its 404 so a mistyped address does not look like the home page.
import { isAppPath } from '../app/lib/paths.js'

/** @param {URL} url @param {Request} request @returns {Request} */
const indexAt = (url, request) => {
  const headers = new Headers(request.headers)
  headers.delete('if-none-match')
  headers.delete('if-modified-since')
  return new Request(new URL('/index.html', url), { method: request.method, headers })
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
    if (isAppPath(url.pathname)) return env.ASSETS.fetch(indexAt(url, request))
    if (!(request.headers.get('accept') ?? '').includes('text/html')) return response
    const index = await env.ASSETS.fetch(indexAt(url, request))
    return new Response(request.method === 'HEAD' ? null : index.body, { status: 404, headers: index.headers })
  },
}
