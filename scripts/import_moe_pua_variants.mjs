// bun scripts/import_moe_pua_variants.mjs [Unihan_Variants.txt]
// Unihan's variant relations run both ways: a row names the variant of its own character. This index
// keeps only relations that touch a character with an MOE PUA code, and swaps the relation name when the
// PUA character is the one a row points to.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RELATIONS = {
  kSimplifiedVariant: { relation: 'simplified', inverse: 'traditional' },
  kTraditionalVariant: { relation: 'traditional', inverse: 'simplified' },
  kSemanticVariant: { relation: 'semantic', inverse: 'semantic' },
  kSpecializedSemanticVariant: { relation: 'specialized', inverse: 'specialized' },
  kZVariant: { relation: 'z', inverse: 'z' },
}

/** @param {string} body @param {Set<string>} withPua */
export function variantIndex(body, withPua) {
  /** @type {Map<string, Map<string, string>>} */
  const byChar = new Map()
  const add = (/** @type {string} */ char, /** @type {string} */ other, /** @type {string} */ relation) => {
    let row = byChar.get(char)
    if (!row) byChar.set(char, row = new Map())
    row.set(`${other}\t${relation}`, relation)
    byChar.set(char, row)
  }
  for (const line of body.split('\n')) {
    if (!line.startsWith('U+')) continue
    const [code, field, value] = line.split('\t')
    const names = RELATIONS[/** @type {keyof typeof RELATIONS} */ (field)]
    if (!names || !value) continue
    const char = String.fromCodePoint(parseInt(code.slice(2), 16))
    for (const match of value.matchAll(/U\+([0-9A-F]{4,6})/g)) {
      const other = String.fromCodePoint(parseInt(match[1], 16))
      if (other === char) continue
      if (withPua.has(other)) add(char, other, names.relation)
      if (withPua.has(char)) add(other, char, names.inverse)
    }
  }
  return Object.fromEntries([...byChar].sort(([a], [b]) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0))
    .map(([char, row]) => [char, [...row.keys()].map(key => {
      const [other, relation] = key.split('\t')
      return { char: other, relation }
    })]))
}

if (import.meta.main) {
  const input = process.argv[2] ?? join(import.meta.dirname, '..', 'cache', 'unihan', 'Unihan_Variants.txt')
  const body = readFileSync(input, 'utf8')
  const mapping = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'data', 'moe-pua.json'), 'utf8'))
  const data = {
    source: {
      name: 'Unihan 18.0.0, variant fields',
      url: 'https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip',
      version: '18.0.0',
      fields: Object.keys(RELATIONS),
      sha256: createHash('sha256').update(body).digest('hex'),
      licence: 'Unicode-3.0',
      attribution: 'Copyright Unicode, Inc.',
    },
    byChar: variantIndex(body, new Set(Object.values(mapping.mappings))),
  }
  writeFileSync(join(import.meta.dirname, '..', 'data', 'moe-pua-variants.json'), JSON.stringify(data, null, 2) + '\n')
  console.log(`${Object.keys(data.byChar).length} characters related to an MOE PUA`)
}
