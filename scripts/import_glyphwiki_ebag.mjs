// Imports the ebag glyphs from the pinned GlyphWiki dump. Sprite sheets are rendered separately by
// scripts/build_ebag_sprites.py with the KAGE engine; this script only reads their symbol names.
//   bun scripts/import_glyphwiki_ebag.mjs
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { fetchOnce } from './lib.mjs'

const OUT = join(import.meta.dirname, '../app/public/charsets')
const DUMP_URL = 'https://glyphwiki.org/dump.tar.gz'
const dump = await fetchOnce(DUMP_URL, 'glyphwiki-dump.tar.gz')
const sha256 = createHash('sha256').update(readFileSync(dump)).digest('hex')

/** @type {string[]} */
const names = []
const tar = spawn('tar', ['-xzf', dump, '-O', 'dump_newest_only.txt'], { stdio: ['ignore', 'pipe', 'inherit'] })
for await (const line of createInterface({ input: tar.stdout })) {
  const [name, , data] = line.split('|').map((/** @type {string} */ cell) => cell.trim())
  if (name?.startsWith('ebag_') && data) names.push(name)
}
await new Promise((resolve, reject) => { tar.on('close', code => code === 0 ? resolve(null) : reject(new Error(`tar exited ${code}`))) })
names.sort()

/** @type {Map<string, string>} */
const sprites = new Map()
const spritesDir = join(OUT, 'ebag-sprites')
for (const file of readdirSync(spritesDir).filter(name => name.endsWith('.svg'))) {
  const sheet = file.slice(0, -4)
  for (const match of readFileSync(join(spritesDir, file), 'utf8').matchAll(/<symbol id="([^"]+)"/g)) sprites.set(match[1], sheet)
}

const records = names.map(name => ({
  document: 'glyphwiki',
  source: name,
  evidenceUrls: [`https://glyphwiki.org/wiki/${name}`],
  ...(sprites.has(name) ? { sprite: { sheet: sprites.get(name), symbol: name } } : {}),
}))
writeFileSync(join(OUT, 'glyphwiki_ebag_source.json'), JSON.stringify({
  dump: {
    url: DUMP_URL,
    retrieved: '2026-11-10',
    sha256,
    licence: 'Free use, copy and distribution',
    licenceUrl: DUMP_URL,
  },
}, null, 2) + '\n')
writeFileSync(join(OUT, 'glyphwiki_ebag.txt'), '')
writeFileSync(join(OUT, 'glyphwiki_ebag_records.json'), JSON.stringify({
  id: 'glyphwiki_ebag',
  title: 'GlyphWiki ebag glyphs',
  complete: true,
  scope: 'GlyphWiki glyphs named ebag_*, the 缺字編號 of 引得市’s ebag missing-character index; shapes render from KAGE data in the GlyphWiki dump.',
  documents: [{
    id: 'glyphwiki',
    document: 'GlyphWiki',
    title: 'GlyphWiki',
    source: 'GlyphWiki',
    date: '2026-11-10',
    url: 'https://glyphwiki.org/',
  }],
  records,
}, null, 0) + '\n')
console.log(`${records.length} ebag glyphs, ${records.filter(record => record.sprite).length} with sprites`)
