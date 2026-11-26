import { describe, expect, test } from 'bun:test'
import { linksFor } from '../app/lib/links.js'

describe('character card links', () => {
  test('links Small Seal characters to their Glyph Atlas character page', () => {
    const sites = linksFor('\u{3D01E}')
    const glyphAtlas = sites.find(site => site.key === 'glyphatlas')
    expect(glyphAtlas?.url('\u{3D01E}')).toBe('https://glyphatlas.org/character/U+3D01E')
    expect(sites.map(site => site.key)).toEqual(['wikt-en', 'wikt-zh', 'wikt-ja', 'glyphatlas', 'unicode'])
  })

  test('links Han characters to their Glyph Atlas character page and Han dictionaries', () => {
    const sites = linksFor('字')
    const glyphAtlas = sites.find(site => site.key === 'glyphatlas')
    expect(glyphAtlas?.url('字')).toBe('https://glyphatlas.org/character/U+5B57')
    expect(sites.some(site => site.key === 'zitools')).toBe(true)
    expect(sites.some(site => site.key === 'unihan')).toBe(true)
  })

  test('keeps Nüshu off Glyph Atlas', () => {
    const sites = linksFor('\u{1B170}')
    expect(sites.some(site => site.key === 'glyphatlas')).toBe(false)
    expect(sites.map(site => site.key)).toEqual(['wikt-en', 'wikt-zh', 'wikt-ja', 'unicode'])
  })
})
