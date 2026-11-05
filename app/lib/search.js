// A query is one or more clues, split on spaces. Each clue names a set of characters; several clues
// leave the characters in all of them.
import { hanIn, isHan } from '../../src/fold.js'
import { findCodes, findMeaning, findPart, loadChars } from './data.js'

/**
 * @typedef {{ kind: 'code' | 'scoped' | 'strokes' | 'point' | 'text' | 'part', text: string, method?: string, code?: string, value?: number }} Clue
 * @typedef {{ clue: Clue, hits: import('./data.js').CodeHit[], meaning: string[], parts: string[], chars: string[] }} Answer
 */

/** @param {string} term @param {boolean} alone @returns {Clue} */
export function readClue(term, alone) {
  const point = term.match(/^[uU]\+?([0-9a-fA-F]{4,6})$/)
  if (point) return { kind: 'point', text: term, value: parseInt(point[1], 16) }
  const strokes = term.match(/^(\d{1,2})[畫画劃划]$/)
  if (strokes) return { kind: 'strokes', text: term, value: Number(strokes[1]) }
  const scoped = term.match(/^([a-z][\w-]*):(.+)$/)
  if (scoped) return { kind: 'scoped', text: term, method: scoped[1], code: scoped[2] }
  if (isHan(term)) return { kind: alone ? 'text' : 'part', text: term }
  if (hanIn(term).length === [...term].length) return { kind: 'text', text: term }
  return { kind: 'code', text: term }
}

/** @param {string} query @returns {Clue[]} */
export function readQuery(query) {
  const terms = query.trim().split(/\s+/).filter(Boolean)
  return terms.map(term => readClue(term, terms.length === 1))
}

/** @param {Clue} clue @returns {Promise<Answer>} */
export async function answer(clue) {
  /** @type {Answer} */
  const out = { clue, hits: [], meaning: [], parts: [], chars: [] }
  if (clue.kind === 'point') {
    if (clue.value !== undefined && clue.value <= 0x10FFFF) out.chars = [String.fromCodePoint(clue.value)]
    return out
  }
  if (clue.kind === 'strokes') {
    const rows = await loadChars()
    out.chars = [...rows].filter(([, row]) => row.strokes === clue.value).map(([char]) => char)
    return out
  }
  if (clue.kind === 'part') {
    out.parts = await findPart(clue.text)
    out.chars = out.parts
    return out
  }
  if (clue.kind === 'scoped') {
    out.hits = (await findCodes(clue.code ?? '')).filter(hit => hit.method === clue.method)
    out.chars = [...new Set(out.hits.flatMap(hit => hit.chars))]
    return out
  }
  if (clue.kind === 'text') {
    out.chars = hanIn(clue.text)
    out.hits = await findCodes(clue.text)
    out.parts = [...clue.text].length === 1 ? await findPart(clue.text) : []
    out.meaning = await findMeaning(clue.text)
    return out
  }
  const [hits, meaning] = await Promise.all([findCodes(clue.text), findMeaning(clue.text)])
  out.hits = hits
  out.meaning = meaning
  out.chars = [...new Set([...hits.flatMap(hit => hit.chars), ...meaning])]
  return out
}

/** The characters every answer names, commonest first. @param {Answer[]} answers */
export async function intersect(answers) {
  const rows = await loadChars()
  const sets = answers.map(item => new Set(item.chars.length ? item.chars : [...item.hits.flatMap(hit => hit.chars), ...item.parts, ...item.meaning]))
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
    list.sort((a, b) => Number(b.exact) - Number(a.exact) || a.code.length - b.code.length)
    return { method, hits: list, exact: list.some(hit => hit.exact), total: list.reduce((sum, hit) => sum + hit.chars.length, 0) }
  }).sort((a, b) => Number(b.exact) - Number(a.exact) || a.total - b.total)
}
