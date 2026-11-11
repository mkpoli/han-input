// Browser regression checks against a built site.
//   bun run build && bun scripts/check_navigation.mjs
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
const browser = await chromium.launch({ executablePath })
const methods = Array.from({ length: 100 }, (_, i) => ({ id: `test-${i}`, family: 'shape', names: { en: `Test method ${i}` }, source: { name: 'Test', url: 'https://example.com', licence: 'Test' }, chars: 100, codes: 100 }))
const sources = Array.from({ length: 100 }, (_, i) => ({ id: `test-${i}`, name: `Test source ${i}`, url: 'https://example.com', licence: 'Test' }))
try {
  for (const colorScheme of /** @type {const} */ (['light', 'dark'])) {
    if (process.env.COLOR_SCHEME && process.env.COLOR_SCHEME !== colorScheme) continue
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2, colorScheme, locale: 'en-US' })
    await serveDist(context, resolve(process.env.SITE_DIR ?? 'dist'))
    await context.route('**/data/methods.json', route => route.fulfill({ json: methods }))
    /** @type {Promise<void> | undefined} */
    let delayed
    /** @type {(() => void) | undefined} */
    let release
    await context.route('**/data/ids.json', async route => {
      if (delayed) await delayed
      await route.fulfill({ json: { sources } })
    })
    const hold = () => { delayed = new Promise(resolve => { release = resolve }) }
    const unhold = () => { delayed = undefined; release?.() }
    const page = await context.newPage()
    const main = page.locator('main')
    const top = () => main.evaluate(element => element.scrollTop)
    /** @param {number} value */
    const scroll = async value => {
      await main.evaluate((element, y) => { element.scrollTop = y }, value)
      assert.equal(await top(), value, 'fixture must be tall enough')
    }
    /** @param {number} value */
    const expectTop = value => page.waitForFunction(y => document.querySelector('main')?.scrollTop === y, value)
    /** @param {string} path */
    const nav = path => page.locator(`nav.rail a[href="/${path}"]`).click()

    await page.goto('http://local.test/about')
    await page.locator('main table').last().locator('tbody tr').last().waitFor()
    const aboutTop = await main.evaluate(element => element.scrollHeight - element.clientHeight - 100)
    await scroll(aboutTop)
    await nav('methods')
    await page.locator('main .list a').first().waitFor()
    assert.equal(await top(), 0, 'new page starts at the top')
    await scroll(600)
    hold()
    await page.goBack()
    await page.waitForURL('**/about')
    await page.locator('main h1').waitFor()
    assert.ok(await top() < aboutTop, 'restoration waits for asynchronous content')
    unhold()
    await expectTop(aboutTop)
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('href')), '/methods', 'history restoration does not steal focus')
    if (process.env.SHOT_PREFIX) await page.screenshot({ path: `${process.env.SHOT_PREFIX}-${colorScheme}.png` })
    await page.goForward()
    await expectTop(600)

    // Same URL entries must remain separate, including through multiple Back/Forward operations.
    await nav('methods')
    assert.equal(await top(), 0, 'reopening the current page starts at the top')
    await scroll(300)
    await nav('methods')
    assert.equal(await top(), 0)
    await scroll(100)
    await page.goBack(); await expectTop(300)
    await page.goBack(); await expectTop(600)
    await page.goForward(); await expectTop(300)
    await page.goForward(); await expectTop(100)

    // A new navigation cancels an in-flight restoration.
    await page.goBack(); await expectTop(300)
    await page.goBack(); await expectTop(600)
    hold()
    await page.goBack()
    await page.waitForURL('**/about')
    await page.locator('main h1').waitFor()
    await page.goForward()
    await expectTop(600)
    unhold()
    await page.locator('main .list a').first().waitFor()
    assert.equal(await top(), 600, 'a stale load cannot move the new page')

    // A user gesture during the delayed load cancels the pending restoration.
    hold()
    await page.goBack()
    await page.waitForURL('**/about')
    await page.locator('main h1').waitFor()
    await main.hover()
    const wheel = page.evaluate(() => new Promise(resolve => document.querySelector('main')?.addEventListener('wheel', resolve, { once: true })))
    await page.mouse.wheel(0, 120)
    await wheel
    unhold()
    await page.locator('main table').last().locator('tbody tr').last().waitFor()
    assert.notEqual(await top(), aboutTop, 'user scrolling cancels delayed restoration')

    // Find pagination changes history within the same mounted view.
    await page.goto('http://local.test/?set=t1')
    await page.locator('main .pager [data-page="2"]').first().waitFor()
    await scroll(500)
    await page.locator('main .pager [data-page="2"]').first().dispatchEvent('click')
    await page.waitForURL('**/?set=t1&p=2')
    await page.locator('main .pager [data-page="2"][aria-current="page"]').first().waitFor()
    await scroll(700)
    await page.goBack()
    await page.waitForURL('**/?set=t1')
    await expectTop(500)
    await page.goForward()
    await page.waitForURL('**/?set=t1&p=2')
    await expectTop(700)
    await page.reload()
    await expectTop(700)
    assert.notEqual(await page.evaluate(() => document.activeElement?.hasAttribute('data-primary')), true, 'reload restoration does not focus the finder')
    await context.close()
  }
  console.log('Navigation scroll history passed in light and dark themes')
} finally {
  await browser.close()
}
