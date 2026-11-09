// Local browser checks against the built app, served through Playwright request interception.
// bun run build && bun scripts/check_charsets.mjs
import { chromium } from 'playwright-core'
import { strict as assert } from 'node:assert'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { extname, join, resolve } from 'node:path'

const SITE = 'http://han-input.test'
const DIST = resolve('dist')
const PUBLIC = resolve('app/public')
const SHOTS = resolve('shots')
mkdirSync(SHOTS, { recursive: true })
/** @type {import('../app/lib/charsets.js').Charset[]} */
const catalogue = JSON.parse(readFileSync(join(DIST, 'charsets/index.json'), 'utf8'))
const members = (/** @type {string} */ id) => new Set([...readFileSync(join(DIST, 'charsets', `${id}.txt`), 'utf8')])
const t1 = members('t1')
const g0 = members('g0')
/** @param {string} char */
const isPrivateUse = char => {
  const cp = char.codePointAt(0) ?? 0
  return cp >= 0xE000 && cp <= 0xF8FF || cp >= 0xF0000 && cp <= 0xFFFFD || cp >= 0x100000 && cp <= 0x10FFFD
}
/** @param {string} id */
const codesOf = id => new Map(readFileSync(join(DIST, 'charsets', `${id}.codes.tsv`), 'utf8').trim().split('\n').filter(Boolean).map(line => {
  const at = line.indexOf('\t')
  return [line.slice(0, at), line.slice(at + 1)]
}))
const collator = new Intl.Collator('en', { numeric: true })
const t1Entry = catalogue.find(set => set.id === 't1')
assert.ok(t1Entry)

function browserPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
  const cache = join(homedir(), '.cache/ms-playwright')
  for (const dir of readdirSync(cache).filter(name => name.startsWith('chromium-')).sort().reverse()) {
    for (const tail of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const path = join(cache, dir, tail)
      if (existsSync(path)) return path
    }
  }
  throw new Error('Set CHROMIUM_PATH to a Chromium executable')
}

const browser = await chromium.launch({ executablePath: browserPath() })
/** @type {string[]} */
const failures = []
/** @type {string[]} */
const scriptErrors = []
let passed = 0
/** @type {Map<string, number>} */
const failNext = new Map()
/** @type {Map<string, Promise<void>>} */
const delayed = new Map()
/** @type {Record<string, string>} */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.gz': 'application/octet-stream' }

/** @param {import('playwright-core').BrowserContext} context */
async function serve(context) {
  context.on('page', page => page.on('pageerror', error => scriptErrors.push(error.message)))
  await context.route(`${SITE}/**`, async route => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname)
    const remaining = failNext.get(path) ?? 0
    if (remaining) {
      failNext.set(path, remaining - 1)
      await route.fulfill({ status: 503, body: 'Unavailable' })
      return
    }
    const pending = delayed.get(path)
    if (pending) await pending
    const relative = path.replace(/^\/+/, '')
    let file = join(DIST, relative)
    if (!extname(file)) file = join(DIST, 'index.html')
    if (!existsSync(file)) file = join(PUBLIC, relative)
    if (!existsSync(file)) {
      await route.fulfill({ status: 404, body: '' })
      return
    }
    await route.fulfill({ status: 200, contentType: MIME[extname(file)] ?? 'application/octet-stream', body: readFileSync(file) })
  })
}

/** @param {string} name @param {() => Promise<void>} run */
async function check(name, run) {
  try { await run(); passed++; console.log(`ok   ${name}`) }
  catch (error) {
    failures.push(name)
    console.error(`FAIL ${name}: ${/** @type {Error} */ (error).message}`)
  }
}

/** @param {import('playwright-core').Page} page */
async function ready(page) {
  await page.waitForLoadState('networkidle')
  await page.locator('main [role="status"]').waitFor({ state: 'hidden' })
}
/** @param {import('playwright-core').Page} page @param {string} [query] @param {string} [set] */
async function find(page, query = '', set = 't1') {
  const params = new URLSearchParams({ set, q: query })
  await page.goto(`${SITE}/?${params}`)
  await ready(page)
  return page.locator('main .ui-tile-glyph').allTextContents()
}
/** @param {import('playwright-core').Page} page @param {string} id */
async function choose(page, id) {
  await page.locator('main details summary').click()
  await page.locator('main details input').fill(id)
  await page.locator(`main details [data-charset="${id}"]`).click()
  await ready(page)
}
/** @param {string[]} chars @param {Set<string>} allowed */
function subset(chars, allowed) { assert.ok(chars.every(char => allowed.has(char)), chars.filter(char => !allowed.has(char)).join('')) }

const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'en-US' })
await serve(context)
const page = await context.newPage()
try {
  await check('full dynamic catalogue, grouped and searchable in every name', async () => {
    await find(page)
    await page.locator('main details summary').click()
    assert.equal(await page.locator('main details .set').count(), catalogue.length)
    assert.equal(await page.locator('main details .groups section').count(), new Set(catalogue.map(set => set.group)).size)
    await page.locator('main details input').fill(t1Entry.names.zh ?? t1Entry.names.en)
    assert.ok(await page.locator('main details .set').count())
    await page.locator('main details input').fill('no-such-character-set')
    assert.equal(await page.locator('main details .set').count(), 0)
    assert.match(await page.locator('main details').innerText(), /No matching sets/)
  })
  await check('empty query browses all mapped members with 240 visible tiles and source counts', async () => {
    const chars = await find(page)
    assert.equal(chars.length, Math.min(240, t1.size))
    assert.deepEqual(chars, [...t1].slice(0, 240))
    const metadata = await page.locator('.metadata').innerText()
    assert.ok(metadata.includes(t1Entry.chars.toLocaleString('en-US')))
    assert.ok(metadata.includes(t1Entry.total.toLocaleString('en-US')))
    assert.equal(await page.locator('.metadata a').getAttribute('href'), t1Entry.source.url)
    assert.match(await page.locator('.charset-filter').innerText(), /Every source row is listed/)
  })
  await check('a browsed set lays its rows one code digit wide on a wide screen', async () => {
    const width = () => page.locator('main .ui-section .ui-tiles[data-columns]').first()
      .evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    await page.goto(`${SITE}/?set=unicode_basic`)
    await ready(page)
    assert.equal(await width(), 16)
    await page.goto(`${SITE}/?set=g0`)
    await ready(page)
    assert.equal(await width(), 10)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${SITE}/?set=unicode_basic`)
    await ready(page)
    assert.notEqual(await width(), 16)
    await page.setViewportSize({ width: 1360, height: 900 })
  })
  await check('every browsed character shows its code, and code order reorders the grid', async () => {
    const codes = codesOf('t1')
    await find(page)
    const glyphs = await page.locator('main .ui-tile-glyph').allTextContents()
    assert.ok(glyphs.every(char => codes.has(char)))
    assert.deepEqual(await page.locator('main .ui-tile-note').allTextContents(), glyphs.map(char => codes.get(char)))
    const sorted = [...t1].sort((a, b) => collator.compare(codes.get(a) ?? '', codes.get(b) ?? ''))
    await page.locator('main .browse-tools').getByRole('button', { name: 'Code order', exact: true }).click()
    await page.waitForFunction(expected => document.querySelector('main .ui-tile-glyph')?.textContent === expected, sorted[0])
    assert.deepEqual(await page.locator('main .ui-tile-glyph').allTextContents(), sorted.slice(0, 240))
    assert.deepEqual(await page.locator('main .ui-tile-note').allTextContents(), sorted.slice(0, 240).map(char => codes.get(char)))
    assert.equal(await page.locator('main .browse-tools').getByRole('button', { name: 'Code order', exact: true }).getAttribute('aria-pressed'), 'true')
    assert.equal(new URL(page.url()).searchParams.has('p'), false)
  })
  await check('a browse shows only encoded or only unencoded members on demand', async () => {
    const land = catalogue.find(set => set.group === 'CNS sources' && set.label === '內政部地政用字')
    assert.ok(land)
    const all = [...members(land.id)]
    const unencoded = all.filter(isPrivateUse)
    assert.ok(unencoded.length)
    await find(page, '', land.id)
    const tools = page.locator('main .browse-tools')
    await tools.getByRole('button', { name: 'Unencoded', exact: true }).click()
    await page.waitForFunction(expected => document.querySelectorAll('main .ui-tile-glyph').length === expected, Math.min(240, unencoded.length))
    const onlyUnencoded = await page.locator('main .ui-tile-glyph').allTextContents()
    assert.ok(onlyUnencoded.every(isPrivateUse))
    assert.deepEqual(onlyUnencoded, unencoded.slice(0, 240))
    await tools.getByRole('button', { name: 'Encoded', exact: true }).click()
    await page.waitForFunction(expected => document.querySelectorAll('main .ui-tile-glyph').length === expected, Math.min(240, all.length - unencoded.length))
    const onlyEncoded = await page.locator('main .ui-tile-glyph').allTextContents()
    assert.ok(onlyEncoded.every(char => !isPrivateUse(char)))
    await tools.getByRole('button', { name: 'All', exact: true }).click()
    await page.waitForFunction(expected => document.querySelectorAll('main .ui-tile-glyph').length === expected, Math.min(240, all.length))
    assert.deepEqual(await page.locator('main .ui-tile-glyph').allTextContents(), all.slice(0, 240))
  })
  await check('a browsed set pages by number, end and jump, with a short last page', async () => {
    const all = [...t1]
    const pageCount = Math.ceil(all.length / 240)
    await find(page)
    const pager = page.locator('.pager').first()
    assert.match(await pager.innerText(), new RegExp(`Page 1 of ${pageCount}`))
    assert.equal(await pager.locator('[data-page="first"]').getAttribute('aria-disabled'), 'true')
    assert.equal(await pager.locator('[data-page="prev"]').getAttribute('aria-disabled'), 'true')
    assert.equal(await pager.locator('[data-page="1"]').getAttribute('aria-current'), 'page')
    assert.equal(await pager.locator('[data-page="first"]').getAttribute('href'), null)
    assert.equal(await pager.locator('[data-page="2"]').getAttribute('href'), '/?set=t1&p=2')
    assert.deepEqual(await pager.locator('[data-page]').evaluateAll(nodes => nodes.map(node => node.dataset.page)),
      ['first', 'prev', '1', '2', '3', String(pageCount), 'next', 'last'])
    await pager.locator('[data-page="2"]').click()
    await page.waitForFunction(expected => document.querySelector('main .ui-tile-glyph')?.textContent === expected, all[240])
    assert.deepEqual(await page.locator('main .ui-tile-glyph').allTextContents(), all.slice(240, 480))
    assert.match(await pager.innerText(), new RegExp(`Page 2 of ${pageCount}`))
    await pager.locator('input').fill('12')
    await pager.getByRole('button', { name: 'Go' }).click()
    await page.waitForFunction(expected => document.querySelector('main .ui-tile-glyph')?.textContent === expected, all[11 * 240])
    assert.equal(await pager.locator('.gap').count(), 2)
    assert.deepEqual(await pager.locator('[data-page]').evaluateAll(nodes => nodes.map(node => node.dataset.page)),
      ['first', 'prev', '1', '10', '11', '12', '13', '14', String(pageCount), 'next', 'last'])
    await pager.locator('input').fill(String(pageCount))
    await pager.getByRole('button', { name: 'Go' }).click()
    await page.waitForFunction(expected => document.querySelector('main .ui-tile-glyph')?.textContent === expected, all[(pageCount - 1) * 240])
    assert.deepEqual(await page.locator('main .ui-tile-glyph').allTextContents(), all.slice((pageCount - 1) * 240))
    assert.equal(await pager.locator('[data-page="next"]').getAttribute('aria-disabled'), 'true')
    assert.equal(await pager.locator('[data-page="last"]').getAttribute('aria-disabled'), 'true')
    assert.equal(await pager.locator('[data-page="next"]').getAttribute('href'), null)
    assert.equal(await pager.locator('input').inputValue(), '')
    await pager.locator('[data-page="first"]').click()
    await page.waitForFunction(expected => document.querySelector('main .ui-tile-glyph')?.textContent === expected, all[0])
    await pager.locator('[data-page="last"]').click()
    await page.waitForFunction(expected => document.querySelector('main .ui-tile-glyph')?.textContent === expected, all[(pageCount - 1) * 240])
  })
  await check('a browsed page lives in the address, survives reload and Back, and clamps', async () => {
    const all = [...t1]
    const pageCount = Math.ceil(all.length / 240)
    const first = (/** @type {number} */ at) => all[at * 240]
    await page.goto(`${SITE}/?set=t1&p=3`)
    await ready(page)
    assert.deepEqual(await page.locator('main .ui-tile-glyph').allTextContents(), all.slice(480, 720))
    assert.equal(new URL(page.url()).searchParams.get('p'), '3')
    const pager = page.locator('.pager').first()
    await pager.locator('[data-page="next"]').click()
    await page.waitForFunction(expected => document.querySelector('main .ui-tile-glyph')?.textContent === expected, first(3))
    assert.equal(new URL(page.url()).searchParams.get('p'), '4')
    await page.goBack()
    await page.waitForFunction(expected => document.querySelector('main .ui-tile-glyph')?.textContent === expected, first(2))
    assert.equal(new URL(page.url()).searchParams.get('p'), '3')
    await page.goForward()
    await page.waitForFunction(expected => document.querySelector('main .ui-tile-glyph')?.textContent === expected, first(3))
    await page.goto(`${SITE}/?set=t1&p=999`)
    await ready(page)
    assert.match(await page.locator('.pager').first().innerText(), new RegExp(`Page ${pageCount} of ${pageCount}`))
    assert.equal(new URL(page.url()).searchParams.get('p'), String(pageCount))
    assert.deepEqual(await page.locator('main .ui-tile-glyph').allTextContents(), all.slice((pageCount - 1) * 240))
    await page.locator('.pager').first().locator('[data-page="first"]').click()
    await page.waitForFunction(expected => document.querySelector('main .ui-tile-glyph')?.textContent === expected, first(0))
    assert.equal(new URL(page.url()).searchParams.has('p'), false)
  })
  await check('CNS source overview lists every registration-source category before choosing a character', async () => {
    await find(page, '', '')
    await page.getByRole('button', { name: 'CNS source categories', exact: true }).click()
    assert.equal(await page.locator('main details input').inputValue(), 'CNS sources')
    assert.equal(await page.locator('main details .set').count(), 123)
    assert.match(await page.locator('main details').innerText(), /source recorded when each CNS code was added/)
    const land = catalogue.find(set => set.group === 'CNS sources' && set.label === '內政部地政用字')
    assert.ok(land)
    await page.locator(`[data-charset="${land.id}"]`).click()
    await ready(page)
    assert.equal(new URL(page.url()).searchParams.get('set'), land.id)
    const chars = await page.locator('main .ui-tile-glyph').allTextContents()
    assert.ok(chars.length)
    subset(chars, members(land.id))
    assert.match(await page.locator('.metadata').innerText(), /3,692/)
    assert.match(await page.locator('.metadata').innerText(), /2026-08-05/)
    assert.equal(await page.getByRole('link', { name: 'Records', exact: true }).getAttribute('href'), land.source.records)
  })
  for (const proposal of catalogue.filter(set => set.records?.glyphs)) {
    await check(`printed records browse and open a card: ${proposal.id}`, async () => {
      assert.ok(proposal.records)
      const data = JSON.parse(readFileSync(join(DIST, 'charsets', proposal.records.file.replace('/charsets/', '')), 'utf8'))
      await find(page, '', proposal.id)
      assert.equal(await page.locator('main .ui-tile-glyph').count(), proposal.chars)
      const tiles = page.locator('main .records .ui-tile')
      const visible = Math.min(240, proposal.records.count)
      assert.equal(await tiles.count(), visible)
      assert.equal(await page.locator('main .records img').count(), Math.min(visible, proposal.records.glyphs))
      assert.equal(await page.locator('main .records .ui-tile-note').count(), Math.min(visible, proposal.records.glyphs))
      if (proposal.records.glyphs) {
        const firstGlyph = data.records.find(/** @param {{glyph?:string}} record */ record => record.glyph)
        assert.equal(await page.locator('main .records .ui-tile-note').first().innerText(), firstGlyph.source ?? firstGlyph.serial)
      }
      if (proposal.records.count > 240) assert.match(await page.locator('main .ui-hint').last().innerText(), new RegExp(`240 of ${proposal.records.count}`))
      await page.waitForFunction(() => [...document.querySelectorAll('main .records img')].every(image => /** @type {HTMLImageElement} */ (image).complete && /** @type {HTMLImageElement} */ (image).naturalWidth > 0))
      assert.equal(await page.getByRole('link', { name: 'Records', exact: true }).getAttribute('href'), proposal.records.file)
      const first = data.records[0]
      await tiles.first().click()
      if (proposal.encoded && proposal.unencoded) {
        const tools = page.locator('main .records-tools')
        await tools.getByRole('button', { name: 'Encoded', exact: true }).click()
        await page.waitForFunction(expected => document.querySelectorAll('main .records .ui-tile').length === expected, Math.min(240, proposal.encoded))
        await tools.getByRole('button', { name: 'Unencoded', exact: true }).click()
        await page.waitForFunction(expected => document.querySelectorAll('main .records .ui-tile').length === expected, Math.min(240, proposal.unencoded))
        await tools.getByRole('button', { name: 'All', exact: true }).click()
        await page.waitForFunction(expected => document.querySelectorAll('main .records .ui-tile').length === expected, visible)
      }
      const card = page.locator('aside.card')
      assert.match(await card.innerText(), new RegExp(first.source))
      assert.match(await card.innerText(), new RegExp(first.document, 'i'))
      assert.equal(new URL(page.url()).searchParams.has('c'), false)
      if (proposal.chars) {
        await page.locator('main .ui-tile-glyph').first().click()
        const text = await card.innerText()
        assert.match(text, /U\+[0-9A-F]{4,5}/)
        assert.ok(!text.includes(first.source), 'the character card must replace the record card')
      }
    })
  }
  const ids = catalogue.find(set => set.records && set.records.glyphs === 0 && (() => {
    const data = JSON.parse(readFileSync(join(DIST, 'charsets', set.records.file.replace('/charsets/', '')), 'utf8'))
    return data.records.some(/** @param {{kind?:string}} record */ record => record.kind === 'ids')
  })())
  const idsRecords = ids?.records
  if (ids && idsRecords) {
    await check(`description records are listed as text: ${ids.id}`, async () => {
      await find(page, '', ids.id)
      assert.equal(await page.locator('main .ids-list li').count(), Math.min(240, idsRecords.count))
      assert.ok((await page.locator('main .ids-list li').first().innerText()).length > 0)
    })
  }
  for (const textOnly of catalogue.filter(set => set.records && set.records.glyphs === 0 && !set.records.file.endsWith('.ids.json'))) {
    const listed = textOnly.records
    if (!listed) continue
    await check(`text-only proposal records are listed: ${textOnly.id}`, async () => {
      const data = JSON.parse(readFileSync(join(DIST, 'charsets', listed.file.replace('/charsets/', '')), 'utf8'))
      await find(page, '', textOnly.id)
      const visible = Math.min(240, listed.count)
      assert.equal(await page.locator('main .records .ui-tile').count(), visible)
      assert.equal(await page.locator('main .records img').count(), 0)
      assert.ok((await page.locator('main .records').innerText()).includes(data.records[0].source))
      if (listed.count > 240) assert.match(await page.locator('main .ui-hint').last().innerText(), new RegExp(`240 of ${listed.count}`))
      await page.locator('main .records .ui-tile').first().click()
      assert.match(await page.locator('aside.card').innerText(), new RegExp(data.records[0].source ?? data.records[0].serial))
    })
  }
  const recorded = catalogue.find(set => set.source.records)
  if (recorded) {
    await check('selected set links its source records', async () => {
      await find(page, '', recorded.id)
      assert.equal(await page.getByRole('link', { name: 'Records', exact: true }).getAttribute('href'), recorded.source.records)
      assert.equal(await page.locator('.set-name').innerText(), recorded.names.en)
    })
  }
  for (const entry of [catalogue.find(set => set.chars < set.total), catalogue.find(set => set.chars > set.total)].filter(set => set !== undefined)) {
    await check(`source rows and mapped counts are independent: ${entry.id}`, async () => {
      const chars = await find(page, '', entry.id)
      subset(chars, members(entry.id))
      const metadata = await page.locator('.metadata').innerText()
      assert.ok(metadata.includes(entry.chars.toLocaleString('en-US')))
      assert.ok(metadata.includes(entry.total.toLocaleString('en-US')))
    })
  }
  for (const [kind, query, expected] of [
    ['literal code', 'jnd', '字'], ['literal text', '字𠀀', '字'], ['code point', 'U+5B57', '字'],
    ['meaning', 'dragon', '龍'], ['readings', 'lung4', '龍'],
    ['parts', '氵', ''], ['strokes', '12畫', ''], ['multiple clues', '氵 12畫', '湖'],
  ]) {
    await check(`all result channels remain within set: ${kind}`, async () => {
      const chars = await find(page, query)
      assert.ok(chars.length, `${query} should have visible results`)
      if (expected) assert.ok(chars.includes(expected), `${query} should include ${expected}`)
      subset(chars, t1)
    })
  }
  await check('proposal sets retain encoded kana glyphs without assigning draft slots', async () => {
    assert.ok((await find(page, 'リ', 'unicode_comp_b_tentative')).includes('リ'))
    assert.equal((await find(page, 'U+2FADC', 'unicode_comp_b_tentative')).length, 0)
  })
  await check('literal strokes, marks and runs remain searchable in their selected blocks', async () => {
    for (const [query, set] of [['㇀', 'block_cjk_strokes'], ['㇀㇁', 'block_cjk_strokes'], ['\u3099', 'block_hiragana'], ['ー', 'block_katakana']]) {
      const chars = await find(page, query, set)
      for (const char of query) assert.ok(chars.includes(char), `${set}: ${query}`)
      subset(chars, members(set))
    }
  })
  await check('keyboard activation opens the catalogue and selection restores trigger focus', async () => {
    await find(page)
    const summary = page.locator('main details summary')
    await summary.focus()
    await summary.press('Enter')
    assert.equal(await page.locator('main details').getAttribute('open'), '')
    await page.keyboard.press('Tab')
    assert.ok(await page.locator('main details input').evaluate(el => el === document.activeElement))
    await page.locator('main details input').fill('g0')
    await page.locator('[data-charset="g0"]').press('Enter')
    await ready(page)
    assert.ok(await summary.evaluate(el => el === document.activeElement))
    assert.equal(new URL(page.url()).searchParams.get('set'), 'g0')
  })
  for (const failure of ['503', 'abort']) {
    await check(`core search-data ${failure} recovers through Retry`, async () => {
      const fresh = await browser.newContext({ locale: 'en-US' })
      await serve(fresh)
      let attempts = 0
      await fresh.route(`${SITE}/data/chars.tsv.gz`, async route => {
        if (attempts++ === 0) {
          if (failure === 'abort') await route.abort('failed')
          else await route.fulfill({ status: 503, body: 'Unavailable' })
        } else await route.fallback()
      })
      try {
        const retryPage = await fresh.newPage()
        assert.equal((await find(retryPage, 'U+5B57')).length, 0)
        assert.ok(await retryPage.getByRole('alert').isVisible())
        await retryPage.getByRole('button', { name: 'Retry', exact: true }).click()
        await ready(retryPage)
        assert.ok((await retryPage.locator('main .ui-tile-glyph').allTextContents()).includes('字'))
        assert.equal(attempts, 2)
      } finally { await fresh.close() }
    })
  }
  await check('excluded literal cannot escape selected set', async () => {
    assert.equal((await find(page, 'U+20000')).length, 0)
    assert.match(await page.locator('main').innerText(), /Nothing matches/)
  })
  await check('set and query survive opening a card', async () => {
    await find(page, 'jnd')
    await page.locator('main .ui-tile').first().click()
    const url = new URL(page.url())
    assert.equal(url.searchParams.get('set'), 't1')
    assert.equal(url.searchParams.get('q'), 'jnd')
    assert.ok(url.searchParams.has('c'))
    await page.locator('[data-primary]').fill('lung4')
    await ready(page)
    assert.equal(new URL(page.url()).searchParams.get('set'), 't1')
    subset(await page.locator('main .ui-tile-glyph').allTextContents(), t1)
  })
  await check('back and forward restore selected set and query reactively', async () => {
    await find(page, 'jnd')
    await choose(page, 'g0')
    await page.locator('[data-primary]').fill('lung4')
    await ready(page)
    await page.goBack()
    await ready(page)
    assert.equal(new URL(page.url()).searchParams.get('set'), 't1')
    assert.equal(await page.locator('[data-primary]').inputValue(), 'jnd')
    await page.goForward()
    await ready(page)
    assert.equal(new URL(page.url()).searchParams.get('set'), 'g0')
    assert.equal(await page.locator('[data-primary]').inputValue(), 'lung4')
    subset(await page.locator('main .ui-tile-glyph').allTextContents(), g0)
  })
  await check('clear selection restores unrestricted search and omits set from URL', async () => {
    await find(page, 'U+20000')
    await page.locator('main details summary').click()
    await page.getByRole('button', { name: 'All characters', exact: true }).click()
    await ready(page)
    assert.equal(new URL(page.url()).searchParams.has('set'), false)
    assert.ok((await page.locator('main .ui-tile-glyph').allTextContents()).includes('𠀀'))
  })
  await check('unknown set fails closed', async () => {
    assert.equal((await find(page, 'jnd', 'unknown-set')).length, 0)
    assert.ok(await page.getByRole('alert').isVisible())
  })
  await check('membership failure stays closed and retries', async () => {
    failNext.set('/charsets/t1.txt', 1)
    assert.equal((await find(page, 'jnd')).length, 0)
    assert.ok(await page.getByRole('alert').isVisible())
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await ready(page)
    const chars = await page.locator('main .ui-tile-glyph').allTextContents()
    assert.ok(chars.includes('字'))
    subset(chars, t1)
  })
  await check('catalogue failure stays closed and retries', async () => {
    failNext.set('/charsets/index.json', 1)
    assert.equal((await find(page, 'jnd')).length, 0)
    assert.ok(await page.getByRole('alert').isVisible())
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await ready(page)
    assert.ok((await page.locator('main .ui-tile-glyph').allTextContents()).includes('字'))
  })
  await check('catalogue outage leaves unrestricted Find usable with a retry', async () => {
    failNext.set('/charsets/index.json', 1)
    const chars = await find(page, 'jnd', '')
    assert.ok(chars.includes('字'))
    assert.ok(await page.getByRole('alert').isVisible())
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await ready(page)
    assert.equal(await page.getByRole('alert').count(), 0)
  })
  await check('late response from previous selection cannot overwrite current results', async () => {
    /** @type {() => void} */
    let release = () => {}
    delayed.set('/charsets/t1.txt', new Promise(resolve => { release = resolve }))
    try {
      await page.goto(`${SITE}/?set=t1`)
      await page.locator('main details summary').click()
      await page.locator('main details input').fill('g0')
      await page.locator('main details .set').first().click()
      // The earlier request remains pending; wait only for the current set's result.
      await page.waitForFunction(() => new URL(location.href).searchParams.get('set') === 'g0' && !document.querySelector('main [role="status"]'))
      subset(await page.locator('main .ui-tile-glyph').allTextContents(), g0)
      release()
      delayed.delete('/charsets/t1.txt')
      await ready(page)
      assert.equal(new URL(page.url()).searchParams.get('set'), 'g0')
      assert.deepEqual(await page.locator('main .ui-tile-glyph').allTextContents(), [...g0].slice(0, 240))
    } finally { release(); delayed.delete('/charsets/t1.txt') }
  })
  await check('method links carry query and leave Find-only filter behind', async () => {
    await find(page, 'jnd')
    await page.locator('main h2.method a').first().click()
    assert.match(new URL(page.url()).pathname, /^\/m\//)
    assert.equal(new URL(page.url()).searchParams.get('q'), 'jnd')
    assert.equal(new URL(page.url()).searchParams.has('set'), false)
  })
  for (const theme of /** @type {const} */ (['light', 'dark'])) {
    for (const phone of [false, true]) {
      const view = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1360, height: 900 }, deviceScaleFactor: 2, colorScheme: theme, locale: 'en-US' })
      await serve(view)
      const tab = await view.newPage()
      await check(`${theme} ${phone ? 'phone' : 'desktop'}: screenshots and no horizontal overflow`, async () => {
        await find(tab)
        await tab.evaluate(() => document.fonts.ready)
        const name = `charsets-${theme}${phone ? '-phone' : ''}`
        await tab.screenshot({ path: join(SHOTS, `${name}.png`) })
        await tab.locator('main details summary').click()
        await tab.screenshot({ path: join(SHOTS, `${name}-catalogue.png`) })
        assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0)
        const bounds = await tab.locator('main details').boundingBox()
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= (phone ? 390 : 1360))
        await tab.getByRole('button', { name: 'CNS source categories', exact: true }).click()
        await tab.screenshot({ path: join(SHOTS, `${name}-cns.png`) })
        assert.equal(await tab.locator('main details .set').count(), 123)
        assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0)
        for (const proposal of catalogue.filter(set => set.records?.glyphs)) {
          await find(tab, '', proposal.id)
          await tab.locator('main .records .ui-tile').first().click()
          await tab.screenshot({ path: join(SHOTS, `${name}-${proposal.id}.png`) })
          assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0)
        }
        for (const proposal of catalogue.filter(set => set.group === 'Proposals' && set.records?.glyphs === 0)) {
          await find(tab, '', proposal.id)
          await tab.locator('main .records .ui-tile').first().click()
          await tab.screenshot({ path: join(SHOTS, `${name}-${proposal.id}.png`) })
          assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0)
        }
      })
      await view.close()
    }
  }
  await check('no client script errors', async () => assert.deepEqual(scriptErrors, []))
} finally {
  await context.close()
  await browser.close()
}
console.log(`${passed} passed, ${failures.length} failed`)
process.exitCode = failures.length ? 1 : 0
