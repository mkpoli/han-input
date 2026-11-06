// Every reading of every variety in 漢字音典 (MCPDict), from the database inside its release APK.
//   d/<n>.tsv.gz     one variety: reading, tab, characters
//   y/<shard>.gz     a character's readings in all varieties, by code point: character, variety, then one reading per column
//   r/<bucket>.gz    a reading in any variety, by its first two folded characters
//   varieties.json   who each variety is, and where its table came from
// Run after unpacking: unzip <apk> 'assets/databases/mcpdict.db' -d cache/mcpdict/x
import { Database } from 'bun:sqlite'
import { appendFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { codeBucket, fold, isHan } from '../src/fold.js'
import { CACHE } from './lib.mjs'

const DB = join(CACHE, 'mcpdict/x/assets/databases/mcpdict.db')
const OUT = join(import.meta.dirname, '..', 'app', 'public', 'data')
const SPOOL = join(CACHE, 'spool-readings')
for (const dir of ['d', 'y', 'r']) { rmSync(join(OUT, dir), { recursive: true, force: true }); mkdirSync(join(OUT, dir), { recursive: true }) }
rmSync(SPOOL, { recursive: true, force: true })
for (const dir of ['raw', 'y', 'r']) mkdirSync(join(SPOOL, dir), { recursive: true })

const db = new Database(DB, { readonly: true })
const COLUMNS = '語言,簡稱,版本,文件名,網站,網址,方言島,地圖集二排序,地圖集二顏色,地圖集二分區,音典排序,音典顏色,音典分區,陳邡排序,陳邡顏色,陳邡分區,行政區級別,省,市,縣,鎮,村,自然村,地點,經緯度,地圖級別,作者,錄入人,維護人,推薦人,發音合作人,字表修改情況,字表品質,字表品質説明,字表來源,參考文獻,補充閲讀,音系說明,說明,繁簡,聲調,歷史音,解析日志,同音字表,字數,□數,音節數,不帶調音節數'.split(',')
const at = (/** @type {string} */ name) => `c${COLUMNS.indexOf(name)}`
const strip = (/** @type {unknown} */ html) => String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/#/g, '').replace(/\s+/g, ' ').trim()

const rows = /** @type {Record<string, unknown>[]} */ (db.query(`select ${['語言', '簡稱', '版本', '地圖集二分區', '音典分區', '音典排序', '地點', '經緯度', '字表來源', '參考文獻', '作者', '字數'].map(n => `${at(n)} as "${n}"`).join(',')} from info_content`).all())
const varieties = rows.filter(row => row['簡稱'] && row['簡稱'] !== '漢字').sort((a, b) => String(a['音典排序'] ?? '~').localeCompare(String(b['音典排序'] ?? '~')))
/** @type {Map<string, number>} */
const indexOf = new Map(varieties.map((row, i) => [String(row['簡稱']), i]))

/** Buffered appends, one file per key. */
class Spool {
  /** @param {string} dir @param {number} limit */
  constructor(dir, limit) { this.dir = dir; this.limit = limit; /** @type {Map<string, string[]>} */ this.rows = new Map(); this.held = 0 }
  /** @param {string} key @param {string} row */
  add(key, row) {
    let list = this.rows.get(key)
    if (!list) this.rows.set(key, list = [])
    list.push(row)
    if (++this.held > this.limit) this.flush()
  }
  flush() {
    for (const [key, list] of this.rows) appendFileSync(join(SPOOL, this.dir, key), `${list.join('\n')}\n`)
    this.rows.clear()
    this.held = 0
  }
}

/** The forms a stored reading can be searched by: `**kou(kau)**` is kou and kau, `a/b` is a and b, and a bracketed note goes. @param {string} reading @returns {string[]} */
export function formsOf(reading) {
  return reading.replace(/〚[^〛]*〛/g, '').replace(/\*\*/g, '').split('/').flatMap(form => {
    const bracket = form.match(/^([^()]+)\(([^()]+)\)$/)
    return bracket ? [bracket[1], bracket[2]] : [form]
  }).map(form => form.trim()).filter(Boolean)
}

console.log(`${varieties.length} varieties; first pass`)
const raw = new Spool('raw', 1_000_000)
let seen = 0
for (const row of /** @type {IterableIterator<{ c0: string, c1: string, c2: string }>} */ (db.query('select c0, c1, c2 from langs_content').iterate())) {
  const n = indexOf.get(row.c1)
  if (n === undefined || !row.c2) continue
  const chars = row.c0.split(' ').filter(isHan).join('')
  if (chars) raw.add(String(n), `${row.c2}\t${chars}`)
  if (++seen % 1_000_000 === 0) console.log(`  ${seen}`)
}
raw.flush()

console.log('second pass')
const byChar = new Spool('y', 3_000_000)
const byReading = new Spool('r', 3_000_000)
const gz = (/** @type {string} */ text) => gzipSync(text, { level: 9 })
for (const file of readdirSync(join(SPOOL, 'raw'))) {
  const n = Number(file)
  /** @type {Map<string, Set<string>>} */
  const table = new Map()
  for (const line of readFileSync(join(SPOOL, 'raw', file), 'utf8').split('\n')) {
    if (!line) continue
    const [reading, chars] = line.split('\t')
    for (const form of formsOf(reading)) {
      let set = table.get(form)
      if (!set) table.set(form, set = new Set())
      for (const char of chars) set.add(char)
    }
  }
  const lines = [...table].map(([form, set]) => [form, [...set].join('')]).sort((a, b) => (a[0] < b[0] ? -1 : 1))
  writeFileSync(join(OUT, 'd', `${n}.tsv.gz`), gz(lines.map(line => line.join('\t')).join('\n')))
  /** @type {Map<string, string[]>} */
  const perChar = new Map()
  for (const [form, chars] of lines) {
    const folded = fold(form)
    if (folded) byReading.add(codeBucket(folded), `${folded}\t${form}\t${n}\t${chars}`)
    for (const char of chars) {
      let list = perChar.get(char)
      if (!list) perChar.set(char, list = [])
      list.push(form)
    }
  }
  for (const [char, forms] of perChar) byChar.add(((char.codePointAt(0) ?? 0) >> 5).toString(16), `${char}\t${n}\t${forms.join('\t')}`)
  rmSync(join(SPOOL, 'raw', file))
}
byChar.flush()
byReading.flush()

console.log('compressing')
for (const dir of ['y', 'r']) {
  for (const file of readdirSync(join(SPOOL, dir))) {
    writeFileSync(join(OUT, dir, `${file}.gz`), gz(readFileSync(join(SPOOL, dir, file), 'utf8').trimEnd()))
    rmSync(join(SPOOL, dir, file))
  }
}

writeFileSync(join(OUT, 'varieties.json'), JSON.stringify(varieties.map((row, n) => ({
  n, name: row['語言'], short: row['簡稱'], version: row['版本'], atlas: row['地圖集二分區'] || '', region: row['音典分區'] || '',
  place: row['地點'] || '', at: row['經緯度'] || '', source: strip(row['字表來源']), refs: strip(row['參考文獻']), author: strip(row['作者']), chars: Number(row['字數']) || 0,
}))))
rmSync(SPOOL, { recursive: true, force: true })
console.log('done')
