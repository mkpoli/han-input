<script>
  // One Unicode code page at a time, sixteen columns wide, as the printed charts lay them out.
  // A code position with no assigned character stays an empty cell; a character the bundled face
  // does not draw keeps its code and shows a placeholder instead of a borrowed glyph.
  import { tick } from 'svelte'
  import { copy } from '../lib/clip.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import Pager from './Pager.svelte'

  /**
   * @type {{
   *   cps: number[],
   *   unavailable?: number[],
   *   marks?: number[],
   *   label: string,
   * }}
   */
  let { cps, unavailable = [], marks = [], label } = $props()

  const absent = $derived(new Set(unavailable))
  const special = $derived(new Set(marks))
  // Pages are runs of sixteen-code rows, not slices of the list. A gap in the block starts a new
  // page, and a short last page ends at its last assigned code instead of padding out the block.
  const pages = $derived.by(() => {
    const present = new Set(cps)
    const rows = [...new Set(cps.map(cp => cp - (cp % 16)))].sort((a, b) => a - b)
    /** @type {{ start: number, last: number, rows: number[] }[]} */
    const runs = []
    for (const row of rows) {
      const run = runs.at(-1)
      if (!run || row !== run.last + 16 || run.rows.length === 16) {
        runs.push({ start: row, last: row, rows: [row] })
      } else {
        run.last = row
        run.rows.push(row)
      }
    }
    return runs.map(run => {
      const slots = run.rows.flatMap(row => Array.from({ length: 16 }, (_, i) => present.has(row + i) ? row + i : null))
      const last = [...slots].reverse().find(cp => cp !== null) ?? run.start
      return { start: run.start, end: last, slots }
    })
  })
  let current = $state(0)
  let top = $state(/** @type {HTMLElement | null} */ (null))
  // A new inventory starts at its first page; the old page number may not exist in it.
  $effect(() => { void cps; current = 0 })
  const page = $derived(pages[Math.min(pages.length - 1, Math.max(0, current))])
  const count = $derived(page ? page.slots.filter(slot => slot !== null).length : 0)
  const hex = (/** @type {number} */ cp) => cp.toString(16).toUpperCase()

  /** @param {number} next */
  async function turn(next) {
    current = Math.max(0, Math.min(pages.length - 1, next))
    await tick()
    top?.scrollIntoView({ block: 'nearest' })
  }

  /** @param {number} cp */
  function cellLabel(cp) {
    const code = `U+${hex(cp)}`
    if (absent.has(cp)) return `${code} · ${t('siniform.noGlyph')}`
    if (special.has(cp)) return `${code} · ${t('siniform.mark')}`
    return `${code} · ${t('siniform.copyCode')}`
  }

  /** @param {number} cp */
  async function pick(cp) {
    const char = absent.has(cp) || special.has(cp) ? '' : String.fromCodePoint(cp)
    await copy(char || `U+${hex(cp)}`, `U+${hex(cp)}`)
  }
</script>

<div class="code-chart" bind:this={top}>
  <div class="head">
    <p class="range ui-mono">
      {#if page}U+{hex(page.start)}–U+{hex(page.end)}{/if}
      <span class="ui-count">{t('siniform.pageCount', { count, total: cps.length })}</span>
    </p>
    <Pager page={Math.min(current, pages.length - 1) + 1} pages={pages.length} onchange={next => turn(next - 1)} />
  </div>
  <div class="chart-wrap">
    <div class="column-head" aria-hidden="true">
      {#each Array.from({ length: 16 }, (_, i) => i.toString(16).toUpperCase()) as digit (digit)}<span>{digit}</span>{/each}
    </div>
    <div class="chart" role="group" aria-label={label}>
      {#each page?.slots ?? [] as cp, at (at)}
        {#if cp === null}
          <span class="cell empty" aria-hidden="true"></span>
        {:else}
          <button class="cell" class:missing={absent.has(cp)} class:mark={special.has(cp)} type="button"
            aria-label={cellLabel(cp)} title={cellLabel(cp)} onclick={() => pick(cp)}>
            {#if absent.has(cp)}
              <span class="glyph placeholder" aria-hidden="true"></span>
            {:else if special.has(cp)}
              <span class="glyph" aria-hidden="true"></span>
            {:else}
              <span class="glyph" aria-hidden="true">{String.fromCodePoint(cp)}</span>
            {/if}
            <span class="code ui-mono" aria-hidden="true">{hex(cp)}</span>
          </button>
        {/if}
      {/each}
    </div>
  </div>
  {#if pages.length > 1}
    <Pager page={Math.min(current, pages.length - 1) + 1} pages={pages.length} onchange={next => turn(next - 1)} />
  {/if}
</div>

<style>
  .code-chart{display:grid;gap:var(--ui-space-sm);min-inline-size:0}
  .head{display:flex;align-items:center;flex-wrap:wrap;gap:var(--ui-space-sm) var(--ui-space-md);min-block-size:32px}
  .range{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  .range .ui-count{margin-inline-start:var(--ui-space-sm)}
  .head :global(.pager){margin-inline-start:auto;margin-block:0}
  .chart-wrap{min-inline-size:0;overflow-x:auto;overscroll-behavior-inline:contain;padding-block-end:2px}
  .column-head,.chart{min-inline-size:560px;display:grid;grid-template-columns:repeat(16,minmax(0,1fr));gap:2px}
  .column-head span{padding-block-end:2px;color:var(--ui-color-ink-muted);font-family:var(--ui-font-mono);font-size:9px;text-align:center}
  .cell{position:relative;display:grid;grid-template-rows:1fr auto;place-items:center;aspect-ratio:1/1.12;min-inline-size:0;padding:3px 1px 2px;border:1px solid var(--ui-color-border);border-radius:3px;background:var(--ui-color-surface);color:var(--ui-color-ink);font-family:'Siniform',var(--ui-font-serif);cursor:pointer}
  button.cell:hover,button.cell:focus-visible{border-color:var(--ui-color-accent);background:var(--ui-color-accent-soft);outline:none}
  .cell.empty{border-color:transparent;background:transparent;cursor:default}
  .glyph{font-size:clamp(18px,2.1vw,28px);line-height:1}
  .code{color:var(--ui-color-ink-muted);font-size:clamp(7px,.65vw,9px);line-height:1.1}
  .placeholder{inline-size:13px;block-size:17px;border:1px dashed var(--ui-color-border-strong);border-radius:1px}
  .missing{background:var(--ui-color-surface-sunken)}
  .mark{background:var(--ui-color-surface-sunken)}
  .mark .code{opacity:.75}
  @media (max-width:700px){
    .glyph{font-size:20px}
    .code{font-size:7px}
  }
</style>
