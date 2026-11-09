<script>
  // A result grid too large to draw at once: one page of tiles with the pager above and below.
  // Its page is local to the grid; the face for the next page is loaded before the slice changes.
  import { tick } from 'svelte'
  import { loadGlyphs } from '../lib/fonts.js'
  import Pager from './Pager.svelte'
  import Tiles from './Tiles.svelte'

  /** @type {{ chars: string[], notes?: Map<string, string>, perPage?: number, size?: number, label?: string }} */
  let { chars, notes, perPage = 96, size = 56, label = '' } = $props()
  let current = $state(0)
  let turning = $state(false)
  /** @type {HTMLElement | null} */
  let top = $state(null)
  const pages = $derived(Math.max(1, Math.ceil(chars.length / perPage)))
  const page = $derived(Math.min(pages - 1, Math.max(0, current)))
  const shown = $derived(chars.slice(page * perPage, (page + 1) * perPage))

  $effect(() => { chars; current = 0 })

  /** @param {number} next */
  async function turnTo(next) {
    if (turning) return
    next = Math.max(0, Math.min(pages - 1, next))
    if (next === page) return
    turning = true
    const from = chars
    try {
      await loadGlyphs(from.slice(next * perPage, (next + 1) * perPage))
      if (chars !== from) return
      current = next
      await tick()
      top?.scrollIntoView({ block: 'start' })
    } finally { turning = false }
  }
</script>

<div bind:this={top}>
  <Pager page={page + 1} {pages} disabled={turning} onchange={next => turnTo(next - 1)} />
  <Tiles chars={shown} {notes} {size} limit={perPage} {label} />
  <Pager page={page + 1} {pages} disabled={turning} onchange={next => turnTo(next - 1)} />
</div>
