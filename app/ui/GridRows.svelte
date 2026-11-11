<script>
  import { tick } from 'svelte'

  /** @type {{ grid: HTMLElement | null, items: any[], children: import('svelte').Snippet<[any, number]> }} */
  let { grid, items, children } = $props()
  let columns = $state(1)
  const rows = $derived(Array.from({ length: Math.ceil(items.length / columns) }, (_, i) => items.slice(i * columns, (i + 1) * columns)))

  $effect(() => {
    if (!grid) return
    const element = grid
    const observer = new ResizeObserver(async () => {
      const tracks = getComputedStyle(element).gridTemplateColumns
      const next = tracks === 'none' ? 1 : tracks.split(' ').filter(Boolean).length
      if (next === columns) return
      const buttons = [...element.querySelectorAll('button')]
      const index = buttons.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement))
      columns = next
      await tick()
      if (index >= 0 && (document.activeElement === document.body || element.contains(document.activeElement))) {
        element.querySelectorAll('button')[index]?.focus()
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  })
</script>

{#each rows as row, r (r)}
  <div role="row" style="display: contents">
    {#each row as item, i}
      <div role="gridcell" style="display: contents">{@render children(item, r * columns + i)}</div>
    {/each}
  </div>
{/each}
