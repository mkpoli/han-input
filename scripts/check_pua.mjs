// SITE_URL=http://127.0.0.1:5317 bun scripts/check_pua.mjs [--before]
// SITE_DIR=dist SITE_URL=http://site.test bun scripts/check_pua.mjs   (served from disk, no port)
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { MOE_PUA } from '../src/pua.js'
import { serveDist } from './serve-dist.mjs'

const SITE = process.env.SITE_URL ?? 'http://127.0.0.1:5317'
const dist = process.env.SITE_DIR
const before = process.argv.includes('--before')
const cache = join(homedir(), '.cache/ms-playwright')
const executablePath = process.env.CHROMIUM_PATH ?? readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse()
  .flatMap(name => ['chrome-linux64/chrome', 'chrome-linux/chrome'].map(tail => join(cache, name, tail))).find(path => existsSync(path))
if (!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium executable')
mkdirSync('shots/pua', { recursive: true })
const browser = await chromium.launch({ executablePath })
try {
  for (const theme of /** @type {const} */ (['light', 'dark'])) {
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2, colorScheme: theme, locale: 'en-US', permissions: ['clipboard-read', 'clipboard-write'] })
    if (dist) await serveDist(context, dist)
    await context.addInitScript(value => localStorage.setItem('han-input:theme', value), theme)
    const page = await context.newPage()
    const errors = /** @type {string[]} */ ([])
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${SITE}/convert?q=U%2BE43B`)
    await page.waitForLoadState('networkidle')
    if (before) {
      assert.match(await page.locator('main h1').innerText(), /Find a character/)
      assert.equal(await page.locator('main textarea').count(), 0)
    } else {
      // The converter's textareas are ordered source, result.
      const input = page.locator('main textarea').nth(0)
      const output = page.locator('main textarea').nth(1)
      await input.fill('\uE43B\uE51F\u{F8FAF}\n字 <b>& 😀\uE000')
      await page.waitForFunction(() => /** @type {HTMLTextAreaElement | undefined} */ (document.querySelectorAll('main textarea')[1])?.value === '䀯𠊎𰹬\n字 <b>& 😀\uE000')
      assert.equal(await page.locator('main b').count(), 0)
      await page.getByRole('button', { name: 'Copy', exact: true }).first().click()
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '䀯𠊎𰹬\n字 <b>& 😀\uE000')
      await input.fill('\uE43B \uE51F \u{F8FAF}\n字')
      await page.waitForFunction(() => /** @type {HTMLTextAreaElement | undefined} */ (document.querySelectorAll('main textarea')[1])?.value === '䀯 𠊎 𰹬\n字')
      await page.locator('main details summary').click()
      assert.equal(await page.locator('main tbody tr').count(), 59)
      assert.ok((await page.locator('main').innerText()).includes('U+F8FAF'))
      await page.screenshot({ path: `shots/pua/mappings-${theme}.png`, fullPage: true })
      await page.locator('main details summary').click()
      await page.locator('.toast').waitFor({ state: 'hidden' })
    }
    await page.screenshot({ path: `shots/pua/${before ? 'before' : 'after'}-${theme}.png`, fullPage: true })
    if (!before) {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.screenshot({ path: `shots/pua/after-mobile-${theme}.png`, fullPage: true })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      const input = page.locator('main textarea').nth(0)
      const output = page.locator('main textarea').nth(1)
      await input.fill(Object.keys(MOE_PUA.mappings).join(''))
      await page.waitForFunction(expected => /** @type {HTMLTextAreaElement | undefined} */ (document.querySelectorAll('main textarea')[1])?.value === expected, Object.values(MOE_PUA.mappings).join(''))
      assert.equal(await output.inputValue(), Object.values(MOE_PUA.mappings).join(''))
      await page.getByRole('button', { name: 'Clear', exact: true }).first().click()
      assert.equal(await input.inputValue(), '')
      assert.equal(await output.inputValue(), '')
      await page.locator('main details summary').click()
      await page.locator('main tbody a').first().click()
      await page.waitForURL(/c=/)
      await page.locator('.card .glyph').waitFor({ state: 'visible' })
      assert.equal(await page.locator('.card .glyph').innerText(), Object.values(MOE_PUA.mappings)[0])

      /** @param {string} query */
      const found = async query => {
        await page.goto(`${SITE}/?q=${encodeURIComponent(query)}`)
        await page.waitForLoadState('networkidle')
        return page.locator('main .ui-tile-glyph').allTextContents()
      }
      assert.ok((await found('U+E43B')).includes('䀯'))
      assert.ok((await found('E43B')).includes('䀯'))
      await page.screenshot({ path: `shots/pua/find-pua-mobile-${theme}.png`, fullPage: true })

      await page.setViewportSize({ width: 1360, height: 900 })
      assert.ok((await found('U+E43B')).includes('䀯'))
      assert.ok((await found('E4DE')).includes('羴'))
      assert.ok((await found('E4DE')).includes('鬿'))
      await page.screenshot({ path: `shots/pua/find-pua-${theme}.png`, fullPage: true })
      await page.goto(`${SITE}/?c=96DE`)
      await page.waitForLoadState('networkidle')
      await page.locator('.card .record').waitFor({ state: 'visible' })
      assert.match(await page.locator('.card').innerText(), /U\+E463/)
      await page.goto(`${SITE}/?c=402F`)
      await page.waitForLoadState('networkidle')
      const ownCard = await page.locator('.card').innerText()
      assert.match(ownCard, /U\+E43B/)
      assert.match(ownCard, /䀯/)
      assert.ok(!ownCard.includes('Ministry of Education'))
      await page.screenshot({ path: `shots/pua/card-own-${theme}.png`, fullPage: true })
      await page.goto(`${SITE}/?c=9E21`)
      await page.waitForLoadState('networkidle')
      const simplifiedCard = await page.locator('.card').innerText()
      assert.match(simplifiedCard, /雞/)
      assert.match(simplifiedCard, /Traditional variant/)
      assert.match(simplifiedCard, /U\+E463/)
      await page.screenshot({ path: `shots/pua/card-variant-${theme}.png`, fullPage: true })
      await page.goto(`${SITE}/?c=7FB6`)
      await page.waitForLoadState('networkidle')
      const variantCard = await page.locator('.card').innerText()
      assert.match(variantCard, /羴/)
      assert.match(variantCard, /Semantic variant/)
      assert.match(variantCard, /U\+E4DE/)
      await page.screenshot({ path: `shots/pua/card-semantic-${theme}.png`, fullPage: true })

      await page.goto(`${SITE}/m/ashide?c=9E21`)
      await page.waitForLoadState('networkidle')
      const variantHref = await page.locator('.card a[href*="c=96DE"]').getAttribute('href')
      assert.ok(variantHref?.startsWith('/m/ashide?'), variantHref ?? 'no href')
      await page.goto(`${SITE}/?c=9E21&lang=ja`)
      await page.waitForLoadState('networkidle')
      assert.match(await page.locator('.card').innerText(), /繁体字/)
      for (const locale of ['ja', 'zh-Hans', 'zh-Hant', 'ko']) {
        await page.goto(`${SITE}/convert?lang=${locale}`)
        await page.waitForLoadState('networkidle')
        assert.ok(!/^(convert\.|nav\.)/.test(await page.locator('main h1').innerText()))
      }
    }
    assert.deepEqual(errors, [])
    await context.close()
    console.log(`ok ${before ? 'baseline' : 'conversion, mappings, clipboard, mobile, locales'}: ${theme}`)
  }
  if (before) {
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 })
    await page.goto(MOE_PUA.source.url, { waitUntil: 'domcontentloaded' })
    await page.locator('.original-text').fill('\uE43B\uE51F\u{F8FAF}')
    await page.locator('.submit_btn').click()
    await page.waitForFunction(() => /** @type {HTMLTextAreaElement | null} */ (document.querySelector('#myInput2'))?.value === '䀯𠊎𰹬')
    await page.screenshot({ path: 'shots/pua/reference-moe.png', fullPage: true })
    console.log('ok official converter reference: BMP and supplementary PUA')
  }
} finally {
  await browser.close()
}
