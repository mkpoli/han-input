import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { readAge, readBlocks, tangutUses, jurchenRadicals } from '../scripts/build_siniform.mjs'
import { pageOf } from '../app/lib/paths.js'
import { englishSeo } from '../app/lib/seo.js'

describe('siniform code-chart data', () => {
  test('reads the block bounds', () => {
    const blocks = readBlocks('17000..187FF; Tangut\n18D00..18D7F; Tangut Supplement\n')
    expect(blocks.get('Tangut')).toEqual({ start: 0x17000, end: 0x187FF })
    expect(blocks.get('Tangut Supplement')).toEqual({ start: 0x18D00, end: 0x18D7F })
  })

  test('reads the Unicode version of each assigned run', () => {
    const runs = readAge('17000..17001 ; 9.0 # two\n18D00 ; 13.0 # one\n')
    expect(runs).toEqual([
      { start: 0x17000, end: 0x17001, version: '9.0' },
      { start: 0x18D00, end: 0x18D00, version: '13.0' },
    ])
  })

  test('counts a Tangut component once per character', () => {
    const { uses, described } = tangutUses('17000\t𗀀\t⿱𘠀𘠀\n17001\t𗀁\t⿰𘠀𘠁\n')
    expect(described).toBe(2)
    expect(uses.get(0x18800)).toBe(2)
    expect(uses.get(0x18801)).toBe(1)
  })

  test('reads a Jurchen radical index from the source tags', () => {
    const { uses, byCharacter } = jurchenRadicals([
      'U+18E00\tkJURC_RSUnicode\t1.3',
      'U+18E01\tkJURC_Src\tNC:002.02',
      'U+18E02\tkJURC_RSUnicode\t1.4',
      'U+18E03\tkJURC_RSUnicode\t51.6',
    ].join('\n'))
    expect(uses.get(1)).toBe(2)
    expect(uses.get(51)).toBe(1)
    expect(byCharacter.get(0x18E03)).toBe(51)
  })

  test('the page has a crawler title and a route', () => {
    expect(pageOf('/scripts')).toBe('scripts')
    expect(englishSeo('scripts').title).toContain('Tangut')
  })
})

// The JSON is generated into the ignored public data directory; CI builds the app without it.
const file = new URL('../app/public/data/siniform.json', import.meta.url)
if (existsSync(file)) {
  const data = JSON.parse(readFileSync(file, 'utf8'))
  describe('generated siniform data', () => {
    test('keeps the three scripts and their counts', () => {
      expect(data.unicode).toBe('18.0.0')
      expect(data.scripts.map(script => [script.id, script.chars.count, script.parts?.count ?? 0]))
        .toEqual([['tangut', 6177, 883], ['jurchen', 914, 51], ['khitan', 476, 0]])
    })
    test('every block sums to its assigned code points', () => {
      for (const script of data.scripts) {
        expect(script.blocks.reduce((sum, block) => sum + block.count, 0))
          .toBe(script.chars.count + (script.parts?.count ?? 0))
        expect(new Set(script.chars.cps).size).toBe(script.chars.count)
        expect(script.blocks.every(block => block.end > block.start)).toBe(true)
        if (script.parts) expect(script.parts.uses).toHaveLength(script.parts.count)
        if (script.id === 'tangut') {
          const supplement = script.blocks.find(block => block.key === 'siniform.block.tangutSupplement')
          expect(supplement.positions).toBe(128)
          expect(supplement.count).toBe(33)
        }
      }
    })
  })
}
