// Arithmetic composition: characters written with + - * / @ ? and brackets. The signs are not one
// system. The Korean History Database uses + for left-right and * for a combination without a fixed
// position; CBETA's general formula uses * for left-right, @ for containment, and -+ for a
// replacement. This reads either notation into IDS; a sign that does not fix a position is marked.
// Sources: https://db.history.go.kr/resources/unicode/help/help07.jsp (Korean) and
// https://cbetaonline.dila.edu.tw/doc/en/02-04_create_word.php (CBETA).

/** @typedef {'korean' | 'general'} Notation */
/** @typedef {'plus' | 'minus' | 'star' | 'slash' | 'at'} Operator */
/** @typedef {{ code: 'empty' | 'expected-operand' | 'unexpected' | 'unclosed' | 'trailing', at: number }} Problem */

export const NOTATIONS = /** @type {const} */ (['korean', 'general'])

/** @type {{ notation: Notation, signs: { char: string, relation: string, operator?: Operator }[] }[]} */
export const ARITHMETIC_SIGNS = [
  {
    notation: 'korean',
    signs: [
      { char: '+', relation: 'horizontal', operator: 'plus' },
      { char: '-', relation: 'delete', operator: 'minus' },
      { char: '/', relation: 'vertical', operator: 'slash' },
      { char: '*', relation: 'combine', operator: 'star' },
    ],
  },
  {
    notation: 'general',
    signs: [
      { char: '*', relation: 'horizontal', operator: 'star' },
      { char: '/', relation: 'vertical', operator: 'slash' },
      { char: '@', relation: 'contain', operator: 'at' },
      { char: '-', relation: 'delete', operator: 'minus' },
      { char: '+', relation: 'replace', operator: 'plus' },
      { char: '?', relation: 'unknown' },
    ],
  },
]

const WIDE = new Map([['＋', '+'], ['－', '-'], ['／', '/'], ['＊', '*'], ['＠', '@'], ['？', '?']])
const MARKER = new Set(['▼', '▽'])
const COMPONENT = /[\p{Script=Han}\p{Co}]/u

/** @param {string} notation */
const signsOf = notation => new Set(ARITHMETIC_SIGNS.find(item => item.notation === notation)?.signs.map(sign => sign.char) ?? [])
/** @param {string} notation @param {string} char */
const operatorOf = (notation, char) => ARITHMETIC_SIGNS.find(item => item.notation === notation)?.signs.find(sign => sign.char === char)?.operator

/** Whether a text is an arithmetic formula of either notation: it needs a sign and only components
 * or signs. Latin letters, digits and colons rule it out, so codes and dates stay codes.
 * @param {string} text @param {Notation} [notation] */
export function isArithmetic(text, notation) {
  const chars = [...text.trim()]
  if (!chars.length) return false
  const allowed = notation ? [notation] : NOTATIONS
  const signs = new Set(allowed.flatMap(item => [...signsOf(item)]))
  const hasSign = chars.some(char => signs.has(WIDE.get(char) ?? char) || (allowed.includes('korean') && MARKER.has(char)) || (allowed.includes('general') && '[]()'.includes(char)))
  if (!hasSign) return false
  return chars.every(char => {
    const plain = WIDE.get(char) ?? char
    return signs.has(plain) || /\s/u.test(char) || COMPONENT.test(char) || (allowed.includes('general') && '?[]()'.includes(char)) || (allowed.includes('korean') && (MARKER.has(char) || '(){}[]'.includes(char)))
  })
}

/** @typedef {{ type: 'operand', char: string, unknown?: boolean } | { type: 'operator', id: Operator } | { type: 'open' } | { type: 'close' }} Token */

/** @param {string} text @param {Notation} notation @returns {{ tokens: Token[], marker: boolean, separator: boolean, text: string }} */
function tokenize(text, notation) {
  let body = text
  let separator = false
  if (notation === 'general') {
    const start = body.indexOf('[')
    const end = start >= 0 ? body.indexOf(']', start + 1) : -1
    if (start >= 0 && end > start) {
      body = body.slice(start + 1, end)
      separator = true
    }
  }
  /** @type {Token[]} */
  const tokens = []
  let marker = false
  for (const char of body) {
    if (/\s/u.test(char)) continue
    const plain = WIDE.get(char) ?? char
    if (notation === 'korean' && MARKER.has(char)) { marker = true; continue }
    const operator = operatorOf(notation, plain)
    if (operator) { tokens.push({ type: 'operator', id: operator }); continue }
    if (notation === 'korean' && (char === '(' || char === '（' || char === '{' || char === '｛' || char === '[' || char === '［')) { tokens.push({ type: 'open' }); continue }
    if (notation === 'korean' && (char === ')' || char === '）' || char === '}' || char === '｝' || char === ']' || char === '］')) { tokens.push({ type: 'close' }); continue }
    if (notation === 'general' && (char === '(' || char === '（')) { tokens.push({ type: 'open' }); continue }
    if (notation === 'general' && (char === ')' || char === '）')) { tokens.push({ type: 'close' }); continue }
    if (notation === 'general' && plain === '?') { tokens.push({ type: 'operand', char: '?', unknown: true }); continue }
    if (COMPONENT.test(char)) { tokens.push({ type: 'operand', char }); continue }
    // An unexpected sign or a Latin character: let the parser report it.
    tokens.push({ type: 'operand', char })
  }
  return { tokens, marker, separator, text: body }
}

/** @typedef {{ op: Operator, left: Node, right: Node } | { op: 'replace', left: Node, removed: Node, added: Node } | { char: string, unknown?: boolean }} Node */

class ArithmeticError extends Error {
  /** @param {Problem['code']} code @param {number} at */
  constructor(code, at) {
    super(code)
    this.code = code
    this.at = at
  }
}

/** @param {Token[]} tokens @param {Notation} notation */
function parse(tokens, notation) {
  let index = 0
  const peek = () => tokens[index]
  const startsFactor = () => peek()?.type === 'operand' || peek()?.type === 'open'

  /** @returns {Node} */
  function factor() {
    const token = peek()
    if (token?.type === 'operand') { index++; return token.unknown ? { char: token.char, unknown: true } : { char: token.char } }
    if (token?.type === 'open') {
      index++
      const node = expression()
      if (peek()?.type !== 'close') throw new ArithmeticError('unclosed', index)
      index++
      return node
    }
    throw new ArithmeticError('expected-operand', index)
  }

  /** @returns {Node} */
  function term() {
    let node = factor()
    while (true) {
      const token = peek()
      if (token?.type !== 'operator') break
      if (token.id === 'star' || token.id === 'slash' || (notation === 'general' && token.id === 'at')) {
        index++
        node = { op: token.id, left: node, right: factor() }
        continue
      }
      break
    }
    return node
  }

  /** @returns {Node} */
  function expression() {
    let node = term()
    while (true) {
      const token = peek()
      if (notation === 'korean' && token?.type === 'operator' && (token.id === 'plus' || token.id === 'minus')) {
        index++
        node = { op: token.id, left: node, right: term() }
        continue
      }
      if (notation === 'korean' && startsFactor()) {
        // The Korean database lets + be left out, so two parts in a row are left-right.
        node = { op: 'plus', left: node, right: term() }
        continue
      }
      if (notation === 'general' && token?.type === 'operator' && token.id === 'minus') {
        index++
        const removed = term()
        const after = peek()
        if (after?.type === 'operator' && after.id === 'plus') {
          index++
          node = { op: 'replace', left: node, removed, added: term() }
        } else node = { op: 'minus', left: node, right: removed }
        continue
      }
      break
    }
    return node
  }

  if (!peek()) throw new ArithmeticError('empty', 0)
  const node = expression()
  if (index < tokens.length) throw new ArithmeticError(peek()?.type === 'close' ? 'unexpected' : 'trailing', index)
  return node
}

/** @param {Operator} operator @param {Notation} notation */
function idsOf(operator, notation) {
  if (operator === 'plus') return '⿰'
  if (operator === 'star') return notation === 'general' ? '⿰' : '⿻'
  if (operator === 'minus') return '㇯'
  if (operator === 'slash') return '⿱'
  if (operator === 'at') return '⿴'
  return ''
}

/** @param {Node} node @param {Notation} notation @returns {string} */
function toIds(node, notation) {
  if ('char' in node) return node.char
  if (node.op === 'replace') return `⿻㇯${toIds(node.left, notation)}${toIds(node.removed, notation)}${toIds(node.added, notation)}`
  return `${idsOf(node.op, notation)}${toIds(node.left, notation)}${toIds(node.right, notation)}`
}

/** Parts of the result, in reading order. Deletion drops its right side; replacement drops the
 * replaced part and adds the new one. An unknown part is not searchable. @param {Node} node @returns {string[]} */
function toParts(node) {
  if ('char' in node) return node.unknown ? [] : [node.char]
  if (node.op === 'minus') return toParts(node.left)
  if (node.op === 'replace') return [...toParts(node.left), ...toParts(node.added)]
  return [...toParts(node.left), ...toParts(node.right)]
}

/** @param {Node} node @returns {string[]} */
function toOperands(node) {
  if ('char' in node) return [node.char]
  if (node.op === 'replace') return [...toOperands(node.left), ...toOperands(node.removed), ...toOperands(node.added)]
  return [...toOperands(node.left), ...toOperands(node.right)]
}

/** @param {Node} node @param {Set<string>} found */
function notesOf(node, found) {
  if ('char' in node) { if (node.unknown) found.add('unknown'); return }
  found.add(node.op)
  notesOf(node.left, found)
  if (node.op === 'replace') { notesOf(node.removed, found); notesOf(node.added, found) } else notesOf(node.right, found)
}

/**
 * @typedef {object} ArithmeticConversion
 * @property {string} ids
 * @property {string[]} parts parts of the result, used by search
 * @property {string[]} operands every part written, including a deleted or unknown one
 * @property {('combine' | 'subtract' | 'contain' | 'replace' | 'unknown' | 'variant' | 'separator')[]} notes readings that need care
 * @property {boolean} variant
 * @property {boolean} separator whether [] held the formula in running text
 * @property {Problem[]} problems
 */

/** @param {Set<string>} found @param {Notation} notation @param {boolean} variant @param {boolean} separator */
function notesList(found, notation, variant, separator) {
  /** @type {ArithmeticConversion['notes']} */
  const notes = []
  if (notation === 'korean' && found.has('star')) notes.push('combine')
  if (found.has('minus')) notes.push('subtract')
  if (notation === 'general' && found.has('at')) notes.push('contain')
  if (notation === 'general' && found.has('replace')) notes.push('replace')
  if (found.has('unknown')) notes.push('unknown')
  if (variant) notes.push('variant')
  if (separator) notes.push('separator')
  return notes
}

/** Convert an arithmetic formula to IDS. `*`/`@`/`+` map to the closest IDS relation; the notes say
 * where the source leaves the position open. @param {string} text @param {Notation} [notation] @returns {ArithmeticConversion} */
export function convertArithmetic(text, notation = 'korean') {
  const { tokens, marker, separator } = tokenize(text, notation)
  try {
    const node = parse(tokens, notation)
    /** @type {Set<string>} */
    const found = new Set()
    notesOf(node, found)
    const notes = notesList(found, notation, marker, separator)
    return { ids: toIds(node, notation), parts: toParts(node), operands: toOperands(node), notes, variant: marker, separator, problems: [] }
  } catch (error) {
    if (!(error instanceof ArithmeticError)) throw error
    return { ids: '', parts: [], operands: [], notes: marker ? ['variant'] : [], variant: marker, separator, problems: [{ code: error.code, at: error.at }] }
  }
}
