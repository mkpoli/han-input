// Kana and Nüshu: scripts derived from Han characters, findable by reading and, for kana, by the
// character each form was written from.
import { readFileSync } from 'node:fs'
import * as OpenCC from 'opencc-js'
import { fetchOnce } from '../lib.mjs'

const UCD = 'https://www.unicode.org/Public/18.0.0/ucd'
const UNICODE = { licence: 'Unicode-3.0', attribution: 'Copyright Unicode, Inc.', version: '18.0.0' }

/** Unicode's kana names follow Nihon-shiki spelling; these syllables differ in Hepburn. */
const HEPBURN = { si: 'shi', ti: 'chi', tu: 'tsu', hu: 'fu', zi: 'ji', di: 'ji', du: 'zu' }

/** @returns {Promise<import('../lib.mjs').Method[]>} */
export async function kanaMethods() {
  const data = readFileSync(await fetchOnce(`${UCD}/UnicodeData.txt`, 'UnicodeData-18.txt'), 'utf8')
  /** @type {[string, string][]} */
  const named = []
  /** @type {[string, string][]} */
  const hepburn = []
  for (const line of data.split('\n')) {
    const [hex, name] = line.split(';')
    const match = name?.match(/^(?:HALFWIDTH )?(?:HIRAGANA|KATAKANA|HENTAIGANA) LETTER (.+)$/)
    if (!match) continue
    const char = String.fromCodePoint(parseInt(hex, 16))
    // A space would split the name into two clues when typed; a hyphen folds away.
    const reading = match[1].toLowerCase().replace(/ /g, '-')
    named.push([reading, char])
    const respelled = reading.replace(/\b(si|ti|tu|hu|zi|di|du)\b/, whole => HEPBURN[/** @type {keyof typeof HEPBURN} */ (whole)])
    hepburn.push([respelled, char])
  }

  const el = readFileSync(await fetchOnce('https://raw.githubusercontent.com/kawabata/hentaigana/29c07a4e479239cdc389409630f57d8a103f7270/hentaigana.el', 'hentaigana.el'), 'utf8')
  const HENTAIGANA_EL = {
    name: 'hentaigana.el, version 1.170817', url: 'https://github.com/kawabata/hentaigana',
    licence: 'GPL-3.0-or-later, as the file states', attribution: '川幡太一 (KAWABATA Taichi), 2017',
  }
  /** @type {[string, string][]} */
  const fromHan = []
  /** @type {[string, string][]} */
  const fromKana = []
  for (const [, key, forms] of el.matchAll(/\(\?(.) \. "([^"]+)"\)/gu)) {
    const list = /\p{Script=Han}/u.test(key) ? fromHan : /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(key) ? fromKana : null
    if (list) for (const form of forms) list.push([key, form])
  }

  // The table lists old forms, and readers mostly type the new ones the file maps them to.
  for (const [, older, newer] of el.matchAll(/\(\?(.) \. \?(.)\)/gu)) {
    for (const [key, form] of fromHan.filter(([key]) => key === older)) fromHan.push([newer, form])
  }

  const rime = readFileSync(await fetchOnce('https://raw.githubusercontent.com/yuanhao-chen-nyoeghau/rime-hentaigana/daab772b5ae64562f7abd49897589d5429cc1009/hentaigana.dict.yaml', 'rime-hentaigana.dict.yaml'), 'utf8')
  const body = rime.slice(rime.indexOf('\n...') + 4)
  /** @type {[string, string][]} */
  const collection = body.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
    const [char, code] = line.split('\t')
    return /** @type {[string, string]} */ ([code ?? '', char])
  }).filter(([code, char]) => code && [...char].length === 1)

  const sources = readFileSync(await fetchOnce(`${UCD}/NushuSources.txt`, 'NushuSources-18.txt'), 'utf8')
  /** @type {[string, string][]} */
  const nushuReadings = []
  /** @type {[string, string][]} */
  const nushuDuben = []
  for (const line of sources.split('\n')) {
    const [cp, tag, value] = line.split('\t')
    if (!cp?.startsWith('U+')) continue
    const char = String.fromCodePoint(parseInt(cp.slice(2), 16))
    if (tag === 'kNSHU_Reading') nushuReadings.push([value, char])
    if (tag === 'kNSHU_DubenSrc') nushuDuben.push([value, char])
  }
  const table = readFileSync(await fetchOnce('https://raw.githubusercontent.com/osfans/MCPDict/cc3e2932666fc0aff0d0b5d52751e75e5a2204bc/tools/tables/data/unicode_nushu_data.csv', 'unicode_nushu_data.csv'), 'utf8')
  // The table writes simplified forms, so traditional ones are added by conversion.
  const toTraditional = OpenCC.Converter({ from: 'cn', to: 'hk' })
  /** @type {[string, string][]} */
  const nushuHan = []
  for (const line of table.replace(/^\uFEFF/, '').split(/\r?\n/).slice(1)) {
    const [char, , han] = line.split(',')
    if (!char || !han) continue
    for (const one of han) {
      nushuHan.push([one, char])
      const traditional = toTraditional(one)
      if (traditional !== one) nushuHan.push([traditional, char])
    }
  }

  return [
    { id: 'kana-name', family: 'extended', keys: 'a–z', names: { en: 'Kana by Unicode name', zh: '假名（Unicode 名稱）', ja: '仮名（Unicode の名前）' },
      about: 'Variant forms carry a number, as a-1.', source: { name: 'UnicodeData.txt', url: `${UCD}/UnicodeData.txt`, ...UNICODE }, entries: named },
    { id: 'kana-hepburn', family: 'extended', keys: 'a–z', names: { en: 'Kana in Hepburn', zh: '假名（平文式）', ja: '仮名（ヘボン式）' },
      about: 'Unicode’s names respelled by rule.', source: { name: 'UnicodeData.txt, respelled', url: `${UCD}/UnicodeData.txt`, ...UNICODE }, entries: hepburn },
    { id: 'kana-origin', family: 'extended', names: { en: 'Kana by source character', zh: '假名（字母）', ja: '仮名（字母）' },
      about: 'The Han character a hiragana or hentaigana form was written from, in old and new forms.', source: HENTAIGANA_EL, entries: fromHan },
    { id: 'hentaigana-by-kana', family: 'extended', names: { en: 'Hentaigana by modern kana', zh: '變體假名（現行假名）', ja: '変体仮名（現行仮名）' }, source: HENTAIGANA_EL, entries: fromKana },
    { id: 'kana-rime', family: 'extended', keys: 'a–z', names: { en: 'Kana Syū', zh: '仮名集', ja: '仮名集' },
      source: { name: 'rime-hentaigana, hentaigana.dict.yaml', url: 'https://github.com/yuanhao-chen-nyoeghau/rime-hentaigana', licence: 'Apache-2.0' }, entries: collection },
    { id: 'nushu-reading', family: 'extended', names: { en: 'Nüshu by Jiangyong reading', zh: '女書（江永讀音）' },
      source: { name: 'NushuSources.txt, kNSHU_Reading', url: `${UCD}/NushuSources.txt`, ...UNICODE }, entries: nushuReadings },
    { id: 'nushu-han', family: 'extended', names: { en: 'Nüshu by corresponding Han character', zh: '女書（對應漢字）' },
      about: 'Traditional forms are converted from the table’s simplified ones.',
      source: { name: 'unicode_nushu_data.csv, as carried by 漢字音典 (MCPDict), commit cc3e293', url: 'https://github.com/osfans/MCPDict', licence: 'MCPDict repository MIT; no separate terms checked for this table', attribution: 'osfans and contributors' }, entries: nushuHan },
    { id: 'nushu-duben', family: 'index', names: { en: 'Nüshu Duben position', zh: '《女書讀本》位置' },
      source: { name: 'NushuSources.txt, kNSHU_DubenSrc', url: `${UCD}/NushuSources.txt`, ...UNICODE }, entries: nushuDuben },
  ]
}
