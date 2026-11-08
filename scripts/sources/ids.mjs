// The descriptions of how each character is written: BabelStone's IDS and CHISE's, merged so one
// description names every source that gives it.
import { readFileSync } from 'node:fs'
import { fetchOnce, sha256 } from '../lib.mjs'

const BABELSTONE = {
  id: 'babelstone',
  name: 'BabelStone IDS.TXT',
  url: 'https://www.babelstone.co.uk/CJK/IDS.TXT',
  licence: 'Freely available; terms stated in the file header',
  attribution: 'Andrew West',
  version: '2025-06-27',
}

/** CHISE's UCS files, pinned as the manifest in the sibling ids-input project pins them. */
const CHISE = {
  id: 'chise',
  name: 'CHISE IDS',
  url: 'https://github.com/chise/ids',
  licence: 'GPL-2.0-or-later',
  attribution: 'CHISE project',
  version: 'main@2026-11-04',
  files: [
    ['IDS-UCS-Basic.txt', '497ab2be984a86233848fe3631046351f3bb0334bfaac1d8f836aff2d3f87ba0'],
    ['IDS-UCS-Compat-Supplement.txt', 'c1d265a791a24a8b4d7d963cb7cf31a6a3b1b234b630477d3f27798c9ccab930'],
    ['IDS-UCS-Compat.txt', '7683730c8213ecb3a2b3e85daa6b7b913c43b44a81a9af7900671bca4d091391'],
    ['IDS-UCS-Ext-A.txt', 'd58c5b21054d1ba07fd2621f0892b36c088009d7890b136f42f8c5a5af21f495'],
    ['IDS-UCS-Ext-B-1.txt', '336be9f156b9c78785a79360978241b1a2973fab5c26662489f69e4d94b13ba0'],
    ['IDS-UCS-Ext-B-2.txt', '551150fa2bd8886c17b5af40ad1d7876026d477349e7d636b0fbfc7306d26b81'],
    ['IDS-UCS-Ext-B-3.txt', '33a51a09a18d06fb666e72f13d3854c41a1d06207f0f0c4ac43f3687a0bea6fb'],
    ['IDS-UCS-Ext-B-4.txt', 'f6c926482a3600e93b17be958de8cce701c0d91c644316a87e3a821374ad4360'],
    ['IDS-UCS-Ext-B-5.txt', '21cf28e9e4aeb3d98e8c7739899270b13a6d080a2f65f0d4287710d71e72901a'],
    ['IDS-UCS-Ext-B-6.txt', 'a732d18a27f418cb4610b7a1e1674487485111734cbd131220caa1baf23b630a'],
    ['IDS-UCS-Ext-C.txt', '74dcff528d54508225e587384f132cac508b97a866969ebbeea848a030910225'],
    ['IDS-UCS-Ext-D.txt', 'c300f9ace1ffd9526fe3c17a12c94b3823e1a97cd507bd4b85b784bf269a3234'],
    ['IDS-UCS-Ext-E.txt', 'aab22be5a0ba07d3830f37f344b08950c566286171539c08ce6d0d0a5f3a635b'],
    ['IDS-UCS-Ext-F.txt', 'dfede4731416ad43a084d0ecdc86562607e9057735e9ac43114870fa5dbf9f5e'],
    ['IDS-UCS-Ext-G.txt', '1f8f8cc7d911ccf86c196ce4de43d7e4ca03689ee83d4e3e380120eac336c64d'],
    ['IDS-UCS-Ext-H.txt', 'e239d31373777a953c755ba99ae7a502a33823bddd0fc9af4e61e3cd8f209e0c'],
    ['IDS-UCS-Ext-I.txt', 'a84694c801290033b7e3f79303c71fcdcae595afc3a47481496dc051832369d0'],
    ['IDS-UCS-Ext-J.txt', '0910def2870d1e4cb38c4064f060de5efc48bb73fee6d5f7447657fa121fa260'],
  ],
}

export const IDS_SOURCES = [BABELSTONE, { id: CHISE.id, name: CHISE.name, url: CHISE.url, licence: CHISE.licence, attribution: CHISE.attribution, version: CHISE.version }]

/** @typedef {{ text: string, regions: string, sources: string[] }} Description */

const OPERATORS = new Set('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿〾㇯')
const BODY = /^\^(.+)\$\(([^()]*)\)$/

/** BabelStone's numbered components ({12}, the right of 龍) and the IDS fragments that write them out. */
const FRAGMENTS = (() => {
  /** @type {Map<number, string>} */
  const map = new Map()
  for (const line of readFileSync(new URL('../../data/ids-components.tsv', import.meta.url), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const [name, , fragment] = line.split('\t')
    const number = Number(name?.slice(1, -1))
    if (fragment && Number.isInteger(number)) map.set(number, fragment)
  }
  return map
})()

/** Write out the numbered components a sequence names, at any depth; `unresolved` when one has no fragment. */
export function writeOut(sequence, seen = new Set()) {
  let unresolved = false
  const text = sequence.replace(/\{(\d+)\}/g, (whole, digits) => {
    const number = Number(digits), fragment = FRAGMENTS.get(number)
    if (fragment === undefined || seen.has(number)) { unresolved = true; return whole }
    const inner = writeOut(fragment, new Set([...seen, number]))
    if (inner.unresolved) unresolved = true
    return inner.text
  })
  return { text, unresolved }
}

/** A character's descriptions, keyed by character; one description keeps every source that gives it.
 * @param {Map<string, Description[]>} into
 * @param {string} char @param {string} text @param {string} regions @param {string} source */
export function addDescription(into, char, text, regions, source) {
  const rows = into.get(char) ?? []
  const exact = rows.findIndex(row => row.text === text && row.regions === regions)
  if (exact >= 0) {
    if (!rows[exact].sources.includes(source)) rows[exact].sources.push(source)
  } else if (!regions) {
    // An untagged duplicate is the same description; the region tags a source gives stay its own.
    const same = rows.map((row, i) => row.text === text ? i : -1).filter(i => i >= 0)
    if (same.length) {
      for (const i of same) if (!rows[i].sources.includes(source)) rows[i].sources.push(source)
    } else rows.push({ text, regions, sources: [source] })
  } else rows.push({ text, regions, sources: [source] })
  into.set(char, rows)
}

/** Read BabelStone's file and CHISE's, merged. */
export async function readDescriptions() {
  /** @type {Map<string, Description[]>} */
  const descriptions = new Map()
  const babel = readFileSync(await fetchOnce(BABELSTONE.url, 'babelstone-IDS.TXT'), 'utf8')
  for (const line of babel.split(/\r?\n/)) {
    if (!line.startsWith('U+')) continue
    const [, char, ...sequences] = line.split('\t')
    for (const sequence of sequences) {
      const match = BODY.exec(sequence)
      if (!match) continue
      const { text, unresolved } = writeOut(match[1])
      if (!unresolved) addDescription(descriptions, char, text, match[2], 'babelstone')
    }
  }
  for (const [file, digest] of CHISE.files) {
    const path = await fetchOnce(`https://raw.githubusercontent.com/chise/ids/main/${file}`, file)
    if (sha256(path) !== digest) throw new Error(`${file}: pinned ${digest}, fetched ${sha256(path)}`)
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      if (!line || line.startsWith(';;')) continue
      const [code, char, text] = line.split('\t')
      // Some files write the character as U+4E00, others as U-0002A700.
      if (!/^U[+-][0-9A-F]+$/i.test(code) || !char || [...char].length !== 1 || !text) continue
      // A description naming a part with no code point cannot be shown by a site of code points.
      if (text.includes('&') || ![...text].some(c => OPERATORS.has(c))) continue
      const written = writeOut(text)
      if (!written.unresolved) addDescription(descriptions, char, written.text, '', 'chise')
    }
  }
  return descriptions
}

/** Parts at any depth, keyed by part, from every description given. @param {Map<string, Description[]>} descriptions */
export function partsOf(descriptions) {
  /** @type {Map<string, Set<string>>} */
  const direct = new Map()
  for (const [char, rows] of descriptions) {
    const parts = new Set()
    for (const { text } of rows) {
      for (const c of text) {
        if (OPERATORS.has(c)) continue
        if (/\p{Script=Han}|[⺀-⿟㇀-㇯]/u.test(c) && c !== char) parts.add(c)
      }
    }
    if (parts.size) direct.set(char, parts)
  }
  /** @type {Map<string, Set<string>>} */
  const memo = new Map()
  /** @param {string} char @param {Set<string>} path */
  const expand = (char, path) => {
    const known = memo.get(char)
    if (known) return known
    const all = new Set()
    for (const part of direct.get(char) ?? []) {
      if (path.has(part)) continue
      all.add(part)
      path.add(part)
      for (const deeper of expand(part, path)) all.add(deeper)
      path.delete(part)
    }
    memo.set(char, all)
    return all
  }
  /** @type {Map<string, string[]>} */
  const inverted = new Map()
  for (const char of direct.keys()) {
    for (const part of expand(char, new Set([char]))) {
      if (!inverted.has(part)) inverted.set(part, [])
      ;/** @type {string[]} */ (inverted.get(part)).push(char)
    }
  }
  return inverted
}
