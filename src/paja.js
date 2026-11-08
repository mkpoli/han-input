// Korean 破字: the composition notation of the Korean History Database's unencoded characters.
// Four arithmetic signs stand for relations, parentheses group, and a ▼ marks a record's variant
// form. The help at https://db.history.go.kr/resources/unicode/help/help07.jsp gives the rules:
// + left-right, - delete, / top-bottom, * combine. This reads them into IDS; * and - are the
// closest IDS relations, since neither says exactly where the parts sit.

/** @typedef {'plus' | 'minus' | 'slash' | 'star'} Operator */
/** @typedef {{ code: 'empty' | 'expected-operand' | 'unexpected' | 'unclosed' | 'trailing', at: number }} Problem */

/** @type {{ char: string, id: Operator, ids: string }[]} */
export const PAJA_OPERATORS = [
  { char: '+', id: 'plus', ids: '⿰' },
  { char: '-', id: 'minus', ids: '㇯' },
  { char: '/', id: 'slash', ids: '⿱' },
  { char: '*', id: 'star', ids: '⿻' },
]

/** @type {Map<string, Operator>} */
const OPERATOR = new Map(PAJA_OPERATORS.map(item => [item.char, item.id]))
/** @type {Map<Operator, string>} */
const IDS = new Map(PAJA_OPERATORS.map(item => [item.id, item.ids]))

const WIDE = new Map([['＋', '+'], ['－', '-'], ['／', '/'], ['＊', '*']])
const OPEN = new Map([['(', '('], ['（', '('], ['{', '('], ['｛', '('], ['[', '('], ['［', '(']])
const CLOSE = new Map([[')', ')'], ['）', ')'], ['}', ')'], ['｝', ')'], [']', ')'], ['］', ')']])
const MARKER = new Set(['▼', '▽'])

/** @param {string} char */
const operatorOf = char => OPERATOR.get(WIDE.get(char) ?? char)

/** Whether a text is written as 破字 rather than as ordinary text: it needs a sign and only
 * components or signs. Latin letters, digits and colons rule it out, so codes and dates stay codes.
 * @param {string} text */
export function isPaja(text) {
  const chars = [...text.trim()]
  if (!chars.length) return false
  const signs = new Set([...OPERATOR.keys(), ...WIDE.keys(), ...OPEN.keys(), ...CLOSE.keys(), ...MARKER])
  if (!chars.some(char => signs.has(char))) return false
  return chars.every(char => signs.has(char) || /\s/u.test(char) || !/[0-9A-Za-z:：]/u.test(char))
}

/** @typedef {{ type: 'operand', char: string } | { type: 'operator', id: Operator } | { type: 'open' } | { type: 'close' }} Token */

/** @param {string} text @returns {{ tokens: Token[], variant: boolean }} */
function tokenize(text) {
  /** @type {Token[]} */
  const tokens = []
  let variant = false
  for (const char of text) {
    if (/\s/u.test(char)) continue
    const operator = operatorOf(char)
    if (operator) { tokens.push({ type: 'operator', id: operator }); continue }
    if (OPEN.has(char)) { tokens.push({ type: 'open' }); continue }
    if (CLOSE.has(char)) { tokens.push({ type: 'close' }); continue }
    if (MARKER.has(char)) { variant = true; continue }
    tokens.push({ type: 'operand', char })
  }
  return { tokens, variant }
}

/** @typedef {{ op: Operator, left: Node, right: Node } | { char: string }} Node */

class PajaError extends Error {
  /** @param {Problem['code']} code @param {number} at */
  constructor(code, at) {
    super(code)
    this.code = code
    this.at = at
  }
}

/** @param {Token[]} tokens */
function parse(tokens) {
  let index = 0
  const peek = () => tokens[index]
  const startsFactor = () => peek()?.type === 'operand' || peek()?.type === 'open'

  /** @returns {Node} */
  function factor() {
    const token = peek()
    if (token?.type === 'operand') { index++; return { char: token.char } }
    if (token?.type === 'open') {
      index++
      const node = expression()
      if (peek()?.type !== 'close') throw new PajaError('unclosed', index)
      index++
      return node
    }
    throw new PajaError('expected-operand', index)
  }

  /** @returns {Node} */
  function term() {
    let node = factor()
    while (true) {
      const token = peek()
      if (token?.type !== 'operator' || (token.id !== 'star' && token.id !== 'slash')) break
      index++
      node = { op: token.id, left: node, right: factor() }
    }
    return node
  }

  /** @returns {Node} */
  function expression() {
    let node = term()
    while (true) {
      const token = peek()
      if (token?.type === 'operator' && (token.id === 'plus' || token.id === 'minus')) {
        index++
        node = { op: token.id, left: node, right: term() }
        continue
      }
      // + may be left out, so two parts in a row are a left-right composition.
      if (startsFactor()) {
        node = { op: 'plus', left: node, right: term() }
        continue
      }
      break
    }
    return node
  }

  if (!peek()) throw new PajaError('empty', 0)
  const node = expression()
  if (index < tokens.length) throw new PajaError(peek()?.type === 'close' ? 'unexpected' : 'trailing', index)
  return node
}

/** @param {Node} node @returns {string} */
function toIds(node) {
  if ('char' in node) return node.char
  return `${IDS.get(node.op)}${toIds(node.left)}${toIds(node.right)}`
}

/** Parts of the resulting character, in reading order. A deletion removes its right side. @param {Node} node @returns {string[]} */
function toParts(node) {
  if ('char' in node) return [node.char]
  if (node.op === 'minus') return toParts(node.left)
  return [...toParts(node.left), ...toParts(node.right)]
}

/** All operands, including a deleted one. @param {Node} node @returns {string[]} */
function toOperands(node) {
  if ('char' in node) return [node.char]
  return [...toOperands(node.left), ...toOperands(node.right)]
}

/** @param {Node} node @param {Set<string>} found */
function notesOf(node, found) {
  if ('char' in node) return
  found.add(node.op)
  notesOf(node.left, found)
  notesOf(node.right, found)
}

/**
 * @typedef {object} PajaConversion
 * @property {string} ids
 * @property {string[]} parts parts of the result, used by search
 * @property {string[]} operands every part written, including a deleted one
 * @property {('combine' | 'subtract' | 'variant')[]} notes readings that need care
 * @property {boolean} variant
 * @property {Problem[]} problems
 */

/** Convert a 破字 formula to IDS. `*` becomes overlap and `-` the IDS subtraction sign, since
 * neither arithmetic sign fixes a position. @param {string} text @returns {PajaConversion} */
export function convertPaja(text) {
  const { tokens, variant } = tokenize(text)
  try {
    const node = parse(tokens)
    /** @type {Set<string>} */
    const found = new Set()
    notesOf(node, found)
    /** @type {('combine' | 'subtract' | 'variant')[]} */
    const notes = []
    if (found.has('star')) notes.push('combine')
    if (found.has('minus')) notes.push('subtract')
    if (variant) notes.push('variant')
    return { ids: toIds(node), parts: toParts(node), operands: toOperands(node), notes, variant, problems: [] }
  } catch (error) {
    if (!(error instanceof PajaError)) throw error
    return { ids: '', parts: [], operands: [], notes: variant ? ['variant'] : [], variant, problems: [{ code: error.code, at: error.at }] }
  }
}
