// Run after bun run build; CHROMIUM_PATH may point to a local Chromium executable.
import { strict as assert } from 'node:assert'
import { chromium } from 'playwright-core'
import { serveDist } from './serve-dist.mjs'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const context = await browser.newContext()
  await serveDist(context, 'dist')
  const page = await context.newPage()
  await page.goto('http://localhost/composition')
  for (const [inputSelector, paletteSelector] of [
    ['#composition-input', '.palette'],
    ['#arithmetic-input', '.arithmetic-palette'],
  ]) {
    const input = page.locator(inputSelector)
    const button = page.locator(`${paletteSelector} button`).first()
    const sign = await button.locator('span').first().innerText()
    /** @type {[number, number, string][]} */
    const cases = [[1, 1, 'Enter'], [1, 3, 'Space']]
    for (const [start, end, key] of cases) {
      await input.fill('abcd')
      await input.evaluate((element, [a, b]) => /** @type {HTMLTextAreaElement} */ (element).setSelectionRange(a, b), [start, end])
      await button.focus()
      await page.keyboard.press(key)
      assert.equal(await input.inputValue(), `a${sign}${end === 1 ? 'bcd' : 'd'}`)
      assert.equal(await input.evaluate(element => /** @type {HTMLTextAreaElement} */ (element).selectionStart), start + sign.length)
      assert.equal(await input.evaluate(element => /** @type {HTMLTextAreaElement} */ (element).selectionEnd), start + sign.length)
      assert.equal(await input.evaluate(element => document.activeElement === element), true)
    }
    await input.fill('abcd')
    await input.evaluate(element => /** @type {HTMLTextAreaElement} */ (element).setSelectionRange(2, 3))
    await button.click()
    assert.equal(await input.inputValue(), `ab${sign}d`)
  }
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT })
  console.log('Composition palettes insert at retained selection: passed')
} finally {
  await browser.close()
}
