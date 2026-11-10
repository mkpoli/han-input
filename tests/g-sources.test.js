import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { gSourceKey, gSourceRows } from '../scripts/sources/charsets-g-sources.mjs'

const UNIHAN = [
  'U+3400\tkIRG_GSource\tGDM-00001',
  'U+3401\tkIRG_GSource\tGHC-0000001',
  'U+3402\tkIRG_GSource\tGZA-100001',
  'U+3403\tkIRG_GSource\tGZA-200001',
  'U+3404\tkIRG_GSource\tGZA-500001',
  'U+3405\tkIRG_GSource\tGZ-0000001',
  'U+3406\tkIRG_GSource\tGKJ-00001',
  'U+3407\tkIRG_GSource\tGZ-0000002',
  'U+3408\tkIRG_TSource\tGDM-00002',
].join('\n')

describe('G source serials', () => {
  test('reads the code and its serial digit', () => {
    expect(gSourceKey('GDM-00001')).toBe('GDM')
    expect(gSourceKey('GKJ-00001')).toBe('GKJ')
    expect(gSourceKey('GZ-0000001')).toBe('GZ')
    expect(gSourceKey('GZA-100001')).toBe('GZA-1')
    expect(gSourceKey('GZA-200001')).toBe('GZA-2')
    expect(gSourceKey('GZA-400001')).toBe('GZA-4')
    expect(gSourceKey('GZA-600001')).toBe('GZA-6')
    expect(gSourceKey('GZA-700001')).toBe('GZA-7')
  })

  test('rejects the code without a serial and the unused GZA-5 range', () => {
    expect(gSourceKey('GDM-1')).toBe(null)
    expect(gSourceKey('GZA-500001')).toBe(null)
    expect(gSourceKey('GZA-000001')).toBe(null)
    expect(gSourceKey('GBK-0001')).toBe(null)
  })

  test('collects each source and ignores other fields and codes', () => {
    const rows = gSourceRows(UNIHAN)
    expect(rows.get('GDM')).toEqual([{ char: '\u3400', code: 'GDM-00001' }])
    expect(rows.get('GHC')).toEqual([{ char: '\u3401', code: 'GHC-0000001' }])
    expect(rows.get('GZA-1')).toEqual([{ char: '\u3402', code: 'GZA-100001' }])
    expect(rows.get('GZA-2')).toEqual([{ char: '\u3403', code: 'GZA-200001' }])
    expect(rows.get('GZ')).toEqual([{ char: '\u3405', code: 'GZ-0000001' }, { char: '\u3407', code: 'GZ-0000002' }])
    expect(rows.has('GZA-5')).toBe(false)
  })
})

describe('G source catalogue', () => {
  const base = new URL('../app/public/charsets/', import.meta.url)
  /** @type {any[]} */
  const catalogue = JSON.parse(readFileSync(new URL('index.json', base), 'utf8'))
  /** @type {any[]} */
  const sets = catalogue.filter(set => set.id.startsWith('g_src_'))
  const expected = new Map([
    ['g_src_gdm', ['GDM', 773]], ['g_src_ghc', ['GHC', 543]], ['g_src_gkj', ['GKJ', 669]],
    ['g_src_glgyj', ['GLGYJ', 12]], ['g_src_gpglg', ['GPGLG', 96]], ['g_src_gxm', ['GXM', 282]],
    ['g_src_gz', ['GZ·U', 3591]], ['g_src_gza_1', ['GZA-1', 6]], ['g_src_gza_2', ['GZA-2', 38]],
    ['g_src_gza_3', ['GZA-3', 2]], ['g_src_gza_4', ['GZA-4', 11]], ['g_src_gza_6', ['GZA-6', 59]],
    ['g_src_gza_7', ['GZA-7', 1]],
  ])

  test('lists the thirteen sources in the G group with their counts', () => {
    expect(sets.map(set => [set.id, set.label, set.chars])).toEqual([...expected].map(([id, [label, chars]]) => [id, label, chars]))
    for (const set of sets) {
      expect(set.group).toBe('G')
      expect(set.encoded).toBe(set.chars)
      expect(set.unencoded).toBe(0)
      expect(set.total).toBe(set.chars)
      expect(set.source.name).toBe('Unihan 18.0.0')
    }
  })

  test('writes one member and one source serial per line', () => {
    for (const set of sets) {
      const members = readFileSync(new URL(`${set.id}.txt`, base), 'utf8').split('\n').filter(Boolean)
      expect(members).toHaveLength(set.chars)
      expect(new Set(members).size).toBe(set.chars)
      const codes = readFileSync(new URL(`${set.id}.codes.tsv`, base), 'utf8').split('\n').filter(Boolean)
      expect(codes).toHaveLength(set.chars)
      const prefix = set.label === 'GZ·U' ? 'GZ-' : set.label.startsWith('GZA-') ? set.label : `${set.label}-`
      for (const [index, line] of codes.entries()) {
        const [char, code] = line.split('\t')
        expect(char).toBe(members[index])
        expect(code.startsWith(prefix)).toBe(true)
      }
    }
  })

  test('keeps the GZA books inside Extension H', () => {
    for (const set of sets.filter(entry => entry.label.startsWith('GZA-'))) {
      for (const char of readFileSync(new URL(`${set.id}.txt`, base), 'utf8').split('\n').filter(Boolean)) {
        const point = char.codePointAt(0) ?? 0
        expect(point >= 0x31350 && point <= 0x323AF).toBe(true)
      }
    }
  })

  test('leaves the 字統 GZ snapshot as its own set', () => {
    const snapshot = catalogue.find(set => set.id === 'gz')
    expect(snapshot.label).toBe('GZ')
    expect(snapshot.chars).toBe(7964)
    expect(sets.find(set => set.id === 'g_src_gz').label).toBe('GZ·U')
  })
})
