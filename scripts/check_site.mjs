// Operates the built site in Chromium: each way of finding a character, and every page at a desktop
// and a phone width in both themes. Screenshots go to shots/.
//   bun run build && bunx vite preview app --port 5302 &
//   SITE_URL=http://localhost:5302 bun scripts/check_site.mjs
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { serveDist } from './serve-dist.mjs'

const SITE = process.env.SITE_URL ?? 'http://localhost:5302'
const dist = process.env.SITE_DIR
mkdirSync('shots', { recursive: true })

function browserPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
  const cache = join(homedir(), '.cache/ms-playwright')
  for (const dir of readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse()) {
    for (const tail of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const path = join(cache, dir, tail)
      if (existsSync(path)) return path
    }
  }
  throw new Error('No Chromium under ~/.cache/ms-playwright; set CHROMIUM_PATH')
}

const browser = await chromium.launch({ executablePath: browserPath() })
let passed = 0
/** @type {string[]} */
const failures = []
/** @param {string} name @param {() => Promise<void>} run */
async function check(name, run) {
  try { await run(); passed++; console.log(`ok   ${name}`) } catch (error) {
    failures.push(name)
    console.log(`FAIL ${name}: ${/** @type {Error} */ (error).message.split('\n')[0]}`)
  }
}

const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'en-US', colorScheme: 'light' })
if (dist) await serveDist(context, dist)
const page = await context.newPage()
/** @type {string[]} */
const errors = []
page.on('pageerror', error => errors.push(error.message))

/** Search, and the characters shown. @param {string} query */
async function find(query) {
  await page.goto(`${SITE}/?q=${encodeURIComponent(query)}`)
  await page.waitForLoadState('networkidle')
  return page.locator('main .ui-tile-glyph').allTextContents()
}

/** @type {[string, string, string][]} name, query, a character it must find */
const FINDS = [
  ['葦手 by its own example', 'ユタヘヘミ', '龍'],
  ['葦手 another example', 'サカロ', '茄'],
  ['Cangjie', 'jnd', '字'],
  ['Wubi 86', 'uegd', '龍'],
  ['Four-Corner', '30407', '字'],
  ['Big5', 'a672', '字'],
  ['GBK', 'd7d6', '字'],
  ['T-Code', 'yp', '無'],
  ['TUT-Code', 'dw', '無'],
  ['Xiaohe double pinyin', 'vs', '中'],
  ['Pinyin with a tone digit', 'zhong1', '中'],
  ['Pinyin with a tone mark', 'zhōng', '中'],
  ['Guangyun position', '端一東平', '東'],
  ['Tshet-uinh Phonetic Alphabet', 'luong', '龍'],
  ['Baxter', 'ljowng', '龍'],
  ['Wade-Giles', 'tzu4', '字'],
  ['SKIP', '2-2-10', '無'],
  ['Morohashi', '06942', '字'],
  ['Telegraph code', '1316', '字'],
  ['Chữ Nôm', 'chữ', '𡨸'],
  ['Sawndip', 'saw', '字'],
  ['A Cantonese reading', 'lung4', '龍'],
  ['A dialect reading in IPA', 'lʊŋ', '龍'],
  ['A meaning in English', 'dragon', '龍'],
  ['A meaning in Chinese', '河流', '河'],
  ['A code point', 'U+5B57', '字'],
  ['Kana by spelling', 'shi', 'し'],
  ['Hentaigana by name', 'a-1', '\u{1B002}'],
  ['Kana by source character', '安', 'あ'],
  ['Hentaigana by source character', '安', '\u{1B002}'],
  ['Kana by a new-form source character', '与', 'よ'],
  ['Kana by an old-form source character', '與', 'よ'],
  ['A kana name with two words', 'small-a', 'ぁ'],
  ['The same name without its hyphen', 'smalla', 'ぁ'],
  ['A kana newer than the runtime', 'alternate-ne', '\u{1B127}'],
  ['A Han character newer than the runtime', 'U+2B81E', '\u{2B81E}'],
  ['Nüshu by a traditional Han character', '錯', '\u{1B172}'],
  ['A part in a sequence, either spelling', '口匕', '叱'],
  ['The same sequence written with 七', '口七', '叱'],
  ['A pasted kana', 'あ', 'あ'],
  ['Nüshu by reading', 'na33', '\u{1B171}'],
  ['Nüshu by Han character', '一', '\u{1B170}'],
  ['Nüshu by code point', 'U+1B170', '\u{1B170}'],
]
for (const [name, query, char] of FINDS) {
  await check(`find ${name}: ${query} → ${char}`, async () => assert.ok((await find(query)).includes(char)))
}

await check('a part is also searched under its variant spellings', async () => {
  for (const query of ['七 5畫', '匕 5畫']) {
    const found = await find(query)
    for (const char of ['叱', '叱']) assert.ok(found.includes(char), `${query} ${char}`)
  }
})
await check('a run of parts finds both spellings of a part', async () => {
  const found = await find('口匕')
  for (const char of ['叱', '叱', '𫜸']) assert.ok(found.includes(char), char)
  const other = await find('口七')
  for (const char of ['叱', '叱']) assert.ok(other.includes(char), char)
})
await check('the card names the other code point of a character', async () => {
  for (const [code, other] of [['53F1', '叱'], ['2F83A', '叱']]) {
    await page.goto(`${SITE}/?c=${code}`)
    await page.waitForLoadState('networkidle')
    await page.waitForFunction((/** @type {string} */ char) => (document.querySelector('.card')?.textContent ?? '').includes(char), other)
    assert.match(await page.locator('.card').innerText(), new RegExp(other))
  }
})
await check('clues narrow: 氵 with 12 strokes leaves 湖 and not 河', async () => {
  const found = await find('氵 12畫')
  assert.ok(found.includes('湖'))
  assert.ok(!found.includes('河'))
})
await check('clues narrow: reading and meaning', async () => {
  assert.ok((await find('liu2 river')).includes('流'))
})
await check('clues combine a source character with a code', async () => {
  assert.ok((await find('安 a-1')).includes('\u{1B002}'))
  assert.ok((await find('日 na33')).includes('\u{1B171}'))
  assert.ok((await find('a-1 \u{1B002}')).includes('\u{1B002}'))
})
await check('a code typed exactly comes before the readings it folds onto', async () => {
  await find('a-1')
  assert.match(await page.locator('main .ui-section h2').first().innerText(), /kana/i)
})
await check('siniform scripts stay out of the tables', async () => {
  const methods = await page.evaluate(async () => (await fetch('/data/methods.json')).json())
  assert.ok(!methods.some((/** @type {{ id: string }} */ method) => /tangut|jurchen|khitan/i.test(method.id)))
  await page.goto(`${SITE}/?q=U%2B18E01&c=18E01`)
  await page.waitForLoadState('networkidle')
  assert.equal(await page.locator('.card dl .row').count(), 0)
})

await check('the card lists codes, every reading, and 字統 first', async () => {
  await page.goto(`${SITE}/?c=5B57`)
  await page.waitForLoadState('networkidle')
  const links = page.locator('.card .links a')
  assert.match(await links.first().getAttribute('href') ?? '', /^https:\/\/zi\.tools\/zi\//)
  assert.match(await page.locator('.card').innerText(), /Readings in \d{3,} varieties/i)
})
await check('a method types and takes a candidate into the text', async () => {
  await page.goto(`${SITE}/m/ashide`)
  await page.waitForLoadState('networkidle')
  await page.locator('[data-primary]').fill('ユタヘヘミ')
  await page.locator('[data-primary]').press('Space')
  assert.equal(await page.locator('#writing').inputValue(), '龍')
})
await check('a variety types too', async () => {
  await page.goto(`${SITE}/readings`)
  await page.waitForLoadState('networkidle')
  await page.locator('[data-primary]').fill('廣州')
  await page.locator('.list a').first().click()
  await page.waitForURL(/\/v\/\d+/)
  await page.waitForLoadState('networkidle')
  await page.locator('[data-primary]').fill('l')
  await page.locator('.cand').first().waitFor()
})
await check('rhyme table opens a character', async () => {
  await page.goto(`${SITE}/rhymes`)
  await page.waitForLoadState('networkidle')
  await page.locator('.cell').first().click()
  await page.waitForURL(/c=/)
})
for (const [name, hex] of [['Extension B', '20000'], ['Extension G', '30000'], ['Extension J', '33473'], ['Nüshu', '1B170'], ['Nüshu iteration mark', '16FE1'], ['Hentaigana', '1B002']]) {
  await check(`${name} is drawn by a bundled face, not an empty box`, async () => {
    await page.goto(`${SITE}/?c=${hex}`)
    await page.waitForLoadState('networkidle')
    await page.waitForFunction(() => document.fonts.status === 'loaded')
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    const { root } = await cdp.send('DOM.getDocument')
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.glyph' })
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
    assert.ok(fonts.some(font => font.isCustomFont), fonts.map(font => font.familyName).join())
  })
}
await check('an IRG G source names itself', async () => {
  await page.goto(`${SITE}/?c=206C5`)
  await page.waitForLoadState('networkidle')
  const trigger = page.locator('.source-code .trigger').first()
  await trigger.hover()
  const tip = page.getByRole('tooltip').first()
  await tip.waitFor()
  assert.match(await tip.innerText(), /Cihai/)
})
await check('an Extension E record names its G source', async () => {
  await page.goto(`${SITE}/?set=ext_e_withdrawal_records`)
  await page.waitForLoadState('networkidle')
  const tile = page.locator('.records .ui-tile[title*="G_GJZ"]').first()
  assert.equal(await tile.count(), 1)
  await tile.click()
  await page.locator('aside.card .source-code .trigger').first().waitFor()
  assert.match(await page.locator('aside.card').innerText(), /Commercial Press/)
})
await check('no script errors', async () => assert.equal(errors.join(' | '), ''))

const SHOTS = [['find', '/?q=lung4&c=9F8D'], ['clues', '/?q=%E6%B0%B5+12%E7%95%AB&c=6E56'], ['methods', '/methods'], ['ashide', '/m/ashide?q=%E3%83%A6%E3%82%BF'], ['readings', '/readings'], ['rhymes', '/rhymes?q=%E6%9D%B1&c=6771'], ['radicals', '/radicals?q=85'], ['rare', '/?c=33473'], ['nushu', '/?q=%E4%B8%80&c=1B170'], ['hentaigana', '/?q=%E5%AE%89&c=1B002'], ['about', '/about']]
for (const [theme, phone] of [['light', false], ['dark', false], ['light', true], ['dark', true]]) {
  const view = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1360, height: 900 }, deviceScaleFactor: 2, colorScheme: /** @type {'light' | 'dark'} */ (theme), locale: 'en-US' })
  if (dist) await serveDist(view, dist)
  const tab = await view.newPage()
  for (const [name, path] of SHOTS) {
    await tab.goto(`${SITE}${path}`)
    await tab.waitForLoadState('networkidle')
    await tab.waitForTimeout(300)
    if (phone) {
      await check(`${name} at phone width has no sideways scroll (${theme})`, async () => {
        const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - innerWidth)
        assert.ok(overflow <= 0, `overflow ${overflow}`)
      })
    }
    await tab.screenshot({ path: `shots/${name}-${theme}${phone ? '-phone' : ''}.png` })
  }
  await view.close()
}

await browser.close()
console.log(`${passed} passed, ${failures.length} failed`)
process.exit(failures.length ? 1 : 0)
