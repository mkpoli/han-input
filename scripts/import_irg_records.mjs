// bun scripts/import_irg_records.mjs
// The printed withdrawal lists of IRG proposals: every glyph with the serial and source codes the
// document prints beside it. Poppler reads each pinned PDF, the glyph stencils are copied out and
// made black on a transparent ground. A set is written only when its record count and its codes
// check out.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { fetchOnce } from './lib.mjs'
import { parsePages, rowsFor } from './sources/irg.mjs'

/** @typedef {{id:string, document:string, title:string, source:string, date:string, url:string, status?:string}} CuratedDocument */
/** @typedef {{serial?:string|null, source?:string|null, document:string, status?:string, mappedUnicode?:string|null, mappedCharacter?:string, mappingKind?:string, evidenceUrls?:string[], mappingEvidence?:string}} CuratedRecord */
/** @typedef {import('./sources/irg.mjs').Matcher} Matcher */
/** @typedef {{document:string, pages:number[], matcher:Matcher, serialPattern:string, sourcePattern:string, sequencePattern?:string, draftPattern?:string, stopPattern?:string, leftGap?:number, duplicateSources?:boolean, status?:string, count:number}} ExtractStep */
/** @typedef {{id:string, file:string, group:string, label:string, glyphs:string, names:{en:string,zh?:string,hans?:string,ja?:string,ko?:string}, title:string, complete:boolean, scope:string, source:{name:string,url:string}, documents:CuratedDocument[], extract:ExtractStep[], additionalRecords:CuratedRecord[]}} CuratedSet */
/** @typedef {{sets:CuratedSet[]}} Curated */
/** @typedef {{serial:string|null, source:string, target?:string, sequence?:string, document:string, page:number, glyph:string, from:string, status?:string}} Row */

const ROOT = join(import.meta.dirname, '..')
const OUT = join(ROOT, 'app/public/charsets')
/** @type {Curated} */
const curated = JSON.parse(readFileSync(join(ROOT, 'data/irg-records.json'), 'utf8'))
/** @type {{url:string, sha256:string}[]} */
const pinned = JSON.parse(readFileSync(join(OUT, 'sources.json'), 'utf8')).inputs

const work = mkdtempSync(join(ROOT, 'cache/irg-'))
/** @type {Map<string, import('./sources/irg.mjs').PageBoxes[]>} */
const parsed = new Map()
/** @type {Map<string, string>} */
const pdfs = new Map()

/**
 * IRGN1525 prints its glyphs as private-use text instead of stencils. Render just the glyph box
 * from the pinned PDF and keep the strokes black on white, so the copy step can make white
 * transparent like the stencil glyphs.
 * @param {CuratedDocument} document @param {import('./sources/irg.mjs').PageBoxes} page @param {import('./sources/irg.mjs').Row} row
 */
function textGlyphPng(document, page, row) {
  const pdf = pdfs.get(document.url)
  if (!pdf || !row.box) throw new Error(`${document.document}: no page source for a text glyph`)
  // pdftohtml writes 1.5 pt per coordinate unit; pdftocairo -x/-y/-W/-H take pixels at the dpi.
  const scale = 600 / 72 / 1.5
  const pageWidth = Math.round(page.width * scale)
  const pageHeight = Math.round(page.height * scale)
  const x = Math.max(0, Math.round(row.box.left * scale))
  const y = Math.max(0, Math.round(row.box.top * scale) - 2)
  const width = Math.min(pageWidth - x, Math.round(row.box.width * scale))
  const height = Math.min(pageHeight - y, Math.round(row.box.height * scale) + 4)
  const png = join(work, `${document.id}-${row.page}-${row.source.replace(/[^\w-]+/g, '_')}.png`)
  execFileSync('pdftocairo', ['-png', '-r', '600', '-x', String(x), '-y', String(y), '-W', String(width), '-H', String(height), '-singlefile', pdf, png.replace(/\.png$/, '')], { stdio: 'ignore' })
  execFileSync('magick', [png, '-colorspace', 'gray', '-threshold', '50%', '-trim', '+repage', '-bordercolor', 'white', '-border', '2', png])
  return png
}

/** @param {CuratedDocument} document */
async function pagesOf(document) {
  const cached = parsed.get(document.url)
  if (cached) return cached
  const pdf = await fetchOnce(document.url)
  pdfs.set(document.url, pdf)
  const digest = createHash('sha256').update(readFileSync(pdf)).digest('hex')
  const expected = pinned.find(input => input.url === document.url)?.sha256
  if (!expected) throw new Error(`${document.document} is not pinned in sources.json`)
  if (digest !== expected) throw new Error(`${document.document} source digest changed; review before importing`)
  // One directory per document: pdftohtml names its image files by page and box only.
  const dir = join(work, document.id)
  mkdirSync(dir, { recursive: true })
  execFileSync('pdftohtml', ['-xml', '-q', pdf, 'page.xml'], { cwd: dir, stdio: 'inherit' })
  const pages = parsePages(readFileSync(join(dir, 'page.xml'), 'utf8'))
  for (const page of pages) for (const image of page.images) image.src = join(dir, image.src)
  parsed.set(document.url, pages)
  return pages
}

try {
  for (const set of curated.sets) {
    /** @type {Row[]} */
    const rows = []
    for (const step of set.extract) {
      const document = set.documents.find(entry => entry.id === step.document)
      if (!document) throw new Error(`${set.id}: no document ${step.document}`)
      const pages = await pagesOf(document)
      /** @type {Row[]} */
      const found = []
      for (const number of step.pages) {
        const page = pages.find(entry => entry.number === number)
        if (!page) throw new Error(`${document.document} has no page ${number}`)
        let pageRows
        try { pageRows = rowsFor(page, step.matcher, step) } catch (error) { throw new Error(`${set.id}/${document.document}: ${/** @type {Error} */ (error).message}`) }
        for (const row of pageRows) {
          if (row.char && row.box) row.file = textGlyphPng(document, page, row)
          found.push({ ...row, document: document.id, glyph: row.file ? `${set.glyphs}/${row.serial ?? row.source}.png` : '', from: row.file, ...(step.status ? { status: step.status } : {}) })
        }
      }
      if (found.length !== step.count) throw new Error(`${set.id}: ${found.length} glyphs for ${step.count} listed characters`)
      rows.push(...found)
    }
    rows.sort((a, b) => (a.serial ?? a.source).localeCompare(b.serial ?? b.source))
    const serials = rows.filter(row => row.from).map(row => row.serial).filter(Boolean)
    if (new Set(serials).size !== serials.length) throw new Error(`${set.id}: repeated serial`)
    // IRGN1306 lists two sources twice; the flag keeps that evidence instead of deduplicating it.
    const duplicatesAllowed = set.extract.some(step => step.duplicateSources)
    if (!duplicatesAllowed && new Set(rows.map(row => row.source)).size !== rows.length) throw new Error(`${set.id}: repeated source`)

    const glyphDir = join(OUT, set.glyphs)
    rmSync(glyphDir, { recursive: true, force: true })
    mkdirSync(glyphDir, { recursive: true })
    for (const row of rows.filter(entry => entry.from)) {
      const target = join(OUT, row.glyph)
      copyFileSync(row.from, target)
      const corner = Number(execFileSync('magick', ['identify', '-format', '%[fx:u.p{0,0}]', target]).toString().trim())
      if (corner === 0) execFileSync('magick', [target, '-negate', target])
      execFileSync('magick', [target, '-transparent', 'white', target])
    }

    const data = {
      id: set.id, group: set.group, label: set.label, names: set.names,
      title: set.title, complete: set.complete, scope: set.scope,
      source: set.source,
      documents: set.documents,
      records: [
        ...rows.map(({ serial, source, target, sequence, document, page, glyph, status }) => ({ ...(serial ? { serial } : {}), ...(sequence ? { sequence } : {}), source, document, page, ...(glyph ? { glyph } : {}), ...(target ? { unifiedWith: target } : {}), ...(status ? { status } : {}) })),
        ...set.additionalRecords,
      ],
    }
    writeFileSync(join(OUT, set.file), JSON.stringify(data, null, 2) + '\n')
    console.log(`${set.id}: ${rows.length} records, ${rows.filter(row => row.glyph).length} glyphs, ${set.additionalRecords.length} further records`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
