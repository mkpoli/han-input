<script>
  // A grid of characters. A click opens the card; a double click adds the character to the text.
  import { route } from '../lib/route.svelte.js'
  import { choose, put } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'

  /** @type {{ chars: string[], notes?: Map<string, string>, limit?: number, size?: number, label?: string }} */
  let { chars, notes, limit = 96, size = 56, label = '' } = $props()
  const shown = $derived(chars.slice(0, limit))
</script>

<div class="ui-tiles" style:--ui-tile-size="{size}px" role="listbox" aria-label={label}>
  {#each shown as char (char)}
    {@const note = notes?.get(char)}
    <button class="ui-tile" type="button" role="option" aria-selected={route.c === char} data-note={note ? undefined : 'none'} title={note ? `${char} ${note}` : char}
      onclick={() => choose(char)} ondblclick={() => put(char)}>
      <span class="ui-tile-glyph ui-script" lang="und-Hani">{char}</span>{#if note}<span class="ui-tile-note">{note}</span>{/if}
    </button>
  {/each}
</div>
{#if chars.length > limit}<p class="ui-hint cut">{t('common.cut', { shown: limit, total: chars.length })}</p>{/if}

<style>
  .cut{margin-top:var(--ui-space-sm)}
</style>
