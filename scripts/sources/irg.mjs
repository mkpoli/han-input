// Reading the printed withdrawal lists of the IRG. Poppler's XML gives text and image boxes in one
// coordinate system, so a glyph is matched to the codes printed beside it on the same row.

/** @typedef {{top:number, left:number, width:number, height:number, value:string}} TextBox */
/** @typedef {{top:number, left:number, width:number, height:number, src:string}} ImageBox */
/** @typedef {{number:number, width:number, height:number, text:TextBox[], images:ImageBox[]}} PageBoxes */
/** @typedef {{left:number, top:number, width:number, height:number}} TextGlyphBox */
/** @typedef {{serial:string|null, source:string, target?:string, sequence?:string, char?:string, box?:TextGlyphBox, page:number, file:string}} Row */
/** @typedef {{serialPattern:string, sourcePattern:string, sequencePattern?:string, draftPattern?:string, stopPattern?:string, leftGap?:number, skipUnmatched?:boolean}} Patterns */

/** @param {string} xml @returns {PageBoxes[]} */
export function parsePages(xml) {
  return [...xml.matchAll(/<page number="(\d+)"([\s\S]*?)(?=<page number="|<\/pdf2xml>)/g)].map(([, number, body]) => ({
    number: +number,
    width: +(body.match(/width="(\d+)"/)?.[1] ?? 0),
    height: +(body.match(/height="(\d+)"/)?.[1] ?? 0),
    text: [...body.matchAll(/<text top="(\d+)" left="(\d+)" width="(\d+)" height="(\d+)"[^>]*>(.*?)<\/text>/g)]
      .map(([, top, left, width, height, value]) => ({ top: +top, left: +left, width: +width, height: +height, value: value.replace(/<[^>]+>/g, '').trim() })),
    images: [...body.matchAll(/<image top="(\d+)" left="(\d+)" width="(\d+)" height="(\d+)" src="([^"]+)"/g)]
      .map(([, top, left, width, height, src]) => ({ top: +top, left: +left, width: +width, height: +height, src })),
  }))
}

/**
 * Codes printed to the left of the glyph on its row, one matching the serial and one the source.
 * IRGN1841 stacks a serial over its G source; IRGN1925 prints a sequence number and a Z_SAT source
 * side by side.
 * @param {PageBoxes} page @param {Patterns} patterns @returns {Row[]}
 */
export function codesLeftRows(page, patterns) {
  const serial = new RegExp(patterns.serialPattern)
  const source = new RegExp(patterns.sourcePattern)
  return page.images.map((image, index) => {
    const beside = page.text.filter(text => text.value
      && image.left - text.left >= 20 && image.left - text.left <= (patterns.leftGap ?? 210)
      && Math.abs(text.top + text.height / 2 - (image.top + image.height / 2)) <= 30)
    const serials = beside.filter(text => serial.test(text.value))
    const sources = beside.filter(text => source.test(text.value))
    if (serials.length !== 1 || !sources.length) throw new Error(`Page ${page.number}: glyph ${index} has ${serials.length} serial and ${sources.length} source candidates`)
    const sourceValue = sources.sort((a, b) => a.top - b.top || a.left - b.left).map(text => text.value).join(' ')
    return { serial: serials[0].value, source: sourceValue, page: page.number, file: image.src }
  })
}

/**
 * One line of two codes to the left of the glyph: IRGN1250 prints "00294 JMK65006" per row.
 * @param {PageBoxes} page @param {Patterns} patterns @returns {Row[]}
 */
export function codeTextRows(page, patterns) {
  const serial = new RegExp(`^${patterns.serialPattern}$`)
  const source = new RegExp(`^${patterns.sourcePattern}$`)
  return page.images.map((image, index) => {
    const beside = page.text.filter(text => text.value && image.left - text.left >= 20 && image.left - text.left <= 210
      && Math.abs(text.top + text.height / 2 - (image.top + image.height / 2)) <= 30)
    if (beside.length !== 1) throw new Error(`Page ${page.number}: glyph ${index} has ${beside.length} code candidates`)
    const [serialValue, sourceValue] = beside[0].value.split(/\s+/)
    if (!serial.test(serialValue ?? '') || !source.test(sourceValue ?? '')) throw new Error(`Page ${page.number}: unrecognized row “${beside[0].value}”`)
    return { serial: serialValue, source: sourceValue, page: page.number, file: image.src }
  })
}

/**
 * A list without glyphs: the first cell prints a sequence number and a draft code point, and the
 * source sits in the next cell. IRGN1567 prints "00186 06209" and "V04-4066", and wraps four
 * source codes after the hyphen, so adjacent boxes are joined before the source is read.
 * @param {PageBoxes} page @param {Patterns} patterns @returns {Row[]}
 */
export function dualCodeCellRows(page, patterns) {
  const bare = (/** @type {string} */ pattern) => pattern.replace(/^\^/, '').replace(/\$$/, '')
  const cell = new RegExp(`^(${bare(patterns.serialPattern)})\\s+(${bare(patterns.draftPattern ?? '[0-9A-F]{4,5}')})(?:\\s+(\\S+))?$`)
  const source = new RegExp(`^${patterns.sourcePattern}$`)
  const rows = []
  for (const text of page.text) {
    const match = cell.exec(text.value)
    if (!match) continue
    const [, serialValue, , inline] = match
    const beside = page.text.filter(candidate => candidate.left >= text.left + text.width
      && candidate.left <= text.left + text.width + (patterns.leftGap ?? 100)
      && Math.abs(candidate.top - text.top) <= 24)
      .sort((a, b) => a.top - b.top || a.left - b.left)
    const parts = [...(inline ? [inline] : []), ...beside.map(candidate => candidate.value)]
    const sources = []
    for (let index = 0; index < parts.length; index++) {
      let value = parts[index]
      while (/-$/.test(value) && /^[0-9A-F]+$/.test(parts[index + 1] ?? '')) value += parts[++index]
      for (const token of value.split(/\s+/)) if (source.test(token)) sources.push(token)
    }
    if (sources.length !== 1) throw new Error(`Page ${page.number}: row at ${text.top} has ${sources.length} source candidates`)
    rows.push({ serial: serialValue, source: sources[0], page: page.number, file: '' })
  }
  return rows
}

/**
 * A table without glyphs whose rows print a sequence number and a working number in one cell, with
 * the source in the next column or, when poppler merges tight cells, in the same box. IRGN1306
 * prints "1  00410" then "TC-2122", and sometimes "973  12029  TD-4F3E" on one line.
 * @param {PageBoxes} page @param {Patterns} patterns @returns {Row[]}
 */
export function numberedCodeRows(page, patterns) {
  const bare = (/** @type {string} */ pattern) => pattern.replace(/^\^/, '').replace(/\$$/, '')
  const cell = new RegExp(`^(${bare(patterns.sequencePattern ?? '\\d{1,4}')})\\s+(${bare(patterns.serialPattern)})(?:\\s+(${bare(patterns.sourcePattern)}))?$`)
  const source = new RegExp(`^${patterns.sourcePattern}$`)
  const rows = []
  const consumed = new Set()
  for (const text of page.text) {
    const match = cell.exec(text.value)
    if (!match) continue
    const [, sequence, serial, inline] = match
    let sourceValue = inline
    if (sourceValue) consumed.add(text)
    else {
      const beside = page.text.filter(candidate => !consumed.has(candidate) && source.test(candidate.value)
        && Math.abs(candidate.top - text.top) <= 8
        && candidate.left - text.left > 0 && candidate.left - text.left <= (patterns.leftGap ?? 150))
      if (beside.length !== 1) throw new Error(`Page ${page.number}: row ${sequence} has ${beside.length} source candidates`)
      sourceValue = beside[0].value
      consumed.add(beside[0])
    }
    rows.push({ serial, sequence, source: sourceValue, page: page.number, file: '' })
  }
  const loose = page.text.filter(text => source.test(text.value) && !consumed.has(text))
  if (loose.length) throw new Error(`Page ${page.number}: ${loose.length} source codes without a row`)
  return rows
}

/** @typedef {'codes-left' | 'code-text' | 'code-only' | 'text-pairs' | 'text-glyphs' | 'dual-code-cells' | 'numbered-code-rows' | 'glyph-pairs' | 'source-lines'} Matcher */

/**
 * A list without glyphs: every row prints a sequence number and a source id on one line.
 * @param {PageBoxes} page @param {Patterns} patterns @returns {Row[]}
 */
export function textPairRows(page, patterns) {
  const serial = new RegExp(`^${patterns.serialPattern}$`)
  const source = new RegExp(`^${patterns.sourcePattern}$`)
  const rows = []
  const tops = [...new Set(page.text.map(text => text.top))].sort((a, b) => a - b)
  for (const top of tops) {
    const line = page.text.filter(text => Math.abs(text.top - top) <= 6)
    const serials = line.filter(text => serial.test(text.value))
    const sources = line.filter(text => source.test(text.value))
    if (!serials.length && !sources.length) continue
    if (serials.length !== 1 || sources.length !== 1) throw new Error(`Page ${page.number}: line at ${top} has ${serials.length} serial and ${sources.length} source candidates`)
    rows.push({ serial: serials[0].value, source: sources[0].value, page: page.number, file: '' })
  }
  return [...new Map(rows.map(row => [row.source, row])).values()]
}

/**
 * One code printed to the left of the glyph, with no separate sequence number: IRGN1854 numbers
 * Macao characters as MAC00024 and nothing else.
 * @param {PageBoxes} page @param {Patterns} patterns @returns {Row[]}
 */
export function codeOnlyRows(page, patterns) {
  const source = new RegExp(`^${patterns.sourcePattern}$`)
  return page.images.map(/** @returns {Row | null} */ (image, index) => {
    const beside = page.text.filter(text => text.value && source.test(text.value)
      && image.left - text.left >= 20 && image.left - text.left <= (patterns.leftGap ?? 210)
      && Math.abs(text.top + text.height / 2 - (image.top + image.height / 2)) <= 30)
    if (!beside.length && patterns.skipUnmatched) return null
    if (beside.length !== 1) throw new Error(`Page ${page.number}: glyph ${index} has ${beside.length} code candidates`)
    return { serial: null, source: beside[0].value, page: page.number, file: image.src }
  }).filter(/** @returns {row is Row} */ row => row !== null)
}

/**
 * A running list whose glyph is printed as text in a private-use slot: IRGN1525 prints "UTC00291"
 * and then the character in the document's own font. The glyph box is a single private-use
 * character, and its code is the source token in the nearest box to its left on the same line. An
 * optional stop pattern ends the list before the paragraph that opens the next one.
 * @param {PageBoxes} page @param {Patterns} patterns @returns {Row[]}
 */
export function textGlyphRows(page, patterns) {
  const source = new RegExp(patterns.sourcePattern)
  const stop = patterns.stopPattern ? new RegExp(patterns.stopPattern) : null
  const privateUse = (/** @type {string} */ value) => {
    const point = value.codePointAt(0) ?? 0
    return (point >= 0xE000 && point <= 0xF8FF) || (point >= 0xF0000 && point <= 0xFFFFD) || (point >= 0x100000 && point <= 0x10FFFD)
  }
  const tokens = (/** @type {string} */ value) => value.split(/[\s,;]+/).filter(token => source.test(token))
  const stopTop = stop ? page.text.find(text => stop.test(text.value))?.top : null
  const rows = []
  for (const glyph of page.text) {
    if ([...glyph.value].length !== 1 || !privateUse(glyph.value)) continue
    if (stopTop !== null && stopTop !== undefined && glyph.top >= stopTop) continue
    const beside = page.text.filter(text => text.value && text.left < glyph.left
      && glyph.left - text.left <= (patterns.leftGap ?? 220)
      && Math.abs(text.top + text.height / 2 - (glyph.top + glyph.height / 2)) <= 8)
      .sort((a, b) => (b.left + b.width) - (a.left + a.width))
    if (!beside.length) throw new Error(`Page ${page.number}: glyph at ${glyph.top} has no code candidates`)
    const codes = tokens(beside[0].value)
    if (codes.length !== 1) throw new Error(`Page ${page.number}: glyph at ${glyph.top} has ${codes.length} code candidates`)
    rows.push({
      serial: null, source: codes[0], char: glyph.value,
      box: { left: glyph.left, top: glyph.top, width: glyph.width, height: glyph.height },
      page: page.number, file: '',
    })
  }
  return rows
}

/**
 * Two glyphs per row with their codes printed underneath: IRGN1924 puts a source glyph and the
 * character it is unified with side by side, each labelled below, and the sequence number to the left.
 * @param {PageBoxes} page @returns {Row[]}
 */
export function glyphPairRows(page) {
  /** @param {import('./irg.mjs').ImageBox} image */
  const codeOf = image => page.text.find(text => /^(JMJ-\d+|U\+[0-9A-F]{4,6})$/.test(text.value)
    && Math.abs(text.left - image.left) < 60
    && text.top - (image.top + image.height) >= -6 && text.top - (image.top + image.height) <= 45)
  const groups = new Map()
  for (const image of page.images) {
    const key = Math.round(image.top / 10)
    const group = groups.get(key)
    if (group) group.push(image)
    else groups.set(key, [image])
  }
  const rows = []
  for (const [, images] of groups) {
    if (images.length !== 2) throw new Error(`Page ${page.number}: a row has ${images.length} glyphs`)
    const [left, right] = [...images].sort((a, b) => a.left - b.left)
    const source = codeOf(left)
    const target = codeOf(right)
    if (!source || !/^JMJ-\d+$/.test(source.value)) throw new Error(`Page ${page.number}: the source glyph has no JMJ code`)
    if (!target) throw new Error(`Page ${page.number}: the target glyph has no code`)
    const serial = page.text.find(text => /^\d{5}$/.test(text.value) && text.left < left.left && Math.abs(text.top + text.height / 2 - (left.top + left.height / 2)) <= 40)
    if (!serial) throw new Error(`Page ${page.number}: a row has no sequence number`)
    rows.push({ serial: serial.value, source: source.value, target: target.value, page: page.number, file: left.src })
  }
  return rows
}

/**
 * A prose list of ids printed as running text: IRGN424 prints "A-2360" under a heading. Tokens are
 * read in printed order, and an optional stop pattern ends the list at the paragraph after it.
 * @param {PageBoxes} page @param {Patterns} patterns @returns {Row[]}
 */
export function sourceLineRows(page, patterns) {
  const source = new RegExp(`^${patterns.sourcePattern}$`)
  const stop = patterns.stopPattern ? new RegExp(patterns.stopPattern) : null
  const rows = []
  for (const text of [...page.text].sort((a, b) => a.top - b.top || a.left - b.left)) {
    if (stop?.test(text.value)) break
    for (const token of text.value.split(/[\s,;]+/)) {
      if (source.test(token)) rows.push({ serial: null, source: token, page: page.number, file: '' })
    }
  }
  return rows
}

/** @param {PageBoxes} page @param {Matcher} matcher @param {Patterns} patterns @returns {Row[]} */
export function rowsFor(page, matcher, patterns) {
  if (matcher === 'codes-left') return codesLeftRows(page, patterns)
  if (matcher === 'code-text') return codeTextRows(page, patterns)
  if (matcher === 'code-only') return codeOnlyRows(page, patterns)
  if (matcher === 'text-pairs') return textPairRows(page, patterns)
  if (matcher === 'text-glyphs') return textGlyphRows(page, patterns)
  if (matcher === 'dual-code-cells') return dualCodeCellRows(page, patterns)
  if (matcher === 'numbered-code-rows') return numberedCodeRows(page, patterns)
  if (matcher === 'glyph-pairs') return glyphPairRows(page)
  if (matcher === 'source-lines') return sourceLineRows(page, patterns)
  throw new Error(`Unknown matcher: ${matcher}`)
}
