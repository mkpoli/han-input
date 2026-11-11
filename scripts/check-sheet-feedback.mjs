// Run after bun run build: verifies status delivery when the mobile sheet closes.
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { serveDist } from './serve-dist.mjs'

const cache = join(homedir(), '.cache/ms-playwright')
const executablePath = process.env.CHROMIUM_PATH ?? readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse().map(name => join(cache, name, 'chrome-linux64/chrome')).find(existsSync)
if (!executablePath) throw new Error('Set CHROMIUM_PATH to a Chromium executable')
const browser = await chromium.launch({ executablePath })
try {
  /** @type {string[]} */
  const duplicates = []
  for (const theme of /** @type {const} */ (['light', 'dark'])) {
    for (const dismissal of ['Back', 'Escape', 'Resize']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', colorScheme: theme, deviceScaleFactor: 2 })
      await serveDist(context, 'dist')
      const page = await context.newPage()
      /** @type {string[]} */
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto('http://site.test/?q=U%2B5B57')
      const tile = page.locator('main .ui-tile').filter({ hasText: '字' }).first()
      await tile.waitFor()
      const dialog = page.locator('dialog:modal')
      const globalStatus = page.locator('.toast[role="status"]')
      async function openSheet() {
        await tile.focus()
        if (dismissal === 'Resize') await page.setViewportSize({ width: 390, height: 844 })
        await tile.focus()
        await page.keyboard.press('Enter')
        await dialog.waitFor()
      }
      async function closeSheet() {
        if (dismissal === 'Back') await dialog.getByRole('button', { name: 'Back' }).click()
        else if (dismissal === 'Escape') await page.keyboard.press('Escape')
        else await page.setViewportSize({ width: 1200, height: 844 })
        await dialog.waitFor({ state: 'hidden' })
      }
      await openSheet()
      await globalStatus.evaluate(el => {
        const events = /** @type {string[]} */ ([])
        Reflect.set(window, 'statusEvents', events)
        const observer = new MutationObserver(records => {
          for (const record of records) for (const node of record.addedNodes) if (node.textContent) events.push(node.textContent)
        })
        observer.observe(el, { childList: true, subtree: true })
        Reflect.set(window, 'statusObserver', observer)
      })
      await dialog.getByRole('button', { name: 'Add to text' }).click()
      await dialog.getByRole('status').getByText('Added 字', { exact: true }).waitFor()
      await closeSheet()
      const observed = await page.evaluate(() => {
        Reflect.get(window, 'statusObserver').disconnect()
        return /** @type {string[]} */ (Reflect.get(window, 'statusEvents'))
      })
      if (await globalStatus.textContent() || observed.length) duplicates.push(`${theme} ${dismissal}: ${observed.join(', ')}`)
      await page.screenshot({ path: `/tmp/han-status-close-${theme}-${dismissal}.png` })
      if (dismissal !== 'Resize') assert.equal(await tile.evaluate(el => el === document.activeElement), true, 'dismissal restores the invoker')
      for (const succeeds of [true, false]) {
        await openSheet()
        await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
          writeText: () => new Promise((resolve, reject) => Object.defineProperty(window, 'settleCopy', { configurable: true, value: (/** @type {boolean} */ ok) => ok ? resolve(undefined) : reject(new Error('denied')) }))
        } }))
        await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
        await closeSheet()
        await page.evaluate(ok => Reflect.get(window, 'settleCopy')(ok), succeeds)
        await globalStatus.getByText(succeeds ? 'Copied 字' : 'The clipboard is blocked', { exact: true }).waitFor()
        if (dismissal !== 'Resize') assert.equal(await tile.evaluate(el => el === document.activeElement), true)
      }
      await openSheet()
      await dialog.getByRole('button', { name: 'Add to text' }).click()
      await dialog.getByRole('status').getByText('Added 字', { exact: true }).waitFor()
      const method = dialog.locator('a[href^="/m/"]').first()
      await method.waitFor()
      await method.click()
      await page.waitForURL('**/m/**')
      await dialog.waitFor({ state: 'hidden' })
      assert.equal(await globalStatus.textContent(), '', 'card navigation does not repeat the modal status')
      assert.deepEqual(errors, [])
      await context.close()
      console.log(`ok ${theme} ${dismissal}: status delivery and card navigation`)
    }
  }
  assert.deepEqual(duplicates, [], 'an already displayed modal status is not repeated after dismissal')
} finally { await browser.close() }
