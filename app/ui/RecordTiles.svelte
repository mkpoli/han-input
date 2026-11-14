<script>
  // Records a query found: each shows its glyph and code, and opens its record card.
  import { ui, showRecord } from '../lib/ui.svelte.js'
  import Pager from './Pager.svelte'
  import RecordGlyph from './RecordGlyph.svelte'
  import GridRows from './GridRows.svelte'
  import { gridNavigation } from './grid.js'

  /** @type {{ entries: import('../lib/records.js').RecordEntry[], label: string }} */
  let { entries, label } = $props()
  const PER_PAGE = 96
  let page = $state(0)
  const pages = $derived(Math.max(1, Math.ceil(entries.length / PER_PAGE)))
  const shown = $derived(entries.slice(page * PER_PAGE, (page + 1) * PER_PAGE))
  $effect(() => { entries; page = 0 })
  /** @type {HTMLDivElement | null} */
  let grid = $state(null)
</script>

{#if pages > 1}<Pager page={page + 1} {pages} onchange={next => { page = next - 1 }} />{/if}
<div class="ui-tiles records" role="grid" aria-label={label} bind:this={grid} use:gridNavigation>
  <GridRows {grid} items={shown}>
    {#snippet children(entry, index)}
      <button class="ui-tile" type="button" tabindex={index === 0 ? 0 : -1} aria-current={ui.record?.record === entry.record ? 'true' : undefined}
        title={[entry.record.source, entry.document.title].join(' · ')} onclick={() => showRecord(entry.record, entry.document)}>
        {#if entry.record.sprite || entry.record.atlas || entry.record.glyph}
          <RecordGlyph record={entry.record} />
        {:else}<span class="formula" lang="und-Hani">{entry.record.composition ?? ''}</span>{/if}
        <span class="ui-tile-note ui-mono">{entry.record.source}</span>
      </button>
    {/snippet}
  </GridRows>
</div>

<style>
  .records{grid-template-columns:repeat(auto-fill,minmax(72px,1fr))}
  .records .ui-tile{grid-template-rows:1fr auto;padding:3px}
  .records .ui-tile-note{font-size:9px;line-height:1.2;white-space:normal;overflow-wrap:anywhere;text-align:center}
  .formula{display:grid;place-items:center;font-family:var(--ui-font-script);font-size:var(--ui-text-xs);overflow-wrap:anywhere}
</style>
