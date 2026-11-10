// The siniform scripts' own code charts: every assigned code point of the Tangut, Jurchen and
// Khitan small-script blocks, with the components or radicals kept apart from the characters.
// Counts are facts about the Unicode 18.0.0 data, not claims about how often a form occurs in text.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fetchOnce } from './lib.mjs'

const OUT = join(import.meta.dirname, '..', 'app', 'public', 'data', 'siniform.json')

const UNICODE = {
  version: '18.0.0',
  base: 'https://www.unicode.org/Public/18.0.0/ucd/',
  licence: 'Unicode License v3',
  files: {
    age: { name: 'DerivedAge.txt', sha256: '58b04334e3a31f9612694bbc3f6bff4a302b7d424565bca9c47e30aa74f8dbac' },
    blocks: { name: 'Blocks.txt', sha256: 'a58f8d322f3c5e254f9f97b1cbf76a454a7e02de6ac35619a5e4f27aaabfd553' },
    jurchen: { name: 'JurchenSources.txt', sha256: 'e4135d2776ff18232dfe2d59b71ac0775f74f8704f141527079b9b8d6832cdaf' },
  },
}

const TANGUT_IDS = {
  name: 'TangutIDS.txt',
  url: 'https://www.babelstone.co.uk/Tangut/TangutIDS.txt',
  sha256: '6d3e24241ce608590b1bce249a8367e8371a34b61e59b150e50c51b639eabd44',
  retrieved: '2026-11-10',
}

/** The faces this page bundles and the code points each one draws. The missing runs are left as
 *  code-only cells rather than filled with a look-alike from another source. */
/** @type {Record<string, { chars?: [number, number][], parts?: [number, number][] }>} */
const FACES = {
  tangut: {
    chars: [[0x187F8, 0x187FF], [0x18D09, 0x18D20]],
    parts: [[0x18D80, 0x18DF2]],
  },
  khitan: {
    chars: [[0x18CD6, 0x18CDA]],
  },
  // U+18CFF is the small script's blank, encoded as a character on purpose.
  jurchen: {},
}
// U+18CFF represents a lost or illegible character, not a blank in the ordinary sense.
const MARKS = new Set([0x18CFF])

/** @type {{ id: string, names: Record<string, string>, sample: string, partsKey: string | null, introKey: string, blocks: { key: string, block: string, kind: 'char' | 'part' }[] }[]} */
const SCRIPTS = [
  {
    id: 'tangut',
    names: { en: 'Tangut', zh: '西夏文', hans: '西夏文', ja: '西夏文字', ko: '서하문' },
    sample: '𗀀',
    partsKey: 'siniform.parts.tangut',
    introKey: 'siniform.tangut.intro',
    blocks: [
      { key: 'siniform.block.tangut', block: 'Tangut', kind: 'char' },
      { key: 'siniform.block.tangutSupplement', block: 'Tangut Supplement', kind: 'char' },
      { key: 'siniform.block.tangutComponents', block: 'Tangut Components', kind: 'part' },
      { key: 'siniform.block.tangutComponentsSupplement', block: 'Tangut Components Supplement', kind: 'part' },
    ],
  },
  {
    id: 'jurchen',
    names: { en: 'Jurchen', zh: '女真文', hans: '女真文', ja: '女真文字', ko: '여진문' },
    sample: '𘸀',
    partsKey: 'siniform.parts.jurchen',
    introKey: 'siniform.jurchen.intro',
    blocks: [
      { key: 'siniform.block.jurchen', block: 'Jurchen', kind: 'char' },
      { key: 'siniform.block.jurchenRadicals', block: 'Jurchen Radicals', kind: 'part' },
    ],
  },
  {
    id: 'khitan',
    names: { en: 'Khitan small script', zh: '契丹小字', hans: '契丹小字', ja: '契丹小文字', ko: '거란 소자' },
    sample: '𘬀',
    partsKey: null,
    introKey: 'siniform.khitan.intro',
    blocks: [
      { key: 'siniform.block.khitan', block: 'Khitan Small Script', kind: 'char' },
    ],
  },
]

/** @param {string} path @param {string} digest */
function pinned(path, digest) {
  const got = createHash('sha256').update(readFileSync(path)).digest('hex')
  if (got !== digest) throw new Error(`${path}: pinned ${digest}, fetched ${got}`)
}

/** @param {string} text */
export function readBlocks(text) {
  /** @type {Map<string, { start: number, end: number }>} */
  const blocks = new Map()
  for (const line of text.split(/\r?\n/)) {
    const match = /^([0-9A-F]+)\.\.([0-9A-F]+);\s*(.+?)\s*$/.exec(line)
    if (!match) continue
    blocks.set(match[3], { start: parseInt(match[1], 16), end: parseInt(match[2], 16) })
  }
  return blocks
}

/** @param {string} text */
export function readAge(text) {
  /** @type {{ start: number, end: number, version: string }[]} */
  const runs = []
  for (const line of text.split(/\r?\n/)) {
    const match = /^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*;\s*([0-9.]+)/.exec(line)
    if (!match) continue
    runs.push({ start: parseInt(match[1], 16), end: parseInt(match[2] ?? match[1], 16), version: match[3] })
  }
  return runs
}

/** Assigned code points in a block, in code order. @param {{start:number,end:number}[]} runs @param {number} start @param {number} end */
function assigned(runs, start, end) {
  const found = []
  for (const run of runs) {
    const from = Math.max(start, run.start)
    const to = Math.min(end, run.end)
    for (let cp = from; cp <= to; cp++) found.push(cp)
  }
  return found.sort((a, b) => a - b)
}

/** @param {number} cp */
const isTangutPart = cp => (cp >= 0x18800 && cp <= 0x18AFF) || (cp >= 0x18D80 && cp <= 0x18DF2)

/** @param {string} text */
export function tangutUses(text) {
  /** @type {Map<number, number>} */
  const uses = new Map()
  /** @type {Set<number>} */
  const chars = new Set()
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line) continue
    const [code, char, sequence] = line.split('\t')
    if (!code || !char || !sequence) throw new Error(`Bad Tangut IDS row: ${line}`)
    if (parseInt(code, 16) !== (char.codePointAt(0) ?? 0)) throw new Error(`Tangut IDS code point ${code} names ${char}`)
    chars.add(char.codePointAt(0) ?? 0)
    // A component counts once per character, however often it occurs in the description.
    for (const part of new Set([...sequence].map(c => c.codePointAt(0) ?? 0).filter(isTangutPart))) {
      uses.set(part, (uses.get(part) ?? 0) + 1)
    }
  }
  return { uses, described: chars.size }
}

/** @param {string} text */
export function jurchenRadicals(text) {
  /** @type {Map<number, number>} */
  const uses = new Map()
  /** @type {Map<number, number>} */
  const byCharacter = new Map()
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const [code, tag, value] = line.split('\t')
    if (tag !== 'kJURC_RSUnicode') continue
    const radical = Number.parseInt(value.split('.')[0], 10)
    if (!Number.isInteger(radical) || radical < 1 || radical > 51) throw new Error(`Bad Jurchen radical: ${line}`)
    const cp = parseInt(code.replace(/^U\+/, ''), 16)
    if (!Number.isInteger(cp)) throw new Error(`Bad Jurchen code point: ${line}`)
    byCharacter.set(cp, radical)
    uses.set(radical, (uses.get(radical) ?? 0) + 1)
  }
  return { uses, byCharacter }
}

/** @param {[number, number][]} runs @param {number[]} cps */
function unavailable(runs, cps) {
  const set = new Set(cps)
  return runs.flatMap(([start, end]) => {
    const out = []
    for (let cp = start; cp <= end; cp++) if (set.has(cp)) out.push(cp)
    return out
  })
}

/** @param {number[]} cps @param {{ start: number, end: number, version: string }[]} runs */
function versionsOf(cps, runs) {
  const age = new Map()
  for (const run of runs) for (let cp = run.start; cp <= run.end; cp++) age.set(cp, run.version)
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const cp of cps) {
    const version = age.get(cp)
    if (!version) throw new Error(`No age for U+${cp.toString(16).toUpperCase()}`)
    counts.set(version, (counts.get(version) ?? 0) + 1)
  }
  return [...counts].map(([version, count]) => ({ version, count }))
    .sort((a, b) => parseFloat(a.version) - parseFloat(b.version))
}

/** @param {number[]} cps @param {{ start: number, end: number, version: string }[]} ageRuns @param {string} key @param {number} start @param {number} end @param {'char' | 'part'} kind */
function blockRow(cps, ageRuns, key, start, end, kind) {
  return {
    key,
    kind,
    start,
    end,
    positions: end - start + 1,
    count: cps.length,
    versions: versionsOf(cps, ageRuns),
  }
}

export async function buildSiniform() {
  console.log('siniform: reading Unicode 18.0.0')
  const agePath = await fetchOnce(`${UNICODE.base}${UNICODE.files.age.name}`, `siniform/${UNICODE.files.age.name}`)
  const blocksPath = await fetchOnce(`${UNICODE.base}${UNICODE.files.blocks.name}`, `siniform/${UNICODE.files.blocks.name}`)
  const jurchenPath = await fetchOnce(`${UNICODE.base}${UNICODE.files.jurchen.name}`, `siniform/${UNICODE.files.jurchen.name}`)
  pinned(agePath, UNICODE.files.age.sha256)
  pinned(blocksPath, UNICODE.files.blocks.sha256)
  pinned(jurchenPath, UNICODE.files.jurchen.sha256)
  const ageRuns = readAge(readFileSync(agePath, 'utf8'))
  const blocksByName = readBlocks(readFileSync(blocksPath, 'utf8'))
  const { uses: radicalUses } = jurchenRadicals(readFileSync(jurchenPath, 'utf8'))

  console.log('siniform: reading BabelStone Tangut IDS')
  const idsPath = await fetchOnce(TANGUT_IDS.url, `siniform/${TANGUT_IDS.name}`)
  pinned(idsPath, TANGUT_IDS.sha256)
  const tangut = tangutUses(readFileSync(idsPath, 'utf8'))

  const scripts = SCRIPTS.map(script => {
    /** @type {{key:string,kind:string,block:string,start:number,end:number,cps:number[]}[]} */
    const blocks = script.blocks.map(entry => {
      const bounds = blocksByName.get(entry.block)
      if (!bounds) throw new Error(`${script.id}: Unicode block not found: ${entry.block}`)
      return { ...entry, ...bounds, cps: assigned(ageRuns, bounds.start, bounds.end) }
    })
    const chars = blocks.filter(block => block.kind === 'char').flatMap(block => block.cps)
    const parts = blocks.filter(block => block.kind === 'part').flatMap(block => block.cps)
    if (!chars.length) throw new Error(`${script.id}: no characters`)
    if (script.id === 'tangut' && (chars.length !== 6177 || parts.length !== 883)) {
      throw new Error(`Tangut counts changed: ${chars.length} characters, ${parts.length} components`)
    }
    if (script.id === 'jurchen' && (chars.length !== 914 || parts.length !== 51)) {
      throw new Error(`Jurchen counts changed: ${chars.length} characters, ${parts.length} radicals`)
    }
    if (script.id === 'khitan' && chars.length !== 476) throw new Error(`Khitan counts changed: ${chars.length}`)

    return {
      id: script.id,
      names: script.names,
      sample: script.sample,
      partsKey: script.partsKey,
      introKey: script.introKey,
      chars: {
        count: chars.length,
        cps: chars,
        unavailable: unavailable(FACES[script.id].chars ?? [], chars),
        marks: [...MARKS].filter(cp => chars.includes(cp)),
        versions: versionsOf(chars, ageRuns),
      },
      parts: script.partsKey ? {
        count: parts.length,
        cps: parts,
        unavailable: unavailable(FACES[script.id].parts ?? [], parts),
        uses: script.id === 'tangut'
          ? parts.map(cp => tangut.uses.get(cp) ?? 0)
          : parts.map((_, index) => radicalUses.get(index + 1) ?? 0),
        labelled: script.id === 'tangut' ? tangut.described : 0,
        versions: versionsOf(parts, ageRuns),
      } : null,
      blocks: script.blocks.map((block, index) => blockRow(
        blocks[index].cps,
        ageRuns,
        block.key,
        blocks[index].start,
        blocks[index].end,
        block.kind,
      )),
    }
  })

  const data = {
    unicode: UNICODE.version,
    retrieved: new Date().toISOString().slice(0, 10),
    sources: [
      {
        id: 'unicode',
        name: 'Unicode 18.0.0 Character Database',
        url: 'https://www.unicode.org/Public/18.0.0/ucd/',
        licence: 'Unicode License v3',
        detail: 'Blocks.txt, DerivedAge.txt, JurchenSources.txt and NamesList.txt',
      },
      {
        id: 'tangut-ids',
        name: 'BabelStone Tangut IDS',
        url: TANGUT_IDS.url,
        licence: 'No separate licence stated',
        attribution: 'Andrew West',
        detail: `retrieved ${TANGUT_IDS.retrieved}; SHA-256 ${TANGUT_IDS.sha256}`,
      },
    ],
    scripts,
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(data))
  console.log(`siniform: wrote ${OUT} (${scripts.map(script => `${script.id} ${script.chars.count}${script.parts ? `+${script.parts.count}` : ''}`).join(', ')})`)
  return data
}

if (import.meta.main) await buildSiniform()
