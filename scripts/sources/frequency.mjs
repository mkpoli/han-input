// How often each character occurs in classical texts, for ordering the rare ones.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CACHE, sha256 } from '../lib.mjs'

const FILE = join(CACHE, 'frequency', '综合频率表(由高到低).csv')
const DIGEST = '99b916a38054531e8c8a426a6703b203b9a40631229c67b4e9b3858b51d1dc1d'

/** What the Sources page credits for the order of results. */
export const FREQUENCY_SOURCE = {
  id: 'frequency',
  name: '综合频率表(由高到低).csv',
  attribution: 'Character counts over a classical-text corpus of 1.56 billion characters; privately supplied 2026-11-14',
  licence: 'Not stated',
}

/** Positions start at 1; characters with equal counts share the first of their positions. @param {string} text the CSV: `Unicode编码,汉字,频率` @returns {Map<string, number>} */
export function parseFrequency(text) {
  const rows = text.split(/\r?\n/).slice(1).filter(Boolean).map(line => {
    const [unicode, char, count] = line.split(',')
    if (String.fromCodePoint(parseInt(unicode, 16)) !== char) throw new Error(`frequency table: ${unicode} is not ${char}`)
    return { char, count: Number(count) }
  }).sort((a, b) => b.count - a.count)
  /** @type {Map<string, number>} */
  const positions = new Map()
  rows.forEach(({ char, count }, i) => positions.set(char, i && rows[i - 1].count === count ? /** @type {number} */ (positions.get(rows[i - 1].char)) : i + 1))
  return positions
}

/** @returns {Map<string, number>} character to position, 1 the commonest */
export function readFrequency() {
  if (!existsSync(FILE)) throw new Error(`frequency table missing: place the privately supplied file at ${FILE}`)
  if (sha256(FILE) !== DIGEST) throw new Error('frequency table changed; update the pinned digest first')
  return parseFrequency(readFileSync(FILE, 'utf8'))
}
