// The dialect sets' inputs, fetched once into cache/ and checked against dialect_source.json.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fetchOnce, sha256 } from '../lib.mjs'

/** @param {string} out the public charsets directory */
export async function readDialectInputs(out) {
  const lock = JSON.parse(readFileSync(join(out, 'dialect_source.json'), 'utf8'))
  /** @type {Record<string, string>} */
  const text = {}
  for (const [key, input] of Object.entries(lock)) {
    const path = await fetchOnce(input.url, `dialect-${key}-${input.url.split('/').pop()}`)
    if (sha256(path) !== input.sha256) throw new Error(`${input.url} changed; review it and update dialect_source.json`)
    text[key] = readFileSync(path, 'utf8')
  }
  return { fangyanzi: JSON.parse(text.fangyanzi), openIds: text.openIds }
}
