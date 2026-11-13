// Characters a single doculect coined or gave its own use, one set per doculect. A set takes only a
// source's dialect-specific tier: the 全國漢語方言用字總表 strict list (嚴式方言字) for the Chinese
// varieties, and the kokuji and gukja lists for Japanese and Korean. Its broad tier (寬式), which
// lends ordinary characters a dialect sense, stays out. A row described only by an IDS is a record.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { membersText } from '../charset-members.mjs'

export const DIALECT_GROUP = 'Dialect characters'

/** @typedef {{ char: string, ids: string | null, group: string[], cities: string[] }} Row */
/** @typedef {{ id: string, label: string, en: string, zh: string, ja: string, ko: string, source: 'fangyanzi' | 'kokuji' | 'gukja', keep: (row: Row) => boolean, note?: string }} DialectSet */

const inGroup = (/** @type {string} */ group) => (/** @type {Row} */ row) => row.group.includes(group)
const readAt = (/** @type {string[]} */ cities) => (/** @type {Row} */ row) => row.group.includes('閩') && row.cities.some(city => cities.includes(city))

/** @type {DialectSet[]} */
export const DIALECT_SETS = [
  { id: 'dialect_guan', label: '官話', en: 'Mandarin', zh: '官話方言字', ja: '官話の方言字', ko: '관화 방언자', source: 'fangyanzi', keep: inGroup('官') },
  { id: 'dialect_jin', label: '晉語', en: 'Jin', zh: '晉語方言字', ja: '晋語の方言字', ko: '진어 방언자', source: 'fangyanzi', keep: inGroup('晉') },
  { id: 'dialect_wu', label: '吳語', en: 'Wu', zh: '吳語方言字', ja: '呉語の方言字', ko: '오어 방언자', source: 'fangyanzi', keep: inGroup('吳') },
  { id: 'dialect_hui', label: '徽語', en: 'Huizhou', zh: '徽語方言字', ja: '徽語の方言字', ko: '휘어 방언자', source: 'fangyanzi', keep: inGroup('徽') },
  { id: 'dialect_gan', label: '贛語', en: 'Gan', zh: '贛語方言字', ja: '贛語の方言字', ko: '감어 방언자', source: 'fangyanzi', keep: inGroup('贛') },
  { id: 'dialect_xiang', label: '湘語', en: 'Xiang', zh: '湘語方言字', ja: '湘語の方言字', ko: '상어 방언자', source: 'fangyanzi', keep: inGroup('湘') },
  { id: 'dialect_hakka', label: '客家話', en: 'Hakka', zh: '客家話方言字', ja: '客家語の方言字', ko: '객가어 방언자', source: 'fangyanzi', keep: inGroup('客') },
  { id: 'dialect_yue', label: '粵語', en: 'Cantonese', zh: '粵語方言字', ja: '粤語の方言字', ko: '월어 방언자', source: 'fangyanzi', keep: inGroup('粵') },
  { id: 'dialect_min', label: '閩語', en: 'Min', zh: '閩語方言字', ja: '閩語の方言字', ko: '민어 방언자', source: 'fangyanzi', keep: inGroup('閩') },
  { id: 'dialect_min_dong', label: '閩東語', en: 'Eastern Min', zh: '閩東語方言字', ja: '閩東語の方言字', ko: '민동어 방언자', source: 'fangyanzi', keep: readAt(['福州', '古田']),
    note: 'Min rows read at Fuzhou or Gutian.' },
  { id: 'dialect_min_nan', label: '閩南語', en: 'Southern Min', zh: '閩南語方言字', ja: '閩南語の方言字', ko: '민남어 방언자', source: 'fangyanzi', keep: readAt(['廈門', '漳州', '漳平']),
    note: 'Min rows read at Xiamen, Zhangzhou or Zhangping.' },
  { id: 'dialect_ping', label: '平話', en: 'Pinghua', zh: '平話方言字', ja: '平話の方言字', ko: '평화 방언자', source: 'fangyanzi', keep: inGroup('平') },
  { id: 'dialect_kokuji', label: '日本國字', en: 'Japanese kokuji', zh: '日本國字', ja: '国字', ko: '일본 국자', source: 'kokuji', keep: () => true },
  { id: 'dialect_gukja', label: '朝鮮國字', en: 'Korean gukja', zh: '朝鮮國字', ja: '朝鮮の国字', ko: '국자', source: 'gukja', keep: () => true },
]

/** The strict tier of the 全國漢語方言用字總表, one row per entry. The transcription spells one
 * group label in simplified form; it is folded into the traditional label the rest use.
 * @param {unknown} json fangyanzi.json
 * @returns {Row[]} */
export function fangyanziRows(json) {
  if (!Array.isArray(json)) throw new Error('fangyanzi.json is not an array')
  return json.filter(entry => entry.type === '嚴式').map(entry => ({
    char: entry.char ?? '',
    ids: entry.ids ?? null,
    group: entry.group.map((/** @type {string} */ group) => group === '吴' ? '吳' : group),
    cities: Object.keys(entry.pinyin ?? {}),
  }))
}

/** The rows of one open-IDS group: the character, or its IDS when it has no code point.
 * @param {string} tsv descriptions.tsv
 * @param {string} group
 * @returns {Row[]} */
export function openIdsRows(tsv, group) {
  const [head, ...lines] = tsv.trimEnd().split('\n')
  const columns = head.split('\t')
  const at = (/** @type {string} */ name) => columns.indexOf(name)
  return lines.map(line => line.split('\t')).filter(cells => cells[at('group')] === group).map(cells => ({
    char: cells[at('char')] ?? '',
    ids: cells[at('ids')] || null,
    group: [],
    cities: [],
  }))
}

/** @type {Record<DialectSet['source'], { name: string, url: string, licence?: string, note: string }>} */
export const DIALECT_SOURCES = {
  fangyanzi: {
    name: '全國漢語方言用字總表',
    url: 'https://github.com/ambar/fangyanzi',
    licence: 'https://github.com/ambar/fangyanzi/blob/760a0a2de3e02bb902807372556cedaef9d117f0/LICENSE',
    note: 'The 嚴式方言字 list, as transcribed by ambar/fangyanzi; its publisher and date are unverified.',
  },
  kokuji: {
    name: 'IDS Workshop open IDS',
    url: 'https://github.com/mkpoli/ids-input/tree/a35965b21260748d9eb0bdf21a6c3246b015b163/data/open-data',
    licence: 'https://creativecommons.org/publicdomain/zero/1.0/',
    note: 'From the sljfaq.org kokuji list and English Wikipedia’s Kokuji.',
  },
  gukja: {
    name: 'IDS Workshop open IDS',
    url: 'https://github.com/mkpoli/ids-input/tree/a35965b21260748d9eb0bdf21a6c3246b015b163/data/open-data',
    licence: 'https://creativecommons.org/publicdomain/zero/1.0/',
    note: 'From Korean Wikipedia’s 국자의 음역자와 구결자.',
  },
}

/** Write each doculect's set and its IDS records, and append the catalogue entries.
 * @param {any[]} catalogue
 * @param {{ fangyanzi: unknown, openIds: string }} inputs
 * @param {string} out the public charsets directory
 * @param {(text: string) => string} hans
 * @returns {any[]} the appended entries */
export function writeDialectSets(catalogue, inputs, out, hans) {
  /** @type {Record<DialectSet['source'], Row[]>} */
  const rows = {
    fangyanzi: fangyanziRows(inputs.fangyanzi),
    kokuji: openIdsRows(inputs.openIds, 'kokuji'),
    gukja: openIdsRows(inputs.openIds, 'korean'),
  }
  /** @type {any[]} */
  const added = []
  for (const set of DIALECT_SETS) {
    const kept = rows[set.source].filter(set.keep)
    const members = [...new Set(kept.filter(row => row.char).map(row => row.char))]
    const described = [...new Set(kept.filter(row => !row.char && row.ids).map(row => /** @type {string} */ (row.ids)))]
    if (!members.length) throw new Error(`Empty dialect set ${set.id}`)
    writeFileSync(join(out, `${set.id}.txt`), membersText(members))
    let records
    if (described.length) {
      const file = `${set.id}.ids.json`
      writeFileSync(join(out, file), JSON.stringify({
        title: `${set.label} IDS descriptions`, complete: true,
        scope: 'Rows whose only glyph is an Ideographic Description Sequence; no Unicode scalar is assigned.',
        documents: [], records: described.map(source => ({ document: 'ids', source, kind: 'ids' })),
      }) + '\n')
      records = { file: `/charsets/${file}`, count: described.length, glyphs: 0 }
    }
    const source = DIALECT_SOURCES[set.source]
    const entry = {
      id: set.id, group: DIALECT_GROUP, label: set.label,
      names: { en: set.en, zh: set.zh, hans: hans(set.zh), ja: set.ja, ko: set.ko },
      chars: members.length, total: members.length + described.length, encoded: members.length, unencoded: described.length,
      ...(records ? { records, recordsNote: false } : {}),
      source: { ...source, note: set.note ? `${source.note} ${set.note}` : source.note },
      columns: 10,
    }
    catalogue.push(entry)
    added.push(entry)
  }
  return added
}
