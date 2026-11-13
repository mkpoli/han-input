// The composition formulas of Taiwan's 漢字構形資料庫, introduced in its version 1.4 (2002). Its thirteen symbols
// live in the Big5 user area at 8DF1–8DFD, and in Unicode at U+F6A3–U+F6AF. Connectors sit between
// two parts, repeats sit before the part they repeat, and a shape marker wraps a part list.

/** @typedef {'lr' | 'ud' | 'oc'} Connector */
/** @typedef {'v2' | 'h2' | 't3' | 'v3' | 'h3' | 'q4' | 'v4' | 'h4'} Repeat */
/** @typedef {'start' | 'end'} Marker */

/**
 * @typedef {object} Symbol
 * @property {string} char
 * @property {string} big5
 * @property {'connect' | 'repeat' | 'mark'} kind
 * @property {Connector | Repeat | Marker} id
 * @property {string} [ids]
 * @property {number} [count]
 */

/** @type {Symbol[]} */
export const LEGACY_SYMBOLS = [
  { char: '\uF6A3', big5: '8DF1', kind: 'connect', id: 'ud', ids: '⿱' },
  { char: '\uF6A4', big5: '8DF2', kind: 'connect', id: 'lr', ids: '⿰' },
  { char: '\uF6A5', big5: '8DF3', kind: 'connect', id: 'oc', ids: '⿴' },
  { char: '\uF6A6', big5: '8DF4', kind: 'repeat', id: 'v2', count: 2 },
  { char: '\uF6A7', big5: '8DF5', kind: 'repeat', id: 'h2', count: 2 },
  { char: '\uF6A8', big5: '8DF6', kind: 'repeat', id: 't3', count: 3 },
  { char: '\uF6A9', big5: '8DF7', kind: 'repeat', id: 'v3', count: 3 },
  { char: '\uF6AA', big5: '8DF8', kind: 'repeat', id: 'h3', count: 3 },
  { char: '\uF6AB', big5: '8DF9', kind: 'repeat', id: 'q4', count: 4 },
  { char: '\uF6AC', big5: '8DFA', kind: 'repeat', id: 'v4', count: 4 },
  { char: '\uF6AD', big5: '8DFB', kind: 'repeat', id: 'h4', count: 4 },
  { char: '\uF6AE', big5: '8DFC', kind: 'mark', id: 'start' },
  { char: '\uF6AF', big5: '8DFD', kind: 'mark', id: 'end' },
]

/** @type {Map<string, Symbol>} */
const BY_CHAR = new Map(LEGACY_SYMBOLS.map(symbol => [symbol.char, symbol]))

/** @type {Record<string, string>} */
const CONNECT = { lr: '⿰', ud: '⿱', oc: '⿴' }
/** @type {Record<string, string>} */
const TERNARY = { lr: '⿲', ud: '⿳' }

/** @param {string} char */
export const isLegacySymbol = char => BY_CHAR.has(char)

/** Whether a text holds any of the thirteen symbols. @param {string} text */
export const hasLegacy = text => [...text].some(isLegacySymbol)

/** A private-use character that is not one of the thirteen symbols is an old component glyph. @param {string} char */
export const isPrivateComponent = char => /\p{Co}/u.test(char) && !isLegacySymbol(char)

/** @param {string} char */
const isConnector = char => BY_CHAR.get(char)?.kind === 'connect'
/** @param {string} char */
const isRepeat = char => BY_CHAR.get(char)?.kind === 'repeat'
/** @param {string} char */
const isStart = char => BY_CHAR.get(char)?.id === 'start'
/** @param {string} char */
const isEnd = char => BY_CHAR.get(char)?.id === 'end'

/** IDS for the given parts, in the given arrangement. A plain connector repeats; a shape marker
 * does not say how its parts sit, so it is not passed here. @param {Connector} id @param {string[]} parts */
export function idsOf(id, parts) {
  if (!parts.length) return ''
  if (parts.length === 1) return parts[0]
  if (id === 'oc') return parts.reduceRight((inner, part) => `⿴${part}${inner}`)
  return tree(id, parts)
}

/** @param {'lr' | 'ud'} id @param {string[]} parts @returns {string} */
function tree(id, parts) {
  const binary = CONNECT[id]
  const ternary = TERNARY[id]
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${binary}${parts[0]}${parts[1]}`
  if (parts.length === 3) return `${ternary}${parts[0]}${parts[1]}${parts[2]}`
  const middle = Math.floor(parts.length / 2)
  return `${binary}${tree(id, parts.slice(0, middle))}${tree(id, parts.slice(middle))}`
}

/** @param {Repeat} id @param {string} part @returns {string} */
function repeatOf(id, part) {
  switch (id) {
    case 'v2': return `⿱${part}${part}`
    case 'h2': return `⿰${part}${part}`
    case 't3': return `⿱${part}⿰${part}${part}`
    case 'v3': return `⿳${part}${part}${part}`
    case 'h3': return `⿲${part}${part}${part}`
    case 'q4': return `⿱⿰${part}${part}⿰${part}${part}`
    case 'v4': return `⿱⿱${part}${part}⿱${part}${part}`
    case 'h4': return `⿰⿰${part}${part}⿰${part}${part}`
  }
}

/**
 * @typedef {object} Problem
 * @property {number} offset index in the input
 * @property {'orphan' | 'missing' | 'mixed' | 'shape-connect' | 'shape-chain' | 'shape-open' | 'shape-empty' | 'nested-repeat' | 'nested-shape' | 'repeat-missing'} code
 */

/**
 * @typedef {object} Part
 * @property {string} text
 * @property {string[]} parts
 * @property {number} next
 * @property {boolean} shape
 * @property {Problem[]} problems
 */

/** Read one part: a character, a repetition, or a shape marker. @param {string[]} chars @param {number} at @returns {Part} */
function readPart(chars, at) {
  if (at >= chars.length || /\s/u.test(chars[at])) return { text: '', parts: [], next: at + 1, shape: false, problems: [{ offset: at, code: 'missing' }] }
  const symbol = BY_CHAR.get(chars[at])
  if (symbol?.kind === 'repeat') {
    const atom = readAtom(chars, at + 1)
    // Leave a symbol that cannot be the repeated part in place, so the caller reports it and the
    // input is not silently shortened.
    if (!atom.text) return { text: chars[at], parts: [], next: at + 1, shape: false, problems: atom.problems }
    const parts = Array.from({ length: symbol.count ?? 0 }, () => atom.text)
    return {
      text: repeatOf(/** @type {Repeat} */ (symbol.id), atom.text), parts,
      next: atom.next, shape: false, problems: atom.problems,
    }
  }
  if (symbol?.id === 'start') {
    const shape = readShape(chars, at)
    return { text: shape.text, parts: shape.parts, next: shape.next, shape: true, problems: shape.problems }
  }
  if (symbol) {
    return { text: '', parts: [], next: at + 1, shape: false, problems: [{ offset: at, code: 'missing' }] }
  }
  return { text: chars[at] ?? '', parts: chars[at] ? [chars[at]] : [], next: at + 1, shape: false, problems: [] }
}

/** A single part after a repetition: no repetition of a repetition, and no marker. @param {string[]} chars @param {number} at @returns {Part} */
function readAtom(chars, at) {
  if (at >= chars.length || /\s/u.test(chars[at])) return { text: '', parts: [], next: at + 1, shape: false, problems: [{ offset: at, code: 'repeat-missing' }] }
  const symbol = BY_CHAR.get(chars[at])
  if (symbol?.kind === 'repeat') return { text: '', parts: [], next: at + 1, shape: false, problems: [{ offset: at, code: 'nested-repeat' }] }
  if (symbol?.id === 'start') return { text: '', parts: [], next: at + 1, shape: false, problems: [{ offset: at, code: 'nested-shape' }] }
  if (symbol) return { text: '', parts: [], next: at + 1, shape: false, problems: [{ offset: at, code: 'repeat-missing' }] }
  return { text: chars[at] ?? '', parts: chars[at] ? [chars[at]] : [], next: at + 1, shape: false, problems: [] }
}

/**
 * @typedef {object} Shape
 * @property {string} text
 * @property {string[]} parts
 * @property {number} next
 * @property {Problem[]} problems
 */

/** The parts between a shape marker's start and end. The marker records writing order, not layout,
 * so its parts are joined and never given IDS operators. @param {string[]} chars @param {number} at @returns {Shape} */
function readShape(chars, at) {
  /** @type {string[]} */
  const parts = []
  /** @type {Problem[]} */
  const problems = []
  let index = at + 1
  while (index < chars.length && !isEnd(chars[index])) {
    if (isConnector(chars[index])) {
      problems.push({ offset: index, code: 'shape-connect' })
      index++
      continue
    }
    const part = readPart(chars, index)
    if (part.shape) problems.push({ offset: index, code: 'nested-shape' })
    parts.push(...part.parts.filter(Boolean))
    problems.push(...part.problems)
    index = part.next
  }
  if (index >= chars.length) problems.push({ offset: at, code: 'shape-open' })
  else index++
  if (!parts.length) {
    problems.push({ offset: at, code: 'shape-empty' })
    return { text: chars.slice(at, index).join(''), parts, next: index, problems }
  }
  return { text: parts.join('·'), parts, next: index, problems }
}

/**
 * @typedef {object} Formula
 * @property {string} text
 * @property {number} next
 * @property {boolean} converted
 * @property {Problem[]} problems
 */

/** Read a connector chain or a lone repetition. @param {string[]} chars @param {number} at @returns {Formula} */
function readFormula(chars, at) {
  const first = readPart(chars, at)
  /** @type {string[]} */
  const parts = [first.text]
  /** @type {Part[]} */
  const read = [first]
  let index = first.next
  /** @type {string | null} */
  let connector = null
  while (isConnector(chars[index])) {
    const current = /** @type {string} */ (chars[index])
    if (connector !== null && current !== connector) {
      return { text: chars.slice(at, index).join(''), next: index, converted: false, problems: [...first.problems, { offset: index, code: 'mixed' }] }
    }
    connector = current
    const part = readPart(chars, index + 1)
    read.push(part)
    parts.push(part.text)
    index = part.next
  }
  if (connector === null) return { text: first.text, next: first.next, converted: first.problems.length === 0, problems: first.problems }
  const problems = read.flatMap(part => part.problems)
  const shape = read.slice(1).some(part => part.shape)
  if (shape) problems.push({ offset: at, code: 'shape-chain' })
  const usable = parts.every(Boolean) && !shape && read.every(part => part.problems.length === 0)
  if (!usable) return { text: chars.slice(at, index).join(''), next: index, converted: false, problems: problems.length ? problems : [{ offset: at, code: 'missing' }] }
  return { text: idsOf(/** @type {Connector} */ (BY_CHAR.get(connector)?.id), parts), next: index, converted: true, problems }
}

/**
 * @typedef {object} Conversion
 * @property {string} text
 * @property {number} converted formulas written as IDS
 * @property {number} shapes formulas left as a part list
 * @property {number} unresolved private-use characters left in the output
 * @property {string[]} unresolvedChars distinct private-use characters left in the output
 * @property {Problem[]} problems
 */

/** Convert every old composition formula in a text to IDS, leaving the rest of the text alone.
 * A shape marker yields its parts joined by `·`, since its writing order does not record a layout.
 * @param {string} text @returns {Conversion}
 */
export function convertLegacy(text) {
  const chars = [...text]
  /** @type {Problem[]} */
  const problems = []
  let output = ''
  let converted = 0
  let shapes = 0
  let index = 0
  while (index < chars.length) {
    const char = chars[index]
    if (isStart(char)) {
      const shape = readShape(chars, index)
      output += shape.text
      problems.push(...shape.problems)
      if (shape.parts.length) shapes++
      index = shape.next
      continue
    }
    if (isRepeat(char)) {
      const formula = readFormula(chars, index)
      output += formula.text
      problems.push(...formula.problems)
      if (formula.converted) converted++
      index = formula.next
      continue
    }
    if (isConnector(char) || isEnd(char)) {
      output += char
      problems.push({ offset: index, code: 'orphan' })
      index++
      continue
    }
    if (!/\s/u.test(char) && isConnector(chars[index + 1] ?? '')) {
      const formula = readFormula(chars, index)
      output += formula.text
      problems.push(...formula.problems)
      if (formula.converted) converted++
      index = formula.next
      continue
    }
    output += char
    index++
  }
  const unresolvedChars = [...new Set([...output].filter(isPrivateComponent))]
  return {
    text: output,
    converted,
    shapes,
    unresolved: [...output].filter(isPrivateComponent).length,
    unresolvedChars,
    problems,
  }
}

/** The IDS a repeat symbol stands for, for the legend. @param {Symbol} symbol */
export function repeatExample(symbol) {
  if (symbol.kind === 'connect') return `${symbol.ids}··`
  if (symbol.kind !== 'repeat') return ''
  return repeatOf(/** @type {Repeat} */ (symbol.id), '·')
}
