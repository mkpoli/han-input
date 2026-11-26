<script>
  // Renders matched Rare Character Compendium entries as character glyph tiles, consistent with
  // Han Input's other character-set tiles. When `onselect` is provided, clicking opens the record
  // card inside Han Input; otherwise each tile links straight to rare.glyphatlas.org.
  import { i18n, t } from '../lib/i18n.svelte.js'
  import { rccEntryUrl } from '../lib/rcc.js'
  import RccGlyph from './RccGlyph.svelte'

  /** @typedef {{ id: number, code: string, ids?: string | null, coverKey?: string | null, mappedChar?: string }} RccTileItem */
  /** @type {{ items: RccTileItem[], label?: string, compact?: boolean, onselect?: (item: RccTileItem) => void }} */
  let { items, label = '', compact = false, onselect } = $props()
</script>

<ul class="rcc-tiles" class:compact aria-label={label || t('rcc.name')}>
  {#each items as item (item.id)}
    <li>
      {#if onselect}
        <button class="ui-tile rcc-tile" type="button" title={item.ids ? `${item.code} ${item.ids}` : item.code} onclick={() => onselect(item)}>
          <span class="glyph-box"><RccGlyph ids={item.ids} mappedChar={item.mappedChar ?? ''} coverKey={item.coverKey} size={compact ? 'sm' : 'tile'} /></span>
          <span class="ui-tile-note ui-mono">{item.code}</span>
        </button>
      {:else}
        <a class="ui-tile rcc-tile" href={rccEntryUrl(item.id, i18n.locale)} target="_blank" rel="noopener noreferrer" title={t('rcc.entryLabel', { code: item.code })}>
          <span class="glyph-box"><RccGlyph ids={item.ids} mappedChar={item.mappedChar ?? ''} coverKey={item.coverKey} size={compact ? 'sm' : 'tile'} /></span>
          <span class="ui-tile-note ui-mono">{item.code}<span aria-hidden="true">↗</span></span>
        </a>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .rcc-tiles{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs);list-style:none;margin:0;padding:0}
  .rcc-tiles li{display:flex;margin:0;padding:0}
  .rcc-tile{display:grid;grid-template-rows:1fr auto;place-items:center;inline-size:74px;block-size:84px;padding:4px;text-decoration:none;color:var(--ui-color-ink)}
  .compact .rcc-tile{inline-size:66px;block-size:74px;padding:3px}
  .glyph-box{display:grid;place-items:center;inline-size:100%;block-size:100%;min-inline-size:0;min-block-size:0;overflow:hidden}
  .rcc-tile .ui-tile-note{font-size:10px;line-height:1.2;color:var(--ui-color-accent-ink);white-space:nowrap}
  .rcc-tile:hover{border-color:var(--ui-color-accent);background:var(--ui-color-accent-soft)}
</style>
