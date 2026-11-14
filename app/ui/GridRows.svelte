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
      const focused = document.activeElement
      const focusedIndex = buttons.indexOf(/** @type {HTMLButtonElement} */ (focused))
      const rememberedIndex = focusedIndex >= 0 ? focusedIndex : buttons.findIndex(button => button.tabIndex === 0)
      const remembered = items[rememberedIndex]
      columns = next
      await tick()
      const index = items.indexOf(remembered)
      if (rememberedIndex < 0 || index < 0) return
      const updated = [...element.querySelectorAll('button')]
      if (focusedIndex >= 0) {
        if (document.activeElement === focused || document.activeElement === document.body) updated[index]?.focus()
      } else if (!element.contains(document.activeElement)) {
        updated.forEach((button, i) => { button.tabIndex = i === index ? 0 : -1 })
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
