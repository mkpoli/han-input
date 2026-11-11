// Browser regression checks against a built site.
//   bun run build && bun scripts/check_navigation.mjs
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { serveDist } from './serve-dist.mjs'
import { codeBucket } from '../src/fold.js'

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
    assert.equal(await page.evaluate(() => history.scrollRestoration), 'auto', 'native restoration remains enabled for the rest of the document')
    await page.locator('aside.card').evaluate(element => {
      const filler = document.createElement('div')
      filler.style.height = '3000px'
      filler.id = 'scroll-test-filler'
      element.append(filler)
      element.scrollTop = 200
    })
    const writes = await main.evaluate(async element => {
      let count = 0
      const original = history.replaceState
      history.replaceState = function (...args) { count++; return original.apply(this, args) }
      try {
        for (let i = 0; i < 20; i++) {
          element.scrollTop = i * 20
          await new Promise(requestAnimationFrame)
        }
        await new Promise(requestAnimationFrame)
        return count
      } finally { history.replaceState = original }
    })
    assert.equal(writes, 0, 'scroll events do not write history state')
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
    const staticCell = await page.locator('main td:not(:has(a))').evaluateAll(cells => {
      const cell = cells.find(element => {
        const rect = element.getBoundingClientRect()
        return rect.top >= 0 && rect.bottom < innerHeight - 80 && rect.width > 20
      })
      if (!cell) throw new Error('No visible static cell')
      const rect = cell.getBoundingClientRect()
      return { x: rect.left + 10, y: rect.top + rect.height / 2 }
    })
    await page.mouse.click(staticCell.x, staticCell.y)
    await page.locator('#writing').click()
    await page.keyboard.type(' ')
    unhold()
    await expectTop(aboutTop)
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'writing', 'history restoration does not steal focus')
    assert.equal(await page.locator('aside.card').evaluate(element => element.scrollTop), 200, 'finder restoration leaves the card alone')
    assert.equal(await page.evaluate(() => window.scrollY), 0, 'the shell does not scroll the window')
    await page.locator('#scroll-test-filler').evaluate(element => element.remove())
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

    // Opening a method should leave the user ready to type without an extra click.
    await nav('methods')
    await page.locator('main .list a').first().click()
    const input = page.locator('main [data-primary]')
    await input.waitFor()
    assert.equal(await input.evaluate(element => document.activeElement === element), true, 'opening a method focuses its input')
    await page.keyboard.type('abc')
    assert.equal(await input.inputValue(), 'abc')
    await page.goBack()
    await page.locator('main .list a').first().waitFor()
    await page.goForward()
    await input.waitFor()
    assert.equal(await input.evaluate(element => document.activeElement === element), false, 'history traversal does not focus the method input')

    // Changing the query while an older history entry is loading cancels its restoration.
    let releaseFoo = () => {}
    let startedFoo = () => {}
    /** @type {Promise<void>} */
    const fooGate = new Promise(resolve => { releaseFoo = resolve })
    /** @type {Promise<void>} */
    const fooStarted = new Promise(resolve => { startedFoo = resolve })
    /** @param {string} query */
    const rows = query => methods.map(method => `${query}\t${query}\t${method.id}\t字`).join('\n')
    await context.route('**/data/c/*.gz', async route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith(`/${codeBucket('foo')}.gz`)) {
        startedFoo()
        await fooGate
        await route.fulfill({ body: rows('foo'), contentType: 'text/plain' })
      } else if (path.endsWith(`/${codeBucket('bar')}.gz`)) {
        await route.fulfill({ body: rows('bar'), contentType: 'text/plain' })
      } else await route.fallback()
    })
    const queryPage = await context.newPage()
    await queryPage.goto('http://local.test/?q=foo', { waitUntil: 'domcontentloaded' })
    await fooStarted
    await queryPage.locator('main [data-primary]').waitFor()
    await queryPage.locator('main .ui-page').evaluate(element => {
      const filler = document.createElement('div')
      filler.style.height = '2000px'
      element.append(filler)
      const main = element.closest('main')
      if (main) main.scrollTop = 500
    })
    assert.equal(await queryPage.locator('main').evaluate(element => element.scrollTop), 500)
    await queryPage.locator('nav.rail a[href="/methods"]').click()
    await queryPage.goBack()
    const queryInput = queryPage.locator('main [data-primary]')
    await queryInput.waitFor()
    await queryInput.fill('bar')
    await queryPage.locator('main .method').first().waitFor()
    assert.equal(await queryPage.locator('main').evaluate(element => element.scrollTop), 0, 'new query does not restore the old query offset')
    releaseFoo()
    await queryPage.close()

    // A failed load leaves a short page; restoration must eventually stop observing it.
    const shortPage = await context.newPage()
    await shortPage.clock.install()
    let failIds = false
    await shortPage.route('**/data/ids.json', route => failIds
      ? route.fulfill({ status: 503, body: '' })
      : route.fulfill({ json: { sources } }))
    await shortPage.goto('http://local.test/about')
    await shortPage.locator('main table').last().locator('tbody tr').last().waitFor()
    await shortPage.locator('main').evaluate(element => { element.scrollTop = 5000 })
    assert.equal(await shortPage.locator('main').evaluate(element => element.scrollTop), 5000)
    await shortPage.locator('nav.rail a[href="/methods"]').click()
    failIds = true
    const failedLoad = shortPage.waitForResponse(response => response.url().endsWith('/data/ids.json') && response.status() === 503)
    await shortPage.goBack()
    await failedLoad
    await shortPage.waitForFunction(() => {
      const main = document.querySelector('main')
      return main && main.scrollTop > 0 && main.scrollTop < 5000
    })
    const shortTop = await shortPage.locator('main').evaluate(element => element.scrollTop)
    await shortPage.clock.fastForward(31_000)
    await shortPage.locator('main .ui-page').evaluate(element => {
      const filler = document.createElement('div')
      filler.style.height = '6000px'
      element.append(filler)
    })
    await shortPage.clock.runFor(100)
    assert.equal(await shortPage.locator('main').evaluate(element => element.scrollTop), shortTop, 'expired restoration does not react to later content')
    await shortPage.close()

    await context.close()
  }
  console.log('Navigation scroll history passed in light and dark themes')
} finally {
  await browser.close()
}
