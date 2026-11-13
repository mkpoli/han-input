import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { matchRecords, partsOf, relatedOf } from '../app/lib/records.js'

const base = new URL('../app/public/charsets/', import.meta.url)
/** @param {string} id @returns {{ documents: any[], records: any[] }} */
const records = id => JSON.parse(readFileSync(new URL(`${id}_records.json`, base), 'utf8'))
const catalogue = JSON.parse(readFileSync(new URL('index.json', base), 'utf8'))

describe('study tables as character sets', () => {
  test('every study set is a searchable record set of the Studies group', () => {
    const studies = catalogue.filter((/** @type {any} */ row) => row.group === 'Studies')
    expect(studies).toHaveLength(26)
    for (const row of studies) {
      expect(row.records.search).toBe(true)
      expect(row.records.file).toBe(`/charsets/${row.id}_records.json`)
      expect(row.records.count).toBe(row.total)
    }
  })

  test('a printed page keeps its form and a float page becomes an integer', () => {
    expect(records('study_dazidian_lungao').records[0].source).toBe('2')
    expect(records('study_zhongyi').records[0]).toEqual({ document: 'book', source: '359-1', ids: '⿰\u{323c6}丶' })
    expect(records('study_zizibu').records.find(record => record.ids === '⿱㞢一').source).toBe('子集/15')
  })

  test('section headings and multi-character words are dropped', () => {
    expect(records('study_zizibu').records.some(record => /部>|劃/.test(record.ids ?? ''))).toBe(false)
    expect(records('study_suihanlu').records.some(record => /部$/.test(record.ids ?? ''))).toBe(false)
    expect(records('study_zidanku').records.some(record => record.mappedUnicode === undefined && !record.ids)).toBe(false)
    expect(records('study_zidanku').records).toHaveLength(396)
  })

  test('随函录 gives the identified character and the kind of identification', () => {
    const [first] = records('study_suihanlu').records
    expect(first).toEqual({ document: 'book', source: '第80页', ids: '⿱丆⿰一㇇', status: '「丐」的訛字', related: ['丐'], relations: ['訛字'] })
  })

  test('康熙外字 pairs each unencoded form with its stand-in', () => {
    const { records: rows } = records('study_kangxi_waizi')
    expect(rows.find(record => record.ids === '〈亻革〉')).toEqual({ document: 'book', source: '頁118第18', ids: '〈亻革〉', related: ['𠎹'] })
    expect(rows.find(record => record.mappedUnicode === 'U+203B9')?.related).toEqual(['〈亻革〉'])
  })

  test('疑难字简明字典 keeps the suffix as a status and the brackets as relation kinds', () => {
    const { records: rows } = records('study_yinan_jianming')
    expect(rows.find(record => record.source === 'YN00182')).toEqual({ document: 'book', source: 'YN00182', mappedUnicode: 'U+72AE', status: '台灣字形' })
    const marked = rows.find(record => record.source === 'YN00051')
    expect(marked.related).toEqual(['碍', '硋'])
    expect(marked.relations).toEqual(['簡化字', '異體字'])
  })

  test('a book with several sources keeps one document each', () => {
    const { documents } = records('study_yupian_suzi')
    expect(documents.map(document => document.document)).toEqual(['玉篇', '玉篇殘卷', '干祿字書', '廣韻', '類篇'])
  })

  test('the members of a set are its encoded headwords', () => {
    const set = records('study_dazidian_lungao')
    const members = readFileSync(new URL('study_dazidian_lungao.txt', base), 'utf8').split('\n').filter(Boolean)
    expect(new Set(members)).toEqual(new Set(set.records.filter(record => record.mappedUnicode).map(record => String.fromCodePoint(parseInt(record.mappedUnicode.slice(2), 16)))))
    const codes = readFileSync(new URL('study_dazidian_lungao.codes.tsv', base), 'utf8').split('\n')
    expect(codes[0]).toBe(`${String.fromCodePoint(parseInt(set.records.find(record => record.mappedUnicode).mappedUnicode.slice(2), 16))}\t${set.records.find(record => record.mappedUnicode).source}`)
  })
})

describe('related forms in record search', () => {
  const rows = records('study_suihanlu').records
  /** @param {any} record */
  const entry = record => ({ set: 'study_suihanlu', document: /** @type {any} */ ({ id: 'book' }), record, parts: partsOf(record), related: relatedOf(record) })

  test('a record is related to the characters its table names', () => {
    expect([...relatedOf(rows[0])]).toEqual(['丐'])
    expect([...relatedOf({ document: 'book', source: 'x', ids: '⿰木丘', alternates: ['坵', '⿱人二'] })]).toEqual(['坵'])
  })

  test('finds an unencoded record by the character it is identified with, and by a part', () => {
    const index = rows.filter(record => !record.mappedUnicode).map(entry)
    expect(matchRecords(index, { kind: 'text', text: '丐' }).map(hit => hit.record.ids)).toContain('⿱丆⿰一㇇')
    expect(matchRecords(index, { kind: 'part', text: '丆' }).map(hit => hit.record.ids)).toContain('⿱丆⿰一㇇')
  })

  test('an alternate description feeds the parts of a record', () => {
    expect([...partsOf({ document: 'book', source: 'x', ids: '⿱髟涼', alternates: ['⿱髟凉'] })]).toEqual(['髟', '涼', '凉'])
  })

  test('an IDS form that is only in related adds no character', () => {
    expect([...relatedOf({ document: 'book', source: 'x', ids: '〈亻革〉', related: ['⿰中馬', '𠎹'] })]).toEqual(['𠎹'])
  })
})
