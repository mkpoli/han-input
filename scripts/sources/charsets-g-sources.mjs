// Unihan's kIRG_GSource names publications and lists, not encodings. These sets make the
// publication-level codes browsable: a member is an assigned character whose value carries
// the code. The GZA titles follow UAX #38's serial split (GZA-[123467]\d{5}).
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { membersText } from '../charset-members.mjs'
import { codeText } from '../charset-codes.mjs'

/** @typedef {{ key: string, id: string, label: string, en: string, zh: string, note: string }} GSourceSet */

/** @type {GSourceSet[]} */
export const G_SOURCE_SETS = [
  {
    key: 'GDM',
    id: 'g_src_gdm',
    label: 'GDM',
    en: 'Place-name characters, Ministry of Public Security',
    zh: '中華人民共和國公安部治安管理局地名漢字',
    note: 'Place-name characters from the Public Order Administration, Ministry of Public Security; GDM- plus a five-digit serial.',
  },
  {
    key: 'GHC',
    id: 'g_src_ghc',
    label: 'GHC',
    en: 'Hanyu Dacidian',
    zh: '漢語大詞典',
    note: 'Hanyu Dacidian, Shanghai Lexicographical Publishing House, 1986; GHC- plus a seven-digit serial.',
  },
  {
    key: 'GKJ',
    id: 'g_src_gkj',
    label: 'GKJ',
    en: 'Terms in sciences and technologies',
    zh: '全國科學技術名詞審定委員會術語定名用字',
    note: 'Terms approved by the China National Committee for Terms in Sciences and Technologies; GKJ- plus a five-digit serial.',
  },
  {
    key: 'GLGYJ',
    id: 'g_src_glgyj',
    label: 'GLGYJ',
    en: 'Zhuang Liao Songs Research',
    zh: '壯族嘹歌研究',
    note: 'Zhuang Liao Songs Research, Guangxi Nationalities Publishing House, 2008; GLGYJ- plus a four-digit serial.',
  },
  {
    key: 'GPGLG',
    id: 'g_src_gpglg',
    label: 'GPGLG',
    en: 'Pingguo County Liao Songs',
    zh: '壯族民歌文化叢書•平果嘹歌',
    note: 'Zhuang Folk Song Culture Series: Pingguo County Liao Songs, 2004–2006; GPGLG- plus a four-digit serial.',
  },
  {
    key: 'GXM',
    id: 'g_src_gxm',
    label: 'GXM',
    en: 'Personal-name characters',
    zh: '中華人民共和國人名用字',
    note: 'Personal-name characters from the Public Order Administration, Ministry of Public Security; GXM- plus a five-digit serial.',
  },
  {
    key: 'GZ',
    id: 'g_src_gz',
    label: 'GZ·U',
    en: 'Ancient Zhuang Character Dictionary (encoded source)',
    zh: '古壯字字典（Unihan G 源）',
    note: 'Ancient Zhuang Character Dictionary, 1989; GZ- plus a seven-digit serial. The gz set is the broader 字統 snapshot of the same dictionary, including unencoded rows.',
  },
  {
    key: 'GZA-1',
    id: 'g_src_gza_1',
    label: 'GZA-1',
    en: 'Filial Piety and Zhuang Funeral Songs',
    zh: '生生不息的傳承•孝與壯族行孝歌之研究',
    note: 'GZA- values whose six-digit serial begins 1; the book is A Vibrant and Unbroken Transmission—Filial Piety and Zhuang Funeral Songs (2010).',
  },
  {
    key: 'GZA-2',
    id: 'g_src_gza_2',
    label: 'GZA-2',
    en: 'Annotated Long Zhuang Morality Songs',
    zh: '壯族倫理道德長詩傳揚歌譯注',
    note: 'GZA- values whose six-digit serial begins 2; the book is Annotated Long Zhuang Morality Songs (2005).',
  },
  {
    key: 'GZA-3',
    id: 'g_src_gza_3',
    label: 'GZA-3',
    en: 'Old Zhuang Folksong Texts: Wooing Songs I',
    zh: '壯族民歌古籍集成•情歌（一）嘹歌',
    note: 'GZA- values whose six-digit serial begins 3; the book is Compendium of Old Zhuang Folksong Texts—Wooing Songs vol. 1—Liao Songs (1993).',
  },
  {
    key: 'GZA-4',
    id: 'g_src_gza_4',
    label: 'GZA-4',
    en: 'Old Zhuang Folksong Texts: Wooing Songs II',
    zh: '壯族民歌古籍集成•情歌（二）歡𭪤',
    note: 'GZA- values whose six-digit serial begins 4; the book is Compendium of Old Zhuang Folksong Texts—Wooing Songs vol. 2—Fwen Nganx (1997).',
  },
  {
    key: 'GZA-6',
    id: 'g_src_gza_6',
    label: 'GZA-6',
    en: 'Zhuang Proverbs from China',
    zh: '中國壯族諺語',
    note: 'GZA- values whose six-digit serial begins 6; the book is Zhuang Proverbs from China (2015).',
  },
  {
    key: 'GZA-7',
    id: 'g_src_gza_7',
    label: 'GZA-7',
    en: 'Zhuang Creation Myth Songs',
    zh: '遠古的追憶•壯族創世神話古歌研究',
    note: 'GZA- values whose six-digit serial begins 7; the book is Ancient Remembrance—Zhuang Creation Myth Songs (2012).',
  },
]

/** The serial pattern for each code. GZA keeps the first serial digit in the set key. */
/** @type {[string, RegExp][]} */
const PATTERNS = [
  ['GDM', /^GDM-\d{5}$/],
  ['GHC', /^GHC-\d{7}$/],
  ['GKJ', /^GKJ-\d{5}$/],
  ['GLGYJ', /^GLGYJ-\d{4}$/],
  ['GPGLG', /^GPGLG-\d{4}$/],
  ['GXM', /^GXM-\d{5}$/],
  ['GZ', /^GZ-\d{7}$/],
  ['GZA', /^GZA-([123467])\d{5}$/],
]

/** The set a value belongs to, or null for another G source or a malformed serial.
 * @param {string} code
 * @returns {string | null} */
export function gSourceKey(code) {
  for (const [base, pattern] of PATTERNS) {
    const match = pattern.exec(code)
    if (!match) continue
    return base === 'GZA' ? `GZA-${match[1]}` : base
  }
  return null
}

/** Every target source's characters, in Unihan code-point order.
 * @param {string} text Unihan_IRGSources.txt
 * @returns {Map<string, { char: string, code: string }[]>} */
export function gSourceRows(text) {
  /** @type {Map<string, { char: string, code: string }[]>} */
  const rows = new Map(G_SOURCE_SETS.map(set => [set.key, []]))
  for (const line of text.split('\n')) {
    if (!line.startsWith('U+')) continue
    const [hex, field, value] = line.split('\t')
    if (field !== 'kIRG_GSource' || !value) continue
    const char = String.fromCodePoint(parseInt(hex.slice(2), 16))
    for (const code of value.split(/\s+/)) {
      const key = gSourceKey(code)
      const list = key ? rows.get(key) : null
      if (list) list.push({ char, code })
    }
  }
  return rows
}

/** Write each source set and append its catalogue entry. The caller owns index.json so a full
 * build and the standalone refresh share this one implementation.
 * @param {any[]} catalogue
 * @param {string} text Unihan_IRGSources.txt
 * @param {string} out the public charsets directory
 * @param {(text: string) => string} hans
 * @returns {any[]} the appended entries
 */
export function writeGSourceSets(catalogue, text, out, hans) {
  const byKey = gSourceRows(text)
  /** @type {any[]} */
  const added = []
  for (const set of G_SOURCE_SETS) {
    const rows = byKey.get(set.key)
    if (!rows?.length) throw new Error(`Empty G source ${set.key}`)
    /** @type {Map<string, string>} */
    const coded = new Map()
    for (const row of rows) if (!coded.has(row.char)) coded.set(row.char, row.code)
    const members = [...coded.keys()]
    writeFileSync(join(out, `${set.id}.txt`), membersText(members))
    writeFileSync(join(out, `${set.id}.codes.tsv`), codeText([...coded].map(([char, code]) => ({ char, code }))))
    const entry = {
      id: set.id, group: 'G', label: set.label,
      names: { en: set.en, zh: set.zh, hans: hans(set.zh) },
      chars: members.length, total: members.length, encoded: members.length, unencoded: 0,
      codes: `/charsets/${set.id}.codes.tsv`,
      source: { name: 'Unihan 18.0.0', url: 'https://www.unicode.org/reports/tr38/#kIRG_GSource', note: set.note },
      columns: 10,
    }
    catalogue.push(entry)
    added.push(entry)
  }
  return added
}

