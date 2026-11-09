#!/usr/bin/env bun
// Draw the share card from the favicon and the faces bundled for the scripts the site covers.
// Chromium renders the mark and the serif exactly as a browser does, so the card and the site
// cannot drift apart.
//
//   bun scripts/make-og.mjs
import { chromium } from 'playwright-core'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const PUBLIC = join(ROOT, 'app/public')
const mark = readFileSync(join(PUBLIC, 'favicon.svg'), 'utf8')
const face = (/** @type {string} */ name) =>
  readFileSync(join(PUBLIC, 'fonts', name)).toString('base64')

function browserPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
  const cache = join(homedir(), '.cache/ms-playwright')
  for (const dir of readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse()) {
    for (const candidate of [join(cache, dir, 'chrome-linux64/chrome'), join(cache, dir, 'chrome-linux/chrome')]) {
      if (existsSync(candidate)) return candidate
    }
  }
  throw new Error('no Chromium under ~/.cache/ms-playwright; set CHROMIUM_PATH')
}

const svg = (/** @type {string} */ body) =>
  `data:image/svg+xml;base64,${Buffer.from(body).toString('base64')}`

const browser = await chromium.launch({ executablePath: browserPath() })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(`
  <style>
    @font-face{font-family:"Jigmo";src:url(data:font/woff2;base64,${face('jigmo-bmp.woff2')}) format("woff2")}
    @font-face{font-family:"Noto Hentaigana";src:url(data:font/woff2;base64,${face('noto-hentaigana.woff2')}) format("woff2")}
    @font-face{font-family:"Noto Nushu";src:url(data:font/woff2;base64,${face('noto-nushu.woff2')}) format("woff2")}
    body{margin:0;background:#eef3f7;color:#14233a;font-family:"DejaVu Serif",Georgia,serif;display:grid;
      grid-template-columns:720px 1fr;align-items:center;padding:0 72px;gap:24px;box-sizing:border-box;
      width:1200px;height:630px;overflow:hidden}
    .copy{width:720px}
    h1{margin:0;font-size:60px;line-height:1.12;letter-spacing:-.01em}
    .mark{display:flex;align-items:center;gap:18px;margin-bottom:26px}
    .mark img{width:76px;height:76px;border-radius:14px}
    .lead{margin:18px 0 0;font-size:27px;line-height:1.4;color:#33475f;max-width:19em;font-family:system-ui,sans-serif}
    .glyphs{font-family:"Jigmo";font-size:96px;line-height:1.05;color:#b5362a;
      display:grid;grid-template-columns:repeat(2,96px);gap:8px 18px;justify-content:center}
    .glyphs .hentaigana{font-family:"Noto Hentaigana"}
    .glyphs .nushu{font-family:"Noto Nushu"}
  </style>
  <div class="copy">
    <div class="mark"><img src="${svg(mark)}"><span style="font-size:30px;letter-spacing:.02em">Han Input</span></div>
    <h1>Find a Chinese<br>character.</h1>
    <p class="lead">By input method, reading, part, meaning or shape.</p>
  </div>
  <div class="glyphs"><span>龍</span><span>あ</span><span class="hentaigana">𛀊</span><span class="nushu">𛅺</span></div>
`)
await page.evaluate(() => document.fonts.ready)
await page.waitForTimeout(300)
await page.screenshot({ path: join(PUBLIC, 'og.png') })
await browser.close()
console.log('og.png written to app/public')
