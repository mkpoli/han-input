<script>
  // A grid of characters. A click opens the card; a double click adds the character to the text.
  import { route } from '../lib/route.svelte.js'
  import { choose, put } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'

  /** `columns` fixes the row width on a wide screen, for a set browsed as a code table.
   * @type {{ chars: string[], notes?: Map<string, string>, limit?: number, size?: number, columns?: number, label?: string, codeNotes?: boolean }} */
  let { chars, notes, limit = 96, size = 56, columns = 0, label = '', codeNotes = false } = $props()
  const shown = $derived(chars.slice(0, limit))
</script>

<div class="ui-tiles" data-codes={codeNotes ? 'true' : undefined} style:--ui-tile-size="{size}px" style:--ui-tile-columns={columns || undefined} data-columns={columns || undefined} role="listbox" aria-label={label}>
  {#each shown as char (char)}
    {@const note = notes?.get(char)}
    <button class="ui-tile" type="button" role="option" aria-selected={route.c === char} data-note={note ? undefined : 'none'} title={note ? `${char} ${note}` : char}
      onclick={() => choose(char)} ondblclick={() => put(char)}>
      <span class="ui-tile-glyph ui-script" lang="und-Hani">{char}</span>{#if note}<span class="ui-tile-note ui-mono">{note}</span>{/if}
    </button>
  {/each}
</div>
{#if chars.length > limit}<p class="ui-hint cut">{t('common.cut', { shown: limit, total: chars.length })}</p>{/if}

<style>
  .cut{margin-top:var(--ui-space-sm)}
  .ui-tiles[data-codes='true'] .ui-tile{aspect-ratio:1/1.12}
  .ui-tiles[data-codes='true'] .ui-tile-note{font-size:9px;line-height:1.15;white-space:normal;overflow-wrap:anywhere;text-align:center}
</style>
