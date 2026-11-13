// Every table beyond Unihan. Add a source here. One that fails to give rows is reported and left out,
// so a moved file upstream cannot silently change what another table holds.
import { readFileSync } from 'node:fs'
import { fetchOnce } from '../lib.mjs'
import { ashideMethods } from './ashide.mjs'
import { algebraMethod, readRimeDict, rimeMethod } from './rime.mjs'
import { mcpdictMethods } from './mcpdict.mjs'
import { qieyunMethods } from './qieyun.mjs'
import { cinMethods } from './cin.mjs'
import { extendedMethods } from './extended.mjs'
import { extraMethods } from './extra.mjs'
import { kanaMethods } from './kana.mjs'
import { sealMethods } from './seal.mjs'
import { mojikyoMethod } from './mojikyo.mjs'
import { yuhaoMethods } from './yuhao.mjs'

/** @type {[string, string, string, string, string, import('../lib.mjs').Family, string?][]} repo, file, id, English, 漢字 name, family, licence */
const RIME = [
  ['rime/rime-scj', 'scj6.dict.yaml', 'scj6', 'Fast Cangjie 6', '快速倉頡六代', 'shape', 'GPL-3.0'],
  ['lotem/rime-zhengma', 'zhengma.dict.yaml', 'zhengma', 'Zhengma', '鄭碼', 'shape', 'GPL-3.0'],
  ['rime/rime-array', 'array30_main.dict.yaml', 'array30', 'Array 30', '行列三〇', 'shape', 'GPL-3.0'],
  ['rime/rime-stroke', 'stroke.dict.yaml', 'stroke', 'Five strokes', '五筆畫', 'shape', 'LGPL-3.0'],
  ['rimeinn/rime-c42', 'c42.dict.yaml', 'c42', 'C42', 'C輸入', 'shape', 'GPL-3.0'],
  ['KyleBing/rime-wubi86-jidian', 'wubi86_jidian.dict.yaml', 'wubi86-jidian', 'Wubi 86 Jidian', '五筆 86 極點', 'shape', 'MIT'],
  ['xkinput/Rime_JD', 'rime/keytao-cx.dict.yaml', 'keytao', 'Keytao', '星空鍵道', 'shape', 'None stated'],
  ['chiahsien/RimeDayi', 'dayi4.dict.yaml', 'dayi4', 'Dayi 4', '大易四碼', 'shape', 'None stated'],
  ['rime/rime-terra-pinyin', 'terra_pinyin.dict.yaml', 'terra-pinyin', 'Terra Pinyin, tones as digits', '地球拼音', 'reading', 'LGPL-3.0'],
  ['a5corpii/GwoyeuRomatzyh', 'romatzyh.dict.yaml', 'gwoyeu', 'Gwoyeu Romatzyh', '國語羅馬字', 'reading', 'None stated'],
  ['rime/rime-cantonese', 'jyut6ping3.chars.dict.yaml', 'jyutping', 'Jyutping (Rime Cantonese)', '粵拼', 'reading', 'CC-BY-4.0 and ODbL'],
  ['rime/rime-jyutping', 'jyutping.dict.yaml', 'jyutping-old', 'Jyutping (rime-jyutping)', '粵拼（舊表）', 'reading', 'LGPL-3.0'],
  ['a-thok/rime-hokkien', 'banlam.dict.yaml', 'hokkien', 'Hokkien Tâi-lô', '閩南語臺羅', 'reading', 'None stated'],
  ['rime/rime-wugniu', 'wugniu_lopha.dict.yaml', 'wugniu', 'Shanghainese (Wugniu)', '上海吳語', 'reading', 'GPL-3.0'],
  ['rime/rime-soutzoe', 'soutzoe.dict.yaml', 'soutzoe', 'Suzhounese', '蘇州吳語', 'reading', 'GPL-3.0'],
  ['sgalal/rime-hanja', 'hanja.dict.yaml', 'hanja', 'Hanja by Hangul', '韓語漢字', 'reading', 'None stated'],
  ['rime/rime-middle-chinese', 'zyenpheng.dict.yaml', 'zyenpheng', 'Middle Chinese full spelling', '中古全拼', 'historical', 'GPL-3.0'],
]

/** @type {[string, string, string, string][]} schema file, id, English, 漢字 name */
const SPELLINGS = [
  ['double_pinyin.schema.yaml', 'sp-ziranma', 'Double pinyin: Ziranma', '自然碼雙拼'],
  ['double_pinyin_abc.schema.yaml', 'sp-abc', 'Double pinyin: Intelligent ABC', '智能ABC雙拼'],
  ['double_pinyin_flypy.schema.yaml', 'sp-flypy', 'Double pinyin: Xiaohe', '小鶴雙拼'],
  ['double_pinyin_mspy.schema.yaml', 'sp-mspy', 'Double pinyin: Microsoft', '微軟雙拼'],
  ['double_pinyin_pyjj.schema.yaml', 'sp-pyjj', 'Double pinyin: Pinyin Jiajia', '拼音加加雙拼'],
  ['double_pinyin_st.schema.yaml', 'sp-sitong', 'Double pinyin: Sitong', '四通雙拼'],
]

/** @template T @param {string} label @param {() => Promise<T[]>} make @returns {Promise<T[]>} */
async function attempt(label, make) {
  try {
    return await make()
  } catch (error) {
    console.warn(`  left out ${label}: ${/** @type {Error} */ (error).message}`)
    return []
  }
}

export async function allMethods() {
  const luna = await fetchOnce('https://raw.githubusercontent.com/rime/rime-luna-pinyin/HEAD/luna_pinyin.dict.yaml')
  const table = [...readRimeDict(readFileSync(luna, 'utf8'))]
  /** @type {import('../lib.mjs').Method[]} */
  const out = [
    ...await ashideMethods(),
    ...mcpdictMethods(),
    ...qieyunMethods(),
    await rimeMethod({ repo: 'rime/rime-cangjie', file: ['cangjie5.base.dict.yaml', 'cangjie5.extended.dict.yaml'], id: 'cangjie5', en: 'Cangjie 5', zh: '倉頡五代', licence: 'GPL, as the dictionary header states; repository LGPL-3.0', keys: 'a–z' }),
    await rimeMethod({ repo: 'rime/rime-wubi', file: 'wubi86.dict.yaml', id: 'wubi86', en: 'Wubi 86', zh: '五筆字型 86', licence: 'LGPL-3.0', keys: 'a–y' }),
    { id: 'luna-pinyin', family: 'reading', names: { en: 'Luna Pinyin', zh: '朙月拼音' },
      source: { name: 'rime/rime-luna-pinyin, luna_pinyin.dict.yaml', url: 'https://github.com/rime/rime-luna-pinyin', licence: 'LGPL-3.0' },
      entries: table.map(row => /** @type {[string, string]} */ ([row.code, row.char])) },
    ...await extendedMethods(),
    ...await kanaMethods(),
    ...await sealMethods(),
    await mojikyoMethod(),
    ...await yuhaoMethods(),
    ...await cinMethods(),
    ...await extraMethods(),
  ]
  for (const [repo, file, id, en, zh, family, licence] of RIME) {
    out.push(...await attempt(id, async () => [await rimeMethod({ repo, file, id, en, zh, family, licence: licence ?? '' })]))
  }
  for (const [schema, id, en, zh] of SPELLINGS) {
    out.push(...await attempt(id, async () => [await algebraMethod({ repo: 'rime/rime-double-pinyin', schema, id, en, zh, table, licence: 'GPL-3.0', tableName: 'Luna Pinyin' })]))
  }
  return out
}
