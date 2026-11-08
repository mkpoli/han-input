// Writes data/variants.json: which spellings of a part IWDS treats as one, and which code points
// Unicode calls the same character. The build reads it; the browser bundles it.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fetchOnce, sha256 } from './lib.mjs'
import { isEncodedGlyph } from './charset-members.mjs'

const IWDS = {
  name: 'yi-bai/iwds',
  url: 'https://raw.githubusercontent.com/yi-bai/iwds/master/iwds.xml',
  licence: 'none stated for the repository',
  retrieved: '2026-11-08',
}
const UCD = {
  name: 'Unicode 18.0.0 UnicodeData',
  url: 'https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt',
  licence: 'Unicode Licence v3',
  retrieved: '2026-11-08',
}

const OPERATORS = new Set('⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿〾㇯')
/** Compatibility ideographs name their unified form in the decomposition field; Kangxi radicals
 * tag it. */
const COMPAT = 'CJK COMPATIBILITY IDEOGRAPH-'
const COMPAT_TAG = '<compat> '

/** @param {string} text @returns {string[] | null} the single glyphs, or null for a description */
export function plainComponents(text) {
  const glyphs = [...text]
  // IWDS writes some shapes as private-use glyph ids; a search cannot reach those.
  if (!glyphs.length || glyphs.some(glyph => OPERATORS.has(glyph) || !isEncodedGlyph(glyph))) return null
  return glyphs
}

/** @param {string} list @returns {[string, string][]} */
export function pairsOf(list) {
  return list.split(',').map(item => [...item.replace(/\*/g, '')])
    .filter(glyphs => glyphs.length === 2 && glyphs.every(glyph => [...glyph].length === 1 && isEncodedGlyph(glyph)))
    .map(glyphs => /** @type {[string, string]} */ (glyphs))
}

/** @param {string} xml */
export function readIwds(xml) {
  const groups = []
  for (const match of xml.matchAll(/<entry\b([^>]*)>([\s\S]*?)<\/entry>/g)) {
    const id = /id="([^"]+)"/.exec(match[1])?.[1]
    const body = match[2]
    const components = plainComponents(/<components>([^<]*)<\/components>/.exec(body)?.[1] ?? '')
    if (!id || !components || components.length < 2) continue
    const pairs = pairsOf(/<disunified>([^<]*)<\/disunified>/.exec(body)?.[1] ?? '')
    const level = /kind="([^"]+)"/.exec(match[1])?.[1]
    groups.push({ id, components, pairs, ...(level ? { kind: level } : {}) })
  }
  return groups
}

/** @param {string} body */
export function readCompat(body) {
  /** @type {Map<string, string>} */
  const map = new Map()
  for (const line of body.split('\n')) {
    const [hex, name, , , , decomposition] = line.split(';')
    if (!hex || !decomposition) continue
    const target = name.startsWith(COMPAT) ? decomposition : decomposition.startsWith(COMPAT_TAG) ? decomposition.slice(COMPAT_TAG.length) : ''
    const unified = Number.parseInt(target, 16)
    if (!target || !/^[0-9A-F]+$/.test(target) || Number.isNaN(unified)) continue
    const from = String.fromCodePoint(parseInt(hex, 16))
    const to = String.fromCodePoint(unified)
    // Only forms this site shows: a Kangxi radical and its ideograph, or two ideographs.
    if (!isEncodedGlyph(from) || !isEncodedGlyph(to)) continue
    map.set(from, to)
  }
  return map
}

/** Groups outside IWDS, with the sources that state them. @param {string} path */
export function readCurated(path) {
  /** @type {{ sources?: Record<string, string>[], groups?: { id: string, components: string[], note?: string, sources?: string[] }[] }} */
  const doc = JSON.parse(readFileSync(path, 'utf8'))
  return { sources: doc.sources ?? [], groups: (doc.groups ?? []).map(group => ({ ...group, curated: true })) }
}

/** @param {{ id: string, components: string[], pairs?: [string, string][], curated?: boolean }[]} groups @param {Map<string, string>} compat */
export function variantIndex(groups, compat) {
  /** @type {Record<string, { component: string, group: string }[]>} */
  const component = {}
  /** @type {Record<string, { char: string, relation: string, source: string, group?: string }[]>} */
  const character = {}
  /** @type {Record<string, { component: string, group: string }[]>} */
  const fuzzy = {}
  /** @param {string} char @param {{ char: string, relation: string, source: string, group?: string }} row */
  const add = (char, row) => {
    const rows = character[char] ??= []
    if (!rows.some(other => other.char === row.char && other.relation === row.relation)) rows.push(row)
  }
  for (const group of groups) {
    // An IWDS entry with no example pair only calls two shapes similar; it does not show a character
    // written either way, so it does not widen a search. A curated group states its own evidence.
    if (!group.curated && !group.pairs?.length) continue
    const fuzzyGroup = /** @type {{ kind?: string }} */ (group).kind === 'fuzzy'
    for (const part of group.components) {
      for (const other of group.components) {
        if (other === part) continue
        const into = fuzzyGroup ? (fuzzy[part] ??= []) : (component[part] ??= [])
        if (!into.some(row => row.component === other)) into.push({ component: other, group: group.id })
      }
    }
    if (fuzzyGroup) continue
    for (const [a, b] of group.pairs ?? []) {
      add(a, { char: b, relation: 'variant', source: 'iwds', group: group.id })
      add(b, { char: a, relation: 'variant', source: 'iwds', group: group.id })
    }
  }
  for (const [compatChar, unified] of compat) {
    if (unified === compatChar) continue
    add(compatChar, { char: unified, relation: 'compatibility', source: 'unicode' })
    add(unified, { char: compatChar, relation: 'compatibility', source: 'unicode' })
  }
  return { component, character, fuzzy }
}

async function main() {
  const xmlPath = await fetchOnce(IWDS.url, 'iwds.xml')
  const xml = readFileSync(xmlPath, 'utf8')
  const ucdPath = await fetchOnce(UCD.url, 'UnicodeData-18.txt')
  const ucd = readFileSync(ucdPath, 'utf8')
  const curated = readCurated(join(import.meta.dirname, '..', 'data', 'variant-groups.json'))
  const groups = [...readIwds(xml), ...curated.groups]
  const { component, character, fuzzy } = variantIndex(groups, readCompat(ucd))
  const data = {
    sources: [
      { ...IWDS, sha256: sha256(xmlPath) },
      { ...UCD, sha256: sha256(ucdPath) },
      ...curated.sources,
    ],
    groups,
    component,
    character,
    fuzzy,
  }
  writeFileSync(join(import.meta.dirname, '..', 'data', 'variants.json'), JSON.stringify(data) + '\n')
  console.log(`${groups.length} IWDS groups, ${Object.keys(component).length} parts, ${Object.keys(character).length} characters`)
}

if (import.meta.main) await main()
