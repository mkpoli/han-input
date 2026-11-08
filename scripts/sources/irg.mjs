// Reading the printed withdrawal lists of the IRG. Poppler's XML gives text and image boxes in one
// coordinate system, so a glyph is matched to the codes printed beside it on the same row.

/** @typedef {{top:number, left:number, width:number, height:number, value:string}} TextBox */
/** @typedef {{top:number, left:number, width:number, height:number, src:string}} ImageBox */
/** @typedef {{number:number, text:TextBox[], images:ImageBox[]}} PageBoxes */
/** @typedef {{serial:string, source:string, page:number, file:string}} Row */

/** @param {string} xml @returns {PageBoxes[]} */
export function parsePages(xml) {
  return [...xml.matchAll(/<page number="(\d+)"([\s\S]*?)(?=<page number="|<\/pdf2xml>)/g)].map(([, number, body]) => ({
    number: +number,
    text: [...body.matchAll(/<text top="(\d+)" left="(\d+)" width="(\d+)" height="(\d+)"[^>]*>(.*?)<\/text>/g)]
      .map(([, top, left, width, height, value]) => ({ top: +top, left: +left, width: +width, height: +height, value: value.replace(/<[^>]+>/g, '').trim() })),
    images: [...body.matchAll(/<image top="(\d+)" left="(\d+)" width="(\d+)" height="(\d+)" src="([^"]+)"/g)]
      .map(([, top, left, width, height, src]) => ({ top: +top, left: +left, width: +width, height: +height, src })),
  }))
}

/**
 * A serial with its source code stacked to the left of the glyph: IRGN1841 prints "00171" above
 * "G_ZFY00028" and puts the glyph to their right.
 * @param {PageBoxes} page @returns {Row[]}
 */
export function serialSourceRows(page) {
  const serials = page.text.filter(text => /^\d{5}$/.test(text.value))
  const sources = page.text.filter(text => /^G_[A-Z0-9_.]+$/.test(text.value))
  if (page.images.length !== serials.length) throw new Error(`Page ${page.number}: ${page.images.length} glyphs for ${serials.length} serials`)
  return page.images.map((image, index) => {
    const beside = serials.filter(serial => serial.left < image.left && image.left - (serial.left + serial.width) < 130 && serial.top > image.top - 25 && serial.top < image.top + image.height + 5)
    if (beside.length !== 1) throw new Error(`Page ${page.number}: glyph ${index} has ${beside.length} serial candidates`)
    const [serial] = beside
    const below = sources.filter(source => Math.abs(source.left - serial.left) < 80 && source.top - serial.top > 10 && source.top - serial.top < 45)
    if (below.length !== 1) throw new Error(`Page ${page.number}: ${serial.value} has ${below.length} source candidates`)
    return { serial: serial.value, source: below[0].value, page: page.number, file: image.src }
  })
}

/**
 * One line of two codes to the left of the glyph: IRGN1250 prints "00294 JMK65006" per row.
 * @param {PageBoxes} page @returns {Row[]}
 */
export function codeTextRows(page) {
  return page.images.map((image, index) => {
    const beside = page.text.filter(text => text.value && image.left - text.left >= 20 && image.left - text.left <= 210
      && Math.abs(text.top + text.height / 2 - (image.top + image.height / 2)) <= 30)
    if (beside.length !== 1) throw new Error(`Page ${page.number}: glyph ${index} has ${beside.length} code candidates`)
    const [serial, source] = beside[0].value.split(/\s+/)
    if (!/^\d{5}$/.test(serial ?? '') || !/^\p{Lu}[\p{Lu}0-9]*$/u.test(source ?? '')) throw new Error(`Page ${page.number}: unrecognized row “${beside[0].value}”`)
    return { serial, source, page: page.number, file: image.src }
  })
}

/** @typedef {'serial-source' | 'code-text'} Matcher */

/** @param {PageBoxes} page @param {Matcher} matcher @returns {Row[]} */
export function rowsFor(page, matcher) {
  if (matcher === 'serial-source') return serialSourceRows(page)
  if (matcher === 'code-text') return codeTextRows(page)
  throw new Error(`Unknown matcher: ${matcher}`)
}
