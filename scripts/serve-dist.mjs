// Serves the built site to a Playwright context from disk, so a browser check needs no port or server.
import { readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

const TYPES = {
  '.css': 'text/css', '.gif': 'image/gif', '.gz': 'application/gzip', '.html': 'text/html', '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.json': 'application/json', '.map': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain', '.webp': 'image/webp', '.woff2': 'font/woff2',
}

/** @param {import('playwright-core').BrowserContext} context @param {string} dist */
export async function serveDist(context, dist) {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    let file = join(dist, decodeURIComponent(url.pathname))
    try { if (statSync(file).isDirectory()) throw new Error('a directory is an app route') } catch { file = join(dist, 'index.html') }
    await route.fulfill({ body: readFileSync(file), contentType: TYPES[/** @type {keyof typeof TYPES} */ (extname(file))] ?? 'application/octet-stream' })
  })
}
