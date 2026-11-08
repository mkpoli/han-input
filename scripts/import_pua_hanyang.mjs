// bun scripts/import_pua_hanyang.mjs [lib/db.js]
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const URL = 'https://raw.githubusercontent.com/SaschaNaz/hypua-unicoder/HEAD/lib/db.js'
const SHA256 = '6f7b71bc8a22bb3fcffb7a420c1282e555501db4f84cbeeb7d6c227529db7be9'

/** The file is a JS object literal; evaluate it after the checksum check. @param {string} body */
export function parseHanyang(body) {
  const code = body.replace(/^"use strict";/, '').replace(/Object\.defineProperty\([^\n]*\n/, '').replace('exports.default =', 'module.exports =')
  const mod = { exports: {} }
  new Function('module', 'exports', code)(mod, mod.exports)
  return /** @type {Record<string, string>} */ (mod.exports)
}

if (import.meta.main) {
  const input = process.argv[2]
  const body = input ? readFileSync(input, 'utf8') : await (await fetch(URL)).text()
  const sha256 = createHash('sha256').update(body).digest('hex')
  if (sha256 !== SHA256) throw new Error('the Hanyang table changed; review it before importing')
  const mappings = parseHanyang(body)
  const data = {
    source: {
      name: 'hypua-unicoder, Hanyang PUA',
      url: 'https://github.com/SaschaNaz/hypua-unicoder',
      dataUrl: URL,
      retrieved: '2026-11-08',
      sha256,
      licence: 'ISC. The table was obtained via hypua2jamo and the KTUG HanyangPuaTableProject; terms for the upstream table are not stated.',
    },
    mappings: Object.fromEntries(Object.entries(mappings).sort(([a], [b]) => /** @type {number} */ (a.codePointAt(0)) - /** @type {number} */ (b.codePointAt(0)))),
  }
  writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'hanyang-pua.json'), JSON.stringify(data, null, 2) + '\n')
  console.log(`${Object.keys(data.mappings).length} Hanyang PUA mappings`)
}
