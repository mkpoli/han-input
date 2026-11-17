// The Tày Nôm dictionary of Hoàng Triều Ân (ed.), Dương Nhật Thanh and Hoàng Tuấn Nam,
// published by the Institute of Hán-Nôm Studies and Nhà Xuất Bản Khoa học Xã hội in 2003 and
// mounted by the Vietnamese Nôm Preservation Foundation as a lookup page. The page answers one
// entry per `entryID`; 2774 entries were read on 2026-11-17. Each entry gives a headword (one
// character or a compound, then its Quốc Ngữ reading in capitals), a Vietnamese definition, then
// examples: the Nôm line, its Quốc Ngữ transcription, the source abbreviation and a gloss.
//
//   bun scripts/import_tay_nom.mjs --fetch   read every page into cache/tay-nom/raw
//   bun scripts/import_tay_nom.mjs           parse the cached pages and write data/tay-nom.json
//
// The Foundation reserves the copyright and permits non-commercial public use with attribution and
// a link; see data/tay-nom.json's source block and docs/materials.md.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CACHE } from './lib.mjs'

const PAGE = 'https://nomfoundation.org/nom-tools/Tu-Dien-Chu-Nom-Tay/Tu-Dien-Chu-Nom-Tay'
const RETRIEVED = '2026-11-17'
const LAST = 2774
const RAW = join(CACHE, 'tay-nom', 'raw')
const OUT = join(import.meta.dirname, '..', 'data', 'tay-nom.json')

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** @param {string} text */
function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const point = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
      return Number.isFinite(point) ? String.fromCodePoint(point) : whole
    }
    return NAMED[/** @type {keyof NAMED} */ (name.toLowerCase())] ?? whole
  })
}

/** The text of a fragment, with its tags gone and its line breaks kept. @param {string} html */
function text(html) {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n').trim()
}

/** @param {number} id */
async function fetchEntry(id) {
  const file = join(RAW, `${String(id).padStart(4, '0')}.html`)
  if (existsSync(file)) return readFileSync(file, 'utf8')
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(`${PAGE}?item=x&entryID=${id}&uiLang=en`, {
        headers: { 'user-agent': 'han-input, non-commercial research; https://github.com/mkpoli/han-input' },
        signal: AbortSignal.timeout(60_000),
      })
      if (!response.ok) throw new Error(String(response.status))
      const body = await response.text()
      writeFileSync(file, body)
      return body
    } catch (error) {
      if (attempt >= 4) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
    }
  }
}

async function fetchAll() {
  mkdirSync(RAW, { recursive: true })
  let next = 1
  let done = 0
  const worker = async () => {
    for (;;) {
      const id = next++
      if (id > LAST) return
      await fetchEntry(id)
      if (++done % 200 === 0) console.log(`  ${done}/${LAST}`)
      // The Foundation's server is small; keep the crawl gentle.
      await new Promise(resolve => setTimeout(resolve, 120))
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
}

/** Split a headword into its characters and its Quốc Ngữ reading. @param {string} head */
function splitHead(head) {
  const match = head.match(/^(\S+?)\s+([A-Za-zÀ-ỹ][A-Za-zÀ-ỹ\s.\-–]*)$/u)
  return match ? { chars: match[1], reading: match[2].trim() } : { chars: head, reading: '' }
}

/** One entry page. @param {number} id @param {string} html */
function parseEntry(id, html) {
  const table = html.match(/<table bgcolor=#ffffdd[\s\S]*?<\/table>/)?.[0]
  if (!table) throw new Error(`entry ${id}: no table`)
  const head = table.match(/<font size="\+2">([\s\S]*?)<\/font>/)?.[1] ?? ''
  const { chars, reading } = splitHead(text(head))
  /** @typedef {{ nom: string[], readings: string[], source: string, sourceName: string, gloss: string, notes: string[] }} Group */
  /** @type {Group | null} */
  let group = null
  /** @type {Group[]} */
  const groups = []
  let definition = ''
  for (const [, cell] of table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    if (/\bEntry\b/.test(text(cell))) continue
    if (cell.includes('<span class=hnText>')) {
      if (!definition) definition = text(cell)
    } else if (cell.includes('class="hnText"')) {
      if (!group || group.readings.length || group.gloss) {
        group = { nom: [], readings: [], source: '', sourceName: '', gloss: '', notes: [] }
        groups.push(group)
      }
      group.nom.push(text(cell))
    } else if (cell.includes('<i>')) {
      if (group) group.readings.push(text(cell))
    } else if (cell.includes('stlkieu')) {
      if (!group) continue
      group.source = text(cell)
      group.sourceName = decode(cell.match(/escape\('([^']*)'\)/)?.[1] ?? '')
    } else if (cell.includes('<b>')) {
      if (group) group.gloss = text(cell)
    }
  }
  const examples = groups.map(group => {
    const { nom, readings, notes } = group
    const extra = readings.slice(nom.length)
    return {
      lines: nom.map((line, i) => ({ nom: line, reading: readings[i] ?? '' })),
      source: group.source,
      sourceName: group.sourceName,
      gloss: group.gloss,
      ...(extra.length || notes.length ? { notes: [...extra, ...notes] } : {}),
    }
  })
  return { id, chars, reading, definition, examples, url: `${PAGE}?item=x&entryID=${id}&uiLang=en` }
}

const fetchMode = process.argv.includes('--fetch')
if (fetchMode) await fetchAll()
const files = existsSync(RAW) ? readdirSync(RAW).filter(name => /^\d+\.html$/.test(name)).sort() : []
if (!files.length) throw new Error(`no pages in ${RAW}; run with --fetch first`)
const entries = files.map(file => parseEntry(Number.parseInt(file, 10), readFileSync(join(RAW, file), 'utf8')))
const ids = new Set(entries.map(entry => entry.id))
if (ids.size !== entries.length) throw new Error('two entries share an id')
// A crawl that stopped early leaves a prefix of the pages; refuse it rather than replace a complete
// snapshot with what arrived.
for (let id = 1; id <= LAST; id++) if (!ids.has(id)) throw new Error(`entry ${id} is missing; snapshot left unchanged`)
if (entries.length !== LAST) throw new Error(`${entries.length} entries, expected ${LAST}; snapshot left unchanged`)
const noReading = entries.filter(entry => !entry.reading)
if (noReading.length) console.warn(`  ${noReading.length} entries have no reading: ${noReading.map(entry => entry.id).join(', ')}`)

const doc = {
  source: {
    name: 'Từ điển chữ Nôm Tày',
    editor: 'Hoàng Triều Ân',
    authors: 'Dương Nhật Thanh, Hoàng Tuấn Nam',
    publisher: 'Nhà Xuất Bản Khoa học Xã hội, Hà Nội, 2003, for Viện Nghiên cứu Hán Nôm',
    url: PAGE,
    retrieved: RETRIEVED,
    licence: '© 2001–2026 Vietnamese Nôm Preservation Foundation. Non-commercial public use with attribution and a link; commercial use needs the Foundation’s permission.',
    note: 'Entries as the Foundation’s lookup page prints them, one page per entryID. The definitions and examples are the dictionary’s; the readings are this project’s index.',
  },
  count: entries.length,
  entries,
}
mkdirSync(join(OUT, '..'), { recursive: true })
writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`)
const digest = createHash('sha256').update(readFileSync(OUT)).digest('hex')
console.log(`${entries.length} entries, ${entries.reduce((sum, entry) => sum + entry.examples.length, 0)} example groups, sha256 ${digest}`)
