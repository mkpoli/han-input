// The message keys behind each route's tab title and description. Detail pages borrow the page
// they belong to until they can name the method or variety themselves.
const PAGES = /** @type {Record<string, [string, string]>} */ ({
  '': ['find.title', 'find.intro'],
  methods: ['methods.title', 'methods.intro'],
  readings: ['readings.title', 'readings.intro'],
  rhymes: ['rhymes.title', 'rhymes.intro'],
  radicals: ['radicals.title', 'radicals.intro'],
  convert: ['convert.title', 'convert.intro'],
  about: ['about.title', 'about.intro'],
  m: ['methods.title', 'methods.intro'],
  v: ['readings.title', 'readings.intro'],
})

/** @param {string} page @returns {{ title: string, description: string }} */
export function pageMetadata(page) {
  const [title, description] = PAGES[page] ?? PAGES['']
  return { title, description }
}
