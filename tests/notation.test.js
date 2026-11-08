import { describe, expect, test } from 'bun:test'
import { pieces } from '../app/lib/notation.js'

const components = {
  numbers: {
    7: { pua: '\u{F4F3}', description: 'top of 專惠', chise: [{ name: 'CDP-8BD0', count: 7 }] },
    12: { pua: '\u{F4AE}', description: 'right of 龍', fragment: '⿷己三' },
    82: { pua: '\u{F4E2}', description: 'top of 書', fragment: '聿' },
  },
  entities: { 'CDP-8BD0': { number: 7, count: 7 } },
}

describe('card notation', () => {
  test('draws a numbered component from its fragment', () => {
    const part = pieces('⿱{82}日', components)[1]
    expect(part).toMatchObject({ kind: 'part', text: '聿', title: ['card.number', { n: '82', description: 'top of 書' }] })
    expect(part.children).toEqual([{ kind: 'plain', text: '聿' }])
  })
  test('draws a number with no fragment from its PUA character', () => {
    expect(pieces('⿱{7}心', components)).toContainEqual({ kind: 'part', text: '\u{F4F3}', pua: true, title: ['card.number', { n: '7', description: 'top of 專惠' }] })
  })
  test('draws an entity its numbered component was aligned with the same way', () => {
    expect(pieces('⿱&CDP-8BD0;心', components)[1]).toMatchObject({
      kind: 'part', text: '\u{F4F3}', pua: true, title: ['card.entityNumber', { name: 'CDP-8BD0', n: '7', description: 'top of 專惠' }],
    })
  })
  test('keeps an unknown number, the unnamed sign and an unaligned CHISE entity, marked', () => {
    expect(pieces('{99}？&UNKNOWN-1;', components)).toEqual([
      { kind: 'unnamed', text: '{99}', title: ['card.numberUnknown', { n: '99' }] },
      { kind: 'unnamed', text: '？', title: ['card.unnamed', {}] },
      { kind: 'entity', text: '&UNKNOWN-1;', title: ['card.entity', { name: 'UNKNOWN-1' }] },
    ])
  })
  test('falls back to the PUA glyph when a fragment names itself', () => {
    const [part] = pieces('{5}', { numbers: { 5: { pua: '\u{F4F1}', description: 'left of 叚', fragment: '{5}' } }, entities: {} })
    expect(part.children?.[0]).toMatchObject({ kind: 'part', text: '\u{F4F1}', title: ['card.number', { n: '5', description: 'left of 叚' }] })
  })
})
