import { describe, expect, test } from 'bun:test'
import { plainComponents, readCompat, readIwds, variantIndex } from '../scripts/import_variants.mjs'
import { spellings } from '../src/variants.js'
import data from '../data/variants.json' with { type: 'json' }

const XML = `<ucv>
  <entry id="141" kind="unifiable" level="2">
    <glyphs>u4e03,u5315-t,u2090e</glyphs>
    <components>七匕𠤎</components>
    <disunified>叱𠮟,梍梎</disunified>
  </entry>
  <entry id="211">
    <components>口\uf40a</components>
  </entry>
  <entry id="4">
    <components>⿱宀丯⿱宀丰</components>
  </entry>
</ucv>`

const UCD = [
  '2F83A;CJK COMPATIBILITY IDEOGRAPH-2F83A;Lo;0;L;53F1;;;;N;;;;;',
  '2F19;KANGXI RADICAL SEAL;So;0;ON;<compat> 5369;;;;N;;;;;',
  '53F1;CJK UNIFIED IDEOGRAPH-53F1;Lo;0;L;;;;;N;;;;;',
].join('\n')

describe('IWDS', () => {
  test('reads a component group and the pairs it disunifies', () => {
    expect(readIwds(XML)).toEqual([
      { id: '141', components: ['七', '匕', '𠤎'], pairs: [['叱', '𠮟'], ['梍', '梎']], kind: 'unifiable' },
    ])
  })
  test('drops a group written with private-use glyphs or a description', () => {
    expect(plainComponents('口\uf40a')).toBeNull()
    expect(plainComponents('⿱宀丯')).toBeNull()
  })
})

describe('Unicode compatibility', () => {
  test('reads the unified form a compatibility ideograph names', () => {
    expect(readCompat(UCD)).toEqual(new Map([['叱', '叱'], ['⼙', '卩']]))
  })
  test('files both spellings of a group under each other', () => {
    const { component, character } = variantIndex(readIwds(XML), readCompat(UCD))
    expect(component['匕']).toEqual([{ component: '七', group: '141' }, { component: '𠤎', group: '141' }])
    expect(character['叱']).toEqual([
      { char: '𠮟', relation: 'variant', source: 'iwds', group: '141' },
      { char: '叱', relation: 'compatibility', source: 'unicode' },
    ])
    expect(character['叱']).toEqual([{ char: '叱', relation: 'compatibility', source: 'unicode' }])
  })
})

describe('spellings', () => {
  const variants = { sources: [], component: { 匕: [{ component: '七', group: '141' }, { component: '𠤎', group: '140' }] }, character: {} }
  test('puts the typed run first and then each spelling of a part', () => {
    expect(spellings(['口', '匕'], variants)).toEqual([['口', '匕'], ['口', '七'], ['口', '𠤎']])
  })
  test('stops at the cap', () => {
    expect(spellings(['口', '匕'], variants, 2)).toEqual([['口', '匕'], ['口', '七']])
  })
})

describe('the checked-in table', () => {
  test('holds the variant forms of 匕, and the character 叱 is found from either side', () => {
    expect(data.component['匕'].map(row => row.component)).toEqual(['𠤎', '七'])
    const rows = data.character['叱']
    expect(rows.map(row => row.char)).toContain('𠮟')
    expect(rows.map(row => row.char)).toContain('叱')
  })
  test('treats the seal radical and its Kangxi form as one shape', () => {
    expect(data.component['卩']).toEqual([{ component: '⼙', group: 'seal-forms' }, { component: '𰆊', group: 'seal-forms' }])
    expect(data.character['卩']).toContainEqual({ char: '⼙', relation: 'compatibility', source: 'unicode' })
  })
  test('keeps 卪 as a fuzzy neighbour of 卩, not a spelling', () => {
    expect(data.fuzzy['卩']).toEqual([{ component: '卪', group: 'seal-similar' }])
    expect(data.component['卩']?.some(row => row.component === '卪')).toBe(false)
  })
  test('names a source for every row', () => {
    expect(data.sources.map(source => source.url)).toContain('https://raw.githubusercontent.com/yi-bai/iwds/master/iwds.xml')
    expect(data.sources.map(source => source.url)).toContain('https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt')
  })
})
