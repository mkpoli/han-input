// bun scripts/import_pua_gb18030.mjs [L2/06-394.txt]
// GB 18030-2005 keeps 24 characters at their 2000 PUA code points; L2/06-394 lists their Unicode.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const URL = 'http://www.unicode.org/L2/L2006/06394-gb18030-2005.txt'
const SHA256 = 'eef77189966159ee82e1207856c86a0b36818dfb7b61bd7462bfeea0bd88a3f3'

/** @param {string} text */
export function parseGb18030(text) {
  /** @type {Record<string, string>} */
  const mappings = {}
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*0x[0-9A-Fa-f]+\s*->\s*U\+([0-9A-Fa-f]+)\s*->\s*U\+([0-9A-Fa-f]+)/)
    if (!match) continue
    mappings[String.fromCodePoint(parseInt(match[1], 16))] = String.fromCodePoint(parseInt(match[2], 16))
  }
  return mappings
}

if (import.meta.main) {
  const file = process.argv[2]
  const body = file ? readFileSync(file, 'utf8') : await (await fetch(URL)).text()
  const sha256 = createHash('sha256').update(body).digest('hex')
  if (sha256 !== SHA256) throw new Error('the L2/06-394 document changed; review it before importing')
  const mappings = parseGb18030(body)
  const data = {
    source: {
      name: 'GB 18030-2005 PUA remappings, L2/06-394',
      url: URL,
      dataUrl: URL,
      retrieved: '2026-11-08',
      sha256,
      licence: 'Unicode UTC document L2/06-394 by Ken Lunde, Adobe Systems; the code-point mapping is treated here as factual data.',
    },
    mappings: Object.fromEntries(Object.entries(mappings).sort(([a], [b]) => /** @type {number} */ (a.codePointAt(0)) - /** @type {number} */ (b.codePointAt(0)))),
  }
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'gb18030-pua.json'), JSON.stringify(data, null, 2) + '\n')
  console.log(`${Object.keys(data.mappings).length} GB 18030 PUA mappings`)
}
