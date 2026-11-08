// Builds app/public/data from the pinned sources in cache/.
//   s/<id>.tsv.gz    one method: code, tab, its characters
//   c/<bucket>.gz    every code of every method, by its first two folded characters
//   x/<plane>.gz     every code of every character, by code point: character, method, then one code per column
//   m/<bucket>.gz    meaning words to characters
//   p/<plane>.gz     parts to the characters written with them
//   i/<plane>.gz     each character's descriptions, and the sources that give them
//   chars.tsv.gz     code point, rank, strokes, radical
//   methods.json     what the above were made from
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { charBucket, codeBucket, fold, inScope, isHan, partBucket, pinyinDigits, wordBucket } from '../src/fold.js'
import { readUnihan, unihanMethods, rankChars } from './sources/unihan.mjs'
import { IDS_SOURCES, partsOf, readDescriptions } from './sources/ids.mjs'
import { allMethods } from './sources/index.mjs'
import { meaningWords } from './sources/meaning.mjs'
import { rhymeTable } from './sources/qieyun.mjs'
import { CACHE } from './lib.mjs'
import * as OpenCC from 'opencc-js'

const OUT = join(import.meta.dirname, '..', 'app', 'public', 'data')
const SPOOL = join(CACHE, 'spool')
for (const dir of ['s', 'c', 'x', 'm', 'p', 'i']) rmSync(join(OUT, dir), { recursive: true, force: true })
rmSync(SPOOL, { recursive: true, force: true })
for (const dir of ['s', 'c', 'x', 'm', 'p', 'i']) mkdirSync(join(OUT, dir), { recursive: true })
for (const dir of ['c', 'x', 'm']) mkdirSync(join(SPOOL, dir), { recursive: true })

const gz = (/** @type {string} */ text) => gzipSync(text, { level: 9 })

/** Rows wait in memory and go to disk in lumps, since the corpus is many million rows. */
class Spool {
  /** @param {string} dir */
  constructor(dir) { this.dir = dir; /** @type {Map<string, string[]>} */ this.rows = new Map(); this.held = 0 }
  /** @param {string} bucket @param {string} row */
  add(bucket, row) {
    let list = this.rows.get(bucket)
    if (!list) this.rows.set(bucket, list = [])
    list.push(row)
    if (++this.held > 2_000_000) this.flush()
  }
  flush() {
    for (const [bucket, list] of this.rows) appendFileSync(join(SPOOL, this.dir, bucket), `${list.join('\n')}\n`)
    this.rows.clear()
    this.held = 0
  }
}
const codes = new Spool('c')
const chars = new Spool('x')

console.log('reading Unihan')
const fields = await readUnihan()
const methods = [...unihanMethods(fields), ...await allMethods()]

const toHans = OpenCC.Converter({ from: 'hk', to: 'cn' })
/** Kana and Nüshu met in any table, for the ordering file. */
const derived = new Set()
const manifest = []
const ids = new Set()
for (const { id } of methods) {
  if (ids.has(id)) throw new Error(`two methods share the id ${id}`)
  ids.add(id)
}
for (const method of methods) {
  /** @type {Map<string, Set<string>>} */
  const table = new Map()
  for (const [code, char] of method.entries) {
    if (!inScope(char)) continue
    if (!isHan(char)) derived.add(char)
    let set = table.get(code)
    if (!set) table.set(code, set = new Set())
    set.add(char)
  }
  if (!table.size) { console.warn(`  left out ${method.id}: no rows`); continue }
  const lines = [...table].map(([code, set]) => [code, [...set].join('')])
  lines.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  writeFileSync(join(OUT, 's', `${method.id}.tsv.gz`), gz(lines.map(line => line.join('\t')).join('\n')))
  const covered = new Set()
  /** @type {Map<string, string[]>} */
  const perChar = new Map()
  for (const [code, set] of lines) {
    const forms = new Set([fold(code)])
    if (method.tone === 'pinyin') forms.add(pinyinDigits(code))
    for (const form of forms) if (form) codes.add(codeBucket(form), `${form}\t${code}\t${method.id}\t${set}`)
    for (const char of set) {
      covered.add(char)
      let list = perChar.get(char)
      if (!list) perChar.set(char, list = [])
      list.push(code)
    }
  }
  for (const [char, list] of perChar) chars.add(charBucket(char), `${char}\t${method.id}\t${list.join('\t')}`)
  manifest.push({
    id: method.id, family: method.family, names: { ...method.names, hans: method.names.hans ?? (method.names.zh ? toHans(method.names.zh) : undefined) }, keys: method.keys, about: method.about,
    source: method.source, codes: table.size, chars: covered.size,
  })
  console.log(`  ${method.id}: ${table.size} codes, ${covered.size} characters`)
}
codes.flush()
for (const bucket of readdirSync(join(SPOOL, 'c'))) writeFileSync(join(OUT, 'c', `${bucket}.gz`), gz(readFileSync(join(SPOOL, 'c', bucket), 'utf8').trimEnd()))


for (const [char, gloss] of fields.get('kDefinition') ?? []) chars.add(charBucket(char), `${char}\t:gloss\t${gloss}`)
chars.flush()
for (const bucket of readdirSync(join(SPOOL, 'x'))) writeFileSync(join(OUT, 'x', `${bucket}.gz`), gz(readFileSync(join(SPOOL, 'x', bucket), 'utf8').trimEnd()))

console.log('meanings')
const words = await meaningWords(fields)
/** @type {Map<string, string[]>} */
const wordFiles = new Map()
for (const [word, list] of words) {
  const bucket = wordBucket(word)
  if (!wordFiles.has(bucket)) wordFiles.set(bucket, [])
  ;/** @type {string[]} */ (wordFiles.get(bucket)).push(`${word}\t${list.join('')}`)
}
for (const [bucket, rows] of wordFiles) writeFileSync(join(OUT, 'm', `${bucket}.gz`), gz(rows.join('\n')))

console.log('writing')
const descriptions = await readDescriptions()
/** @type {Map<string, string[]>} */
const writingFiles = new Map()
for (const [char, rows] of descriptions) {
  const bucket = charBucket(char)
  if (!writingFiles.has(bucket)) writingFiles.set(bucket, [])
  for (const row of rows) /** @type {string[]} */ (writingFiles.get(bucket)).push(`${char}\t${row.text}\t${row.regions}\t${row.sources.join(',')}`)
}
for (const [bucket, rows] of writingFiles) writeFileSync(join(OUT, 'i', `${bucket}.gz`), gz(rows.join('\n')))
writeFileSync(join(OUT, 'ids.json'), JSON.stringify({ sources: IDS_SOURCES }))

console.log('parts')
/** @type {Map<string, string[]>} */
const partFiles = new Map()
for (const [part, list] of partsOf(descriptions)) {
  const bucket = partBucket(part)
  if (!partFiles.has(bucket)) partFiles.set(bucket, [])
  ;/** @type {string[]} */ (partFiles.get(bucket)).push(`${part}\t${list.join('')}`)
}
for (const [bucket, rows] of partFiles) writeFileSync(join(OUT, 'p', `${bucket}.gz`), gz(rows.join('\n')))

// Modern kana come among the commonest characters, and hentaigana and Nüshu after every block of Han.
const derivedRows = [...derived].map(char => [char, /[\u3040-\u30FF]/.test(char) ? 500 : 7000, 0, ''])
writeFileSync(join(OUT, 'chars.tsv.gz'), gz([...rankChars(fields), ...derivedRows].map(row => row.join('\t')).join('\n')))
writeFileSync(join(OUT, 'rhymes.json.gz'), gz(JSON.stringify(rhymeTable())))
// Two tables of one method keep the same name, so where they come from tells them apart.
const uses = new Map()
for (const { names } of manifest) uses.set(names.en, (uses.get(names.en) ?? 0) + 1)
for (const entry of manifest) {
  if (uses.get(entry.names.en) < 2) continue
  const from = entry.source.name.split(',')[0].replace(/^rime\//, '').replace(/^Unihan.*/, 'Unihan')
  const names = /** @type {Record<string, string | undefined>} */ (entry.names)
  for (const key of Object.keys(names)) if (names[key]) names[key] += ` · ${from}`
}
writeFileSync(join(OUT, 'methods.json'), JSON.stringify(manifest))
rmSync(SPOOL, { recursive: true, force: true })
console.log(`${manifest.length} methods`)
