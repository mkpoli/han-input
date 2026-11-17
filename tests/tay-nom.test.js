import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const doc = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'data', 'tay-nom.json'), 'utf8'))

describe('Tày Nôm dictionary snapshot', () => {
  test('holds every entry the Foundation numbered', () => {
    expect(doc.count).toBe(2774)
    expect(doc.entries).toHaveLength(2774)
    expect(new Set(doc.entries.map(entry => entry.id)).size).toBe(2774)
    expect(doc.entries.reduce((sum, entry) => sum + entry.examples.length, 0)).toBe(3106)
  })

  test('links each record back to its own page', () => {
    for (const entry of doc.entries) expect(entry.url).toContain(`entryID=${entry.id}&`)
  })

  test('reads a compound headword and a hyphenated reading', () => {
    const compound = doc.entries.find(entry => entry.id === 100)
    expect(compound?.chars).toBe('𫇥𬄅')
    expect(compound?.reading).toBe('BIOÓC NÁT')
    expect(compound?.examples[0].lines).toHaveLength(2)
    expect(doc.entries[0].examples[0].lines).toEqual([{ nom: '買林妸啉𫢞', reading: 'Mải lùm a lùm dụ' }])
    const hyphen = doc.entries.find(entry => entry.id === 1617)
    expect(hyphen?.chars).toBe('牛郎聀女')
    expect(hyphen?.reading).toBe('NGƯU LANG - CHỨC NỮ')
  })

  test('gives a reading for every headword', () => {
    expect(doc.entries.filter(entry => !entry.reading)).toHaveLength(0)
  })
})
