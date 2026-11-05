// The text being written: one per browser, kept in local storage. Every finder adds to it.
const KEY = 'han-input:text'

export const text = $state({ value: (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) || '' })

/** @param {string} value */
export function setText(value) {
  text.value = value
  try { localStorage.setItem(KEY, value) } catch { /* storage may be full or blocked */ }
}

/** @param {string} chars */
export const insert = chars => setText(text.value + chars)

export function backspace() {
  setText([...text.value].slice(0, -1).join(''))
}
