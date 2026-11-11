// Run after bun run build: exercises the responsive character and proposal sheet in Chromium.
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
  for (const theme of /** @type {const} */ (['light', 'dark'])) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', colorScheme: theme, deviceScaleFactor: 2, hasTouch: theme === 'dark' })
    await serveDist(context, 'dist')
    const page = await context.newPage()
    /** @type {string[]} */
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const dialog = page.getByRole('dialog', { name: 'Character' })
    await page.goto('http://site.test/?q=U%2B5B57')
    const tile = page.locator('main .ui-tile').filter({ hasText: '字' }).first()
    await tile.waitFor()
    await tile.focus()
    await page.keyboard.press('Enter')
    await dialog.waitFor()
    assert.equal(await dialog.evaluate(el => el.matches(':modal')), true)
    assert.equal(await dialog.getByRole('button', { name: 'Back' }).evaluate(el => el === document.activeElement), true)
    await page.screenshot({ path: `/tmp/han-sheet-after-${theme}.png` })
    const status = dialog.locator('[role="status"][aria-live="polite"]')
    assert.equal(await status.count(), 1, 'modal has an accessible feedback region before interaction')
    const addButton = dialog.getByRole('button', { name: 'Add to text' })
    const beforeFeedback = await addButton.boundingBox()
    await addButton.click()
    await status.getByText('Added 字', { exact: true }).waitFor()
    assert.deepEqual(await addButton.boundingBox(), beforeFeedback, 'feedback does not move the action')
    await page.screenshot({ path: `/tmp/han-feedback-${theme}.png` })
    assert.equal(await page.locator('.toast').textContent(), '', 'background status stays silent')
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } }))
    await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
    await status.getByText('Copied 字', { exact: true }).waitFor()
    await dialog.getByRole('button', { name: 'U+5B57' }).click()
    await status.getByText('Copied U+5B57', { exact: true }).waitFor()
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied') } } }))
    await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
    await status.getByText('The clipboard is blocked', { exact: true }).waitFor()
    const firstFailure = await status.textContent()
    await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
    await page.waitForFunction(previous => document.querySelector('dialog [role="status"]')?.textContent !== previous, firstFailure)
    assert.equal(await status.textContent(), 'The clipboard is blocked\u00a0', 'repeated feedback differs for VoiceOver')
    await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('dialog [role="status"]')?.textContent === 'The clipboard is blocked')
    await tile.evaluate(el => el.focus())
    assert.equal(await tile.evaluate(el => el === document.activeElement), false, 'background is inert')
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press(i < 25 ? 'Tab' : 'Shift+Tab')
      assert.equal(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest('dialog')), true, 'focus remains in the modal or browser chrome')
    }
    await page.keyboard.press('/')
    assert.equal(await page.locator('[data-primary]').evaluate(el => el === document.activeElement), false)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await tile.evaluate(el => el === document.activeElement), true, 'Escape restores the invoker')
    await page.keyboard.press('Enter')
    await dialog.waitFor()
    await dialog.getByRole('button', { name: 'Back' }).click()
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await tile.evaluate(el => el === document.activeElement), true, 'Back restores the invoker')

    await page.keyboard.press('Enter')
    await dialog.waitFor()
    await page.setViewportSize({ width: 1200, height: 844 })
    await page.locator('aside.card').waitFor()
    assert.equal(await page.locator('dialog:modal').count(), 0)
    assert.equal(await tile.evaluate(el => el === document.activeElement), true, 'resizing restores focus')
    await tile.click()
    assert.equal(await page.locator('dialog:modal').count(), 0, 'desktop selection remains non-modal')
    assert.equal(await page.locator('aside.card').getByText('U+5B57', { exact: true }).count(), 1)
    await page.locator('aside.card').getByRole('button', { name: 'Add to text' }).click()
    await page.locator('.toast').getByText('Added 字', { exact: true }).waitFor()
    await tile.focus()
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.locator('dialog:modal').count(), 0, 'resizing back does not reopen the sheet')

    await tile.focus()
    await page.keyboard.press('Enter')
    await dialog.waitFor()
    const method = dialog.locator('a[href^="/m/"]').first()
    await method.waitFor()
    await method.click()
    await page.waitForURL('**/m/**')
    await dialog.waitFor({ state: 'hidden' })
    await page.waitForFunction(() => document.querySelector('main')?.contains(document.activeElement))

    await page.goto('http://site.test/?q=U%2B5B57')
    await tile.waitFor()
    await tile.focus()
    await page.keyboard.press('Enter')
    await dialog.waitFor()
    const readingFilter = dialog.locator('input[type="search"]')
    await readingFilter.waitFor()
    await readingFilter.fill('北京')
    const variety = dialog.locator('a[href^="/v/"]').first()
    await variety.waitFor({ state: 'visible' })
    await variety.click()
    await page.waitForURL('**/v/**')
    await dialog.waitFor({ state: 'hidden' })
    await page.waitForFunction(() => document.querySelector('main')?.contains(document.activeElement))

    await page.goto('http://site.test/?set=ext_e_withdrawal_records')
    const proposal = page.locator('.records .ui-tile[title*="G_GJZ"]').first()
    await proposal.waitFor()
    const setCharacter = page.locator('main .ui-tile').filter({ hasText: '𦱳' }).first()
    for (const succeeds of [false, true]) {
      await setCharacter.click()
      await dialog.waitFor()
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: () => new Promise((resolve, reject) => Object.defineProperty(window, 'settleCopy', { configurable: true, value: (/** @type {boolean} */ ok) => ok ? resolve(undefined) : reject(new Error('denied')) }))
      } }))
      await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
      await dialog.getByRole('button', { name: 'Back' }).click()
      await proposal.click()
      await dialog.waitFor()
      await page.evaluate(ok => Reflect.get(window, 'settleCopy')(ok), succeeds)
      const statusInProposal = dialog.locator('[role="status"][aria-live="polite"]')
      assert.equal(await statusInProposal.count(), 1, 'proposal retains the sheet status region')
      await statusInProposal.getByText(succeeds ? 'Copied 𦱳' : 'The clipboard is blocked', { exact: true }).waitFor()
      if (!succeeds) await page.screenshot({ path: `/tmp/han-delayed-after-${theme}.png` })
      await dialog.getByRole('button', { name: 'Back' }).click()
    }
    await proposal.focus()
    await page.keyboard.press('Enter')
    await dialog.waitFor()
    assert.equal(await dialog.getByRole('button', { name: 'Back' }).evaluate(el => el === document.activeElement), true)
    await page.screenshot({ path: `/tmp/han-proposal-after-${theme}.png` })
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await proposal.evaluate(el => el === document.activeElement), true, 'proposal dismissal restores the invoker')
    const mappedProposal = page.locator('.records .ui-tile[title*="G_K0642.17"]').first()
    await mappedProposal.focus()
    await page.keyboard.press('Enter')
    await dialog.waitFor()
    const mapped = dialog.locator('a[href*="c=26C73"]').first()
    await mapped.focus()
    await page.keyboard.press('Enter')
    await dialog.getByText('U+26C73', { exact: true }).waitFor()
    assert.equal(await dialog.getByRole('button', { name: 'Back' }).evaluate(el => el === document.activeElement), true, 'focus remains in the sheet when switching cards')
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(await mappedProposal.evaluate(el => el === document.activeElement), true, 'switching cards preserves the original invoker')
    assert.deepEqual(errors, [])
    await context.close()
    console.log(`ok ${theme}: character, proposal, keyboard, navigation, and resizing`)
  }
  for (const theme of /** @type {const} */ (['light', 'dark'])) {
    for (const largeHeader of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 300 }, locale: 'en-US', colorScheme: theme, deviceScaleFactor: 2 })
      await serveDist(context, 'dist')
      const page = await context.newPage()
      await page.goto('http://site.test/?q=U%2B5B57')
      const tile = page.locator('main .ui-tile').filter({ hasText: '字' }).first()
      await tile.waitFor()
      await tile.focus()
      await page.keyboard.press('Enter')
      const dialog = page.locator('dialog:modal')
      const header = dialog.locator('.back')
      await header.waitFor()
      const initialHeaderHeight = await header.evaluate(el => el.getBoundingClientRect().height)
      if (largeHeader) {
        await dialog.locator('[role="status"]').evaluate(el => {
          el.textContent = 'The clipboard is blocked. The clipboard is blocked.'
          el.classList.add('show')
          ;(/** @type {HTMLElement} */ (el)).style.fontSize = '24px'
        })
      }
      await page.waitForFunction(({ initialHeaderHeight, largeHeader }) => {
        const sheet = document.querySelector('dialog:modal .card')
        const head = sheet?.querySelector('.back')
        const status = sheet?.querySelector('.sheet-status')
        if (!sheet || !head || !status) return false
        const height = head.getBoundingClientRect().height
        const statusHeight = status.getBoundingClientRect().height
        const style = getComputedStyle(sheet)
        const topPadding = parseFloat(style.scrollPaddingTop)
        const bottomPadding = parseFloat(style.scrollPaddingBottom)
        return (!largeHeader || statusHeight > initialHeaderHeight * 1.5) && topPadding >= height && topPadding <= height + 5 && bottomPadding >= statusHeight && bottomPadding <= statusHeight + 5
      }, { initialHeaderHeight, largeHeader })
      const last = dialog.locator('a[href^="/m/"]').last()
      await last.waitFor()
      await last.focus()
      let checked = 0
      for (let i = 0; i < 100; i++) {
        await page.keyboard.press(i < 50 ? 'Shift+Tab' : 'Tab')
        await page.evaluate(() => new Promise(requestAnimationFrame))
        const focused = await page.evaluate(() => {
          const element = document.activeElement
          const sheet = document.querySelector('dialog:modal')
          const head = sheet?.querySelector('.back')
          if (!element || !head || !sheet?.contains(element) || head.contains(element)) return null
          const bounds = element.getBoundingClientRect()
          const status = head.querySelector('.sheet-status')
          return { label: element.textContent?.trim(), top: bounds.top, bottom: bounds.bottom, headerBottom: head.getBoundingClientRect().bottom, statusTop: innerHeight - (status?.getBoundingClientRect().height ?? 0) }
        })
        if (focused) {
          checked++
          assert.ok(focused.top >= focused.headerBottom - 1, `focused ${focused.label} is behind the sticky header`)
          assert.ok(focused.bottom <= focused.statusTop + 1, `focused ${focused.label} is behind the status: ${JSON.stringify(focused)}`)
          if (i === 9) await page.screenshot({ path: `/tmp/han-focus-fixed-${theme}-${largeHeader ? 'large' : 'normal'}.png` })
        }
      }
      assert.ok(checked >= 90, 'keyboard traversal exercised the sheet contents')
      await context.close()
    }
    console.log(`ok ${theme}: short viewport keeps focused controls visible`)
  }
} finally { await browser.close() }
