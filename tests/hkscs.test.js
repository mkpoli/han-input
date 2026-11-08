import { describe, expect, test } from 'bun:test'
import { parseHkscs } from '../scripts/import_pua_hkscs.mjs'
import { HKSCS_PUA } from '../src/pua.js'

const body = [
  '\uFEFFHKSCS-2008 HKSCS-2008 in ISO/IEC 10646-1:1993',
  '8740      F266     43F0     43F0',
  '8745      F26B     F26B     27267',
  '8746      4D77     4D77     4D77',
].join('\n')

describe('HKSCS import', () => {
  test('maps a 1993 PUA code point to the 2003 character', () => {
    expect(parseHkscs(body)).toEqual({ '\uF266': '䏰', '\uF26B': '𧉧' })
  })
  test('keeps the table and its provenance', () => {
    expect(Object.keys(HKSCS_PUA.mappings)).toHaveLength(2353)
    expect(HKSCS_PUA.source.sha256).toBe('f52001a4452cc2c790ac5f255b26be3d8d6e24c9a3867f0d271e21f4359bb266')
    expect(HKSCS_PUA.mappings['\uF266']).toBe('䏰')
  })
})
