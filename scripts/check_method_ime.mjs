// Run after bun run build; CHROMIUM_PATH may point to a local Chromium executable.
import { strict as assert } from 'node:assert'
import { chromium } from 'playwright-core'
import { serveDist } from './serve-dist.mjs'

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
try {
  const context = await browser.newContext()
  await serveDist(context, 'dist')
  await context.route('**/data/methods.json', route => route.fulfill({ json: [{ id: 'fixture', family: 'other', names: { en: 'Fixture' }, source: { name: 'Fixture', url: 'https://example.com', licence: 'test' }, codes: 1, chars: 20 }] }))
  await context.route('**/data/s/fixture.tsv.gz', route => route.fulfill({ contentType: 'text/plain', body: 'a\t一丁七万丈三上下不与丐丑专且丕世丘丙业丛\n' }))
  const page = await context.newPage()
  await page.goto('http://localhost/m/fixture')
  const input = page.locator('input.box')
  await input.fill('a')
  await page.locator('.cand').first().waitFor()
  const first = await page.locator('.cand').first().innerText()
  for (const key of ['Enter', ' ', '1', 'Backspace', 'PageDown', 'PageUp', '=', '-']) {
    const allowed = await input.evaluate((element, key) => element.dispatchEvent(new KeyboardEvent('keydown', { key, isComposing: true, bubbles: true, cancelable: true })), key)
    assert.equal(allowed, true, `${key} must remain available to the IME`)
    assert.equal(await input.inputValue(), 'a')
    assert.equal(await page.locator('.cand').first().innerText(), first)
    assert.equal(await page.evaluate(() => localStorage.getItem('han-input:text')), null)
  }
  const safariAllowed = await input.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true })))
  assert.equal(safariAllowed, true)
  assert.equal(await input.inputValue(), 'a')
  await input.fill('')
  await page.evaluate(() => localStorage.setItem('han-input:text', '一'))
  // Restore the app's in-memory text state via a reload.
  await page.reload()
  await input.waitFor()
  const backspaceAllowed = await input.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', isComposing: true, bubbles: true, cancelable: true })))
  assert.equal(backspaceAllowed, true)
  assert.equal(await page.evaluate(() => localStorage.getItem('han-input:text')), '一')
  const lateBackspaceAllowed = await input.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 229, bubbles: true, cancelable: true })))
  assert.equal(lateBackspaceAllowed, true)
  assert.equal(await page.evaluate(() => localStorage.getItem('han-input:text')), '一')
  await input.fill('a')
  for (const key of ['Enter', ' ', '1', 'PageDown', 'PageUp', '=', '-', 'a']) {
    const allowed = await input.evaluate((element, key) => element.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode: 229, bubbles: true, cancelable: true })), key)
    assert.equal(allowed, true, `${key} with keyCode 229 must retain its native default`)
    assert.equal(await input.inputValue(), 'a')
    assert.equal(await page.locator('.cand').first().innerText(), first)
    assert.equal(await page.evaluate(() => localStorage.getItem('han-input:text')), '一')
  }
  await page.locator('.cand').first().waitFor()
  await page.keyboard.press('PageDown')
  assert.notEqual(await page.locator('.cand').first().innerText(), first)
  await page.keyboard.press('PageUp')
  assert.equal(await page.locator('.cand').first().innerText(), first)
  await page.keyboard.press('Enter')
  assert.equal(await input.inputValue(), '')
  assert.equal(await page.evaluate(() => localStorage.getItem('han-input:text')), '一一')
  await input.fill('a')
  await page.keyboard.press('1')
  assert.equal(await input.inputValue(), '')
  assert.equal(await page.evaluate(() => localStorage.getItem('han-input:text')), '一一一')
  await input.fill('a')
  await page.keyboard.press('Space')
  assert.equal(await input.inputValue(), '')
  assert.equal(await page.evaluate(() => localStorage.getItem('han-input:text')), '一一一一')
  await page.keyboard.press('Backspace')
  assert.equal(await page.evaluate(() => localStorage.getItem('han-input:text')), '一一一')
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT })
  console.log('Method shortcuts respect IME composition: passed')
} finally {
  await browser.close()
}
