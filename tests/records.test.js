import { describe, expect, test } from 'bun:test'
import { canMatch, keptParts, matchRecords } from '../app/lib/records.js'

/** @param {object} record @param {string[]} parts @param {string[]} [related] */
const entry = (record, parts, related = []) => ({ set: 'cbeta_gaiji', document: /** @type {any} */ ({ id: 'cbeta' }), record: /** @type {any} */ ({ document: 'cbeta', ...record }), parts: new Set(parts), related: new Set(related) })

const entries = [
  entry({ source: 'CB00139', workbook: { strokes: 10, zhuyin: ['ㄇㄥˊ'] } }, ['冖', '一', '豖']),
  entry({ source: 'CB00709', workbook: { strokes: 15 } }, ['目'], ['𥉍', '眵']),
  entry({ source: 'CB01000' }, ['氵', '青']),
]

describe('kept parts', () => {
  test('leave out what a formula takes away', () => {
    expect(keptParts('⿰糸⿻㇯占口乙')).toEqual(['糸', '乙'])
    expect(keptParts('㇯林木')).toEqual([])
    expect(keptParts('⿻㇯冗几⿱一豖')).toEqual(['一', '豖'])
  })
  test('keep only the new part of a replacement', () => {
    expect(keptParts('🔄幻幺糸')).toEqual(['糸'])
  })
  test('keep nothing from an IDS that does not parse', () => {
    expect(keptParts('⿰糸')).toEqual([])
  })
})

describe('record search', () => {
  test('finds a record by a part it keeps, in any written form', () => {
    expect(matchRecords(entries, { kind: 'part', text: '豖' }).map(hit => hit.record.source)).toEqual(['CB00139'])
    expect(matchRecords(entries, { kind: 'text', text: '冖豖' }).map(hit => hit.record.source)).toEqual(['CB00139'])
    expect(matchRecords(entries, { kind: 'part', text: '水' }, ['氵']).map(hit => hit.record.source)).toEqual(['CB01000'])
  })
  test('finds a record by a character a source relates it to', () => {
    expect(matchRecords(entries, { kind: 'text', text: '𥉍' }).map(hit => hit.record.source)).toEqual(['CB00709'])
  })
  test('finds a record by the workbook’s strokes and zhuyin', () => {
    expect(matchRecords(entries, { kind: 'strokes', text: '15畫', value: 15 }).map(hit => hit.record.source)).toEqual(['CB00709'])
    expect(matchRecords(entries, { kind: 'code', text: 'ㄇㄥˊ' }).map(hit => hit.record.source)).toEqual(['CB00139'])
    expect(matchRecords(entries, { kind: 'code', text: 'ㄇㄥ' }).map(hit => hit.record.source)).toEqual(['CB00139'])
  })
  test('reads a formula clue by the parts it keeps', () => {
    expect(matchRecords(entries, { kind: 'arithmetic', text: '冖/豖' }).map(hit => hit.record.source)).toEqual(['CB00139'])
    expect(matchRecords(entries, { kind: 'arithmetic', text: '林-木' })).toEqual([])
  })
  test('loads records only for clues that can select one', () => {
    expect(canMatch({ kind: 'code', text: 'jnd' })).toBe(false)
    expect(canMatch({ kind: 'code', text: 'ㄇㄥˊ' })).toBe(true)
    expect(canMatch({ kind: 'part', text: '氵' })).toBe(true)
  })
})
