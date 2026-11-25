import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LXGW_SEAL_CHARS, hasLxgwSeal } from '../app/lib/lxgw-seal.js'
import { isSeal } from '../src/fold.js'

const ROOT = join(import.meta.dirname, '..')

/** Expand a CSS unicode-range list into sorted code points. @param {string} expr */
function expandUnicodeRange(expr) {
  /** @type {number[]} */
  const out = []
  for (const part of expr.split(',')) {
    const match = part.trim().match(/^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i)
    if (!match) throw new Error(`Unexpected unicode-range token: ${part}`)
    const start = parseInt(match[1], 16)
    const end = match[2] ? parseInt(match[2], 16) : start
    for (let cp = start; cp <= end; cp++) out.push(cp)
  }
  return out
}

describe('LXGW Seal coverage', () => {
  test('lists 165 unique Small Seal code points in order', () => {
    expect(LXGW_SEAL_CHARS.length).toBe(165)
    expect(new Set(LXGW_SEAL_CHARS).size).toBe(165)
    for (let i = 0; i < LXGW_SEAL_CHARS.length; i++) {
      const char = LXGW_SEAL_CHARS[i]
      expect(isSeal(char)).toBe(true)
      expect(hasLxgwSeal(char)).toBe(true)
      if (i > 0) {
        expect((char.codePointAt(0) ?? 0)).toBeGreaterThan(LXGW_SEAL_CHARS[i - 1].codePointAt(0) ?? 0)
      }
    }
  })

  test('matches covered Small Seal characters and rejects BMP and uncovered ones', () => {
    for (const char of ['\u{3D000}', '\u{3D01E}', '\u{3DD16}', '\u{3FBB5}']) {
      expect(hasLxgwSeal(char)).toBe(true)
    }
    for (const char of ['\u{3EBA4}', '\u{3FC3F}', '一', '福', '篆', '字', '']) {
      expect(hasLxgwSeal(char)).toBe(false)
    }
  })

  test('declares the exact unicode-range, valid WOFF2 file, and OFL licence', () => {
    const css = readFileSync(join(ROOT, 'app/fonts.css'), 'utf8')
    const face = css.match(/@font-face\s*\{\s*font-family:\s*'LXGW Seal';\s*src:\s*url\('\/fonts\/lxgw-seal\.woff2'\)\s*format\('woff2'\);[^}]*unicode-range:\s*([^;]+);/)
    expect(face).not.toBeNull()
    const cssChars = expandUnicodeRange(face?.[1] ?? '').map(cp => String.fromCodePoint(cp))
    expect(cssChars).toEqual(LXGW_SEAL_CHARS)

    const bytes = readFileSync(join(ROOT, 'app/public/fonts/lxgw-seal.woff2'))
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('wOF2')
    expect(bytes.length).toBeGreaterThan(10000)

    const licence = readFileSync(join(ROOT, 'LICENSE-LxgwSeal.txt'), 'utf8')
    expect(licence).toContain('SIL OPEN FONT LICENSE Version 1.1')
    expect(licence).toContain('LXGW')
  })
})
