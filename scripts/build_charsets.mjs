// Refresh the pinned, offline character-set catalogue. No browser-time requests to source sites.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fetchOnce } from './lib.mjs'
import { mappedMembers, iwdsMembers } from './charset-members.mjs'
import * as OpenCC from 'opencc-js'
import { readCnsSourceSets } from './sources/charsets-cns.mjs'

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
const metadata = await get(`${BASE}metadata.json`)
if (!Array.isArray(metadata.meta) || !metadata.meta.length) throw new Error('Empty catalogue')
const ids = new Set()
for (const entry of metadata.meta) {
  if (!/^[a-z0-9_]+$/.test(entry.id) || ids.has(entry.id)) throw new Error(`Invalid set id: ${entry.id}`)
  ids.add(entry.id)
}
/** @type {any[]} */
const catalogue = new Array(metadata.meta.length)
let next = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < metadata.meta.length) {
    const i = next++
    const entry = metadata.meta[i]
    const url = `${BASE}${entry.id}.json`
    const payload = await get(url)
    if (!Array.isArray(payload.rows) && !entry.hidden) throw new Error(`Missing rows: ${entry.id}`)
    // Hidden document registries have empty endpoints; retain their catalogue identity.
    const { members, total } = payload.rows ? mappedMembers(payload) : { members: '', total: 0 }
    writeFileSync(join(OUT, `${entry.id}.txt`), members)
    catalogue[i] = {
      id: entry.id, group: entry.source, label: entry.abbr,
      names: { en: entry.name_en || entry.abbr, zh: hant(entry.name_zh || entry.abbr), hans: hans(entry.name_zh || entry.abbr) },
      chars: [...members].length, total,
      source: { name: '字統網', url, note: payload.rows ? undefined : 'The source endpoint supplies no membership rows.' },
    }
    console.log(`${entry.id}: ${[...members].length} characters / ${total} rows`)
  }
}))
const iwdsUrl = 'https://raw.githubusercontent.com/yi-bai/iwds/master/iwds.xml'
const iwdsBytes = readFileSync(await fetchOnce(iwdsUrl))
record(iwdsUrl, iwdsBytes)
const iwds = iwdsMembers(iwdsBytes.toString('utf8'))
writeFileSync(join(OUT, 'iwds.txt'), iwds.members)
writeFileSync(join(OUT, 'iwds-evidence.json'), JSON.stringify(iwds.evidence) + '\n')
catalogue.push({ id: 'iwds', group: 'Unicode', label: 'IWDS', names: { en: 'IWDS · encoded examples', zh: 'IWDS·已編碼例字', hans: 'IWDS·已编码例字' }, chars: [...iwds.members].length, total: iwds.total, source: { name: 'yi-bai/iwds', url: iwdsUrl } })

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
for (const line of blocksBytes.toString('utf8').split('\n')) {
  const match = line.match(/^([0-9A-F]+)\.\.([0-9A-F]+); (.+)$/)
  if (!match || !/^(?:CJK Radicals Supplement|Kangxi Radicals|CJK Strokes|CJK Compatibility Ideographs(?: Supplement)?|Hiragana|Katakana(?: Phonetic Extensions)?|Kana (?:Extended-[AB]|Supplement)|Small Kana Extension|Nushu)$/.test(match[3])) continue
  const [, start, end, name] = match
  const members = []
  for (let cp = parseInt(start, 16); cp <= parseInt(end, 16); cp++) if (assigned.has(cp)) members.push(String.fromCodePoint(cp))
  const id = `block_${name.toLowerCase().replaceAll(' ', '_').replaceAll('-', '_')}`
  writeFileSync(join(OUT, `${id}.txt`), members.join(''))
  catalogue.push({ id, group: 'Unicode blocks', label: name, names: { en: name }, chars: members.length, total: members.length, source: { name: 'Unicode 18.0.0', url: blocksUrl } })
}
const withdrawals = JSON.parse(readFileSync(join(OUT, 'ext_e_records.json'), 'utf8'))
for (const url of new Set([withdrawals.n1841.sourceUrl, ...withdrawals.additionalRecords.flatMap((/** @type {{evidenceUrls:string[]}} */ row) => row.evidenceUrls)])) {
  if (!inputs.some(input => input.url === url)) record(url, readFileSync(await fetchOnce(url)))
}
const withdrawalMembers = [...new Set(withdrawals.additionalRecords.filter((/** @type {{mappedUnicode?:string}} */ row) => row.mappedUnicode).map((/** @type {{mappedUnicode:string}} */ row) => String.fromCodePoint(parseInt(row.mappedUnicode.slice(2), 16))))].join('')
writeFileSync(join(OUT, 'ext_e_withdrawal_records.txt'), withdrawalMembers)
catalogue.push({
  id: 'ext_e_withdrawal_records', group: 'Historical', label: 'Ext.E withdrawals · partial',
  names: { en: 'Extension E withdrawal records (partial mappings)', zh: '擴展E撤銷記錄（部分對應）', hans: '扩展E撤销记录（部分对应）', ja: '拡張E撤回記録（一部対応）', ko: '확장 E 철회 기록 (일부 대응)' },
  chars: [...withdrawalMembers].length, total: withdrawals.n1841.count + withdrawals.additionalRecords.length,
  source: { name: 'IRG', url: 'https://www.unicode.org/irg/docs/n1896-EditorialReport.pdf', records: '/charsets/ext_e_records.json' },
})
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
  writeFileSync(join(OUT, `${set.id}.txt`), set.members)
  const records = `/charsets/${set.id}.tsv`
  const categoryId = cns.verifiedOfficialCategoryIds[set.label]
  const sourceUrl = categoryId ? `https://www.cns11643.gov.tw/searchSY.jsp?ID=${categoryId}` : cns.sourceUrl
  const attribution = '數位發展部，CNS11643中文標準交換碼全字庫網站，https://www.cns11643.gov.tw'
  writeFileSync(join(OUT, `${set.id}.tsv`), [
    `# ${set.label}`, `# CNS source release: ${cns.datasetVersion}`, `# ${attribution}`,
    `# Sources: ${cns.sourceUrl} ; ${cns.mappingUrl} ; ${unihanUrl} (Unihan kIRG_TSource)`, `# Licence: ${cns.licenseUrl}`,
    'CNS\tUnicode', ...set.records.map(row => `${row.cns}\t${[...new Set([...(row.crosswalk ? [row.crosswalk] : []), ...row.unicode])].map(hex => `U+${hex}`).join(' ')}`),
  ].join('\n') + '\n')
  catalogue.push({ id: set.id, group: 'CNS sources', label: set.label, names: { en: set.label, zh: set.label, hans: hans(set.label), ja: set.label, ko: set.label },
    chars: [...set.members].length, total: set.records.length,
    source: { name: 'CNS11643全字庫', url: sourceUrl, records, version: cns.datasetVersion.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'), licence: cns.licenseUrl, attribution },
  })
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(catalogue, null, 2) + '\n')
writeFileSync(join(OUT, 'sources.json'), JSON.stringify({
  catalogue: `${BASE}metadata.json`, retrieved: new Date().toISOString().slice(0, 10),
  attribution: '字統網, character-set catalogue and glyph mappings. Editorial mappings; original standards and proposal documents remain authoritative. Reuse terms are unspecified at these endpoints.',
  policy: 'Source-row sets index every row through its assigned Unicode scalars, or its private-use glyph slots where no scalar is assigned; Unihan kIRG_TSource fills assignments newer than the bulk release. Literal Unicode block sets contain assigned scalars. Local row numbers, IDS components and variation sequences do not establish scalar membership. OTHER follows the source’s unified substitutions, rather than literal Unicode block membership.',
  inputs: inputs.sort((a, b) => a.url.localeCompare(b.url)),
}, null, 2) + '\n')
