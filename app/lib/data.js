// The static files, each fetched once when first needed. Gzip is undone here, since the hosting
// serves the .gz files as they are.
import { charBucket, codeBucket, fold, partBucket, pinyinDigits, wordBucket } from '../../src/fold.js'

/** @param {string} path @returns {Promise<string>} empty for a file that does not exist */
async function readGz(path) {
  const response = await fetch(`/data/${path}`)
  // A missing file is answered with the app's own page, so that is what a miss looks like.
  if (response.status === 404 || (response.ok && (response.headers.get('content-type') ?? '').includes('text/html'))) return ''
  if (!response.ok) throw new Error(`Search data unavailable: ${path}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes)
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

/** @template T @param {(key: string) => Promise<T>} load */
function once(load) {
  /** @type {Map<string, Promise<T>>} */
  const held = new Map()
  return (/** @type {string} */ key) => {
    let promise = held.get(key)
    if (!promise) held.set(key, promise = load(key).catch(error => { held.delete(key); throw error }))
    return promise
  }
}

/**
 * @typedef {{ id: string, family: string, names: { en: string, zh?: string, hans?: string, ja?: string, ko?: string }, keys?: string, about?: string,
 *   source: { name: string, url: string, licence: string, attribution?: string, version?: string, note?: string }, codes: number, chars: number }} Method
 */

/** @type {Promise<Method[]> | null} */
let methods = null
/** @returns {Promise<Method[]>} */
export const loadMethods = () => (methods ??= fetch('/data/methods.json').then(response => response.json()))

const codeFile = once(bucket => readGz(`c/${bucket}.gz`))
const charFile = once(bucket => readGz(`x/${bucket}.gz`))
const wordFile = once(bucket => readGz(`m/${bucket}.gz`))
const partFile = once(bucket => readGz(`p/${bucket}.gz`))
const writingFile = once(bucket => readGz(`i/${bucket}.gz`))
const schemeFile = once(path => readGz(path))
const readingFile = once(bucket => readGz(`r/${bucket}.gz`))
const charReadingFile = once(shard => readGz(`y/${shard}.gz`))

/** @typedef {{ method: string, code: string, chars: string[], exact: boolean, literal: boolean }} CodeHit */

/** Every code, in any method, that begins with this text. @param {string} text @returns {Promise<CodeHit[]>} */
export async function findCodes(text) {
  const query = fold(text)
  if (!query) return []
  const body = await codeFile(codeBucket(query))
  const typed = text.normalize('NFC').toLowerCase()
  const seen = new Set()
  /** @type {CodeHit[]} */
  const hits = []
  for (const line of body.split('\n')) {
    if (!line.startsWith(query)) continue
    const [folded, code, method, chars] = line.split('\t')
    // A pinyin code is filed under its plain and its digit form, and one query can match both.
    const key = `${method}\t${code}`
    if (seen.has(key)) continue
    seen.add(key)
    hits.push({ method, code, chars: [...chars], exact: folded === query, literal: code.normalize('NFC').toLowerCase() === typed })
  }
  return hits
}

/** Every code of a character, by method. @param {string} char @returns {Promise<Map<string, string[]>>} */
export async function codesOf(char) {
  const body = await charFile(charBucket(char))
  /** @type {Map<string, string[]>} */
  const out = new Map()
  for (const line of body.split('\n')) {
    if (!line.startsWith(char)) continue
    const [own, method, ...codes] = line.split('\t')
    if (own === char) out.set(method, codes)
  }
  return out
}

/** The characters whose gloss uses a word. @param {string} text @returns {Promise<string[]>} */
export async function findMeaning(text) {
  const word = text.toLowerCase()
  const body = await wordFile(wordBucket(word))
  const row = body.split('\n').find(line => line.startsWith(`${word}\t`))
  return row ? [...row.split('\t')[1]] : []
}

/** @typedef {{ text: string, regions: string, sources: string[] }} Description */

/** How a character is written, once per description, with the sources that give it. @param {string} char @returns {Promise<Description[]>} */
export async function descriptionsOf(char) {
  const body = await writingFile(charBucket(char))
  const out = []
  for (const line of body.split('\n')) {
    if (!line.startsWith(char)) continue
    const [own, text, regions, sources] = line.split('\t')
    if (own !== char || !text) continue
    out.push({ text, regions: regions ?? '', sources: sources ? sources.split(',') : [] })
  }
  return out
}

/** The characters written with a part. @param {string} part @returns {Promise<string[]>} */
export async function findPart(part) {
  const body = await partFile(partBucket(part))
  const row = body.split('\n').find(line => line.startsWith(`${part}\t`))
  return row ? [...row.split('\t')[1]] : []
}

/** @typedef {{ rank: number, strokes: number, radical: string }} CharRow */
/** @type {Promise<Map<string, CharRow>> | null} */
let charRows = null
/** How common each character is, its stroke count and its radical. */
export const loadChars = () => (charRows ??= readGz('chars.tsv.gz').then(body => {
  /** @type {Map<string, CharRow>} */
  const map = new Map()
  for (const line of body.split('\n')) {
    const [char, rank, strokes, radical] = line.split('\t')
    map.set(char, { rank: Number(rank), strokes: Number(strokes), radical })
  }
  return map
}).catch(error => { charRows = null; throw error }))

/** @typedef {{ code: string, folded: string, digits: string, chars: string[] }} SchemeRow */

/** One method's whole table, for typing in it key by key. @param {string} id @returns {Promise<SchemeRow[]>} */
export async function loadScheme(id) {
  return loadTable(`s/${id}.tsv.gz`)
}

/** One variety's whole table of readings. @param {number | string} n @returns {Promise<SchemeRow[]>} */
export const loadVariety = n => loadTable(`d/${n}.tsv.gz`)

/** @param {string} path @returns {Promise<SchemeRow[]>} */
async function loadTable(path) {
  const body = await schemeFile(path)
  return body.split('\n').filter(Boolean).map(line => {
    const [code, chars] = line.split('\t')
    return { code, folded: fold(code), digits: /[̀-̌]/.test(code.normalize('NFD')) ? pinyinDigits(code) : '', chars: [...chars] }
  }).sort((a, b) => a.folded.length - b.folded.length || (a.folded < b.folded ? -1 : 1))
}

/**
 * @typedef {{ n: number, name: string, short: string, version: string, atlas: string, order: string, region: string, place: string, at: string, source: string, refs: string, author: string, chars: number }} Variety
 */
/** @type {Promise<Variety[]> | null} */
let varieties = null
/** Every variety in 漢字音典. @returns {Promise<Variety[]>} */
export const loadVarieties = () => (varieties ??= fetch('/data/varieties.json').then(response => response.json()))

/** @typedef {{ n: number, form: string, chars: string[] }} ReadingHit */

/** A reading, whole, in any variety. @param {string} text @returns {Promise<ReadingHit[]>} */
export async function findReadings(text) {
  const query = fold(text)
  if (!query) return []
  const body = await readingFile(codeBucket(query))
  /** @type {ReadingHit[]} */
  const hits = []
  const prefix = `${query}\t`
  for (const line of body.split('\n')) {
    if (!line.startsWith(prefix)) continue
    const [, form, n, chars] = line.split('\t')
    hits.push({ n: Number(n), form, chars: [...chars] })
  }
  return hits
}

/** A character's readings in every variety that has it. @param {string} char @returns {Promise<{ n: number, forms: string[] }[]>} */
export async function readingsOf(char) {
  const body = await charReadingFile(((char.codePointAt(0) ?? 0) >> 5).toString(16))
  const out = []
  for (const line of body.split('\n')) {
    if (!line.startsWith(char)) continue
    const [own, n, ...forms] = line.split('\t')
    if (own === char) out.push({ n: Number(n), forms })
  }
  return out
}

/** @typedef {{ 母: string, 呼: string, 等: string, 類: string, 韻: string, 聲: string, 描述: string, 反切: string, 字: string }} RhymeRow */
/** @type {Promise<RhymeRow[]> | null} */
let rhymes = null
/** Every small rhyme of the Guangyun. @returns {Promise<RhymeRow[]>} */
export const loadRhymes = () => (rhymes ??= readGz('rhymes.json.gz').then(body => JSON.parse(body)))
