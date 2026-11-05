// Extended sinographies: characters that reuse and extend Han for other languages. Only scripts built
// from Han characters belong here, so Tangut, Jurchen and Khitan do not.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CACHE, fetchOnce } from '../lib.mjs'
import { rimeMethod } from './rime.mjs'

const WIKTIONARY = {
  name: 'English Wiktionary, through the wiktextract data file', url: 'https://kaikki.org/dictionary/rawdata.html',
  licence: 'CC BY-SA 4.0 and GFDL, as Wiktionary states', attribution: 'Wiktionary contributors',
}

/** @returns {Promise<import('../lib.mjs').Method[]>} */
export async function extendedMethods() {
  const out = [
    await rimeMethod({ repo: 'huangjunxin/Rime-Hannom', ref: 'HEAD', file: 'hannom.dict.yaml', id: 'nom-hannom', family: 'extended', en: 'Chữ Nôm (Rime-Hannom)', zh: '字喃（Rime-Hannom）', licence: 'CC-BY-4.0', attribution: 'huangjunxin, from HannomPS' }),
    await rimeMethod({ repo: 'nomnaviet/rime-nom-viet', ref: 'main', file: 'nom_viet.dict.yaml', id: 'nom-viet', family: 'extended', en: 'Chữ Nôm in Telex (Nôm Na Việt)', zh: '字喃 Telex（Nôm Na Việt）', licence: 'MIT', attribution: 'nomnaviet' }),
  ]
  const standard = readFileSync(await fetchOnce('https://raw.githubusercontent.com/valestanov/ChuNomStandardization/HEAD/NomStandardization.csv'), 'utf8')
  /** @type {[string, string][]} */
  const telex = []
  /** @type {[string, string][]} */
  const quocNgu = []
  for (const line of standard.split(/\r?\n/).slice(1)) {
    const [, code, reading, nom] = line.split('\t')
    if (!nom || [...nom].length !== 1) continue
    telex.push([code, nom])
    quocNgu.push([reading, nom])
  }
  const STANDARD = { name: 'NomStandardization.csv', url: 'https://github.com/valestanov/ChuNomStandardization', licence: 'MIT', attribution: 'valestanov' }
  out.push(
    { id: 'nom-standard', family: 'extended', names: { en: 'Chữ Nôm by Quốc ngữ', zh: '字喃（國語字）' }, source: STANDARD, entries: quocNgu },
    { id: 'nom-standard-telex', family: 'extended', names: { en: 'Chữ Nôm by Telex', zh: '字喃（Telex）' }, source: STANDARD, entries: telex },
  )
  const sawndip = readFileSync(await fetchOnce('https://raw.githubusercontent.com/DracoLoong/sawndip-tables/HEAD/Sawndip-table_2026-01-11-2205.txt'), 'utf8')
  out.push({
    id: 'sawndip', family: 'extended', names: { en: 'Sawndip by Zhuang reading', zh: '古壯字（壯文）' },
    source: { name: 'Sawndip-table_2026-01-11-2205.txt', url: 'https://github.com/DracoLoong/sawndip-tables', licence: 'GPL-3.0', attribution: 'DracoLoong' },
    entries: sawndip.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
      const [char, code] = line.split('\t')
      return /** @type {[string, string]} */ ([code ?? '', char])
    }).filter(([code]) => code),
  })
  const forms = join(CACHE, 'wikt-forms.tsv')
  if (existsSync(forms)) {
    const rows = readFileSync(forms, 'utf8').split('\n').filter(Boolean).map(line => line.split('\t'))
    const of = (/** @type {string} */ lang) => rows.filter(row => row[0] === lang).map(row => /** @type {[string, string]} */ ([row[1], row[2]]))
    out.push(
      { id: 'nom-wiktionary', family: 'extended', names: { en: 'Chữ Nôm in Wiktionary', zh: '字喃（維基詞典）' }, source: WIKTIONARY, entries: of('vi') },
      { id: 'sawndip-wiktionary', family: 'extended', names: { en: 'Sawndip in Wiktionary', zh: '古壯字（維基詞典）' }, source: WIKTIONARY, entries: of('za') },
    )
  }
  return out
}
