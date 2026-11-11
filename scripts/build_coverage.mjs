// Counts every character and every printed record once, for /statistics. The font coverage is the
// snapshot in data/font-coverage.json; rewrite it with scripts/build_font_coverage.py after
// scripts/build_fonts.py.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { BLOCKS } from '../app/lib/blocks.js'

const ROOT = join(import.meta.dirname, '..')
const DATA = join(ROOT, 'app/public/data')
const CHARSETS = join(ROOT, 'app/public/charsets')

/** @param {number} point */
function scriptOf(point) {
  if ((point >= 0x3040 && point <= 0x30ff) || (point >= 0x31f0 && point <= 0x31ff)
    || (point >= 0x1aff0 && point <= 0x1b16f) || (point >= 0xff65 && point <= 0xff9f)) return 'kana'
  if (point === 0x16fe1 || (point >= 0x1b170 && point <= 0x1b2ff)) return 'nushu'
  return 'han'
}

/** @param {number} point @param {[number, number][]} ranges */
function covered(point, ranges) {
  let low = 0, high = ranges.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const [start, end] = ranges[middle]
    if (point < start) high = middle - 1
    else if (point > end) low = middle + 1
    else return true
  }
  return false
}

const font = JSON.parse(readFileSync(join(ROOT, 'data/font-coverage.json'), 'utf8'))
const ages = JSON.parse(readFileSync(join(CHARSETS, 'unicode-age.json'), 'utf8')).ranges

/** @param {number} point */
function assigned(point) {
  let low = 0, high = ages.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const [start, end] = ages[middle]
    if (point < start) high = middle - 1
    else if (point > end) low = middle + 1
    else return true
  }
  return false
}

const chars = new Set()
for (const line of gunzipSync(readFileSync(join(DATA, 'chars.tsv.gz'))).toString('utf8').split('\n')) {
  if (line) chars.add(line.split('\t')[0])
}

const described = new Set()
for (const file of readdirSync(join(DATA, 'i'))) {
  if (!file.endsWith('.gz')) continue
  for (const line of gunzipSync(readFileSync(join(DATA, 'i', file))).toString('utf8').split('\n')) {
    if (line) described.add(line.split('\t')[0])
  }
}

/** @type {Map<string, {total: number, font: number, ids: number}>} */
const scripts = new Map([['han', { total: 0, font: 0, ids: 0 }], ['kana', { total: 0, font: 0, ids: 0 }], ['nushu', { total: 0, font: 0, ids: 0 }]])
/** @type {Map<string, number>} */
const gaps = new Map()
let reserved = 0
for (const char of chars) {
  const point = char.codePointAt(0) ?? 0
  if (!assigned(point)) { reserved++; continue }
  const script = scripts.get(scriptOf(point))
  if (!script) continue
  script.total++
  if (covered(point, font.ranges)) script.font++
  else {
    const block = BLOCKS.find(item => point >= item.start && point <= item.end)
    const label = block?.label ?? 'Other'
    gaps.set(label, (gaps.get(label) ?? 0) + 1)
  }
  if (described.has(char)) script.ids++
}

const catalogue = JSON.parse(readFileSync(join(CHARSETS, 'index.json'), 'utf8'))
const confidences = []
const buckets = Array.from({ length: 10 }, (_, index) => ({ low: index / 10, count: 0 }))
/** @type {{id: string, label: string, group: string, total: number, attested: number, image: number, guessed: number, imageGuessed: number, imageWithoutGuess: number, textOnly: number}[]} */
const sets = []
for (const entry of catalogue) {
  if (!entry.records?.file) continue
  const records = JSON.parse(readFileSync(join(ROOT, 'app', 'public', entry.records.file), 'utf8')).records
  let attested = 0, image = 0, guessed = 0, textOnly = 0
  for (const record of records) {
    const hasImage = !!(record.glyph || record.sprite)
    const hasIds = record.kind === 'ids' || !!record.ids
    if (hasImage) image++
    else if (hasIds) attested++
    else textOnly++
    if (record.guess) {
      guessed++
      confidences.push(record.guess.confidence)
      const bucket = Math.min(9, Math.floor(record.guess.confidence * 10))
      buckets[bucket].count++
    }
  }
  sets.push({
    id: entry.id, label: entry.label, group: entry.group, total: records.length,
    attested, image, guessed, imageGuessed: guessed, imageWithoutGuess: image - guessed, textOnly,
  })
}
sets.sort((a, b) => b.total - a.total || a.id.localeCompare(b.id))

const all = sets.reduce((sum, row) => sum + row.total, 0)
const attested = sets.reduce((sum, row) => sum + row.attested, 0)
const image = sets.reduce((sum, row) => sum + row.image, 0)
const textOnly = sets.reduce((sum, row) => sum + row.textOnly, 0)
const guessed = sets.reduce((sum, row) => sum + row.guessed, 0)
if (attested + image + textOnly !== all) throw new Error('Record counts overlap')
confidences.sort((a, b) => a - b)
const median = confidences.length
  ? (confidences[(confidences.length - 1) >> 1] + confidences[confidences.length >> 1]) / 2
  : 0

const characters = {
  total: [...scripts.values()].reduce((sum, row) => sum + row.total, 0),
  scripts: [...scripts].map(([id, row]) => ({ id, ...row })),
  reserved,
  fontGaps: {
    total: [...gaps.values()].reduce((sum, count) => sum + count, 0),
    blocks: [...gaps].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  },
}

const records = {
  sets: sets.length,
  total: all,
  attested,
  image,
  guessed,
  imageGuessed: guessed,
  imageWithoutGuess: image - guessed,
  textOnly,
  confidence: { median, buckets },
  bySet: sets,
}

writeFileSync(join(DATA, 'coverage.json'), JSON.stringify({ characters, records }))
console.log(`${characters.total.toLocaleString()} characters, ${all.toLocaleString()} records, ${guessed.toLocaleString()} guessed`)
