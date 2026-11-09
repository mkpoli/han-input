import { describe, test, expect } from 'bun:test'
import { parsePages, codesLeftRows, codeTextRows, dualCodeCellRows, numberedCodeRows, rowsFor } from '../scripts/sources/irg.mjs'

/** @param {{number:number, text:any[], images:any[]}} page */
const pageOf = page => /** @type {any} */ (page)
const G = { serialPattern: '^\\d{5}$', sourcePattern: '^G_[A-Z0-9_.]+$' }
const SAT = { serialPattern: '^\\d{1,5}$', sourcePattern: '^Z_SAT\\d+$' }

describe('IRG list boxes', () => {
  test('reads text and image boxes page by page', () => {
    const xml = '<pdf2xml><page number="2"><text top="10" left="20" width="30" height="12">00171</text>'
      + '<image top="5" left="60" width="40" height="40" src="p-2_1.png"/></page><page number="3"></page></pdf2xml>'
    const pages = parsePages(xml)
    expect(pages).toHaveLength(2)
    expect(pages[0].number).toBe(2)
    expect(pages[0].text[0]).toMatchObject({ top: 10, left: 20, width: 30, height: 12, value: '00171' })
    expect(pages[0].images[0]).toMatchObject({ top: 5, left: 60, width: 40, height: 40, src: 'p-2_1.png' })
    expect(pages[1].text).toEqual([])
  })
})

describe('row matching', () => {
  test('pairs a serial and the source printed under it with the glyph on their right', () => {
    const page = pageOf({
      number: 2,
      text: [
        { top: 10, left: 20, width: 30, height: 12, value: '00171' },
        { top: 24, left: 20, width: 60, height: 12, value: 'G_ZFY00028' },
      ],
      images: [{ top: 5, left: 60, width: 40, height: 40, src: 'p-2_1.png' }],
    })
    expect(codesLeftRows(page, G)).toEqual([{ serial: '00171', source: 'G_ZFY00028', page: 2, file: 'p-2_1.png' }])
  })

  test('pairs codes printed side by side in a far column with the glyph', () => {
    const page = pageOf({
      number: 2,
      text: [
        { top: 188, left: 72, width: 30, height: 14, value: '181' },
        { top: 188, left: 229, width: 83, height: 14, value: 'Z_SAT60006' },
      ],
      images: [{ top: 137, left: 327, width: 112, height: 112, src: 'c-2_1.png' }],
    })
    expect(codesLeftRows(page, { ...SAT, leftGap: 320 })).toEqual([{ serial: '181', source: 'Z_SAT60006', page: 2, file: 'c-2_1.png' }])
    expect(() => codesLeftRows(page, SAT)).toThrow('0 serial and 1 source candidates')
  })

  test('refuses a glyph without exactly one serial or one source', () => {
    const missing = pageOf({ number: 2, text: [], images: [{ top: 5, left: 60, width: 40, height: 40, src: 'p-2_1.png' }] })
    expect(() => codesLeftRows(missing, G)).toThrow('0 serial and 0 source candidates')
    const noSource = pageOf({
      number: 2,
      text: [{ top: 10, left: 20, width: 30, height: 12, value: '00171' }],
      images: [{ top: 5, left: 60, width: 40, height: 40, src: 'p-2_1.png' }],
    })
    expect(() => codesLeftRows(noSource, G)).toThrow('0 source candidates')
  })

  test('splits the codes printed on one line beside the glyph', () => {
    const page = pageOf({
      number: 3,
      text: [
        { top: 171, left: 104, width: 164, height: 19, value: '00294 JMK65006' },
        { top: 171, left: 348, width: 137, height: 19, value: '02652 JMK65045' },
        { top: 123, left: 104, width: 47, height: 19, value: 'C1 v20' },
      ],
      images: [{ top: 154, left: 252, width: 42, height: 42, src: 'a-3_2.png' }],
    })
    const JMK = { serialPattern: '^\\d{5}$', sourcePattern: '^JMK\\d+$' }
    expect(codeTextRows(page, JMK)).toEqual([{ serial: '00294', source: 'JMK65006', page: 3, file: 'a-3_2.png' }])
  })

  test('rejects an unreadable row and an unknown matcher', () => {
    const bad = pageOf({
      number: 3,
      text: [{ top: 171, left: 104, width: 164, height: 19, value: 'C1 v20' }],
      images: [{ top: 154, left: 252, width: 42, height: 42, src: 'a-3_2.png' }],
    })
    expect(() => codeTextRows(bad, G)).toThrow('unrecognized row')
    expect(() => codeTextRows(pageOf({ number: 3, text: [], images: bad.images }), G)).toThrow('0 code candidates')
    expect(() => rowsFor(bad, 'nope', G)).toThrow('Unknown matcher')
  })
})

describe('numbered code rows', () => {
  const T = { sequencePattern: '^\\d{1,4}$', serialPattern: '^[0-9A-F]{5}$', sourcePattern: '^T[CDE]-[0-9A-F]{4}$' }
  test('reads a row number and working number from one cell with the source in the next column', () => {
    const page = pageOf({
      number: 3,
      text: [
        { top: 120, left: 147, width: 86, height: 17, value: '1  00410' },
        { top: 120, left: 255, width: 75, height: 17, value: 'TC-2122' },
        { top: 120, left: 349, width: 86, height: 17, value: '37 00863' },
        { top: 120, left: 462, width: 75, height: 17, value: 'TC-2269' },
        { top: 149, left: 147, width: 86, height: 17, value: '973  12029  TD-4F3E' },
      ],
      images: [],
    })
    expect(numberedCodeRows(page, T)).toEqual([
      { serial: '00410', sequence: '1', source: 'TC-2122', page: 3, file: '' },
      { serial: '00863', sequence: '37', source: 'TC-2269', page: 3, file: '' },
      { serial: '12029', sequence: '973', source: 'TD-4F3E', page: 3, file: '' },
    ])
  })

  test('refuses a row without exactly one source and any source outside a row', () => {
    const missing = pageOf({
      number: 3,
      text: [{ top: 120, left: 147, width: 86, height: 17, value: '1  00410' }],
      images: [],
    })
    expect(() => numberedCodeRows(missing, T)).toThrow('0 source candidates')
    const repeated = pageOf({
      number: 3,
      text: [
        { top: 120, left: 147, width: 86, height: 17, value: '1  00410' },
        { top: 120, left: 255, width: 75, height: 17, value: 'TC-2122' },
        { top: 120, left: 290, width: 75, height: 17, value: 'TC-2123' },
      ],
      images: [],
    })
    expect(() => numberedCodeRows(repeated, T)).toThrow('2 source candidates')
    const loose = pageOf({
      number: 3,
      text: [
        { top: 120, left: 147, width: 86, height: 17, value: '1  00410' },
        { top: 120, left: 255, width: 75, height: 17, value: 'TC-2122' },
        { top: 149, left: 255, width: 75, height: 17, value: 'TC-2269' },
      ],
      images: [],
    })
    expect(() => numberedCodeRows(loose, T)).toThrow('1 source codes without a row')
  })
})

describe('two-code cells', () => {
  const V = {
    serialPattern: '^\\d{5}$',
    sourcePattern: '^V\\d{2}-[0-9A-F]{4}$',
    draftPattern: '^[0-9A-F]{4,5}$',
  }
  test('splits a serial and draft code point printed in one cell from the source beside it', () => {
    const page = pageOf({
      number: 2,
      text: [
        { top: 351, left: 85, width: 117, height: 17, value: '00186 06209' },
        { top: 351, left: 221, width: 82, height: 17, value: 'V04-4066' },
        { top: 342, left: 307, width: 31, height: 34, value: '戉' },
      ],
      images: [],
    })
    expect(dualCodeCellRows(page, V)).toEqual([{ serial: '00186', source: 'V04-4066', page: 2, file: '' }])
  })

  test('reads a source printed in the same cell, and joins one wrapped after the hyphen', () => {
    const inline = pageOf({
      number: 2,
      text: [{ top: 692, left: 85, width: 219, height: 17, value: '00373 062C4  V04-4141' }],
      images: [],
    })
    expect(dualCodeCellRows(inline, V)).toEqual([{ serial: '00373', source: 'V04-4141', page: 2, file: '' }])
    const wrapped = pageOf({
      number: 7,
      text: [
        { top: 588, left: 85, width: 118, height: 17, value: '03585 06F50' },
        { top: 580, left: 221, width: 32, height: 17, value: 'V04-' },
        { top: 597, left: 221, width: 42, height: 17, value: '4A2C' },
      ],
      images: [],
    })
    expect(dualCodeCellRows(wrapped, V)).toEqual([{ serial: '03585', source: 'V04-4A2C', page: 7, file: '' }])
  })

  test('refuses a row without exactly one source', () => {
    const missing = pageOf({
      number: 2,
      text: [{ top: 351, left: 85, width: 117, height: 17, value: '00186 06209' }],
      images: [],
    })
    expect(() => dualCodeCellRows(missing, V)).toThrow('0 source candidates')
    const repeated = pageOf({
      number: 2,
      text: [
        { top: 351, left: 85, width: 117, height: 17, value: '00186 06209' },
        { top: 351, left: 221, width: 82, height: 17, value: 'V04-4066' },
        { top: 351, left: 221, width: 82, height: 17, value: 'V04-4067' },
      ],
      images: [],
    })
    expect(() => dualCodeCellRows(repeated, V)).toThrow('2 source candidates')
  })
})
