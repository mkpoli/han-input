import { describe, test, expect } from 'bun:test'
import { parsePages, serialSourceRows, codeTextRows, rowsFor } from '../scripts/sources/irg.mjs'

/** @param {{number:number, text:any[], images:any[]}} page */
const pageOf = page => /** @type {any} */ (page)

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
  test('pairs a serial and the source printed below it with the glyph on their right', () => {
    const page = pageOf({
      number: 2,
      text: [
        { top: 10, left: 20, width: 30, height: 12, value: '00171' },
        { top: 24, left: 20, width: 60, height: 12, value: 'G_ZFY00028' },
      ],
      images: [{ top: 5, left: 60, width: 40, height: 40, src: 'p-2_1.png' }],
    })
    expect(serialSourceRows(page)).toEqual([{ serial: '00171', source: 'G_ZFY00028', page: 2, file: 'p-2_1.png' }])
  })

  test('refuses a glyph without exactly one serial or one source', () => {
    const missing = pageOf({ number: 2, text: [], images: [{ top: 5, left: 60, width: 40, height: 40, src: 'p-2_1.png' }] })
    expect(() => serialSourceRows(missing)).toThrow('1 glyphs for 0 serials')
    const noSource = pageOf({
      number: 2,
      text: [{ top: 10, left: 20, width: 30, height: 12, value: '00171' }],
      images: [{ top: 5, left: 60, width: 40, height: 40, src: 'p-2_1.png' }],
    })
    expect(() => serialSourceRows(noSource)).toThrow('0 source candidates')
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
    expect(codeTextRows(page)).toEqual([{ serial: '00294', source: 'JMK65006', page: 3, file: 'a-3_2.png' }])
  })

  test('rejects an unreadable row and an unknown matcher', () => {
    const bad = pageOf({
      number: 3,
      text: [{ top: 171, left: 104, width: 164, height: 19, value: 'C1 v20' }],
      images: [{ top: 154, left: 252, width: 42, height: 42, src: 'a-3_2.png' }],
    })
    expect(() => codeTextRows(bad)).toThrow('unrecognized row')
    expect(() => codeTextRows(pageOf({ number: 3, text: [], images: bad.images }))).toThrow('0 code candidates')
    expect(() => rowsFor(bad, 'nope')).toThrow('Unknown matcher')
  })
})
