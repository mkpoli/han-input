// Where a set's characters sit in Unicode. Blocks.txt 18.0.0:
// https://www.unicode.org/Public/18.0.0/ucd/Blocks.txt
/** @typedef {{id: string, label: string, start: number, end: number}} Block */
/** @typedef {{id: string, label: string, count: number, share: number}} BlockRow */

/** The unified ideograph blocks, the ones the block occupancy table describes. @type {Block[]} */
export const CJK_BLOCKS = [
  { id: 'ext_a', label: 'Ext.A', start: 0x3400, end: 0x4DBF },
  { id: 'uro', label: 'URO', start: 0x4E00, end: 0x9FFF },
  { id: 'compat', label: 'Compat', start: 0xF900, end: 0xFAFF },
  { id: 'ext_b', label: 'Ext.B', start: 0x20000, end: 0x2A6DF },
  { id: 'ext_c', label: 'Ext.C', start: 0x2A700, end: 0x2B73F },
  { id: 'ext_d', label: 'Ext.D', start: 0x2B740, end: 0x2B81F },
  { id: 'ext_e', label: 'Ext.E', start: 0x2B820, end: 0x2CEAF },
  { id: 'ext_f', label: 'Ext.F', start: 0x2CEB0, end: 0x2EBEF },
  { id: 'ext_i', label: 'Ext.I', start: 0x2EBF0, end: 0x2EE5F },
  { id: 'compat_supp', label: 'Compat Suppl.', start: 0x2F800, end: 0x2FA1F },
  { id: 'ext_g', label: 'Ext.G', start: 0x30000, end: 0x3134F },
  { id: 'ext_h', label: 'Ext.H', start: 0x31350, end: 0x323AF },
  { id: 'ext_j', label: 'Ext.J', start: 0x323B0, end: 0x3347F },
]

/** The other scripts a set can list, kept out of the occupancy table. */
const SCRIPT_BLOCKS = [
  { id: 'latin', label: 'Latin', start: 0x0000, end: 0x007F },
  { id: 'rad_supp', label: 'Rad. Suppl.', start: 0x2E80, end: 0x2EFF },
  { id: 'kangxi', label: 'Kangxi', start: 0x2F00, end: 0x2FDF },
  { id: 'hiragana', label: 'Hiragana', start: 0x3040, end: 0x309F },
  { id: 'katakana', label: 'Katakana', start: 0x30A0, end: 0x30FF },
  { id: 'strokes', label: 'CJK Strokes', start: 0x31C0, end: 0x31EF },
  { id: 'katakana_ext', label: 'Katakana Ext.', start: 0x31F0, end: 0x31FF },
  { id: 'kana_ext_b', label: 'Kana Ext.-B', start: 0x1AFF0, end: 0x1AFFF },
  { id: 'kana_supp', label: 'Kana Suppl.', start: 0x1B000, end: 0x1B0FF },
  { id: 'kana_ext_a', label: 'Kana Ext.-A', start: 0x1B100, end: 0x1B12F },
  { id: 'small_kana', label: 'Small Kana', start: 0x1B130, end: 0x1B16F },
  { id: 'nushu', label: 'Nushu', start: 0x1B170, end: 0x1B2FF },
]

/** Every block a share list names, non-CJK scripts first. @type {Block[]} */
export const BLOCKS = [...SCRIPT_BLOCKS, ...CJK_BLOCKS]

/** The shares of a set's characters in each block, largest first; anything outside the blocks is Other.
 * @param {Set<string>} members @returns {BlockRow[]} */
export function blockRows(members) {
  const counts = new Map(BLOCKS.map(block => [block.id, 0]))
  let other = 0
  for (const char of members) {
    const point = char.codePointAt(0) ?? 0
    const block = BLOCKS.find(block => point >= block.start && point <= block.end)
    if (block) counts.set(block.id, (counts.get(block.id) ?? 0) + 1)
    else other++
  }
  const total = members.size
  /** @type {BlockRow[]} */
  const rows = BLOCKS
    .filter(block => counts.get(block.id))
    .map(block => ({ id: block.id, label: block.label, count: counts.get(block.id) ?? 0, share: (counts.get(block.id) ?? 0) / total }))
  if (other) rows.push({ id: 'other', label: 'Other', count: other, share: other / total })
  return rows.sort((a, b) => b.share - a.share || order(a.id) - order(b.id))
}

/** @param {string} id */
function order(id) {
  if (id === 'other') return BLOCKS.length
  return BLOCKS.findIndex(block => block.id === id)
}

/** @typedef {{id: string, label: string, start: number, end: number, total: number, assigned: number, empty: number, share: number}} BlockOccupancy */

/** Assigned and empty code points of each block, from the age ranges and the block ranges.
 * Extensions come first, then the remaining CJK blocks.
 * @param {import('./ages.js').AgeRange[]} ages @param {Block[]} [blocks] @returns {BlockOccupancy[]} */
export function blockOccupancy(ages, blocks = CJK_BLOCKS) {
  const order = ['ext_a', 'ext_b', 'ext_c', 'ext_d', 'ext_e', 'ext_f', 'ext_g', 'ext_h', 'ext_i', 'ext_j', 'uro', 'compat', 'compat_supp']
  const rank = (/** @type {string} */ id) => { const index = order.indexOf(id); return index < 0 ? order.length : index }
  return blocks.map(block => {
    const total = block.end - block.start + 1
    let assigned = 0
    for (const [start, end] of ages) {
      const from = Math.max(start, block.start)
      const to = Math.min(end, block.end)
      if (from <= to) assigned += to - from + 1
    }
    return { id: block.id, label: block.label, start: block.start, end: block.end, total, assigned, empty: total - assigned, share: total ? (total - assigned) / total : 0 }
  }).sort((a, b) => rank(a.id) - rank(b.id) || a.start - b.start)
}

/** @typedef {{plane: number | null, count: number, share: number}} PlaneRow */

/** The share of a set's characters in planes 0–3, with anything above plane 3 kept as Other.
 * @param {Set<string>} members @returns {PlaneRow[]} */
export function planeRows(members) {
  const counts = new Map()
  for (const char of members) {
    const plane = (char.codePointAt(0) ?? 0) >> 16
    counts.set(plane, (counts.get(plane) ?? 0) + 1)
  }
  const total = members.size
  /** @type {PlaneRow[]} */
  const rows = [0, 1, 2, 3].map(plane => ({ plane, count: counts.get(plane) ?? 0, share: total ? (counts.get(plane) ?? 0) / total : 0 }))
  const other = [...counts].filter(([plane]) => plane > 3).reduce((sum, [, count]) => sum + count, 0)
  if (other) rows.push({ plane: null, count: other, share: total ? other / total : 0 })
  return rows
}
