// The five Yuhao schemes. Each release zip carries the full-code and short-code tables; the repository
// itself holds only the Rime settings, so the zips are the source.
import { execFileSync } from 'node:child_process'
import { fetchOnce } from '../lib.mjs'
import { byWeight, readRimeDict } from './rime.mjs'

const VERSION = 'v3.13.0'
const BASE = `https://github.com/forfudan/yuhao-ime-release/releases/download/${VERSION}`
const LICENCE = 'CC BY-NC-ND 4.0: non-commercial use, and modified works may not be distributed'
const ATTRIBUTION = '朱宇浩 (forfudan), 20261024'

/** @type {[string, string, string, string, string[]][]} asset, id, English, 漢字, table files */
const SCHEMES = [
  ['guanghua', 'yuhao-guanghua', 'Yuhao Guanghua', '宇浩·光華', ['yulight.full', 'yulight_sc.quick', 'yulight_tc.quick', 'yulight_tw.quick']],
  ['lingming', 'yuhao-lingming', 'Yuhao Lingming', '宇浩·靈明', ['yuling.full', 'yuling.quick', 'yuling.pop']],
  ['qingyun', 'yuhao-qingyun', 'Yuhao Qingyun', '宇浩·卿雲', ['yujoy.full', 'yujoy.quick', 'yujoy_sc.quick', 'yujoy.dedup', 'yujoy.compatible', 'yujoy.adjusted']],
  ['riyue', 'yuhao-riyue', 'Yuhao Riyue', '宇浩·日月', ['yuming.full', 'yuming.quick', 'yuming.pop']],
  ['xingchen', 'yuhao-xingchen', 'Yuhao Xingchen', '宇浩·星辰', ['yustar.full', 'yustar.quick', 'yustar_sc.quick', 'yustar.short', 'yustar_sc.short', 'yustar.compatible', 'yustar.adjusted']],
]

/** One member of a release zip, as text. @param {string} zip @param {string} member */
const unzipText = (zip, member) => execFileSync('unzip', ['-p', zip, member], { maxBuffer: 1 << 28 }).toString('utf8')

/** @returns {Promise<import('../lib.mjs').Method[]>} */
export async function yuhaoMethods() {
  /** @type {import('../lib.mjs').Method[]} */
  const out = []
  for (const [asset, id, en, zh, tables] of SCHEMES) {
    const url = `${BASE}/${asset}_${VERSION}.zip`
    const zip = await fetchOnce(url)
    const rows = []
    for (const table of tables) rows.push(...readRimeDict(unzipText(zip, `schema/yuhao/${table}.dict.yaml`)))
    const entries = byWeight(rows)
    out.push({
      id, family: 'shape', keys: 'a–z',
      names: { en, zh },
      about: 'Full codes run to five letters; shorter codes for common characters are included too.',
      source: { name: `forfudan/yuhao-ime-release, ${asset}_${VERSION}.zip`, url, licence: LICENCE, attribution: ATTRIBUTION, version: VERSION },
      entries,
    })
  }
  return out
}
