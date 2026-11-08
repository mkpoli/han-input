import { describe, test, expect } from 'bun:test'
import { PAJA_OPERATORS, convertPaja, isPaja } from '../src/paja.js'

describe('Korean 破字', () => {
  test('lists the four relations', () => {
    expect(PAJA_OPERATORS.map(item => [item.char, item.ids])).toEqual([
      ['+', '⿰'], ['-', '㇯'], ['/', '⿱'], ['*', '⿻'],
    ])
  })

  test('converts the four signs', () => {
    expect(convertPaja('氵+飛').ids).toBe('⿰氵飛')
    expect(convertPaja('髟/目').ids).toBe('⿱髟目')
    expect(convertPaja('日-月').ids).toBe('㇯日月')
    expect(convertPaja('(臼*米)/皿').ids).toBe('⿱⿻臼米皿')
  })

  test('groups and keeps arithmetic precedence', () => {
    expect(convertPaja('石+(毁-殳)').ids).toBe('⿰石㇯毁殳')
    expect(convertPaja('穴/(爿+未)').ids).toBe('⿱穴⿰爿未')
    expect(convertPaja('A+B*C').ids).toBe('⿰A⿻BC')
    expect(convertPaja('A*B+C').ids).toBe('⿰⿻ABC')
  })

  test('reads a missing + as left-right', () => {
    expect(convertPaja('氵飛').ids).toBe('⿰氵飛')
    expect(convertPaja('日 月').ids).toBe('⿰日月')
  })

  test('reads the database marker and braces', () => {
    const result = convertPaja('▼{日/央}')
    expect(result.ids).toBe('⿱日央')
    expect(result.variant).toBe(true)
    expect(result.notes).toContain('variant')
  })

  test('reads full-width signs', () => {
    expect(convertPaja('氵＋飛').ids).toBe('⿰氵飛')
    expect(convertPaja('（日＊月）').ids).toBe('⿻日月')
  })

  test('keeps the result parts and the deleted part apart', () => {
    const result = convertPaja('石+(毁-殳)')
    expect(result.parts).toEqual(['石', '毁'])
    expect(result.operands).toEqual(['石', '毁', '殳'])
    expect(convertPaja('木+木').parts).toEqual(['木', '木'])
    expect(result.notes).toContain('subtract')
  })

  test('reports malformed formulas', () => {
    for (const [text, code] of [['', 'empty'], ['+A', 'expected-operand'], ['(A', 'unclosed'], ['A)', 'unexpected'], ['A+', 'expected-operand']]) {
      const result = convertPaja(text)
      expect(result.ids).toBe('')
      expect(result.problems[0]?.code).toBe(code)
    }
  })
})

test('detects a 破字 query without taking codes or dates', () => {
  for (const text of ['氵+飛', '▼{日/央}', '日-月', '一+二']) expect(isPaja(text)).toBe(true)
  for (const text of ['cangjie5:jnd', '2026-11-09', 'A+B', '漢字']) expect(isPaja(text)).toBe(false)
})
