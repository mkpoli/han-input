// Unicode-今昔文字鏡番号対照表 by 青蛙亭漢語塾; BMP only.
import { readFileSync } from 'node:fs'
import { fetchOnce, sha256 } from '../lib.mjs'

const URL = 'https://archive.seiwatei.net/info/ut82mjk.ut8'
const SHA256 = 'e2b8395cb1bc14a6e1e40f7202b670ff0505f4a738409b96b0b0f3a088e62427'

/** @param {string} body */
export function parseMojikyo(body) {
  /** @type {[string, string][]} */
  const rows = []
  for (const line of body.split('\n')) {
    const columns = line.split('\t')
    if (columns.length < 5) continue
    const point = parseInt(columns[0].replace('*', ''), 16)
    if (!Number.isFinite(point) || point > 0x10FFFF) continue
    const number = columns[3].trim()
    if (!/^\d{6}$/.test(number)) continue
    rows.push([number, String.fromCodePoint(point)])
  }
  return rows
}

/** @returns {Promise<import('../lib.mjs').Method>} */
export async function mojikyoMethod() {
  const path = await fetchOnce(URL, 'ut82mjk.ut8')
  if (sha256(path) !== SHA256) throw new Error('the Mojikyō table changed; review it before rebuilding')
  return {
    id: 'mojikyo',
    family: 'index',
    names: { en: 'Mojikyō number', zh: '今昔文字鏡番号', ja: '今昔文字鏡番号' },
    source: {
      name: 'Unicode-今昔文字鏡番号対照表, 青蛙亭漢語塾',
      url: 'https://www.seiwatei.net/info/chtucmj/',
      licence: 'The table is offered for free download and use. Its author states it is unofficial and made without permission from 文字鏡研究会. BMP only.',
      attribution: 'Compiled by 青蛙亭主人',
    },
    entries: parseMojikyo(readFileSync(path, 'utf8')),
  }
}
