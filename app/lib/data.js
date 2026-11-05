// The static files, each fetched once when first needed. Gzip is undone here, since the hosting
// serves the .gz files as they are.
import { charBucket, codeBucket, fold, partBucket, pinyinDigits, wordBucket } from '../../src/fold.js'

/** @param {string} path @returns {Promise<string>} empty for a file that does not exist */
async function readGz(path) {
  const response = await fetch(`/data/${path}`)
  // A missing file is answered with the app's own page, so that is what a miss looks like.
  if (!response.ok || (response.headers.get('content-type') ?? '').includes('text/html')) return ''
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
    if (!promise) held.set(key, promise = load(key))
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
const schemeFile = once(id => readGz(`s/${id}.tsv.gz`))

/** @typedef {{ method: string, code: string, chars: string[], exact: boolean }} CodeHit */

/** Every code, in any method, that begins with this text. @param {string} text @returns {Promise<CodeHit[]>} */
export async function findCodes(text) {
  const query = fold(text)
  if (!query) return []
  const body = await codeFile(codeBucket(query))
  /** @type {CodeHit[]} */
  const hits = []
  for (const line of body.split('\n')) {
    if (!line.startsWith(query)) continue
    const [folded, code, method, chars] = line.split('\t')
    hits.push({ method, code, chars: [...chars], exact: folded === query })
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
    const [own, method, codes] = line.split('\t')
    if (own === char) out.set(method, codes.split(' '))
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
}))

/** @typedef {{ code: string, folded: string, digits: string, chars: string[] }} SchemeRow */

/** One method's whole table, for typing in it key by key. @param {string} id @returns {Promise<SchemeRow[]>} */
export async function loadScheme(id) {
  const body = await schemeFile(id)
  return body.split('\n').filter(Boolean).map(line => {
    const [code, chars] = line.split('\t')
    return { code, folded: fold(code), digits: /[̀-̌]/.test(code.normalize('NFD')) ? pinyinDigits(code) : '', chars: [...chars] }
  }).sort((a, b) => a.folded.length - b.folded.length || (a.folded < b.folded ? -1 : 1))
}
