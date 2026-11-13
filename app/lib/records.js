// Records without a Unicode character are found by what describes them: the parts of their formula or
// IDS, their stroke count, a zhuyin reading, or a character a source relates them to. A set opts in
// with `records.search` in the catalogue.
import { loadCharsets, loadRecords } from './charsets.js'
import { convertArithmetic } from '../../src/arithmetic.js'
import { isHan } from '../../src/fold.js'
import { loadVariants } from './data.js'

/**
 * @typedef {import('./charsets.js').ProposalRecord} ProposalRecord
 * @typedef {import('./charsets.js').ProposalDocument} ProposalDocument
 * @typedef {{ set: string, record: ProposalRecord, document: ProposalDocument, parts: Set<string>, related: Set<string> }} RecordEntry
 */

/** @type {Map<string, number>} */
const ARITY = new Map([...[...'⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽'].map(op => /** @type {[string, number]} */ ([op, 2])), ['⿲', 3], ['⿳', 3], ['⿾', 1], ['⿿', 1], ['㇯', 2], ['🔄', 3]])

/**
 * The Han parts an IDS keeps. A part taken away (㇯ minuend and subtrahend) is not kept, and a
 * replacement (🔄 base, old, new) keeps only the new part. Anything that does not parse keeps nothing.
 * @param {string} ids
 */
export function keptParts(ids) {
  const tokens = [...ids]
  let at = 0
  /** @returns {string[] | null} */
  const node = () => {
    const token = tokens[at++]
    if (token === undefined) return null
    const arity = ARITY.get(token)
    if (!arity) return isHan(token) ? [token] : []
    const children = []
    for (let i = 0; i < arity; i++) {
      const child = node()
      if (!child) return null
      children.push(child)
    }
    if (token === '㇯') return []
    if (token === '🔄') return children[2]
    return children.flat()
  }
  const parts = []
  while (at < tokens.length) {
    const tree = node()
    if (!tree) return []
    parts.push(...tree)
  }
  return parts
}

/** @param {ProposalRecord} record */
function partsOf(record) {
  const ids = [record.workbook?.ids, record.workbook?.idsMachine, record.composition ? convertArithmetic(record.composition, 'general').ids : '']
  return new Set(ids.flatMap(text => text ? keptParts(text) : []))
}

/** @param {ProposalRecord} record */
function relatedOf(record) {
  const related = new Set(/** @type {string[]} */ ([record.workbook?.proposed, record.common].filter(Boolean)))
  if (record.similarUnicode) related.add(String.fromCodePoint(parseInt(record.similarUnicode.slice(2), 16)))
  return related
}

/** @type {Promise<RecordEntry[]> | null} */
let index = null
/** Every searchable record that has no Unicode character, loaded once. */
export function loadRecordIndex() {
  index ??= (async () => {
    const sets = (await loadCharsets()).filter(set => set.records?.search)
    const lists = await Promise.all(sets.map(async set => {
      const data = await loadRecords(set.id)
      const documents = new Map(data.documents.map(document => [document.id, document]))
      return data.records.flatMap(record => {
        const document = documents.get(record.document)
        return !record.mappedUnicode && document ? [{ set: set.id, record, document, parts: partsOf(record), related: relatedOf(record) }] : []
      })
    }))
    return lists.flat()
  })().catch(error => { index = null; throw error })
  return index
}

const ZHUYIN = /^[ㄅ-ㄯㆠ-ㆿˊˇˋ˙]+$/u
/** @param {string} text */
const toneless = text => text.replace(/[ˊˇˋ˙]/gu, '')

/**
 * The records one clue selects. A part also matches the other forms it is written in, as 氵 is 水.
 * @param {RecordEntry[]} entries @param {import('./search.js').Clue} clue @param {string[]} [variants]
 * @returns {RecordEntry[]}
 */
export function matchRecords(entries, clue, variants = []) {
  const forms = [clue.text, ...variants]
  /** @param {string[]} parts */
  const withParts = parts => parts.length ? entries.filter(entry => parts.every(part => entry.parts.has(part))) : []
  switch (clue.kind) {
    case 'part':
      return entries.filter(entry => forms.some(form => entry.parts.has(form)) || entry.related.has(clue.text))
    case 'text': {
      const chars = [...clue.text]
      if (chars.length === 1) return entries.filter(entry => forms.some(form => entry.parts.has(form)) || entry.related.has(clue.text))
      return chars.length <= 3 && chars.every(isHan) ? withParts(chars) : []
    }
    case 'strokes':
      return entries.filter(entry => entry.record.workbook?.strokes === clue.value)
    case 'arithmetic': {
      const kept = /** @type {const} */ (['korean', 'general']).map(notation => keptParts(convertArithmetic(clue.text, notation).ids))
      const best = kept.sort((a, b) => b.length - a.length)[0] ?? []
      return withParts([...new Set(best)])
    }
    case 'code':
      if (!ZHUYIN.test(clue.text)) return []
      return entries.filter(entry => (entry.record.workbook?.zhuyin ?? []).some(reading => reading === clue.text || toneless(reading) === toneless(clue.text)))
    default:
      return []
  }
}

/** Whether a clue can select a record, so a query of codes alone never loads the records. @param {import('./search.js').Clue} clue */
export const canMatch = clue => clue.kind === 'part' || clue.kind === 'strokes' || clue.kind === 'arithmetic'
  || (clue.kind === 'text' && [...clue.text].every(isHan)) || (clue.kind === 'code' && ZHUYIN.test(clue.text))

/**
 * The records every clue selects, kept to one character set when one is chosen.
 * @param {import('./search.js').Clue[]} clues @param {string} [set]
 */
export async function findRecords(clues, set = '') {
  if (!clues.length || !clues.every(canMatch)) return []
  const [index, variants] = await Promise.all([loadRecordIndex(), loadVariants()])
  const entries = index.filter(entry => !set || entry.set === set)
  /** @param {string} part */
  const formsOf = part => (variants.component[part] ?? []).map(row => row.component)
  const [first, ...rest] = clues.map(clue => matchRecords(entries, clue, formsOf(clue.text)))
  const others = rest.map(list => new Set(list))
  return (first ?? []).filter(entry => others.every(list => list.has(entry)))
}
