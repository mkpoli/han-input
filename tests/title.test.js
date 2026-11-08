import { describe, expect, test } from 'bun:test'
import { pageMetadata } from '../app/lib/title.js'

describe('page metadata', () => {
  test('gives every top-level route its own title and description', () => {
    expect(pageMetadata('')).toEqual({ title: 'find.title', description: 'find.intro' })
    expect(pageMetadata('methods')).toEqual({ title: 'methods.title', description: 'methods.intro' })
    expect(pageMetadata('readings')).toEqual({ title: 'readings.title', description: 'readings.intro' })
    expect(pageMetadata('rhymes')).toEqual({ title: 'rhymes.title', description: 'rhymes.intro' })
    expect(pageMetadata('radicals')).toEqual({ title: 'radicals.title', description: 'radicals.intro' })
    expect(pageMetadata('convert')).toEqual({ title: 'convert.title', description: 'convert.intro' })
    expect(pageMetadata('about')).toEqual({ title: 'about.title', description: 'about.intro' })
  })
  test('borrows the page a detail route belongs to', () => {
    expect(pageMetadata('m')).toEqual(pageMetadata('methods'))
    expect(pageMetadata('v')).toEqual(pageMetadata('readings'))
  })
  test('falls back to the finder for an unknown route', () => {
    expect(pageMetadata('nope')).toEqual(pageMetadata(''))
  })
})
