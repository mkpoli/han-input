<script>
  // A share list's own pie. The slices follow the list order, so no separate legend is needed;
  // the denominator is printed underneath because every share is read against it.
  import { i18n, t } from '../lib/i18n.svelte.js'

  /** @type {{ slices: { id: string, count: number, share: number, color: string }[], total: number }} */
  let { slices, total } = $props()
  const radius = 27
  const circumference = 2 * Math.PI * radius
  const arcs = $derived.by(() => {
    let used = 0
    return slices.filter(slice => slice.count > 0).map(slice => {
      const length = circumference * slice.share
      const arc = { id: slice.id, length, offset: -used, color: slice.color }
      used += length
      return arc
    })
  })
</script>

<figure class="pie">
  <svg viewBox="0 0 72 72" aria-hidden="true">
    <circle class="track" cx="36" cy="36" r={radius} />
    {#each arcs as arc (arc.id)}
      <circle cx="36" cy="36" r={radius} stroke={arc.color}
        stroke-dasharray="{arc.length} {circumference - arc.length}" stroke-dashoffset={arc.offset}
        transform="rotate(-90 36 36)" />
    {/each}
  </svg>
  <figcaption><span>{t('charset.denominator')}</span><b>{total.toLocaleString(i18n.locale)}</b></figcaption>
</figure>

<style>
  .pie{display:grid;justify-items:center;gap:4px;margin:0}
  svg{display:block;inline-size:64px;block-size:64px}
  circle{fill:none;stroke-width:9}
  .track{stroke:var(--ui-color-border)}
  figcaption{display:grid;justify-items:center;line-height:1.1;font-variant-numeric:tabular-nums}
  figcaption span{font-size:9px;color:var(--ui-color-ink-muted);letter-spacing:.02em}
  figcaption b{font-size:var(--ui-text-xs);font-weight:var(--ui-weight-medium);color:var(--ui-color-ink)}
</style>
