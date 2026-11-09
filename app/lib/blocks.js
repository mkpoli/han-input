// Where a set's characters sit in the CJK code space. Blocks.txt 18.0.0:
// https://www.unicode.org/Public/18.0.0/ucd/Blocks.txt
/** @typedef {{id: string, label: string, start: number, end: number}} Block */
/** @typedef {{id: string, label: string, count: number, share: number}} BlockRow */

/** @type {Block[]} */
export const BLOCKS = [
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
