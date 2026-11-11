<script>
  // One covered share of a total: a track, a fill, and the numbers left to the caption beside it.
  /** @type {{ value: number, total: number, color?: string, label: string, height?: number }} */
  let { value, total, color = 'var(--ui-color-accent)', label, height = 6 } = $props()
  const share = $derived(total ? Math.max(0, Math.min(1, value / total)) : 0)
</script>

<div class="meter" role="img" aria-label={label} style:block-size={`${height}px`}>
  <span style:inline-size={`${share * 100}%`} style:background={color}></span>
</div>

<style>
  .meter{position:relative;inline-size:100%;border-radius:var(--ui-radius-pill);background:var(--ui-color-surface-sunken);box-shadow:inset 0 0 0 1px var(--ui-color-border);overflow:hidden}
  .meter span{display:block;block-size:100%;border-radius:inherit}
</style>
