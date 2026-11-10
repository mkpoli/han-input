// Share charts keep one hue: a slice carries the accent in proportion to its share, so the
// largest slice is the deepest and the many slivers fade into the track.
/** @param {number} share */
export function shareTint(share) {
  const accent = Math.max(40, Math.min(100, Math.round(Math.sqrt(share) * 100)))
  return `color-mix(in oklab, var(--ui-color-accent) ${accent}%, var(--ui-color-surface-sunken))`
}

/** The colour the panel already gives a record without a scalar. */
export const unencodedTint = 'var(--ui-color-border-strong)'
