// A description as the card draws it: the source's notation, with a numbered component written out
// when note 6 gives a fragment, drawn from BabelStone's PUA glyph when it does not, and every part
// that is not a character marked so a reader can see what the source wrote.

/**
 * @typedef {{ pua: string, description: string, fragment?: string, chise?: { name: string, count: number }[] }} Component
 * @typedef {{ numbers: Record<string, Component>, entities: Record<string, { number: number, count: number }> }} Components
 */
/** @typedef {[string, Record<string, string>]} Title A message key and its parameters. */
/**
 * @typedef {object} Piece
 * @property {'plain' | 'part' | 'unnamed' | 'entity'} kind
 * @property {string} text
 * @property {Title} [title]
 * @property {Piece[]} [children] What a written-out fragment draws.
 * @property {boolean} [pua] Whether the text is BabelStone's PUA character for the part.
 */

const TOKEN = /\{(\d+)\}|？|&([^;]+);/g

/**
 * The parts of a description, in reading order. A `{n}` becomes the fragment note 6 gives, else its
 * PUA character, else the number as written; `？` and `&name;` stay as the source writes them.
 * @param {string} notation
 * @param {Components} components
 * @param {Set<number>} [seen]
 * @returns {Piece[]}
 */
export function pieces(notation, components, seen = new Set()) {
  /** @type {Piece[]} */
  const out = []
  let at = 0
  /** Draw one numbered component: its fragment, else its PUA character, else the number as written.
   * @param {string} number @param {Title} title */
  const draw = (number, title) => {
    const component = components.numbers[number]
    if (component?.fragment && !seen.has(Number(number))) {
      out.push({ kind: 'part', text: component.fragment, title, children: pieces(component.fragment, components, new Set([...seen, Number(number)])) })
    } else if (component?.pua) {
      out.push({ kind: 'part', text: component.pua, pua: true, title })
    } else {
      out.push({ kind: 'unnamed', text: `{${number}}`, title: /** @type {Title} */ (['card.numberUnknown', { n: number }]) })
    }
  }
  /** @param {string} text */
  const plain = text => {
    if (!text) return
    const last = out[out.length - 1]
    if (last?.kind === 'plain') last.text += text
    else out.push({ kind: 'plain', text })
  }
  for (const match of notation.matchAll(TOKEN)) {
    plain(notation.slice(at, match.index))
    at = match.index + match[0].length
    if (match[1] !== undefined) {
      draw(match[1], /** @type {Title} */ (['card.number', { n: match[1], description: components.numbers[match[1]]?.description ?? '' }]))
    } else if (match[2] !== undefined) {
      const name = match[2], same = components.entities[name]
      if (same) {
        const component = components.numbers[String(same.number)]
        draw(String(same.number), /** @type {Title} */ (['card.entityNumber', { name, n: String(same.number), description: component?.description ?? '' }]))
      } else {
        out.push({ kind: 'entity', text: match[0], title: /** @type {Title} */ (['card.entity', { name }]) })
      }
    } else {
      out.push({ kind: 'unnamed', text: match[0], title: /** @type {Title} */ (['card.unnamed', {}]) })
    }
  }
  plain(notation.slice(at))
  return out
}
