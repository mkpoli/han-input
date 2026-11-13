import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CACHE } from '../scripts/lib.mjs'
import { SOURCES, TAGS, charOf, compact, countTags, readTag, readTable, readXinhua, splitTag } from '../scripts/import_sourced_variants.mjs'
import { allVariants, sourcedVariants } from '../src/variants.js'
import sourced from '../data/sourced-variants.json' with { type: 'json' }
import variants from '../data/variants.json' with { type: 'json' }

const HEADER = 'Word, Unicode, Related, Variants, type\r\n'
/** @param {string[][]} rows */
const csv = rows => '﻿' + HEADER + rows.map(row => row.join(',')).join('\r\n') + '\r\n'
/** @param {string} char */
const field = char => `${char}(U+${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')})`
/** @param {string} head @param {string} other @param {string} tags */
const row = (head, other, tags) => [head, 'U+0', field(head), field(other), tags]

describe('tag classification', () => {
  test('every tag in the supplied table is classified, and every kept source exists', () => {
    for (const rule of Object.values(TAGS)) if ('source' in rule) expect(SOURCES).toHaveProperty(rule.source)
    const path = join(CACHE, 'variant-tables', 'computer-hanzi-dictionary.csv')
    if (!existsSync(path)) return
    for (const tag of countTags(readFileSync(path, 'utf8')).keys()) expect(TAGS).toHaveProperty(splitTag(tag).name)
  })
  test('keeps variant, simplification and standard-form tags and drops shape and bookkeeping tags', () => {
    expect(TAGS['異體字（漢語大字典）']).toEqual({ kind: 'variant', source: 'hydzd' })
    expect(TAGS['入管正字']).toEqual({ kind: 'variant', source: 'nyukan' })
    expect(TAGS['簡化字']).toEqual({ kind: 'simplified', source: 'simplified' })
    for (const tag of ['◯囲み', 'カタカナ', 'ボポモフォ', '筆画文字', '關連字（その他）', 'UCS互換', '同型異字']) expect(TAGS[tag]).toHaveProperty('drop')
  })
  test('source codes are single, distinct letters', () => {
    const codes = Object.values(SOURCES).map(source => source.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) expect(code).toMatch(/^[A-Za-z]$/)
  })
  test('refuses a tag it has not classified', () => {
    expect(() => readTag('未知', '學', '学')).toThrow('unclassified tag')
  })
})

describe('direction', () => {
  test('簡化字 reads head to simplified form; a reverse tag reads from the other side', () => {
    expect(readTag('簡化字', '學', '学')).toMatchObject({ kind: 'simplified', from: '學', to: '学' })
    expect(readTag('←簡化字', '学', '學')).toMatchObject({ kind: 'simplified', from: '學', to: '学' })
  })
  test('繁體字 states the same pair as 簡化字 from the other side', () => {
    expect(readTag('繁體字', '学', '學')).toMatchObject({ kind: 'simplified', from: '學', to: '学' })
    expect(readTag('←繁體字', '學', '学')).toMatchObject({ kind: 'simplified', from: '學', to: '学' })
  })
  test('both rows of a pair collapse into one relation that lists each source once', () => {
    const pairs = readTable(csv([
      row('學', '学', '簡化字|異體字（漢語大字典）'),
      row('学', '學', '←簡化字|繁體字|異體字（漢語大字典）|入管正字'),
    ]))
    expect([...pairs.values()].map(pair => ({ ...pair, sources: [...pair.sources] }))).toEqual([
      { kind: 'simplified', from: '學', to: '学', sources: ['simplified'] },
      { kind: 'variant', from: '学', to: '學', sources: ['hydzd', 'nyukan'] },
    ])
  })
  test('the compact form lists the simplified side for the traditional character and the reverse', () => {
    const character = compact(readTable(csv([row('學', '学', '簡化字'), row('学', '學', '繁體字')])))
    expect(character['學']).toBe('学sk')
    expect(character['学']).toBe('學tk')
  })
  test('drops a row with no variant, with itself, or with a dropped tag only', () => {
    const pairs = readTable(csv([['㐇', 'U+3407', '㐇(U+3407)', '', ''], row('一', '一', '入管正字'), row('一', '壱', '◯囲み')]))
    expect(pairs.size).toBe(0)
  })
})

describe('reading the files', () => {
  test('charOf reads the code point and not an unencoded one', () => {
    expect(charOf('學(U+5B78)')).toBe('學')
    expect(charOf('(U+E000)')).toBeNull()
    expect(charOf('')).toBeNull()
  })
  test('新华字典 lines give a headword and the forms after it', () => {
    expect(readXinhua('〇\n㑇（㑳）\n学（學）\n')).toEqual([{ head: '㑇', forms: ['㑳'] }, { head: '学', forms: ['學'] }])
  })
})

describe('the checked-in file', () => {
  test('searching 學 finds 学 as its simplified form and a variant, with source ids expanded', () => {
    const rows = sourcedVariants('學', sourced)
    expect(rows).toContainEqual(expect.objectContaining({ char: '学', relation: 'simplified', sources: ['simplified'] }))
    const variant = rows.find(found => found.char === '学' && found.relation === 'variant')
    expect(variant?.sources).toContain('moe')
    expect(sourced.labels.moe).toBe('教育部異體字字典')
  })
  test('a rare character carries its 漢語大字典 variant', () => {
    const rows = sourcedVariants('㐁', sourced)
    expect(rows.find(found => found.char === '䑙')?.sources).toEqual(['hydzd'])
  })
  test('rows from IWDS and the database for one pair merge into one row', () => {
    const rows = allVariants('叱', variants, sourced)
    expect(rows.filter(found => found.char === '𠮟' && found.relation === 'variant')).toHaveLength(1)
  })
  test('pins both inputs', () => {
    expect(sourced.sources.map(source => source.sha256)).toEqual([
      'da5b73e85cbf1cd24faae4a0b0da638b499d2580695d641c54598f758c22260d',
      '3dda96b1bdcafc4fa5f5242b01ec5e7943d777ae2cadbc1c4295c6a5b5728260',
    ])
  })
})
