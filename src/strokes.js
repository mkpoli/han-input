// The five stroke classes a stroke-order method numbers 1–5, for typing its codes from keys that
// show the strokes: 1 horizontal, 2 vertical, 3 left-falling, 4 dot, 5 turning.

/** Each digit with the CJK stroke that stands for its class. */
export const STROKE_KEYS = /** @type {const} */ ([
  { digit: '1', stroke: '㇐' }, { digit: '2', stroke: '㇑' }, { digit: '3', stroke: '㇒' },
  { digit: '4', stroke: '㇔' }, { digit: '5', stroke: '㇕' },
])

/** The methods whose codes are strokes in writing order. */
export const STROKE_METHODS = new Set(['wubihua', 'cns-stroke-order'])

/**
 * The keys some code goes on with after `typed`.
 * @param {Iterable<{ folded: string }>} rows
 * @param {string} typed
 * @returns {Set<string>}
 */
export function nextKeys(rows, typed) {
  const next = new Set()
  for (const row of rows) if (row.folded.length > typed.length && row.folded.startsWith(typed)) next.add(row.folded[typed.length])
  return next
}
