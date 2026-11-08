// A query is one or more clues, split on spaces. Each clue names a set of characters; several clues
// leave the characters in all of them.
import { hanIn, inScope, isHan, isRareKana } from '../../src/fold.js'
import { puaChars } from '../../src/pua.js'
import { convertPaja, isPaja } from '../../src/paja.js'
import { findCodes, findMeaning, findPart, findReadings, findRun, loadChars, loadVariants } from './data.js'
import { fuzzyComponents, characterVariants, spellings } from '../../src/variants.js'

/**
 * @typedef {{ kind: 'code' | 'scoped' | 'strokes' | 'point' | 'pua' | 'paja' | 'text' | 'part', text: string, method?: string, code?: string, value?: number, char?: string, chars?: string[] }} Clue
 * @typedef {{ text: string, chars: string[], exact: boolean }} Shape
 * @typedef {{ char: string, relation: string, source: string, group?: string }} VariantRow
 * @typedef {{ clue: Clue, hits: import('./data.js').CodeHit[], readings: import('./data.js').ReadingHit[], meaning: string[], parts: string[], partVariants: Shape[], similarParts: Shape[], shapes: Shape[], variants: VariantRow[], chars: string[] }} Answer
 */

/** @param {string} term @param {boolean} alone @returns {Clue} */
export function readClue(term, alone) {
  const point = term.match(/^[uU]\+?([0-9a-fA-F]{4,6})$/)
  if (point) {
    const chars = puaChars(point[1]).map(hit => hit.char)
    return chars.length ? { kind: 'pua', text: term, value: parseInt(point[1], 16), char: chars[0], chars } : { kind: 'point', text: term, value: parseInt(point[1], 16) }
  }
  const strokes = term.match(/^(\d{1,2})[畫画劃划]$/)
  if (strokes) return { kind: 'strokes', text: term, value: Number(strokes[1]) }
  if (isPaja(term)) return { kind: 'paja', text: term }
  const scoped = term.match(/^([a-z][\w-]*):(.+)$/)
  if (scoped) return { kind: 'scoped', text: term, method: scoped[1], code: scoped[2] }
  if (isHan(term)) return { kind: alone ? 'text' : 'part', text: term }
  if (isRareKana(term) || (alone && inScope(term))) return { kind: 'text', text: term }
  if (hanIn(term).length === [...term].length) return { kind: 'text', text: term }
  const hex = term.match(/^[0-9a-fA-F]{4,6}$/)
  if (hex) {
    const chars = puaChars(hex[0]).map(hit => hit.char)
    if (chars.length) return { kind: 'pua', text: term, value: parseInt(hex[0], 16), char: chars[0], chars }
  }
  return { kind: 'code', text: term }
}

/** @param {string} query @returns {Clue[]} */
export function readQuery(query) {
  const terms = query.trim().split(/\s+/).filter(Boolean)
  return terms.map(term => readClue(term, terms.length === 1))
}

/** @param {Clue} clue @returns {Promise<Answer>} */
export async function answer(clue) {
  const found = await lookUp(clue)
  // Commonest first, since a table's own order is often by code point.
  const rows = await loadChars()
  const rank = (/** @type {string} */ char) => rows.get(char)?.rank ?? 1e6
  for (const hit of [...found.hits, ...found.readings]) hit.chars.sort((a, b) => rank(a) - rank(b))
  for (const shape of [...found.shapes, ...found.partVariants, ...found.similarParts]) shape.chars.sort((a, b) => rank(a) - rank(b))
  return found
}

/** @param {Clue} clue @returns {Promise<Answer>} */
async function lookUp(clue) {
  /** @type {Answer} */
  const out = { clue, hits: [], readings: [], meaning: [], parts: [], partVariants: [], similarParts: [], shapes: [], variants: [], chars: [] }
  if (clue.kind === 'point') {
    if (clue.value !== undefined && clue.value <= 0x10FFFF) out.chars = [String.fromCodePoint(clue.value)]
    return out
  }
  if (clue.kind === 'pua') {
    out.chars = clue.chars ?? (clue.char ? [clue.char] : [])
    out.hits = await findCodes(clue.text)
    return out
  }
  if (clue.kind === 'paja') {
    const formula = convertPaja(clue.text)
    if (!formula.ids) return out
    const parts = formula.parts
    const runs = []
    if (parts.length >= 2 && parts.length <= 3) runs.push(parts.join(''))
    else for (const length of [2, 3]) for (let at = 0; at + length <= parts.length; at++) runs.push(parts.slice(at, at + length).join(''))
    const runSets = (await Promise.all([...new Set(runs)].map(run => findRun(run)))).map(list => new Set(list))
    let chars = runSets.length ? [...(runSets[0] ?? [])].filter(char => runSets.every(set => set.has(char))) : []
    const unique = [...new Set(parts)]
    if (!chars.length) {
      const partSets = (await Promise.all(unique.map(part => findPart(part)))).map(list => new Set(list))
      chars = partSets.length ? [...(partSets[0] ?? [])].filter(char => partSets.every(set => set.has(char))) : []
    }
    if (!chars.length && parts.length === 1 && isHan(parts[0])) chars = [parts[0]]
    out.shapes = chars.length ? [{ text: parts.join(''), chars, exact: true }] : []
    out.chars = chars
    return out
  }
  if (clue.kind === 'strokes') {
    const rows = await loadChars()
    out.chars = [...rows].filter(([, row]) => row.strokes === clue.value).map(([char]) => char)
    return out
  }
  if (clue.kind === 'part') {
    // A character also names what is filed under it, as 安 does あ and 一 does its Nüshu. Sources
    // spell a part in more than one way, so the other spellings count here too.
    const [parts, hits, variants] = await Promise.all([findPart(clue.text), findCodes(clue.text), loadVariants()])
    out.parts = parts
    out.variants = characterVariants(clue.text, variants)
    const groups = await partGroups(clue.text, parts, variants)
    out.partVariants = groups.parts
    out.similarParts = groups.similar
    out.hits = hits.filter(hit => hit.exact)
    out.chars = [...new Set([...parts, ...out.partVariants.flatMap(group => group.chars), ...out.hits.flatMap(hit => hit.chars)])]
    return out
  }
  if (clue.kind === 'scoped') {
    out.hits = (await findCodes(clue.code ?? '')).filter(hit => hit.method === clue.method)
    out.chars = [...new Set(out.hits.flatMap(hit => hit.chars))]
    return out
  }
  if (clue.kind === 'text') {
    const chars = [...clue.text]
    out.chars = chars.filter(inScope)
    out.hits = await findCodes(clue.text)
    const variants = await loadVariants()
    if (chars.length === 1) {
      out.parts = await findPart(clue.text)
      const groups = await partGroups(clue.text, out.parts, variants)
      out.partVariants = groups.parts
      out.similarParts = groups.similar
      out.variants = characterVariants(clue.text, variants)
    } else if (chars.length <= 3 && chars.every(isHan)) {
      // Two or three parts in a row are also a way of writing a character; the run is shown beside
      // any code of the same spelling, since a method may use Han characters as its codes.
      out.shapes = await shapesOf(clue.text, variants)
    }
    out.meaning = await findMeaning(clue.text)
    return out
  }
  const [hits, meaning, readings] = await Promise.all([findCodes(clue.text), findMeaning(clue.text), findReadings(clue.text)])
  out.hits = hits
  out.meaning = meaning
  out.readings = readings
  out.chars = [...new Set([...hits.flatMap(hit => hit.chars), ...meaning, ...readings.flatMap(hit => hit.chars)])]
  return out
}

/** Characters an answer contributes to an intersection. @param {Answer} item */
export function answerChars(item) {
  const chars = [...item.chars, ...(item.clue.kind === 'pua' ? item.hits.flatMap(hit => hit.chars) : [])]
  return chars.length ? chars : [...item.hits.flatMap(hit => hit.chars), ...item.parts, ...item.meaning]
}

/** The characters every answer names, commonest first. @param {Answer[]} answers */
export async function intersect(answers) {
  const rows = await loadChars()
  const sets = answers.map(item => new Set(answerChars(item)))
  const [first, ...rest] = sets
  const kept = [...(first ?? [])].filter(char => rest.every(set => set.has(char)))
  return kept.sort((a, b) => (rows.get(a)?.rank ?? 1e6) - (rows.get(b)?.rank ?? 1e6))
}

/** Hits put in reading order: whole codes first, then those a query only begins. @param {import('./data.js').CodeHit[]} hits */
export function groupHits(hits) {
  /** @type {Map<string, import('./data.js').CodeHit[]>} */
  const byMethod = new Map()
  for (const hit of hits) {
    const list = byMethod.get(hit.method)
    if (list) list.push(hit)
    else byMethod.set(hit.method, [hit])
  }
  return [...byMethod].map(([method, list]) => {
    list.sort((a, b) => Number(b.literal) - Number(a.literal) || Number(b.exact) - Number(a.exact) || a.code.length - b.code.length)
    return { method, hits: list, literal: list.some(hit => hit.literal), exact: list.some(hit => hit.exact), total: list.reduce((sum, hit) => sum + hit.chars.length, 0) }
  }).sort((a, b) => Number(b.literal) - Number(a.literal) || Number(b.exact) - Number(a.exact) || a.total - b.total)
}

/** The other spellings of a part, then the parts that only resemble it. @param {string} part @param {string[]} exact @param {import('../../src/variants.js').Variants} variants */
async function partGroups(part, exact, variants) {
  const seen = new Set(exact)
  /** @param {import('../../src/variants.js').ComponentVariant[]} rows @returns {Promise<Shape[]>} */
  const gather = async rows => {
    /** @type {Shape[]} */
    const out = []
    const sorted = [...rows].sort((a, b) => (a.component.codePointAt(0) ?? 0) - (b.component.codePointAt(0) ?? 0))
    for (const row of sorted) {
      const chars = (await findPart(row.component)).filter(char => !seen.has(char))
      if (!chars.length) continue
      for (const char of chars) seen.add(char)
      out.push({ text: row.component, chars, exact: false })
    }
    return out
  }
  return { parts: await gather(variants.component[part] ?? []), similar: await gather(fuzzyComponents(part, variants)) }
}

/** The characters sources write with a run of parts, one group per spelling. @param {string} text @param {import('../../src/variants.js').Variants} variants */
async function shapesOf(text, variants) {
  const runs = [...new Set(spellings([...text], variants).map(spelling => spelling.join('')))]
  const found = await Promise.all(runs.map(run => findRun(run)))
  return runs.flatMap((run, at) => found[at].length ? [{ text: run, chars: found[at], exact: run === text }] : [])
}

/** The characters a reading names, those named by the most varieties first. @param {import('./data.js').ReadingHit[]} hits */
export function tallyReadings(hits) {
  /** @type {Map<string, number>} */
  const tally = new Map()
  for (const hit of hits) for (const char of hit.chars) tally.set(char, (tally.get(char) ?? 0) + 1)
  return [...tally].sort((a, b) => b[1] - a[1])
}
