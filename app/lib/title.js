// The message keys behind each route's tab title and search description. Detail pages borrow the
// page they belong to until they can name the method or variety themselves. The page's own intro
// is interface prose; these keys are what a search result shows.
const PAGES = /** @type {Record<string, [string, string]>} */ ({
  '': ['find.seoTitle', 'find.seo'],
  methods: ['methods.title', 'methods.seo'],
  readings: ['readings.title', 'readings.seo'],
  rhymes: ['rhymes.title', 'rhymes.seo'],
  radicals: ['radicals.title', 'radicals.seo'],
  convert: ['convert.title', 'convert.seo'],
  composition: ['composition.title', 'composition.seo'],
  about: ['about.title', 'about.seo'],
  notfound: ['notfound.title', 'notfound.intro'],
  m: ['methods.title', 'methods.seo'],
  v: ['readings.title', 'readings.seo'],
})

/** @param {string} page @returns {{ title: string, description: string }} */
export function pageMetadata(page) {
  const [title, description] = PAGES[page] ?? PAGES['']
  return { title, description }
}
