<script>
  // A grid of characters. A click opens the card; a double click adds the character to the text.
  import { route } from '../lib/route.svelte.js'
  import { choose, put } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import GridRows from './GridRows.svelte'
  import { gridNavigation } from './grid.js'
  /** @type {HTMLDivElement | null} */
  let grid = $state(null)

  /** `columns` fixes the row width on a wide screen, for a set browsed as a code table.
   * @type {{ chars: string[], notes?: Map<string, string>, rccByChar?: Map<string, import('../lib/rcc-data.js').RccEntry[]>, limit?: number, size?: number, columns?: number, label?: string, codeNotes?: boolean }} */
  let { chars, notes, rccByChar, limit = 96, size = 56, columns = 0, label = '', codeNotes = false } = $props()
  const shown = $derived(chars.slice(0, limit))
</script>

<div class="ui-tiles" data-codes={codeNotes ? 'true' : undefined} style:--ui-tile-size="{size}px" style:--ui-tile-columns={columns || undefined} data-columns={columns || undefined} role="grid" aria-label={label} bind:this={grid} use:gridNavigation>
  <GridRows {grid} items={shown}>
    {#snippet children(char, index)}
      {@const note = notes?.get(char)}
      {@const rccHits = rccByChar?.get(char)}
      {@const rccLabel = rccHits?.map(hit => hit.code).join(' ')}
      <button class="ui-tile" class:in-rcc={!!rccHits?.length} type="button" tabindex={index === 0 ? 0 : -1} aria-current={route.c === char ? 'true' : undefined} data-note={note || rccHits?.length ? undefined : 'none'} title={[char, note, rccLabel].filter(Boolean).join(' · ')}
        onclick={() => choose(char)} ondblclick={() => put(char)}>
        {#if rccHits?.length}<span class="rcc-badge ui-mono">{rccHits[0].code}</span>{/if}
        <span class="ui-tile-glyph ui-script" lang="und-Hani">{char}</span>{#if note}<span class="ui-tile-note ui-mono">{note}</span>{/if}
      </button>
    {/snippet}
  </GridRows>
</div>
{#if chars.length > limit}<p class="ui-hint cut">{t('common.cut', { shown: limit, total: chars.length })}</p>{/if}

<style>
  .cut{margin-top:var(--ui-space-sm)}
  .ui-tiles[data-codes='true'] .ui-tile{aspect-ratio:1/1.12}
  .ui-tiles[data-codes='true'] .ui-tile-note{font-size:9px;line-height:1.15;white-space:normal;overflow-wrap:anywhere;text-align:center}
  .ui-tile.in-rcc{position:relative;border-color:color-mix(in srgb,var(--ui-color-accent) 45%,var(--ui-color-border))}
  .rcc-badge{position:absolute;inset-block-start:2px;inset-inline-end:2px;padding:0 3px;border-radius:2px;background:var(--ui-color-surface);border:1px solid color-mix(in srgb,var(--ui-color-accent) 45%,var(--ui-color-border));color:var(--ui-color-accent-ink);font-size:8px;line-height:1.25;pointer-events:none}
</style>
