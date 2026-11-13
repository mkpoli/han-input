// Writes data/sourced-variants.json: character relations from a variant database, each kept with the
// source its tag names. The browser loads it when a character's variants are shown.
//   bun scripts/import_sourced_variants.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CACHE, sha256 } from './lib.mjs'
import { isEncodedGlyph } from './charset-members.mjs'

const TABLE = {
  name: '电脑汉字字典.csv',
  file: 'variant-tables/computer-hanzi-dictionary.csv',
  sha256: 'da5b73e85cbf1cd24faae4a0b0da638b499d2580695d641c54598f758c22260d',
  licence: 'not stated; supplied privately',
  retrieved: '2026-11-14',
}
const XINHUA = {
  name: '新华字典12版字表_含繁异体.txt',
  file: 'variant-tables/xinhua12-with-variants.txt',
  sha256: '3dda96b1bdcafc4fa5f5242b01ec5e7943d777ae2cadbc1c4295c6a5b5728260',
  licence: 'not stated; supplied privately',
  retrieved: '2026-11-14',
}

/**
 * What a relation reads as, seen from the first character of the pair:
 *   variant      the two are variants of one character; the direction is kept in the pair, not shown
 *   simplified   the second character is the simplified form of the first
 */
/** @typedef {'variant' | 'simplified'} Kind */

/** One id per source; the letter is the short code the data file uses. */
export const SOURCES = {
  hydzd: { code: 'a', label: '漢語大字典' },
  moe: { code: 'b', label: '教育部異體字字典' },
  koseki: { code: 'c', label: '戶籍統一文字' },
  nyukan: { code: 'd', label: '入管正字' },
  ichiran: { code: 'e', label: '第一批異體字整理表' },
  joyo: { code: 'f', label: '常用漢字表' },
  jinmei: { code: 'g', label: '人名用漢字' },
  separated: { code: 'h', label: '原規格分離' },
  numerals: { code: 'i', label: '漢數字の異體' },
  variantSimplified: { code: 'j', label: '異體簡化字' },
  simplified: { code: 'k', label: '簡化字' },
  hydzdSimplified: { code: 'l', label: '漢語大字典（簡體字）' },
  tradSimp: { code: 'm', label: '繁簡關係' },
  taisho: { code: 'n', label: '大正大藏經' },
  yinan: { code: 'o', label: '疑難字考釋與研究' },
  yinanXu: { code: 'p', label: '疑難字續考' },
  suziCong: { code: 'q', label: '漢語俗字叢考' },
  suziXin: { code: 'r', label: '漢語俗字新考' },
  zidianKaozheng: { code: 's', label: '字典考正' },
  longkan: { code: 't', label: '龍龕手鏡研究' },
  kehong: { code: 'u', label: '可洪音義研究' },
  hanyue: { code: 'v', label: '漢越語研究' },
  zhonghua: { code: 'w', label: '中華字海' },
  kangxi: { code: 'x', label: '康熙字典' },
  jiyun: { code: 'y', label: '集韻' },
  tianyuan: { code: 'z', label: '天原發微' },
  suzi: { code: 'A', label: '俗字' },
  kakucho: { code: 'B', label: '擴張新舊字體' },
  notice5200: { code: 'C', label: '5200号通達' },
  hyogai: { code: 'D', label: '表外漢字字體表の簡易慣用字體' },
  xinhua12: { code: 'E', label: '新华字典12版' },
}

/**
 * Every tag in the database and what this site does with it. `kind` is how the relation reads;
 * `source` names the source it is kept under; `drop` says why a tag is left out. Direction: a
 * `←` tag reads from the second character to the first, and a bare 繁體字 reads as 簡化字 reversed.
 * @type {Record<string, { kind: Kind, source: keyof typeof SOURCES } | { drop: string }>}
 */
export const TAGS = {
  '異體字（漢語大字典）': { kind: 'variant', source: 'hydzd' },
  '異體字（民國教育部）': { kind: 'variant', source: 'moe' },
  '民國教育部': { kind: 'variant', source: 'moe' },
  '入管正字': { kind: 'variant', source: 'nyukan' },
  '異體字（戶籍統一文字）': { kind: 'variant', source: 'koseki' },
  '戶籍統一文字': { kind: 'variant', source: 'koseki' },
  '異體字（第一批異體字整理表）': { kind: 'variant', source: 'ichiran' },
  '異體字（第一批異體字整理表・1956年废止）': { kind: 'variant', source: 'ichiran' },
  '異體字（第一批異體字整理表・1986年废止）': { kind: 'variant', source: 'ichiran' },
  '異體字（第一批異體字整理表・1988年废止）': { kind: 'variant', source: 'ichiran' },
  '異體字（第一批異體字整理表・1993年废止）': { kind: 'variant', source: 'ichiran' },
  '異體字（第一批異體字整理表・1997年废止）': { kind: 'variant', source: 'ichiran' },
  '異體字（常用漢字表）': { kind: 'variant', source: 'joyo' },
  '異體字（人名用漢字・別表１）': { kind: 'variant', source: 'jinmei' },
  '異體字（人名用漢字・別表２）': { kind: 'variant', source: 'jinmei' },
  '異體字（原規格分離）': { kind: 'variant', source: 'separated' },
  '異體字（数字）': { kind: 'variant', source: 'numerals' },
  '異體簡化字': { kind: 'simplified', source: 'variantSimplified' },
  '簡化字': { kind: 'simplified', source: 'simplified' },
  '繁體字': { kind: 'simplified', source: 'simplified' },
  '簡體字（漢語大字典）': { kind: 'variant', source: 'hydzdSimplified' },
  '繁簡關係': { kind: 'variant', source: 'tradSimp' },
  '大正大藏經': { kind: 'variant', source: 'taisho' },
  '疑難字考釋與研究': { kind: 'variant', source: 'yinan' },
  '疑難字續考': { kind: 'variant', source: 'yinanXu' },
  '漢語俗字叢考': { kind: 'variant', source: 'suziCong' },
  '漢語俗字新考': { kind: 'variant', source: 'suziXin' },
  '字典考正': { kind: 'variant', source: 'zidianKaozheng' },
  '龍龕手鏡研究': { kind: 'variant', source: 'longkan' },
  '可洪音義研究': { kind: 'variant', source: 'kehong' },
  '漢越語研究': { kind: 'variant', source: 'hanyue' },
  '中華字海': { kind: 'variant', source: 'zhonghua' },
  '康熙字典': { kind: 'variant', source: 'kangxi' },
  '集韻': { kind: 'variant', source: 'jiyun' },
  '天原發微': { kind: 'variant', source: 'tianyuan' },
  '俗字': { kind: 'variant', source: 'suzi' },
  '擴張新舊': { kind: 'variant', source: 'kakucho' },
  '擴張新字體': { kind: 'variant', source: 'kakucho' },
  '5200号通達': { kind: 'variant', source: 'notice5200' },
  '簡易慣用字體（表外漢字字體表）': { kind: 'variant', source: 'hyogai' },

  'その他': { drop: 'residual class; states no relation' },
  'その他　': { drop: 'residual class; states no relation' },
  'ユーザー': { drop: 'user-added; states no relation' },
  '關連字（その他）': { drop: 'only "related"; the relation is not stated' },
  '關連字（JIS X 0212）': { drop: 'only "related"; the relation is not stated' },
  'UCS互換': { drop: 'Unicode compatibility mapping, already read from UnicodeData' },
  'UCS重複': { drop: 'code point bookkeeping' },
  'UCS類似': { drop: 'code point bookkeeping' },
  'IVD重複': { drop: 'code point bookkeeping' },
  '重複漢字': { drop: 'code point bookkeeping' },
  '同型異字': { drop: 'same shape, different characters' },
  '同字形': { drop: 'same shape, different characters' },
  '擬似簡化字': { drop: 'resembles a simplified form without being one' },
  '古壯字字典': { drop: 'Zhuang characters; a correspondence, not a variant' },
  '韓國人名': { drop: 'membership in a name list; states no relation' },
  '同音の書き換え字': { drop: 'a same-sound replacement, not a variant' },
  '広東語': { drop: 'dialect usage tag' },
  '漢文': { drop: 'usage tag' },
  '支那漢': { drop: 'usage tag' },
  '偏旁': { drop: 'component forms, not characters' },
  '隸變部件': { drop: 'component forms, not characters' },
  '康熙部首（非漢字）': { drop: 'not a character relation' },
  '部首（非漢字）': { drop: 'not a character relation' },
  '杭州数字（非漢字）': { drop: 'not a character relation' },
  '◯囲み': { drop: 'enclosed form' },
  '□囲み': { drop: 'enclosed form' },
  'カッコ付き': { drop: 'enclosed form' },
  '括弧付き': { drop: 'enclosed form' },
  'カタカナ': { drop: 'shape tag' },
  'ボポモフォ': { drop: 'shape tag' },
  '筆画文字': { drop: 'shape tag' },
  '繁簡關係(二簡字)': { drop: 'second simplification scheme, withdrawn' },
  '繁簡關係(二簡字、蚯蚓)': { drop: 'second simplification scheme, withdrawn' },
  '繁簡關係(二簡字、咔叽)': { drop: 'second simplification scheme, withdrawn' },
  '繁簡關係(二簡字、哔叽)': { drop: 'second simplification scheme, withdrawn' },
  '繁簡關係(二簡字、霹雳)': { drop: 'second simplification scheme, withdrawn' },
  '繁簡關係(二簡字、枓栱)': { drop: 'second simplification scheme, withdrawn' },
  '繁簡關係(二簡字、蝌蚪)': { drop: 'second simplification scheme, withdrawn' },
  '繁簡關係(二簡字、曚昽)': { drop: 'second simplification scheme, withdrawn' },
  '繁簡關係(二簡字、朦胧)': { drop: 'second simplification scheme, withdrawn' },
  '繁簡關係(二簡字、蒙眬)': { drop: 'second simplification scheme, withdrawn' },
  '繁簡關係(二簡字、柠檬)': { drop: 'second simplification scheme, withdrawn' },
}

const REVERSE = '←'

/** @param {string} tag @returns {{ reverse: boolean, name: string }} */
export function splitTag(tag) {
  const reverse = tag.startsWith(REVERSE)
  return { reverse, name: reverse ? tag.slice(REVERSE.length) : tag }
}

/**
 * One tag as a relation between two characters, in the direction it reads, or null for a tag that
 * is dropped. For `simplified` the pair is (traditional, simplified); 繁體字 states the same pair as
 * 簡化字 seen from the other side, and a `←` tag is read from the second character.
 * @param {string} tag @param {string} head @param {string} other
 * @returns {{ kind: Kind, source: string, from: string, to: string } | null}
 */
export function readTag(tag, head, other) {
  const { reverse, name } = splitTag(tag)
  const rule = TAGS[name]
  if (!rule) throw new Error(`unclassified tag: ${tag}`)
  if ('drop' in rule) return null
  // 簡化字 on (head, other): other is the simplified form. 繁體字: other is the traditional form.
  const otherFirst = name === '繁體字' ? !reverse : reverse
  const [from, to] = otherFirst ? [other, head] : [head, other]
  return { kind: rule.kind, source: rule.source, from, to }
}

/** @param {string} text a field written `字(U+XXXX)` @returns {string | null} */
export function charOf(text) {
  const match = /\(U\+([0-9A-F]{4,6})\)$/.exec(text)
  if (!match) return null
  const char = String.fromCodePoint(parseInt(match[1], 16))
  return isEncodedGlyph(char) ? char : null
}

/**
 * The pairs the database states, one per (from, to, kind), with the sources that state it.
 * @param {string} csv @returns {Map<string, { kind: Kind, from: string, to: string, sources: Set<string> }>}
 */
export function readTable(csv) {
  /** @type {Map<string, { kind: Kind, from: string, to: string, sources: Set<string> }>} */
  const pairs = new Map()
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).slice(1)
  for (const line of lines) {
    if (!line) continue
    const cells = line.split(',')
    if (cells.length !== 5) throw new Error(`bad row: ${line}`)
    const head = charOf(cells[2])
    const other = charOf(cells[3])
    if (!head || !other || head === other || !cells[4]) continue
    for (const tag of cells[4].split('|')) {
      const relation = readTag(tag, head, other)
      if (!relation) continue
      // A variant has no direction to show; store it with the smaller code point first.
      const [from, to] = relation.kind === 'variant' && (relation.from.codePointAt(0) ?? 0) > (relation.to.codePointAt(0) ?? 0)
        ? [relation.to, relation.from] : [relation.from, relation.to]
      const key = `${relation.kind} ${from} ${to}`
      const row = pairs.get(key) ?? { kind: relation.kind, from, to, sources: new Set() }
      row.sources.add(relation.source)
      pairs.set(key, row)
    }
  }
  return pairs
}

/** 新华字典's headwords with the forms it prints after them. @param {string} text @returns {{ head: string, forms: string[] }[]} */
export function readXinhua(text) {
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    const match = /^(.)（(.+)）$/u.exec(line.trim())
    if (!match || !isEncodedGlyph(match[1])) continue
    const forms = [...match[2]].filter(glyph => glyph !== match[1] && isEncodedGlyph(glyph))
    if (forms.length) rows.push({ head: match[1], forms })
  }
  return rows
}

/**
 * The compact form the browser reads: for each character a string of entries separated by spaces,
 * each the other character, a relation letter (`v` variant, `s` the other is its simplified form,
 * `t` the other is its traditional form) and the source codes.
 * @param {Map<string, { kind: Kind, from: string, to: string, sources: Set<string> }>} pairs
 */
export function compact(pairs) {
  /** @type {Map<string, { to: string, rel: string, sources: string[] }[]>} */
  const byChar = new Map()
  /** @param {string} char @param {string} to @param {string} rel @param {Set<string>} sources */
  const put = (char, to, rel, sources) => {
    const list = byChar.get(char) ?? []
    list.push({ to, rel, sources: [...sources].map(id => SOURCES[/** @type {keyof typeof SOURCES} */ (id)].code).sort() })
    byChar.set(char, list)
  }
  for (const { kind, from, to, sources } of pairs.values()) {
    if (kind === 'variant') {
      put(from, to, 'v', sources)
      put(to, from, 'v', sources)
    } else {
      put(from, to, 's', sources)
      put(to, from, 't', sources)
    }
  }
  /** @type {Record<string, string>} */
  const character = {}
  for (const char of [...byChar.keys()].sort((a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))) {
    const list = /** @type {NonNullable<ReturnType<typeof byChar.get>>} */ (byChar.get(char))
    list.sort((a, b) => b.sources.length - a.sources.length || (a.to.codePointAt(0) ?? 0) - (b.to.codePointAt(0) ?? 0))
    character[char] = list.map(row => row.to + row.rel + row.sources.join('')).join(' ')
  }
  return character
}

/** Counts of each tag in a table, for the tag table in the notes. @param {string} csv */
export function countTags(csv) {
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const line of csv.replace(/^﻿/, '').split(/\r?\n/).slice(1)) {
    const tags = line.split(',')[4]
    if (!tags) continue
    for (const tag of tags.split('|')) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return counts
}

/** @param {{ file: string, sha256: string }} input */
function readPinned(input) {
  const path = join(CACHE, input.file)
  if (sha256(path) !== input.sha256) throw new Error(`${input.file}: digest differs from the pinned one`)
  return readFileSync(path, 'utf8')
}

function main() {
  const csv = readPinned(TABLE)
  const pairs = readTable(csv)
  for (const { head, forms } of readXinhua(readPinned(XINHUA))) {
    for (const form of forms) {
      const [from, to] = (head.codePointAt(0) ?? 0) < (form.codePointAt(0) ?? 0) ? [head, form] : [form, head]
      const key = `variant ${from} ${to}`
      const row = pairs.get(key) ?? { kind: /** @type {Kind} */ ('variant'), from, to, sources: new Set() }
      row.sources.add('xinhua12')
      pairs.set(key, row)
    }
  }
  const character = compact(pairs)
  const data = {
    sources: [TABLE, XINHUA].map(({ file: _file, ...rest }) => rest),
    codes: Object.fromEntries(Object.entries(SOURCES).map(([id, { code }]) => [code, id])),
    labels: Object.fromEntries(Object.entries(SOURCES).map(([id, { label }]) => [id, label])),
    character,
  }
  writeFileSync(join(import.meta.dirname, '..', 'data', 'sourced-variants.json'), JSON.stringify(data) + '\n')
  const dropped = [...countTags(csv)].filter(([tag]) => 'drop' in (TAGS[splitTag(tag).name] ?? {}))
  console.log(`${pairs.size} pairs, ${Object.keys(character).length} characters; ${dropped.length} tags dropped`)
}

if (import.meta.main) main()
