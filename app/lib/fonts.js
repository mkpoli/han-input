// Supplementary-plane characters are drawn by sliced faces fetched when a character needs them. A
// grid asks for hundreds at once: while the slice is missing the browser searches every installed
// font per glyph on the main thread, which freezes a large grid for seconds. Asking for the slice
// before the grid is laid out keeps that search off the page.

const TIMEOUT = 10000

/**
 * Wait until the face that draws these characters has arrived. BMP characters are left to system
 * faces — the page's own BMP face is several megabytes — and a stalled face holds the page for no
 * longer than the timeout.
 * @param {Iterable<string>} chars
 * @returns {Promise<void>}
 */
export async function loadGlyphs(chars) {
  if (typeof document === 'undefined' || !document.fonts) return
  const text = [...chars].filter(char => (char.codePointAt(0) ?? 0) >= 0x10000).join('')
  if (!text) return
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer
  try {
    await Promise.race([
      document.fonts.load('1em "Han Ext"', text).catch(() => {}),
      new Promise(resolve => { timer = setTimeout(resolve, TIMEOUT) }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
