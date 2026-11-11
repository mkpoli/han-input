// Check navigation between independently scrolled pages against a built site.
//   bun run build && SITE_DIR=dist bun scripts/check_navigation.mjs
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { serveDist } from './serve-dist.mjs'

const cache = join(homedir(), '.cache/ms-playwright')
const executablePath = process.env.CHROMIUM_PATH ?? readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse()
  .map(name => join(cache, name, 'chrome-linux64/chrome')).find(existsSync)
if (!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium executable')
const dist = resolve(process.env.SITE_DIR ?? 'dist')
const browser = await chromium.launch({ executablePath })
try {
  for (const colorScheme of /** @type {const} */ (['light', 'dark'])) {
    if (process.env.COLOR_SCHEME && process.env.COLOR_SCHEME !== colorScheme) continue
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2, colorScheme, locale: 'en-US' })
    await serveDist(context, dist)
    const page = await context.newPage()
    await page.goto('http://local.test/about')
    await page.locator('main table tbody tr').first().waitFor()
    const main = page.locator('main')
    await main.evaluate(element => { element.scrollTop = 500 })
    assert.ok(await main.evaluate(element => element.scrollTop) > 0, 'source page must scroll')
    await page.locator('nav.rail a[href="/methods"]').click()
    await page.waitForURL('**/methods')
    await page.locator('main h1').waitFor()
    if (process.env.SHOT_PREFIX) await page.screenshot({ path: `${process.env.SHOT_PREFIX}-${colorScheme}.png` })
    assert.equal(await main.evaluate(element => element.scrollTop), 0, 'new page starts at the top')
    await page.goBack()
    await page.waitForURL('**/about')
    await page.locator('main table tbody tr').first().waitFor()
    await page.goForward()
    await page.waitForURL('**/methods')
    await page.locator('main .list a').first().waitFor()
    await main.evaluate(element => { element.scrollTop = 500 })
    assert.ok(await main.evaluate(element => element.scrollTop) > 0, 'destination page must scroll')
    await page.locator('nav.rail a[href="/methods"]').click()
    assert.equal(await main.evaluate(element => element.scrollTop), 0, 'reopening the current page starts at the top')
    await context.close()
  }
  console.log('Navigation starts at the top in light and dark themes')
} finally {
  await browser.close()
}
