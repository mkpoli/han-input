// Small Seal (Unicode 18, U+3D000–U+3FC3F): found by the modern character Unicode pairs with each form,
// by Shuowen radical, and by the number each form has in the four Shuowen editions it was encoded from.
import { readFileSync } from 'node:fs'
import * as OpenCC from 'opencc-js'
import { fetchOnce } from '../lib.mjs'
import { SIMPLIFIED } from '../../src/script.js'

const URL = 'https://www.unicode.org/Public/18.0.0/ucd/SealSources.txt'
const UNICODE = { url: URL, licence: 'Unicode-3.0', attribution: 'Copyright Unicode, Inc.', version: '18.0.0' }
// WG2 N5294R3 (L2/25-049R, Michel Suignard, 2025-01-26) names the editions behind the source tags.
const N5294 = 'WG2 N5294R3 (https://www.unicode.org/wg2/docs/n5294R3-ConsiderationsSmallSeal.pdf) names the edition.'

/** @type {[string, string, string, string, string][]} field, id, English, 漢字 name, about */
const EDITIONS = [
  ['kSEAL_THXSrc', 'seal-thx', 'Small Seal, unified THX number', '小篆（THX統一編號）',
    'Unicode’s unified numbering, built on Xu Xuan’s Shuowen in the Tenghuaxie edition, as TH-00001, TH-X001 or TH-Y001.'],
  ['kSEAL_CCZSrc', 'seal-ccz', 'Small Seal, Chen Changzhi edition number', '小篆（陳昌治本編號）',
    'Xu Xuan’s Shuowen as Chen Changzhi recut it, as C-00001.'],
  ['kSEAL_QJZSrc', 'seal-qjz', 'Small Seal, Qi Junzao edition number', '小篆（祁寯藻本編號）',
    'Xu Kai’s Shuowen as Qi Junzao carved it in 1839, as K-00001.'],
  ['kSEAL_DYCSrc', 'seal-dyc', 'Small Seal, Duan Yucai edition number', '小篆（段注本編號）',
    'Duan Yucai’s annotated Shuowen, Jingyunlou edition, as D-00001.'],
]

/** @returns {Promise<import('../lib.mjs').Method[]>} */
export async function sealMethods() {
  const text = readFileSync(await fetchOnce(URL, 'SealSources-18.txt'), 'utf8')
  const toSimplified = OpenCC.Converter(SIMPLIFIED)
  /** @type {Map<string, [string, string][]>} */
  const byField = new Map()
  /** @type {[string, string][]} */
  const modern = []
  /** @type {[string, string][]} */
  const radicals = []
  for (const line of text.split('\n')) {
    const [cp, field, value] = line.split('\t')
    if (!cp?.startsWith('U+') || !value) continue
    const char = String.fromCodePoint(parseInt(cp.slice(2), 16))
    if (field === 'kSEAL_MCJK') {
      for (const hex of value.split(' ')) {
        const one = String.fromCodePoint(parseInt(hex, 16))
        modern.push([one, char])
        const simplified = toSimplified(one)
        if (simplified !== one && [...simplified].length === 1) modern.push([simplified, char])
      }
    } else if (field === 'kSEAL_Rad') {
      for (const radical of value.split(' ')) radicals.push([radical.split('.')[0], char])
    } else {
      let list = byField.get(field)
      if (!list) byField.set(field, list = [])
      list.push([value, char])
    }
  }
  return [
    { id: 'seal-modern', family: 'extended', names: { en: 'Small Seal by modern character', zh: '小篆（對應今字）', ja: '小篆（対応する現行字）' },
      about: 'Simplified forms are converted from the modern characters Unicode gives.',
      source: { name: 'SealSources.txt, kSEAL_MCJK', ...UNICODE }, entries: modern },
    { id: 'seal-radical', family: 'index', names: { en: 'Small Seal by Shuowen radical', zh: '小篆（說文部首）', ja: '小篆（説文部首）' },
      about: 'The 540 radicals of the Shuowen, numbered 1–540.',
      source: { name: 'SealSources.txt, kSEAL_Rad', ...UNICODE }, entries: radicals },
    ...EDITIONS.map(([field, id, en, zh, about]) => ({
      id, family: /** @type {const} */ ('index'), names: { en, zh }, about,
      source: { name: `SealSources.txt, ${field}`, ...UNICODE, note: N5294 }, entries: byField.get(field) ?? [],
    })),
  ]
}
