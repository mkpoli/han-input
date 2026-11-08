import { describe, test, expect } from 'bun:test'
import { parsePages, codesLeftRows, codeTextRows, rowsFor } from '../scripts/sources/irg.mjs'

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
