// GB/T 12052-1989's 94×94 table. The 1989 standard assigns 5,979 graphic characters: 682 symbols,
// 3,424 first-level Hangul, and 1,873 second-level rows, 94 of them 吏讀字 at 71-89–72-88. The table
// is read from Jaemin Chung's transcription (ecma35lib, 2014), which gives each row's kuten position
// and its Unicode scalar or, for the 1,719 archaic-syllable rows (1,718 distinct), a sequence of
// two or three jamo.
import { readFileSync } from 'node:fs'
import { fetchOnce } from '../lib.mjs'

export const GB12052 = {
  url: 'https://raw.githubusercontent.com/harjitmoe/ecma35lib/3ac8f4561c388b3744e0a2b221773eb602c09702/ecma35/data/multibyte/mbmaps/Other/gb12052-uni.txt',
  as: 'gb12052-uni.txt',
}

/** The two 吏讀字 positions whose printed glyph has no scalar (⿱土𰆊 and ⿱爲𰆊 in 字統's reading). */
export const GB12052_UNENCODED = ['7233', '7267']

/** Characters printed in the table, but fixed at 5,979 rows by the standard's own layout. */
const ROW_COUNTS = new Map(/** @type {[number, number][]} */ ([
  [1, 94], [2, 72], [3, 94], [4, 83], [5, 86], [6, 48], [7, 66], [8, 63], [9, 76],
  ...Array.from({ length: 36 }, (_, i) => [16 + i, 94]),
  [52, 40],
  ...Array.from({ length: 18 }, (_, i) => [53 + i, 94]),
  [71, 93], [72, 88],
]))

/** @typedef {{ code: string, row: number, cell: number, glyph: string }} Gb12052Row */

/** @param {string} text @returns {Gb12052Row[]} */
export function gb12052Rows(text) {
  /** @type {Gb12052Row[]} */
  const rows = []
  const seen = new Set()
  let previous = { row: 0, cell: 0 }
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^(\d{2})-(\d{2})\t0x([0-9A-F]{4})\t0x([0-9A-F]{4})\t(U\+[0-9A-F]{4,6}(?: U\+[0-9A-F]{4,6})*)\t# (.*)$/)
    if (!match) throw new Error(`Malformed GB 12052 row: ${line}`)
    const [, rowText, cellText, glText, dualText, scalars] = match
    const row = Number(rowText)
    const cell = Number(cellText)
    if (!ROW_COUNTS.has(row) || cell < 1 || cell > 94) throw new Error(`GB 12052 position outside the table: ${rowText}-${cellText}`)
    const gl = 0x2020 + (row << 8) + cell
    if (parseInt(glText, 16) !== gl) throw new Error(`GB 12052 GL byte disagrees with its position: ${rowText}-${cellText}`)
    if (parseInt(dualText, 16) !== gl + 0x8080) throw new Error(`GB 12052 dual byte disagrees with its position: ${rowText}-${cellText}`)
    const code = `${rowText}${cellText}`
    if (seen.has(code)) throw new Error(`GB 12052 repeats the position ${code}`)
    seen.add(code)
    if (row < previous.row || (row === previous.row && cell <= previous.cell)) throw new Error(`GB 12052 rows are out of kuten order at ${code}`)
    previous = { row, cell }
    const glyph = scalars.split(' ').map(scalar => String.fromCodePoint(parseInt(scalar.slice(2), 16))).join('')
    if (!glyph) throw new Error(`GB 12052 row without a glyph: ${code}`)
    rows.push({ code, row, cell, glyph })
  }
  for (const [row, count] of ROW_COUNTS) {
    const found = rows.filter(item => item.row === row).length
    if (found !== count) throw new Error(`GB 12052 row ${row} has ${found} characters, the table prints ${count}`)
  }
  return rows
}

/** The table's distinct characters, each with the first position it occupies. Repeated characters
 * keep the earlier position; the transcription notes that the later ones use another typeface.
 * Positions whose printed glyph has no assigned scalar stay out of the list and live as records.
 * @param {Gb12052Row[]} rows @param {Set<string>} unencoded @returns {{ members: string[], codes: { char: string, code: string }[] }} */
export function gb12052Members(rows, unencoded) {
  const printed = new Set(rows.map(row => row.code))
  for (const code of unencoded) if (!printed.has(code)) throw new Error(`GB 12052 has no position ${code}`)
  const seen = new Set()
  /** @type {string[]} */
  const members = []
  /** @type {{ char: string, code: string }[]} */
  const codes = []
  for (const row of rows) {
    if (unencoded.has(row.code) || seen.has(row.glyph)) continue
    seen.add(row.glyph)
    members.push(row.glyph)
    codes.push({ char: row.glyph, code: row.code })
  }
  return { members, codes }
}

/** @returns {Promise<Gb12052Row[]>} */
export async function readGb12052() {
  const path = await fetchOnce(GB12052.url, GB12052.as)
  return gb12052Rows(readFileSync(path, 'utf8'))
}
