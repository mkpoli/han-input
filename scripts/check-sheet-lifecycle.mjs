// Build and mount the app fixture to exercise responsive DOM reparenting and teardown.
import { build } from 'vite'
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { serveDist } from './serve-dist.mjs'

const dist = '/tmp/han-input-sheet-lifecycle-dist'
await build({
  configFile: 'app/vite.config.js', root: process.cwd(), publicDir: 'app/public',
  build: { outDir: dist, emptyOutDir: false, rollupOptions: { input: 'tests/fixtures/sheet-lifecycle.html' } },
})
const cache = join(homedir(), '.cache/ms-playwright')
const executablePath = process.env.CHROMIUM_PATH ?? readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse().map(name => join(cache, name, 'chrome-linux64/chrome')).find(existsSync)
if (!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium executable')
const browser = await chromium.launch({ executablePath })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 600 }, locale: 'en-US' })
  await serveDist(context, dist)
  const page = await context.newPage()
  /** @type {string[]} */
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://site.test/tests/fixtures/sheet-lifecycle.html')
  const tile = page.locator('main .ui-tile').filter({ hasText: '字' }).first()
  await tile.waitFor()
  await tile.click()
  const dialog = page.locator('dialog:modal')
  await dialog.waitFor()
  const card = page.locator('aside.card')
  for (let i = 0; i < 3; i++) {
    await page.setViewportSize({ width: 1100, height: 600 })
    await page.waitForFunction(() => document.querySelector('aside.card')?.parentElement?.classList.contains('shell'))
    assert.equal(await page.locator('aside.card').count(), 1)
    await page.setViewportSize({ width: 390, height: 600 })
    await tile.click()
    await dialog.waitFor()
    assert.equal(await page.locator('aside.card').count(), 1)
    assert.equal(await dialog.locator('aside.card').count(), 1)
    assert.equal(await card.getByText('U+5B57', { exact: true }).count(), 1)
  }
  await dialog.getByRole('button', { name: 'Back' }).click()
  const input = page.locator('main [data-primary]')
  await input.fill('U+9F8D')
  const next = page.locator('main .ui-tile').filter({ hasText: '龍' }).first()
  await next.waitFor()
  await next.click()
  await dialog.getByText('U+9F8D', { exact: true }).waitFor()
  const method = dialog.locator('a[href^="/m/"]').first()
  await method.waitFor()
  await method.click()
  await page.waitForURL('**/m/**')
  await page.waitForFunction(() => !document.querySelector('dialog:modal'))
  await page.goto('http://site.test/tests/fixtures/sheet-lifecycle.html')
  await tile.waitFor()
  await tile.click()
  await dialog.waitFor()
  await page.evaluate(() => Reflect.get(window, 'unmountSheetFixture')())
  assert.equal(await page.locator('#app > *').count(), 0, 'unmount removes the reparented card and dialog')
  assert.equal(await page.locator('dialog:modal').count(), 0)
  await page.setViewportSize({ width: 1100, height: 600 })
  await page.evaluate(() => Reflect.get(window, 'mountSheetFixture')())
  await page.locator('aside.card').waitFor()
  assert.equal(await page.locator('aside.card').count(), 1)
  assert.equal(await page.locator('dialog:modal').count(), 0, 'remount clears modal state')
  await page.evaluate(() => Reflect.get(window, 'unmountSheetFixture')())
  assert.equal(await page.locator('#app > *').count(), 0)
  await page.setViewportSize({ width: 390, height: 600 })
  await page.evaluate(() => Reflect.get(window, 'mountSheetFixture')())
  await tile.waitFor()
  await tile.click()
  await dialog.waitFor()
  assert.equal(await page.locator('aside.card').count(), 1)
  await page.evaluate(() => Reflect.get(window, 'unmountSheetFixture')())
  assert.equal(await page.locator('#app > *').count(), 0)
  assert.deepEqual(errors, [])
  await context.close()
  console.log('ok responsive card updates and mount/unmount lifecycle')
} finally { await browser.close() }
