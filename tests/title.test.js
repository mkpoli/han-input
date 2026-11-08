import { describe, expect, test } from 'bun:test'
import { pageMetadata } from '../app/lib/title.js'
import en from '../messages/en.json' with { type: 'json' }
import ja from '../messages/ja.json' with { type: 'json' }
import zhHans from '../messages/zh-Hans.json' with { type: 'json' }
import zhHant from '../messages/zh-Hant.json' with { type: 'json' }
import ko from '../messages/ko.json' with { type: 'json' }

const CATALOGUES = { en, ja, 'zh-Hans': zhHans, 'zh-Hant': zhHant, ko }

describe('page metadata', () => {
  test('gives every top-level route its own title and description', () => {
    expect(pageMetadata('')).toEqual({ title: 'find.title', description: 'find.intro' })
    expect(pageMetadata('methods')).toEqual({ title: 'methods.title', description: 'methods.intro' })
    expect(pageMetadata('readings')).toEqual({ title: 'readings.title', description: 'readings.intro' })
    expect(pageMetadata('rhymes')).toEqual({ title: 'rhymes.title', description: 'rhymes.intro' })
    expect(pageMetadata('radicals')).toEqual({ title: 'radicals.title', description: 'radicals.intro' })
    expect(pageMetadata('convert')).toEqual({ title: 'convert.title', description: 'convert.intro' })
    expect(pageMetadata('about')).toEqual({ title: 'about.title', description: 'about.intro' })
    expect(pageMetadata('notfound')).toEqual({ title: 'notfound.title', description: 'notfound.intro' })
  })
  test('borrows the page a detail route belongs to', () => {
    expect(pageMetadata('m')).toEqual(pageMetadata('methods'))
    expect(pageMetadata('v')).toEqual(pageMetadata('readings'))
  })
  test('falls back to the finder for an unknown route', () => {
    expect(pageMetadata('nope')).toEqual(pageMetadata(''))
  })
})

describe('catalogues', () => {
  test('holds every title and description key in every language', () => {
    for (const page of ['', 'methods', 'readings', 'rhymes', 'radicals', 'convert', 'about', 'notfound', 'm', 'v']) {
      const { title, description } = pageMetadata(page)
      for (const [locale, catalogue] of Object.entries(CATALOGUES)) {
        expect(title in catalogue, `${locale} ${title}`).toBe(true)
        expect(description in catalogue, `${locale} ${description}`).toBe(true)
      }
    }
  })
})
