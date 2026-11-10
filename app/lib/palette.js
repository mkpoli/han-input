// Share charts give each slice its own hue. A ramp that followed the share made the small slices
// nearly identical pale blues; the list still prints every count and percentage.
const CHART = Array.from({ length: 12 }, (_, index) => `var(--ui-color-chart-${index + 1})`)

/** @param {number} index */
export function shareColor(index) {
  return CHART[index % CHART.length]
}

/** The colour the panel already gives a record without a scalar. */
export const unencodedTint = 'var(--ui-color-border-strong)'
