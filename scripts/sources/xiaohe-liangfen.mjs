// 小鶴兩分: four letters, each pair the 小鶴雙拼 key of one component's name (山火 → ujho).
// A privately supplied table; the file is pinned by digest and lives in cache/xiaohe-liangfen/.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CACHE, sha256 } from '../lib.mjs'

const FILE = join(CACHE, 'xiaohe-liangfen', '两分百度码表.txt')
const SHA256 = '813bfd085d91f71647deb6f93eaea26d6654b833efc022925ed485834437341a'

/** Plane 16 private-use glyphs the table uses for components with no Unicode character. */
const PUA = /[\u{F0000}-\u{10FFFD}]/u

/**
 * Lines of `code character`. Codes of two, four and six letters are kept; any other line, such as a stray
 * word, and components in plane 16 are dropped.
 * @param {string} body
 * @returns {[string, string][]}
 */
export function parseXiaoheLiangfen(body) {
  /** @type {[string, string][]} */
  const rows = []
  for (const line of body.split(/\r?\n/)) {
    const match = /^([a-z]+) (\S+)$/u.exec(line)
    if (!match || ![2, 4, 6].includes(match[1].length)) continue
    const [code, char] = [match[1], match[2]]
    if ([...char].length !== 1 || PUA.test(char)) continue
    rows.push([code, char])
  }
  return rows
}

/** @returns {import('../lib.mjs').Method[]} */
export function xiaoheLiangfenMethods() {
  if (!existsSync(FILE)) {
    console.warn(`  left out xiaohe-liangfen: ${FILE} is missing`)
    return []
  }
  if (sha256(FILE) !== SHA256) throw new Error('the 小鶴兩分 table changed; review it before rebuilding')
  return [{
    id: 'xiaohe-liangfen', family: 'shape', keys: 'a–z',
    names: { en: 'Xiaohe Liangfen', zh: '小鶴兩分', hans: '小鹤两分', ja: '小鶴両分', ko: '소학 양분' },
    about: 'Four letters: each pair is the Xiaohe double-pinyin key of one component’s name.',
    source: {
      name: '两分百度码表.txt, 小鶴兩分 code table, privately supplied 2026-11-14',
      url: '',
      licence: 'Not stated',
      attribution: 'Author and source not stated',
    },
    entries: parseXiaoheLiangfen(readFileSync(FILE, 'utf8')),
  }]
}
