// The atlas names each variety down to its branch and sub-branch. The readings need the branches
// above them too, in one order for every character.

/** One branch for 北京, 東北 and the standard language based on them. */
export const NORTHERN_MANDARIN = '北京・東北官話'

/**
 * A variety's place in the classification, from the trunk down to the sub-branch the atlas names.
 * @param {{ atlas: string }} variety
 * @returns {string[]}
 */
export function classificationOf(variety) {
  const path = variety.atlas ? variety.atlas.split('－') : []
  const [root, ...rest] = path
  if (!root) return []
  if (root === '現代標準漢語' || root === '北京官話' || root === '東北官話') return ['官話', NORTHERN_MANDARIN, root, ...rest]
  if (root === '官話') return ['官話', ...rest]
  if (root.endsWith('官話')) return ['官話', root, ...rest]
  return path
}

/** @param {import('./data.js').Variety} variety @param {string} fallback @returns {string[]} */
function pathOf(variety, fallback) {
  const path = classificationOf(variety)
  return path.length ? path : [fallback]
}

/** @type {WeakMap<import('./data.js').Variety[], Map<string, Map<string, string>>>} */
const ORDERS = new WeakMap()

/**
 * A branch's place in the atlas. A few points carry a code from a neighbouring branch, so the
 * commonest code under a branch decides where it sits, not its earliest outlier.
 * @param {import('./data.js').Variety[]} varieties
 * @param {string} unclassed
 * @returns {Map<string, string>}
 */
function orderOf(varieties, unclassed) {
  let byFallback = ORDERS.get(varieties)
  if (!byFallback) ORDERS.set(varieties, byFallback = new Map())
  const held = byFallback.get(unclassed)
  if (held) return held
  /** @type {Map<string, { path: string[], codes: Map<string, number> }>} */
  const groups = new Map()
  for (const variety of varieties) {
    const path = pathOf(variety, unclassed)
    const key = path.join('－')
    let group = groups.get(key)
    if (!group) groups.set(key, group = { path, codes: new Map() })
    const code = variety.order || '~'
    group.codes.set(code, (group.codes.get(code) ?? 0) + 1)
  }
  const order = new Map()
  for (const group of groups.values()) {
    let best = '~'
    let count = -1
    for (const [code, n] of group.codes) {
      if (n > count || (n === count && code < best)) { best = code; count = n }
    }
    for (let depth = 1; depth <= group.path.length; depth++) {
      const key = group.path.slice(0, depth).join('－')
      const current = order.get(key)
      if (current === undefined || best < current) order.set(key, best)
    }
  }
  byFallback.set(unclassed, order)
  return order
}

/** @param {Map<string, string>} order @param {{ path: string, name: string }} left @param {{ path: string, name: string }} right */
function byAtlas(order, left, right) {
  const a = order.get(left.path) ?? '~'
  const b = order.get(right.path) ?? '~'
  return a < b ? -1 : a > b ? 1 : left.name < right.name ? -1 : left.name > right.name ? 1 : 0
}

/**
 * @typedef {{ n: number, forms: string[] }} Reading
 * @typedef {{ n: number, name: string, forms: string[], order: string }} VarietyReading
 * @typedef {{ path: string, name: string, count: number, rows: VarietyReading[], children: ReadingNode[] }} ReadingNode
 */

/**
 * Readings in a tree, ordered once by the atlas rather than by whichever variety a character
 * happens to have first. Branches without a matching reading are left out.
 * @param {import('./data.js').Variety[]} varieties
 * @param {Reading[]} readings
 * @param {string} needle
 * @param {string} unclassed
 * @returns {ReadingNode[]}
 */
export function readingTree(varieties, readings, needle, unclassed) {
  const byN = new Map(varieties.map(variety => [variety.n, variety]))
  const order = orderOf(varieties, unclassed)

  /** @type {{ path: string, name: string, rows: VarietyReading[], children: Map<string, any> }} */
  const root = { path: '', name: '', rows: [], children: new Map() }
  for (const reading of readings) {
    const variety = byN.get(reading.n)
    if (!variety) continue
    const haystack = `${variety.name} ${variety.short} ${variety.atlas} ${reading.forms.join(' ')}`.toLowerCase()
    if (needle && !haystack.includes(needle)) continue
    const path = pathOf(variety, unclassed)
    let node = root
    for (let depth = 1; depth <= path.length; depth++) {
      const key = path.slice(0, depth).join('－')
      let child = node.children.get(key)
      if (!child) {
        child = { path: key, name: path[depth - 1], rows: [], children: new Map() }
        node.children.set(key, child)
      }
      node = child
    }
    node.rows.push({ n: variety.n, name: variety.short, forms: reading.forms, order: variety.order || '~' })
  }

  /** @param {{ path: string, name: string, rows: VarietyReading[], children: Map<string, any> }} node @returns {ReadingNode} */
  const finish = node => {
    node.rows.sort((a, b) => a.order < b.order ? -1 : a.order > b.order ? 1 : a.n - b.n)
    const children = [...node.children.values()].map(finish).sort((a, b) => byAtlas(order, a, b))
    const count = node.rows.length + children.reduce((sum, child) => sum + child.count, 0)
    return { path: node.path, name: node.name, count, rows: node.rows, children }
  }
  return [...root.children.values()].map(finish).sort((a, b) => byAtlas(order, a, b))
}

/**
 * @typedef {import('./data.js').Variety} Variety
 * @typedef {{ path: string, name: string, count: number, items: Variety[], children: VarietyNode[] }} VarietyNode
 */

/**
 * Every variety in a tree, in atlas order. Branches without a matching variety are left out.
 * @param {Variety[]} varieties
 * @param {string} needle
 * @param {string} unclassed
 * @returns {VarietyNode[]}
 */
export function varietyTree(varieties, needle, unclassed) {
  const order = orderOf(varieties, unclassed)
  /** @type {{ path: string, name: string, items: Variety[], children: Map<string, any> }} */
  const root = { path: '', name: '', items: [], children: new Map() }
  for (const variety of varieties) {
    const haystack = `${variety.name} ${variety.short} ${variety.atlas} ${variety.region} ${variety.place}`.toLowerCase()
    if (needle && !haystack.includes(needle)) continue
    const path = pathOf(variety, unclassed)
    let node = root
    for (let depth = 1; depth <= path.length; depth++) {
      const key = path.slice(0, depth).join('－')
      let child = node.children.get(key)
      if (!child) {
        child = { path: key, name: path[depth - 1], items: [], children: new Map() }
        node.children.set(key, child)
      }
      node = child
    }
    node.items.push(variety)
  }

  /** @param {{ path: string, name: string, items: Variety[], children: Map<string, any> }} node @returns {VarietyNode} */
  const finish = node => {
    node.items.sort((a, b) => {
      const left = a.order || '~'
      const right = b.order || '~'
      return left < right ? -1 : left > right ? 1 : a.n - b.n
    })
    const children = [...node.children.values()].map(finish).sort((a, b) => byAtlas(order, a, b))
    const count = node.items.length + children.reduce((sum, child) => sum + child.count, 0)
    return { path: node.path, name: node.name, count, items: node.items, children }
  }
  return [...root.children.values()].map(finish).sort((a, b) => byAtlas(order, a, b))
}
