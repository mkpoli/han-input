// The Qieyun system through nk2028's TshetUinh.js: each small rhyme's position, its fanqie, and the
// romanizations and reconstructions computed from the position by nk2028's published scripts.
import TshetUinh from 'tshet-uinh'
import * as Examples from 'tshet-uinh-examples'

const DATA = 'https://github.com/nk2028/tshet-uinh-data'
const SCRIPTS = 'https://github.com/nk2028/tshet-uinh-examples/blob/main'

/** @type {[string, keyof typeof Examples, string, string, string][]} id, script, English, 漢字 name, what it is */
const DERIVED = [
  ['tupa', 'tupa', 'Tshet-uinh Phonetic Alphabet', '切韻拼音', 'A romanization of the Qieyun system.'],
  ['baxter', 'baxter', 'Baxter’s transcription', '白一平轉寫', 'A transcription of the Qieyun system.'],
  ['karlgren-mc', 'karlgren', 'Karlgren’s reconstruction', '高本漢擬音', 'A reconstruction, computed from the position.'],
  ['wangli', 'wangli', 'Wang Li’s reconstruction', '王力擬音', 'A reconstruction, computed from the position.'],
  ['panwuyun', 'panwuyun', 'Pan Wuyun’s reconstruction', '潘悟雲擬音', 'A reconstruction, computed from the position.'],
  ['unt', 'unt', 'unt’s reconstruction', 'unt 擬音', 'A reconstruction, computed from the position.'],
  ['msoeg', 'msoeg_v8', 'msoeg’s reconstruction, version 8', 'msoeg 擬音 V8', 'A reconstruction, computed from the position.'],
  ['high-tang', 'high_tang', 'High Tang, extrapolated', '推導盛唐（平水韻）擬音', 'Extrapolated from the Qieyun position by rule, so a reading here is computed and not attested.'],
  ['mid-tang', 'mid_tang', 'Mid Tang, extrapolated', '推導中唐（韻圖）擬音', 'Extrapolated from the Qieyun position by rule, so a reading here is computed and not attested.'],
  ['northern-song', 'n_song', 'Northern Song, extrapolated', '推導北宋（聲音唱和圖）擬音', 'Extrapolated from the Qieyun position by rule, so a reading here is computed and not attested.'],
]

/** Every small rhyme of the Guangyun: its place in the system, and the characters in it. */
export function smallRhymes() {
  return [...TshetUinh.資料.iter音韻地位()].map(place => ({ place, rows: TshetUinh.資料.query音韻地位(place) }))
}

/** @returns {import('../lib.mjs').Method[]} */
export function qieyunMethods() {
  const rhymes = smallRhymes()
  const source = (/** @type {string} */ script) => ({
    name: `tshet-uinh-examples, ${script}.js, over TshetUinh.js 0.15.4`, url: `${SCRIPTS}/${script}.js`, licence: 'MIT',
    attribution: 'nk2028; each script names its author and the works it follows',
  })
  const data = { name: 'tshet-uinh-data, through TshetUinh.js 0.15.4', url: DATA, licence: 'CC0-1.0', attribution: 'nk2028' }
  return [
    {
      id: 'guangyun-place', family: 'historical', names: { en: 'Guangyun position', zh: '《廣韻》音韻地位' }, source: data,
      about: 'Initial, division, rhyme and tone, as 端一東平.',
      entries: rhymes.flatMap(({ place, rows }) => rows.map(row => /** @type {[string, string]} */ ([place.描述, row.字頭]))),
    },
    {
      id: 'guangyun-fanqie', family: 'historical', names: { en: 'Guangyun fanqie', zh: '《廣韻》反切' }, source: data,
      entries: rhymes.flatMap(({ rows }) => rows.flatMap(row => (row.反切 ? [/** @type {[string, string]} */ ([row.反切, row.字頭])] : []))),
    },
    ...DERIVED.map(([id, script, en, zh, about]) => {
      const derive = /** @type {(o?: object) => (p: unknown) => string} */ (/** @type {unknown} */ (Examples[script]))()
      return {
        id, family: /** @type {const} */ ('historical'), names: { en, zh }, about, source: source(script),
        entries: rhymes.flatMap(({ place, rows }) => {
          const code = String(derive(place))
          return rows.map(row => /** @type {[string, string]} */ ([code, row.字頭]))
        }),
      }
    }),
  ]
}

/** One row per small rhyme, for the rhyme table page. */
export function rhymeTable() {
  return smallRhymes().map(({ place, rows }) => ({
    母: place.母, 呼: place.呼 ?? '', 等: place.等, 類: place.類 ?? '', 韻: place.韻, 聲: place.聲,
    描述: place.描述, 反切: rows[0]?.反切 ?? '', 字: [...new Set(rows.map(row => row.字頭))].join(''),
  }))
}
