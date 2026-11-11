// Refresh the pinned, offline character-set catalogue. No browser-time requests to source sites.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fetchOnce } from './lib.mjs'
import { mappedMembers, membersText, iwdsMembers, idsRecords, columnsOf } from './charset-members.mjs'
import { cnsRowCodes, codeText, evidenceCodes, proposalCodes, rowCodes } from './charset-codes.mjs'
import * as OpenCC from 'opencc-js'
import { readCnsSourceSets } from './sources/charsets-cns.mjs'
import { writeGSourceSets } from './sources/charsets-g-sources.mjs'
import { GB12052, GB12052_UNENCODED, gb12052Members, gb12052Rows } from './sources/charsets-gb12052.mjs'
import { ziSourcePage } from './sources/zi-page.mjs'

const BASE = 'https://zi.tools/api/ma/ma/'
const OUT = join(import.meta.dirname, '../app/public/charsets')
mkdirSync(OUT, { recursive: true })
const hans = OpenCC.Converter({ from: 'tw', to: 'cn' })
const hant = OpenCC.Converter({ from: 'cn', to: 'tw' })
/** @type {{url:string,sha256:string}[]} */
const inputs = []
const lockPath = join(OUT, 'sources.json')
const locked = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')).inputs : []
/** @param {string} url @param {Buffer} bytes */
function record(url, bytes) {
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const previous = locked.find((/** @type {{url:string,sha256:string}} */ item) => item.url === url)
  if (previous && previous.sha256 !== sha256) throw new Error(`Source digest changed: ${url}`)
  inputs.push({ url, sha256 })
}
/** @param {string} url */
async function get(url) {
  const bytes = readFileSync(await fetchOnce(url))
  record(url, bytes)
  return JSON.parse(bytes.toString('utf8'))
}
// GB/T 12052-1989 is a standard's own 94×94 table, not a 字統 catalogue of Han rows: the set
// lists every printed character, so it comes from the pinned transcription rather than zi.tools.
// The 字統 payload still supplies the two 吏讀字 rows whose printed glyph has no scalar.
const gbBytes = readFileSync(await fetchOnce(GB12052.url, GB12052.as))
record(GB12052.url, gbBytes)
const gbRows = gb12052Rows(gbBytes.toString('utf8'))
// A 字統 metadata row names a standard; where the standard holds more than the mapped rows,
// the set's note says what this set covers. The note text lives in messages/*.json under
// charset.scope.gk so readers in each locale see it in their language.
/** @type {Record<string, string>} */
const SET_NOTE_KEYS = {
  gk: 'charset.scope.gk',
}

const metadata = await get(`${BASE}metadata.json`)
if (!Array.isArray(metadata.meta) || !metadata.meta.length) throw new Error('Empty catalogue')
const ids = new Set()
for (const entry of metadata.meta) {
  if (!/^[a-z0-9_]+$/.test(entry.id) || ids.has(entry.id)) throw new Error(`Invalid set id: ${entry.id}`)
  ids.add(entry.id)
}
// 字統 marks its document registries hidden and serves no rows for them; a character-set
// catalogue lists sets, so those entries are left out.
const entries = metadata.meta.filter((/** @type {any} */ entry) => !entry.hidden)
/** @type {any[]} */
const catalogue = new Array(entries.length)
let next = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < entries.length) {
    const i = next++
    const entry = entries[i]
    const url = `${BASE}${entry.id}.json`
    const payload = await get(url)
    if (!Array.isArray(payload.rows)) throw new Error(`Missing rows: ${entry.id}`)
    const { members, total, encoded, unencoded } = mappedMembers(payload)
    const ids = idsRecords(payload)
    // GB 12052's two 吏讀字 rows whose printed glyph is an IDS carry no scalar, so they stay records.
    const unencodedCodes = new Set(GB12052_UNENCODED)
    const table = entry.id === 'gk' ? gb12052Members(gbRows, unencodedCodes) : null
    writeFileSync(join(OUT, `${entry.id}.txt`), membersText(table ? table.members : members))
    // A row whose glyph is not a member (an IDS or a variation sequence) carries no member code.
    const coded = table ? table.codes : rowCodes(payload.rows, entry, members)
    let codes
    if (coded.length) {
      writeFileSync(join(OUT, `${entry.id}.codes.tsv`), codeText(coded))
      codes = `/charsets/${entry.id}.codes.tsv`
    }
    let records
    if (ids.length) {
      writeFileSync(join(OUT, `${entry.id}.ids.json`), JSON.stringify({
        title: `${entry.abbr} IDS descriptions`,
        complete: true,
        scope: 'Rows whose only glyph is an Ideographic Description Sequence; no Unicode scalar is assigned.',
        documents: [],
        records: ids.map(source => ({ document: 'ids', source, kind: 'ids' })),
      }) + '\n')
      records = { file: `/charsets/${entry.id}.ids.json`, count: ids.length, glyphs: 0 }
    }
    const noteKey = SET_NOTE_KEYS[entry.id]
    const names = { en: entry.name_en || entry.abbr, zh: hant(entry.name_zh || entry.abbr), hans: hans(entry.name_zh || entry.abbr) }
    catalogue[i] = table
      ? {
          id: entry.id, group: entry.source, label: entry.abbr, names,
          chars: table.members.length, total: gbRows.length, encoded: table.members.length, unencoded: unencodedCodes.size,
          // The standard's table is 94 rows of 94 cells; every printed row fills one cell.
          positions: { total: 94 * 94, filled: gbRows.length, mapped: gbRows.length - unencodedCodes.size },
          codes, records,
          source: { name: 'GB/T 12052-1989', url: 'https://archive.org/details/GB-T12052-1989', noteKey },
          columns: columnsOf(entry.index),
        }
      : {
          id: entry.id, group: entry.source, label: entry.abbr, names,
          chars: [...members].length, total, encoded, unencoded, codes, records,
          source: noteKey
            ? { name: '字統網', url: ziSourcePage(entry), dataUrl: url, noteKey }
            : { name: '字統網', url: ziSourcePage(entry), dataUrl: url },
          columns: columnsOf(entry.index),
        }
    console.log(`${entry.id}: ${table ? table.members.length : [...members].length} characters / ${table ? gbRows.length : total} rows`)
  }
}))
const iwdsUrl = 'https://raw.githubusercontent.com/yi-bai/iwds/master/iwds.xml'
const iwdsBytes = readFileSync(await fetchOnce(iwdsUrl))
record(iwdsUrl, iwdsBytes)
const iwds = iwdsMembers(iwdsBytes.toString('utf8'))
writeFileSync(join(OUT, 'iwds.txt'), membersText(iwds.members))
writeFileSync(join(OUT, 'iwds-evidence.json'), JSON.stringify(iwds.evidence) + '\n')
writeFileSync(join(OUT, 'iwds.codes.tsv'), codeText(evidenceCodes(iwds.evidence, iwds.members)))
catalogue.push({ id: 'iwds', group: 'Unicode', label: 'IWDS', names: { en: 'IWDS · encoded examples', zh: 'IWDS·已編碼例字', hans: 'IWDS·已编码例字' }, chars: [...iwds.members].length, total: iwds.total, encoded: iwds.encoded, unencoded: iwds.unencoded, codes: '/charsets/iwds.codes.tsv', source: { name: 'yi-bai/iwds', url: iwdsUrl }, columns: 10 })

// Literal block membership also covers the site's kana and Nüshu, and keeps compatibility scalars.
const ucdUrl = 'https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt'
const ucdBytes = readFileSync(await fetchOnce(ucdUrl))
record(ucdUrl, ucdBytes)
const assigned = new Set()
let first = 0
for (const line of ucdBytes.toString('utf8').split('\n')) {
  if (!line) continue
  const [hex, name] = line.split(';')
  const cp = parseInt(hex, 16)
  if (name.endsWith(', First>')) first = cp
  else if (name.endsWith(', Last>')) { for (let i = first; i <= cp; i++) assigned.add(i) }
  else assigned.add(cp)
}
const blocksUrl = 'https://www.unicode.org/Public/18.0.0/ucd/Blocks.txt'
const blocksBytes = readFileSync(await fetchOnce(blocksUrl))
record(blocksUrl, blocksBytes)
/** The designed size of every block, by its Unicode name. @type {Map<string, number>} */
const blockSizes = new Map()
for (const line of blocksBytes.toString('utf8').split('\n')) {
  const match = line.match(/^([0-9A-F]+)\.\.([0-9A-F]+); (.+)$/)
  if (match) blockSizes.set(match[3], parseInt(match[2], 16) - parseInt(match[1], 16) + 1)
}
// The version that first assigned each code point, for the block version breakdown.
const ageUrl = 'https://www.unicode.org/Public/18.0.0/ucd/DerivedAge.txt'
const ageBytes = readFileSync(await fetchOnce(ageUrl))
record(ageUrl, ageBytes)
/** @type {[number, number, string][]} */
const ageRanges = []
for (const line of ageBytes.toString('utf8').split('\n')) {
  const match = line.split('#')[0].trim().match(/^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*;\s*([0-9.]+)$/)
  if (match) ageRanges.push([parseInt(match[1], 16), parseInt(match[2] ?? match[1], 16), match[3]])
}
writeFileSync(join(OUT, 'unicode-age.json'), JSON.stringify({ version: '18.0.0', source: ageUrl, ranges: ageRanges.sort((a, b) => a[0] - b[0]) }) + '\n')
for (const line of blocksBytes.toString('utf8').split('\n')) {
  const match = line.match(/^([0-9A-F]+)\.\.([0-9A-F]+); (.+)$/)
  if (!match || !/^(?:CJK Radicals Supplement|Kangxi Radicals|CJK Strokes|CJK Compatibility Ideographs(?: Supplement)?|Hiragana|Katakana(?: Phonetic Extensions)?|Kana (?:Extended-[AB]|Supplement)|Small Kana Extension|Nushu)$/.test(match[3])) continue
  const [, start, end, name] = match
  const total = parseInt(end, 16) - parseInt(start, 16) + 1
  const members = []
  for (let cp = parseInt(start, 16); cp <= parseInt(end, 16); cp++) if (assigned.has(cp)) members.push(String.fromCodePoint(cp))
  const id = `block_${name.toLowerCase().replaceAll(' ', '_').replaceAll('-', '_')}`
  writeFileSync(join(OUT, `${id}.txt`), membersText(members))
  writeFileSync(join(OUT, `${id}.codes.tsv`), codeText(members.map(char => ({ char, code: `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}` }))))
  catalogue.push({ id, group: 'Unicode blocks', label: name, names: { en: name }, chars: members.length, total: members.length, encoded: members.length, unencoded: 0, positions: { total, filled: members.length, mapped: members.length }, codes: `/charsets/${id}.codes.tsv`, source: { name: 'Unicode 18.0.0', url: blocksUrl }, columns: 16 })
}
for (const name of readdirSync(OUT).filter(/** @param {string} name */ name => name.endsWith('_records.json')).sort()) {
  const set = JSON.parse(readFileSync(join(OUT, name), 'utf8'))
  for (const url of new Set([...set.documents.map(/** @param {{url:string}} document */ document => document.url), ...set.records.flatMap(/** @param {{evidenceUrls?:string[]}} record */ record => record.evidenceUrls ?? [])])) {
    if (!inputs.some(input => input.url === url)) record(url, readFileSync(await fetchOnce(url)))
  }
  const members = [...new Set(set.records.filter(/** @param {{mappedUnicode?:string}} record */ record => record.mappedUnicode).map(/** @param {{mappedUnicode:string}} record */ record => String.fromCodePoint(parseInt(record.mappedUnicode.slice(2), 16))))].join('')
  writeFileSync(join(OUT, `${set.id}.txt`), membersText(members))
  const coded = proposalCodes(set.records, members)
  let codes
  if (coded.length) {
    writeFileSync(join(OUT, `${set.id}.codes.tsv`), codeText(coded))
    codes = `/charsets/${set.id}.codes.tsv`
  }
  catalogue.push({
    id: set.id, group: set.group, label: set.label, names: set.names,
    chars: [...members].length, total: set.records.length,
    encoded: [...members].length,
    unencoded: set.records.filter(/** @param {{mappedUnicode?:string}} record */ record => !record.mappedUnicode).length,
    codes,
    records: { file: `/charsets/${name}`, count: set.records.length, glyphs: set.records.filter(/** @param {{glyph?:string}} record */ record => record.glyph).length },
    source: set.source,
    columns: 10,
  })
}
const cns = JSON.parse(readFileSync(join(OUT, 'cns-sources.json'), 'utf8'))
const propertiesPath = await fetchOnce(cns.sourceUrl)
const mappingPath = await fetchOnce(cns.mappingUrl)
record(cns.sourceUrl, readFileSync(propertiesPath))
record(cns.mappingUrl, readFileSync(mappingPath))
const unihanUrl = 'https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip'
const unihanPath = await fetchOnce(unihanUrl, 'Unihan.zip')
record(unihanUrl, readFileSync(unihanPath))
const unihanText = execFileSync('unzip', ['-p', unihanPath, 'Unihan_IRGSources.txt'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
const cnsSets = readCnsSourceSets(propertiesPath, mappingPath, unihanText, assigned)
if (cnsSets.length !== cns.categoryCount || cnsSets.reduce((sum, set) => sum + set.records.length, 0) !== cns.rowCount) throw new Error('CNS catalogue count changed')
for (const set of cnsSets) {
  writeFileSync(join(OUT, `${set.id}.txt`), membersText(set.members))
  const records = `/charsets/${set.id}.tsv`
  const categoryId = cns.verifiedOfficialCategoryIds[set.label]
  const sourceUrl = categoryId ? `https://www.cns11643.gov.tw/searchSY.jsp?ID=${categoryId}` : cns.sourceUrl
  const attribution = '數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw'
  writeFileSync(join(OUT, `${set.id}.tsv`), [
    `# ${set.label}`, `# CNS source release: ${cns.datasetVersion}`, `# ${attribution}`,
    `# Sources: ${cns.sourceUrl} ; ${cns.mappingUrl} ; ${unihanUrl} (Unihan kIRG_TSource)`, `# Licence: ${cns.licenseUrl}`,
    'CNS\tUnicode', ...set.records.map(row => `${row.cns}\t${[...new Set([...(row.crosswalk ? [row.crosswalk] : []), ...row.unicode])].map(hex => `U+${hex}`).join(' ')}`),
  ].join('\n') + '\n')
  writeFileSync(join(OUT, `${set.id}.codes.tsv`), codeText(cnsRowCodes(set.records, set.members)))
  catalogue.push({ id: set.id, group: 'CNS sources', label: set.label, names: { en: set.label, zh: set.label, hans: hans(set.label), ja: set.label, ko: set.label },
    chars: [...set.members].length, total: set.records.length, encoded: set.encoded, unencoded: set.unencoded, codes: `/charsets/${set.id}.codes.tsv`,
    source: { name: 'CNS11643全字庫', url: sourceUrl, records, version: cns.datasetVersion.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'), licence: cns.licenseUrl, attribution },
    columns: 16,
  })
}
writeGSourceSets(catalogue, unihanText, OUT, hans)
// The ebag missing-character glyphs come from GlyphWiki's KAGE data. The records are a snapshot
// made by scripts/import_glyphwiki_ebag.mjs; their sprite sheets are rendered offline.
const ebag = JSON.parse(readFileSync(join(OUT, 'glyphwiki_ebag_records.json'), 'utf8'))
catalogue.push({
  id: 'glyphwiki_ebag', group: 'GlyphWiki', label: 'ebag 缺字',
  names: { en: 'ebag missing glyphs', zh: 'ebag 缺字', hans: 'ebag 缺字', ja: 'ebag 缺字', ko: 'ebag 缺字' },
  chars: 0, total: ebag.records.length, encoded: 0, unencoded: ebag.records.length,
  records: { file: '/charsets/glyphwiki_ebag_records.json', count: ebag.records.length, glyphs: ebag.records.filter(/** @param {{sprite?:unknown}} record */ record => record.sprite).length },
  recordsNote: false,
  source: { name: 'GlyphWiki', url: 'https://glyphwiki.org/', licence: 'Free use, copy and distribution' },
  columns: 10,
})
// The 方正超大字符集 fonts define 633 BMP private-use slots. Only the cmap facts are kept; the font
// files and glyph outlines stay out of the repository.
const fzPua = JSON.parse(readFileSync(join(OUT, 'fz_pua_records.json'), 'utf8'))
catalogue.push({
  id: 'fz_pua', group: 'PUA', label: 'FZ PUA',
  names: { en: 'FZ oversized PUA', zh: '方正超大字符集私用區', hans: '方正超大字符集私用区', ja: '方正超大字符集私用領域', ko: 'FZ 초대형 문자 집합 PUA' },
  chars: 0, total: fzPua.records.length, encoded: 0, unencoded: fzPua.records.length,
  records: { file: '/charsets/fz_pua_records.json', count: fzPua.records.length, glyphs: 0 },
  recordsNote: false,
  source: { name: '方正超大字符集', url: 'https://github.com/xiangrongjingujiu/FangZhengChaoDaZiFuJi', licence: 'Commercial; cmap facts only' },
  columns: 10,
})
// A 字統 set named for a Unicode block is that block's assigned characters; the block's range gives
// the designed positions the coverage dial divides by.
for (const row of catalogue) {
  if (row.group !== 'Unicode' || row.positions || !row.names?.en) continue
  const total = blockSizes.get(row.names.en)
  if (total && row.chars <= total) row.positions = { total, filled: row.chars, mapped: row.chars }
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(catalogue, null, 2) + '\n')
writeFileSync(join(OUT, 'sources.json'), JSON.stringify({
  catalogue: `${BASE}metadata.json`, retrieved: new Date().toISOString().slice(0, 10),
  attribution: '字統網, character-set catalogue and glyph mappings. Editorial mappings; original standards and proposal documents remain authoritative. Reuse terms are unspecified at these endpoints. GB/T 12052-1989 follows Jaemin Chung’s transcription (ecma35lib); its printed totals differ from the table by three, and the set counts printed rows.',
  policy: 'Source-row sets index every row through its assigned Unicode scalars, or its private-use glyph slots where no scalar is assigned; rows described only by an IDS are kept as records, not scalar members; a glyph printed at more than one position is listed once, at its first position; a member may be a jamo sequence when a standard prints one glyph for a Hangul syllable Unicode cannot compose. Unihan kIRG_TSource fills assignments newer than the bulk release. Literal Unicode block sets contain assigned scalars. Unihan kIRG_GSource gives the G source collections. Local row numbers, IDS components and variation sequences do not establish scalar membership. OTHER follows the source’s unified substitutions, rather than literal Unicode block membership.',
  inputs: inputs.sort((a, b) => a.url.localeCompare(b.url)),
}, null, 2) + '\n')
