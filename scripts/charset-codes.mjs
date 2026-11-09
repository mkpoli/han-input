// The code printed under a character in a browsed set is the set's own index: a code point, a kuten
// position or a serial. These are source positions, not scalar assignments.

/** @typedef {{ char: string, code: string }} Code */

/** @param {unknown[] | undefined} rows @param {{ index?: string, source?: string }} meta @param {string} members @returns {Code[]} */
export function rowCodes(rows, meta, members) {
  const set = new Set(members)
  const seen = new Set()
  /** @type {Code[]} */
  const codes = []
  for (const row of rows ?? []) {
    if (!Array.isArray(row)) continue
    const [code, glyph] = row
    if (typeof code !== 'string' || typeof glyph !== 'string' || !set.has(glyph) || seen.has(glyph)) continue
    seen.add(glyph)
    codes.push({ char: glyph, code: meta.index === 'hex' && meta.source === 'Unicode' ? `U+${code}` : code })
  }
  return codes
}

/** @param {{ cns: string, unicode: string[], crosswalk?: string }[]} records @param {string} members @returns {Code[]} */
export function cnsRowCodes(records, members) {
  const set = new Set(members)
  const seen = new Set()
  /** @type {Code[]} */
  const codes = []
  for (const row of records) {
    for (const hex of new Set([...(row.crosswalk ? [row.crosswalk] : []), ...row.unicode])) {
      const char = String.fromCodePoint(parseInt(hex, 16))
      if (!set.has(char) || seen.has(char)) continue
      seen.add(char)
      codes.push({ char, code: row.cns })
    }
  }
  return codes
}

/** @param {{ mappedUnicode?: string, source?: string | null, serial?: string }[]} records @param {string} members @returns {Code[]} */
export function proposalCodes(records, members) {
  const set = new Set(members)
  const seen = new Set()
  /** @type {Code[]} */
  const codes = []
  for (const record of records) {
    if (!record.mappedUnicode) continue
    const char = String.fromCodePoint(parseInt(record.mappedUnicode.slice(2), 16))
    const code = record.source ?? record.serial ?? ''
    if (!code || !set.has(char) || seen.has(char)) continue
    seen.add(char)
    codes.push({ char, code })
  }
  return codes
}

/** @param {{ char: string, entry: string }[]} evidence @param {string} members @returns {Code[]} */
export function evidenceCodes(evidence, members) {
  const set = new Set(members)
  const seen = new Set()
  /** @type {Code[]} */
  const codes = []
  for (const item of evidence) {
    if (!set.has(item.char) || seen.has(item.char)) continue
    seen.add(item.char)
    codes.push({ char: item.char, code: item.entry })
  }
  return codes
}

/** @param {Code[]} codes */
export function codeText(codes) {
  return codes.map(({ char, code }) => `${char}\t${code}`).join('\n') + '\n'
}
