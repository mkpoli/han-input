import { describe, expect, test } from 'bun:test'
import { addDescription, alignDescriptions, partsOf, runsOf, writeOut } from '../scripts/sources/ids.mjs'

/** @returns {Map<string, { text: string, notation: string, regions: string, sources: string[] }[]>} */
const empty = () => new Map()

describe('description sources', () => {
  test('keeps one description with every source that gives it', () => {
    const into = empty()
    addDescription(into, '乪', '⿺乙田', '⿺乙田', 'GHT', 'babelstone')
    addDescription(into, '乪', '⿺乙田', '⿺乙田', '', 'chise')
    expect(into.get('乪')).toEqual([{ text: '⿺乙田', notation: '⿺乙田', regions: 'GHT', sources: ['babelstone', 'chise'] }])
  })
  test('keeps a second description and its own source', () => {
    const into = empty()
    addDescription(into, '𠀆', '𠀆', '𠀆', 'K', 'babelstone')
    addDescription(into, '𠀆', '⿻十丿', '⿻十丿', '', 'chise')
    expect(into.get('𠀆')).toEqual([
      { text: '𠀆', notation: '𠀆', regions: 'K', sources: ['babelstone'] },
      { text: '⿻十丿', notation: '⿻十丿', regions: '', sources: ['chise'] },
    ])
  })
  test('keeps a source region tag as its own row', () => {
    const into = empty()
    addDescription(into, '林', '⿰木木', '⿰木木', 'GHTJKPV', 'babelstone')
    addDescription(into, '林', '⿰木木', '⿰木木', 'J', 'zitools')
    expect(into.get('林')).toHaveLength(2)
  })
})

describe('numbered components', () => {
  test('writes out the fragment BabelStone note 6 gives', () => {
    expect(writeOut('⿰𦚏{12}')).toBe('⿰𦚏⿷己三')
    expect(writeOut('⿱{82}日')).toBe('⿱聿日')
  })
  test('keeps a number the note leaves without a fragment', () => {
    expect(writeOut('⿰{12}{999}')).toBe('⿰⿷己三{999}')
  })
  test("keeps BabelStone's sign for a part it cannot name", () => {
    expect(writeOut('⿱𠂉？')).toBe('⿱𠂉？')
  })
  test('stores a description the source writes with its own notation', () => {
    const into = empty()
    addDescription(into, '惠', '⿱{7}心', '⿱{7}心', 'GHTJKPV', 'babelstone')
    addDescription(into, '惠', '⿱&CDP-8BD0;心', '⿱&CDP-8BD0;心', '', 'chise')
    expect(into.get('惠')).toEqual([
      { text: '⿱{7}心', notation: '⿱{7}心', regions: 'GHTJKPV', sources: ['babelstone'] },
      { text: '⿱&CDP-8BD0;心', notation: '⿱&CDP-8BD0;心', regions: '', sources: ['chise'] },
    ])
  })
  test('keeps the source notation beside the written-out text', () => {
    const into = empty()
    addDescription(into, '龍', '⿰𦚏⿷己三', '⿰𦚏{12}', 'GH', 'babelstone')
    expect(into.get('龍')).toEqual([{ text: '⿰𦚏⿷己三', notation: '⿰𦚏{12}', regions: 'GH', sources: ['babelstone'] }])
  })
})

describe('runs', () => {
  test('drops the operators and keeps every run of the asked lengths', () => {
    expect(runsOf('⿱夫⿰口匕', [2, 3])).toEqual(new Set(['夫口', '口匕', '夫口匕']))
  })
  test('finds no run in a description shorter than the length', () => {
    expect(runsOf('口', [2, 3])).toEqual(new Set())
  })
})

describe('equivalences', () => {
  test('aligns a numbered component with the CHISE entity in its place', () => {
    const pairs = alignDescriptions(
      new Map([['惠', new Set(['⿱{7}心'])], ['專', new Set(['⿱{7}寸'])]]),
      new Map([['惠', new Set(['⿱&CDP-8BD0;心'])], ['專', new Set(['⿱&CDP-8BD0;寸'])]]),
    )
    expect(pairs.get('CDP-8BD0').get(7)).toBe(2)
  })
  test('leaves descriptions that differ by more than one operand apart', () => {
    const pairs = alignDescriptions(new Map([['惠', new Set(['⿱{7}心'])]]), new Map([['惠', new Set(['⿱&CDP-8BD0;日'])]]))
    expect(pairs.get('CDP-8BD0')).toBeUndefined()
  })
})

describe('parts', () => {
  test('inverts the descriptions at every depth', () => {
    const into = empty()
    addDescription(into, '森', '⿱木林', '⿱木林', 'G', 'babelstone')
    addDescription(into, '林', '⿰木木', '⿰木木', 'G', 'babelstone')
    const parts = partsOf(into)
    expect(parts.get('木')).toEqual(['森', '林'])
    expect(parts.get('林')).toEqual(['森'])
  })
})
