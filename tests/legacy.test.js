import { describe, test, expect } from 'bun:test'
import { LEGACY_SYMBOLS, convertLegacy, hasLegacy, idsOf, repeatExample } from '../src/legacy.js'

/** @param {string} id */
const symbol = id => /** @type {string} */ (LEGACY_SYMBOLS.find(item => item.id === id)?.char)

const lr = symbol('lr'), ud = symbol('ud'), oc = symbol('oc')
const v2 = symbol('v2'), h2 = symbol('h2'), t3 = symbol('t3'), v3 = symbol('v3'), h3 = symbol('h3')
const q4 = symbol('q4'), v4 = symbol('v4'), h4 = symbol('h4'), start = symbol('start'), end = symbol('end')

describe('old composition formulas', () => {
  test('has thirteen symbols in Big5 order', () => {
    expect(LEGACY_SYMBOLS).toHaveLength(13)
    expect(LEGACY_SYMBOLS.map(item => item.char)).toEqual([...Array(13)].map((_, index) => String.fromCodePoint(0xF6A3 + index)))
    expect(LEGACY_SYMBOLS.map(item => item.big5)).toEqual([...Array(13)].map((_, index) => `8DF${(1 + index).toString(16).toUpperCase()}`))
  })

  test('converts the three connectors', () => {
    expect(convertLegacy(`金${lr}本`).text).toBe('⿰金本')
    expect(convertLegacy(`今${ud}口`).text).toBe('⿱今口')
    expect(convertLegacy(`囗${oc}韋`).text).toBe('⿴囗韋')
  })

  test('converts the eight repetition symbols', () => {
    expect(convertLegacy(`${v2}火`).text).toBe('⿱火火')
    expect(convertLegacy(`${h2}月`).text).toBe('⿰月月')
    expect(convertLegacy(`${t3}火`).text).toBe('⿱火⿰火火')
    expect(convertLegacy(`${v3}火`).text).toBe('⿳火火火')
    expect(convertLegacy(`${h3}木`).text).toBe('⿲木木木')
    expect(convertLegacy(`${q4}火`).text).toBe('⿱⿰火火⿰火火')
    expect(convertLegacy(`${v4}火`).text).toBe('⿱⿱火火⿱火火')
    expect(convertLegacy(`${h4}火`).text).toBe('⿰⿰火火⿰火火')
  })

  test('repeats the same connector to a flat row or column', () => {
    expect(convertLegacy(`言${lr}身${lr}寸`).text).toBe('⿲言身寸')
    expect(convertLegacy(`日${ud}共${ud}言`).text).toBe('⿳日共言')
    expect(convertLegacy(`甲${lr}乙${lr}丙${lr}丁`).text).toBe('⿰⿰甲乙⿰丙丁')
  })

  test('keeps a repeated part as one operand', () => {
    expect(convertLegacy(`${t3}土${ud}兀`).text).toBe('⿱⿱土⿰土土兀')
  })

  test('includes a formula inside running text', () => {
    const result = convertLegacy(`「髟${ud}八」`)
    expect(result.text).toBe('「⿱髟八」')
    expect(result.converted).toBe(1)
  })

  test('leaves a shape marker as parts in writing order', () => {
    const result = convertLegacy(`${start}角刀牛${end}`)
    expect(result.text).toBe('角·刀·牛')
    expect(result.converted).toBe(0)
    expect(result.shapes).toBe(1)
  })

  test('expands a repetition inside a shape marker', () => {
    expect(convertLegacy(`${start}${q4}又酉欠${end}`).text).toBe('又·又·又·又·酉·欠')
  })

  test('counts private-use parts left unresolved', () => {
    const result = convertLegacy(`\uF4D5${lr}扉`)
    expect(result.text).toBe('⿰\uF4D5扉')
    expect(result.unresolved).toBe(1)
    expect(result.unresolvedChars).toEqual(['\uF4D5'])
    expect(convertLegacy(`\uF4D5\uF6A4\uF4D5`).unresolvedChars).toEqual(['\uF4D5'])
  })

  test('leaves mixed connectors and orphans alone', () => {
    const mixed = convertLegacy(`甲${lr}乙${ud}丙`)
    expect(mixed.text).toBe(`甲${lr}乙${ud}丙`)
    expect(mixed.converted).toBe(0)
    expect(mixed.problems.map(problem => problem.code)).toContain('mixed')

    const orphan = convertLegacy(`abcd ${ud} 字`)
    expect(orphan.text).toBe(`abcd ${ud} 字`)
    expect(orphan.problems.map(problem => problem.code)).toContain('orphan')
  })

  test('leaves an empty formula alone', () => {
    const repeat = convertLegacy(v2)
    expect(repeat.text).toBe(v2)
    expect(repeat.converted).toBe(0)
    expect(repeat.problems.map(problem => problem.code)).toContain('repeat-missing')

    const shape = convertLegacy(`${start}${end}`)
    expect(shape.text).toBe(`${start}${end}`)
    expect(shape.shapes).toBe(0)
    expect(shape.problems.map(problem => problem.code)).toContain('shape-empty')
  })

  test('keeps a repetition without a part in the text', () => {
    const formula = convertLegacy(`${v2}${lr}火`)
    expect(formula.text).toBe(`${v2}${lr}火`)
    expect(formula.converted).toBe(0)
    expect(formula.problems.map(problem => problem.code)).toContain('repeat-missing')

    const shape = convertLegacy(`${start}${v2}${end}`)
    expect(shape.text).toBe(`${start}${v2}${end}`)
    expect(shape.problems.map(problem => problem.code)).toContain('repeat-missing')
  })

  test('does not join a shape marker with a connector', () => {
    const result = convertLegacy(`金${lr}${start}角${end}`)
    expect(result.text).toBe(`金${lr}${start}角${end}`)
    expect(result.converted).toBe(0)
    expect(result.problems.map(problem => problem.code)).toContain('shape-chain')
  })

  test('reports an unclosed shape marker', () => {
    const result = convertLegacy(`${start}角刀`)
    expect(result.text).toBe('角·刀')
    expect(result.problems.map(problem => problem.code)).toContain('shape-open')
  })

  test('detects a text that holds a symbol', () => {
    expect(hasLegacy(`金${lr}本`)).toBe(true)
    expect(hasLegacy('金本')).toBe(false)
  })
})

test('writes IDS for any number of parts', () => {
  expect(idsOf('lr', ['甲'])).toBe('甲')
  expect(idsOf('lr', ['甲', '乙'])).toBe('⿰甲乙')
  expect(idsOf('lr', ['甲', '乙', '丙'])).toBe('⿲甲乙丙')
  expect(idsOf('ud', ['甲', '乙', '丙', '丁'])).toBe('⿱⿱甲乙⿱丙丁')
  expect(idsOf('oc', ['囗', '韋', '口'])).toBe('⿴囗⿴韋口')
})

test('shows what a repetition symbol writes', () => {
  expect(repeatExample(LEGACY_SYMBOLS[0])).toBe('⿱··')
  expect(repeatExample(LEGACY_SYMBOLS.find(item => item.id === 'v2') ?? LEGACY_SYMBOLS[0])).toBe('⿱··')
  expect(repeatExample(LEGACY_SYMBOLS.find(item => item.id === 't3') ?? LEGACY_SYMBOLS[0])).toBe('⿱·⿰··')
})
