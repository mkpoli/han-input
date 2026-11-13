<script>
  // A whole divided into its parts, each in its own colour. The legend that names them sits beside
  // it and prints the counts, so the bar itself carries no text.
  /** @type {{ segments: { id: string, count: number, color: string, label: string }[], total: number, label: string, height?: number }} */
  let { segments, total, label, height = 10 } = $props()
  const share = (/** @type {number} */ value) => total ? Math.max(0, Math.min(1, value / total)) : 0
</script>

<div class="stack" role="img" aria-label={label} style:block-size={`${height}px`}>
  {#each segments as segment (segment.id)}
    <span style:inline-size={`${share(segment.count) * 100}%`} style:background={segment.color} title={`${segment.label}: ${segment.count}`}></span>
  {/each}
</div>

<style>
  .stack{display:flex;inline-size:100%;border-radius:var(--ui-radius-xs);background:var(--ui-color-surface-sunken);overflow:hidden}
  .stack span{display:block;block-size:100%;min-inline-size:1px}
  .stack span + span{box-shadow:inset 2px 0 0 var(--ui-color-surface)}
</style>
