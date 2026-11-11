// Run after building the site and its data: SITE_DIR=dist bun scripts/check_grid.mjs
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { serveDist } from './serve-dist.mjs'

const cache = join(homedir(), '.cache/ms-playwright')
const chromiumPath = process.env.CHROMIUM_PATH ?? readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse().map(name => join(cache, name, 'chrome-linux64/chrome')).find(existsSync)
if (!chromiumPath) throw new Error('Set CHROMIUM_PATH to a Chromium executable')
const browser = await chromium.launch({ executablePath: chromiumPath })
try {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, locale: 'en-US' })
  if (process.env.SITE_DIR) await serveDist(context, process.env.SITE_DIR)
  const page = await context.newPage()
  /** @type {string[]} */
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const site = process.env.SITE_URL ?? 'http://localhost:5302'

  for (const [url, selector] of [['/?q=water', 'main .ui-tiles'], ['/?set=ext_e_withdrawal_records', '.records']]) {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto(site + url)
    const grid = page.locator(selector).first()
    await grid.locator('button').first().waitFor()
    const buttons = grid.locator('button')
    await page.waitForFunction(element => {
      const columns = getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
      return columns > 1 && element.querySelector('[role="row"]')?.querySelectorAll('button').length === columns
    }, await grid.elementHandle())
    assert.equal(await grid.getAttribute('role'), 'grid')
    assert.equal(await grid.locator('[role="listbox"], [role="option"]').count(), 0)
    assert.equal(await grid.locator('button[tabindex="0"]').count(), 1)
    assert.ok(await buttons.count() > 10)
    await grid.evaluate(element => element.addEventListener('keydown', event => element.setAttribute('data-key-prevented', String(event.defaultPrevented))))
    await buttons.first().focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await buttons.nth(1).evaluate(button => button === document.activeElement), true)
    assert.equal(await grid.getAttribute('data-key-prevented'), 'true')
    await page.keyboard.press('ArrowDown')
    assert.equal(await grid.getAttribute('data-key-prevented'), 'true')
    const row = await grid.locator('[role="row"]').nth(1).locator('button').all()
    assert.ok(await Promise.all(row.map(button => button.evaluate(element => element === document.activeElement))).then(values => values.some(Boolean)))
    await page.keyboard.press('Home')
    assert.equal(await row[0].evaluate(button => button === document.activeElement), true)
    await page.keyboard.press('Control+End')
    assert.equal(await buttons.last().evaluate(button => button === document.activeElement), true)
    await page.keyboard.press('Tab')
    assert.equal(await grid.evaluate(element => element.contains(document.activeElement)), false)
    await page.keyboard.press('Shift+Tab')
    assert.equal(await buttons.last().evaluate(button => button === document.activeElement), true)
    const rowsBeforeResize = await grid.locator('[role="row"]').count()
    await page.setViewportSize({ width: 600, height: 768 })
    await page.waitForFunction(({ element, previous }) => element.querySelectorAll('[role="row"]').length !== previous, { element: await grid.elementHandle(), previous: rowsBeforeResize })
    await page.waitForFunction(element => [...element.querySelectorAll('button')].at(-1) === document.activeElement, await grid.elementHandle())
    assert.equal(await buttons.last().evaluate(button => button === document.activeElement), true)
    assert.equal(await grid.locator('button[tabindex="0"]').count(), 1)
    await page.keyboard.press('Enter')
    if (url.includes('set=')) await page.locator('.card').first().waitFor()
    else assert.ok(new URL(page.url()).searchParams.has('c'))
    console.log(`ok ${url}: roles, roving focus, arrows, Home/End, Tab, resize, activation`)
  }
  for (const [url, selector] of [['/?q=water', 'main .ui-tiles'], ['/?set=ext_e_withdrawal_records', '.records']]) {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(site + url)
    const grid = page.locator(selector).first()
    const buttons = grid.locator('button')
    await buttons.first().waitFor()
    await page.waitForFunction(element => {
      const columns = getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
      return columns > 1 && element.querySelector('[role="row"]')?.querySelectorAll('button').length === columns
    }, await grid.elementHandle())
    const target = buttons.nth(13)
    const label = await target.innerText()
    await target.focus()
    await page.keyboard.press('Tab')
    const outside = await page.evaluateHandle(() => document.activeElement)
    assert.equal(await grid.evaluate(element => element.contains(document.activeElement)), false)
    const previousRows = await grid.locator('[role="row"]').count()
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.waitForFunction(({ element, previous }) => element.querySelectorAll('[role="row"]').length !== previous, { element: await grid.elementHandle(), previous: previousRows })
    assert.equal(await outside.evaluate(element => element === document.activeElement), true, `${url} stole focus after resize`)
    assert.equal(await grid.locator('button[tabindex="0"]').innerText(), label, `${url} lost the remembered item`)
    await page.keyboard.press('Shift+Tab')
    assert.equal(await target.evaluate(element => element === document.activeElement), true, `${url} returned to a different item`)
    await outside.dispose()
    console.log(`ok ${url}: resize while outside preserves the roving item and outside focus`)
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  for (const [url, selector] of [['/?q=water', 'main .ui-tiles'], ['/?set=ext_e_withdrawal_records', '.records']]) {
    await page.goto(site + url)
    const grid = page.locator(selector).first()
    await grid.locator('button').first().waitFor()
    await page.waitForFunction(element => {
      const columns = getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
      return columns > 1 && element.querySelector('[role="row"]')?.querySelectorAll('button').length === columns
    }, await grid.elementHandle())
    const rows = grid.locator('[role="row"]')
    const count = await rows.count()
    const finalRow = rows.nth(count - 1).locator('button')
    const previousRow = rows.nth(count - 2).locator('button')
    assert.ok(await finalRow.count() < await previousRow.count(), `${url} needs a partial final row`)
    await grid.evaluate(element => element.addEventListener('keydown', event => element.setAttribute('data-key-prevented', String(event.defaultPrevented))))
    /** @type {[import('playwright-core').Locator, string][]} */
    const boundaries = [
      [finalRow.first(), 'Home'], [finalRow.last(), 'End'],
      [rows.first().locator('button').first(), 'Control+Home'], [finalRow.last(), 'Control+End'],
      [finalRow.last(), 'ArrowRight'], [previousRow.last(), 'ArrowDown'],
      [rows.first().locator('button').first(), 'ArrowUp'], [finalRow.first(), 'ArrowLeft'],
    ]
    for (const [button, key] of boundaries) {
      await button.focus()
      const scrollPositions = () => button.evaluate(element => {
        /** @type {number[][]} */
        const positions = []
        for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) positions.push([ancestor.scrollLeft, ancestor.scrollTop])
        return positions
      })
      const before = await scrollPositions()
      await page.keyboard.press(key)
      assert.equal(await button.evaluate(element => element === document.activeElement), true, `${url} ${key} changed focus at a boundary`)
      const arrow = key.startsWith('Arrow')
      assert.equal(await grid.getAttribute('data-key-prevented'), String(!arrow), `${url} ${key} default handling`)
      if (!arrow) assert.deepEqual(await scrollPositions(), before, `${url} ${key} scrolled at a boundary`)
    }
    console.log(`ok ${url}: arrow boundaries allow native scrolling; Home/End boundaries retain scroll position`)
  }
  await page.setViewportSize({ width: 1024, height: 768 })
  for (const [url, selector] of [['/?q=water', 'main .ui-tiles'], ['/?set=ext_e_withdrawal_records', '.records']]) {
    await page.goto(site + url)
    const grid = page.locator(selector).first()
    const button = grid.locator('button').first()
    await button.waitFor()
    await page.waitForFunction(element => {
      const columns = getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
      return columns > 1 && element.querySelector('[role="row"]')?.querySelectorAll('button').length === columns
    }, await grid.elementHandle())
    const label = (await button.innerText()).trim()
    if (url.includes('set=')) {
      assert.equal(await button.getAttribute('aria-current'), null)
      assert.ok(!(await page.locator('.card').first().innerText()).includes(label))
    }
    await button.focus()
    await page.keyboard.press('Space')
    if (url.includes('set=')) {
      await page.waitForFunction(element => element.getAttribute('aria-current') === 'true', await button.elementHandle())
      await page.waitForFunction(code => document.querySelector('.card')?.textContent?.includes(code), label)
    } else await page.waitForFunction(() => new URL(location.href).searchParams.has('c'))
    console.log(`ok ${url}: Space activates the native button`)
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(site + '/?q=water')
  const keyboardTile = page.locator('main .ui-tiles button').first()
  await keyboardTile.waitFor()
  await page.waitForLoadState('networkidle')
  const keyboardCharacter = await keyboardTile.locator('.ui-tile-glyph').innerText()
  for (let i = 0; i < 100 && !await keyboardTile.evaluate(element => element === document.activeElement); i++) await page.keyboard.press('Tab')
  assert.equal(await keyboardTile.evaluate(element => element === document.activeElement), true, 'keyboard cannot reach the first tile')
  await page.keyboard.press('Enter')
  const add = page.locator('.card').getByRole('button', { name: 'Add to text' })
  await add.waitFor()
  for (let i = 0; i < 100 && !await add.evaluate(element => element === document.activeElement); i++) await page.keyboard.press('Tab')
  assert.equal(await add.evaluate(element => element === document.activeElement), true, 'keyboard cannot reach Add to text')
  const previousText = await page.locator('#writing').inputValue()
  await page.keyboard.press('Space')
  assert.equal(await page.locator('#writing').inputValue(), previousText + keyboardCharacter)
  console.log('ok keyboard reaches a character tile, opens its card, and adds it to writing')

  await page.goto(site + '/?q=water')
  const first = page.locator('main .ui-tiles button').first()
  await first.waitFor()
  const character = await first.locator('.ui-tile-glyph').innerText()
  const beforeDoubleClick = await page.locator('#writing').inputValue()
  await first.dblclick()
  assert.equal(await page.locator('#writing').inputValue(), beforeDoubleClick + character)
  console.log('ok double click adds the character to the writing field')
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
