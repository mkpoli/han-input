import { describe, expect, test } from 'bun:test'
import worker from '../worker/index.js'
import { isAppPath } from '../app/lib/paths.js'

const HTML = '<!doctype html><title>app</title>'
const env = {
  ASSETS: {
    /** @param {Request} request */
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === '/index.html') {
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
    for (const path of ['/', '/methods', '/methods/', '/readings', '/rhymes', '/radicals', '/convert', '/about', '/m/cangjie5', '/v/16', '/v/16/', '//methods', '//m/cangjie5']) {
      expect(isAppPath(path), path).toBe(true)
    }
  })
  test('leaves a mistyped path to the 404', () => {
    for (const path of ['/nope', '/methods/extra', '/m', '/m/', '/v', '/v/', '/data/missing.json']) {
      expect(isAppPath(path), path).toBe(false)
    }
  })
})

describe('worker', () => {
  test('serves a known app path from the index', async () => {
    const response = await fetch('/methods', { headers: { accept: 'text/html' } })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(HTML)
  })
  test('serves an unknown page as a 404 view', async () => {
    const response = await fetch('/nope', { headers: { accept: 'text/html' } })
    expect(response.status).toBe(404)
    expect(await response.text()).toBe(HTML)
  })
  test('does not let a matching ETag turn the 404 view into 304', async () => {
    const response = await fetch('/nope', { headers: { accept: 'text/html', 'if-none-match': '"index"' } })
    expect(response.status).toBe(404)
    expect(await response.text()).toBe(HTML)
  })
  test('keeps a non-page miss as a plain 404', async () => {
    const response = await fetch('/nope', { headers: { accept: 'application/json' } })
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('missing')
  })
  test('answers HEAD for a known path and a missing page', async () => {
    const known = await fetch('/methods', { method: 'HEAD', headers: { accept: 'text/html' } })
    expect(known.status).toBe(200)
    const missing = await fetch('/nope', { method: 'HEAD', headers: { accept: 'text/html' } })
    expect(missing.status).toBe(404)
  })
  test('treats a doubled leading slash like the app does', async () => {
    const response = await fetch('//methods', { headers: { accept: 'text/html' } })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(HTML)
  })
})
