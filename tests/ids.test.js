import { describe, expect, test } from 'bun:test'
import { addDescription, partsOf } from '../scripts/sources/ids.mjs'

/** @returns {Map<string, { text: string, regions: string, sources: string[] }[]>} */
const empty = () => new Map()

describe('description sources', () => {
  test('keeps one description with every source that gives it', () => {
    const into = empty()
    addDescription(into, '乪', '⿺乙田', 'GHT', 'babelstone')
    addDescription(into, '乪', '⿺乙田', '', 'chise')
    expect(into.get('乪')).toEqual([{ text: '⿺乙田', regions: 'GHT', sources: ['babelstone', 'chise'] }])
  })
  test('keeps a second description and its own source', () => {
    const into = empty()
    addDescription(into, '𠀆', '𠀆', 'K', 'babelstone')
    addDescription(into, '𠀆', '⿻十丿', '', 'chise')
    expect(into.get('𠀆')).toEqual([
      { text: '𠀆', regions: 'K', sources: ['babelstone'] },
      { text: '⿻十丿', regions: '', sources: ['chise'] },
    ])
  })
  test('keeps a source region tag as its own row', () => {
    const into = empty()
    addDescription(into, '林', '⿰木木', 'GHTJKPV', 'babelstone')
    addDescription(into, '林', '⿰木木', 'J', 'zitools')
    expect(into.get('林')).toHaveLength(2)
  })
})

describe('parts', () => {
  test('inverts the descriptions at every depth', () => {
    const into = empty()
    addDescription(into, '森', '⿱木林', 'G', 'babelstone')
    addDescription(into, '林', '⿰木木', 'G', 'babelstone')
    const parts = partsOf(into)
    expect(parts.get('木')).toEqual(['森', '林'])
    expect(parts.get('林')).toEqual(['森'])
  })
})
