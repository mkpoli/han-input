<script>
  // A small pie for a catalogue row; the row's title carries the numbers.
  let { encoded, unencoded } = $props()
  const total = $derived(encoded + unencoded)
  const share = $derived(total ? unencoded / total : 0)
  const angle = $derived(share * 2 * Math.PI)
  const x = $derived(8 + 6 * Math.sin(angle))
  const y = $derived(8 - 6 * Math.cos(angle))
  const large = $derived(share > 0.5 ? 1 : 0)
</script>

<span class="dot" aria-hidden="true">
  <svg viewBox="0 0 16 16">
    <circle class="encoded" cx="8" cy="8" r="6" />
    {#if unencoded === total}
      <circle class="unencoded" cx="8" cy="8" r="6" />
    {:else if unencoded}
      <path class="unencoded" d="M8 8 L8 2 A6 6 0 {large} 1 {x} {y} Z" />
    {/if}
  </svg>
</span>

<style>
  .dot{display:grid;place-items:center;inline-size:16px;block-size:16px;flex:none}
  svg{display:block;inline-size:100%;block-size:100%}
  .encoded{fill:var(--ui-color-accent)}
  .unencoded{fill:var(--ui-color-border-strong)}
</style>
