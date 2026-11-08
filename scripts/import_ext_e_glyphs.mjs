// bun scripts/import_ext_e_glyphs.mjs
// The Ext.E withdrawal records and the glyph images of IRGN1841. Poppler reads the pinned PDF;
// text and image boxes share one coordinate system, so each glyph is matched to the serial and
// G-source printed beside it. The result is checked against the record count before writing.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { fetchOnce } from './lib.mjs'

/** @typedef {{id:string, document:string, title:string, source:string, date:string, url:string, status?:string, count?:number, pages?:number[]}} CuratedDocument */
/** @typedef {{serial?:string|null, source?:string|null, document:string, status?:string, mappedUnicode?:string|null, mappedCharacter?:string, mappingKind?:string, evidenceUrls?:string[], mappingEvidence?:string}} CuratedRecord */
/** @typedef {{title:string, complete:boolean, scope:string, documents:CuratedDocument[], additionalRecords:CuratedRecord[]}} Curated */

const ROOT = join(import.meta.dirname, '..')
const OUT = join(ROOT, 'app/public/charsets')
/** @type {Curated} */
const curated = JSON.parse(readFileSync(join(ROOT, 'data/irg-ext-e.json'), 'utf8'))
/** @type {{url:string, sha256:string}[]} */
const pinned = JSON.parse(readFileSync(join(OUT, 'sources.json'), 'utf8')).inputs
const doc = curated.documents.find(document => document.id === 'n1841')
if (!doc) throw new Error('IRGN1841 document entry is missing')

const pdf = await fetchOnce(doc.url)
const digest = createHash('sha256').update(readFileSync(pdf)).digest('hex')
const expected = pinned.find(input => input.url === doc.url)?.sha256
if (!expected) throw new Error('IRGN1841 is not pinned in sources.json')
if (digest !== expected) throw new Error('IRGN1841 source digest changed; review before importing')

const work = mkdtempSync(join(ROOT, 'cache/irg-'))
try {
  execFileSync('pdftohtml', ['-xml', '-q', pdf, 'page.xml'], { cwd: work, stdio: 'inherit' })
  const xml = readFileSync(join(work, 'page.xml'), 'utf8')

  /** @param {string} body */
  function boxes(body) {
    const text = [...body.matchAll(/<text top="(\d+)" left="(\d+)" width="(\d+)" height="(\d+)"[^>]*>(.*?)<\/text>/g)]
      .map(([, top, left, width, height, value]) => ({ top: +top, left: +left, width: +width, height: +height, value: value.replace(/<[^>]+>/g, '').trim() }))
    const images = [...body.matchAll(/<image top="(\d+)" left="(\d+)" width="(\d+)" height="(\d+)" src="([^"]+)"/g)]
      .map(([, top, left, width, height, src]) => ({ top: +top, left: +left, width: +width, height: +height, src }))
    return { text, images }
  }

  const pages = [...xml.matchAll(/<page number="(\d+)"([\s\S]*?)(?=<page number="|<\/pdf2xml>)/g)]
    .map(([, number, body]) => ({ number: +number, ...boxes(body) }))

  /** @type {{ serial: string, source: string, page: number, file: string }[]} */
  const rows = []
  const pageNumbers = doc.pages ?? []
  if (!pageNumbers.length) throw new Error('IRGN1841 pages are not set')
  for (const page of pageNumbers) {
    const content = pages.find(entry => entry.number === page)
    if (!content) throw new Error(`IRGN1841 has no page ${page}`)
    execFileSync('pdfimages', ['-png', '-f', String(page), '-l', String(page), pdf, 'glyph'], { cwd: work, stdio: 'inherit' })
    const serials = content.text.filter(text => /^\d{5}$/.test(text.value))
    const sources = content.text.filter(text => /^G_[A-Z0-9_.]+$/.test(text.value))
    content.images.forEach((image, index) => {
      // The serial sits to the left of its glyph, the G source directly below it.
      const beside = serials.filter(serial => serial.left < image.left && image.left - (serial.left + serial.width) < 130 && serial.top > image.top - 25 && serial.top < image.top + image.height + 5)
      if (beside.length !== 1) throw new Error(`Page ${page}: glyph ${index} has ${beside.length} serial candidates`)
      const [serial] = beside
      const below = sources.filter(source => Math.abs(source.left - serial.left) < 80 && source.top - serial.top > 10 && source.top - serial.top < 45)
      if (below.length !== 1) throw new Error(`Page ${page}: ${serial.value} has ${below.length} G-source candidates`)
      rows.push({ serial: serial.value, source: below[0].value, page, file: image.src })
    })
    if (content.images.length !== serials.length) throw new Error(`Page ${page}: ${content.images.length} glyphs for ${serials.length} serials`)
  }

  if (rows.length !== doc.count) throw new Error(`${rows.length} glyphs for ${doc.count} listed characters`)
  if (new Set(rows.map(row => row.serial)).size !== rows.length) throw new Error('Repeated IRGN1841 serial')
  if (new Set(rows.map(row => row.source)).size !== rows.length) throw new Error('Repeated IRGN1841 G source')

  const glyphDir = join(OUT, 'glyphs/ext-e')
  rmSync(glyphDir, { recursive: true, force: true })
  mkdirSync(glyphDir, { recursive: true })
  const records = rows.map(row => {
    copyFileSync(join(work, row.file), join(glyphDir, `${row.serial}.png`))
    return { serial: row.serial, source: row.source, document: 'n1841', page: row.page, glyph: `glyphs/ext-e/${row.serial}.png` }
  })
  // The PDF paints these stencils with either polarity. Make the strokes black on a transparent
  // ground, reading the corner pixel as the background.
  for (const record of records) {
    const file = join(glyphDir, `${record.serial}.png`)
    const corner = Number(execFileSync('magick', ['identify', '-format', '%[fx:u.p{0,0}]', file]).toString().trim())
    if (corner === 0) execFileSync('magick', [file, '-negate', file])
    execFileSync('magick', [file, '-transparent', 'white', file])
  }

  const data = {
    title: curated.title,
    complete: curated.complete,
    scope: curated.scope,
    documents: curated.documents.map(({ pages, count, ...rest }) => rest),
    records: [...records, ...curated.additionalRecords],
  }
  writeFileSync(join(OUT, 'ext_e_records.json'), JSON.stringify(data, null, 2) + '\n')
  console.log(`${records.length} IRGN1841 glyphs, ${curated.additionalRecords.length} further records`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
