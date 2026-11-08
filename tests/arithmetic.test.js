import { describe, test, expect } from 'bun:test'
import { ARITHMETIC_SIGNS, convertArithmetic, isArithmetic } from '../src/arithmetic.js'

describe('arithmetic composition', () => {
  test('lists the signs of both notations', () => {
    expect(ARITHMETIC_SIGNS.map(item => [item.notation, item.signs.map(sign => `${sign.char} ${sign.relation}`)])).toEqual([
      ['korean', ['+ horizontal', '- delete', '/ vertical', '* combine']],
      ['general', ['* horizontal', '/ vertical', '@ contain', '- delete', '+ replace', '? unknown']],
    ])
  })

  test('reads the Korean History Database signs', () => {
    expect(convertArithmetic('氵+飛').ids).toBe('⿰氵飛')
    expect(convertArithmetic('髟/目').ids).toBe('⿱髟目')
    expect(convertArithmetic('日-月').ids).toBe('㇯日月')
    expect(convertArithmetic('(臼*米)/皿').ids).toBe('⿱⿻臼米皿')
    expect(convertArithmetic('石+(毁-殳)').ids).toBe('⿰石㇯毁殳')
    expect(convertArithmetic('氵飛').ids).toBe('⿰氵飛')
    expect(convertArithmetic('▼{日/央}').ids).toBe('⿱日央')
    expect(convertArithmetic('氵＋飛').ids).toBe('⿰氵飛')
  })

  test('reads CBETA general signs', () => {
    expect(convertArithmetic('日*月', 'general').ids).toBe('⿰日月')
    expect(convertArithmetic('立/日', 'general').ids).toBe('⿱立日')
    expect(convertArithmetic('囗@大', 'general').ids).toBe('⿴囗大')
    expect(convertArithmetic('請-言', 'general').ids).toBe('㇯請言')
    expect(convertArithmetic('間-日+月', 'general').ids).toBe('⿻㇯間日月')
    expect(convertArithmetic('(?*匕)/月', 'general').ids).toBe('⿱⿰?匕月')
    expect(convertArithmetic('羅[目*侯]羅母耶輸陀羅', 'general').ids).toBe('⿰目侯')
  })

  test('keeps the result parts and the deleted part apart', () => {
    expect(convertArithmetic('石+(毁-殳)').parts).toEqual(['石', '毁'])
    expect(convertArithmetic('石+(毁-殳)').operands).toEqual(['石', '毁', '殳'])
    expect(convertArithmetic('木+木').parts).toEqual(['木', '木'])
    expect(convertArithmetic('間-日+月', 'general').parts).toEqual(['間', '月'])
    expect(convertArithmetic('(?*匕)/月', 'general').parts).toEqual(['匕', '月'])
  })

  test('groups and keeps arithmetic precedence', () => {
    expect(convertArithmetic('石+(毁-殳)').ids).toBe('⿰石㇯毁殳')
    expect(convertArithmetic('穴/(爿+未)').ids).toBe('⿱穴⿰爿未')
    expect(convertArithmetic('A+B*C').ids).toBe('⿰A⿻BC')
    expect(convertArithmetic('A*B+C').ids).toBe('⿰⿻ABC')
    expect(convertArithmetic('甲*乙@丙', 'general').ids).toBe('⿴⿰甲乙丙')
  })

  test('reads the database marker, braces and text separators', () => {
    const korean = convertArithmetic('▼{日/央}')
    expect(korean.variant).toBe(true)
    expect(korean.notes).toContain('variant')
    const general = convertArithmetic('羅[目*侯]羅母耶輸陀羅', 'general')
    expect(general.separator).toBe(true)
    expect(general.notes).toContain('separator')
  })

  test('reports malformed formulas', () => {
    for (const [text, notation, code] of [['', 'korean', 'empty'], ['+A', 'korean', 'expected-operand'], ['(A', 'korean', 'unclosed'], ['A)', 'korean', 'unexpected'], ['A+', 'korean', 'expected-operand'], ['A+B', 'general', 'trailing']]) {
      const result = convertArithmetic(text, /** @type {'korean' | 'general'} */ (notation))
      expect(result.ids).toBe('')
      expect(result.problems[0]?.code).toBe(code)
    }
  })
})

test('detects an arithmetic query without taking codes or dates', () => {
  for (const text of ['氵+飛', '▼{日/央}', '日*月', '間-日+月', '囗@大']) expect(isArithmetic(text)).toBe(true)
  for (const text of ['cangjie5:jnd', '2026-11-09', 'A+B', '漢字']) expect(isArithmetic(text)).toBe(false)
  expect(isArithmetic('囗@大', 'korean')).toBe(false)
  expect(isArithmetic('囗@大', 'general')).toBe(true)
})
