<script>
  // One printed proposal record: the glyph as the document shows it, the source or serial code it is
  // named by, and where the document states it. Many of these characters were never encoded.
  import { ui, choose, closeRecord } from '../lib/ui.svelte.js'
  import { link } from '../lib/route.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import SourceCode from './SourceCode.svelte'

  const held = $derived(ui.record)
  const record = $derived(held?.record ?? null)
  const document = $derived(held?.document ?? null)
  const code = $derived(record ? record.source ?? record.serial ?? '' : '')
  const mapped = $derived(record?.mappedUnicode ? String.fromCodePoint(parseInt(record.mappedUnicode.slice(2), 16)) : '')
  const unified = $derived(record?.unifiedWith ?? '')
  const unifiedChar = $derived(unified.startsWith('U+') ? String.fromCodePoint(parseInt(unified.slice(2), 16)) : '')
</script>

{#if record && document}
  {#if ui.sheet}
    <div class="back"><button class="ui-button" data-variant="quiet" data-size="sm" type="button" onclick={closeRecord}>{t('card.back')}</button></div>
  {/if}
  <article class="record">
    <header class="head">
      <div class="glyph">
        {#if record.sprite}
          <svg viewBox="0 0 200 200" aria-hidden="true"><use href={`/charsets/ebag-sprites/${record.sprite.sheet}.svg#${record.sprite.symbol}`}></use></svg>
        {:else if record.glyph}<img src={`/charsets/${record.glyph}`} alt="" width="128" height="128" />{:else}<span class="ui-mono">{code}</span>{/if}
      </div>
      <div class="facts">
        <p class="name"><SourceCode code={code} /></p>
        <p class="ui-hint">{document.title} · {document.source}</p>
        <a href={`${document.url}#page=${record.page ?? 1}`} target="_blank" rel="noopener noreferrer">{document.document}{record.page ? ` · ${t('proposal.page', { page: record.page })}` : ''}</a>
      </div>
    </header>
    {#if record.status}<p class="ui-hint">{record.status}</p>{/if}
    {#if unified}
      <p class="unified"><span class="ui-hint">{t('proposal.unifiedWith')}</span>
        {#if unifiedChar}
          <a href={link('', { c: unifiedChar })} lang="und-Hani" onclick={event => { event.preventDefault(); choose(unifiedChar) }}>{unifiedChar}</a>
        {/if}
        <span class="ui-mono ui-hint">{unified}</span>
      </p>
    {/if}
    {#if mapped}
      <p class="mapped"><a href={link('', { c: mapped })} lang="und-Hani" onclick={event => { event.preventDefault(); choose(mapped) }}>{mapped}</a> <span class="ui-mono ui-hint">{record.mappedUnicode}</span></p>
    {/if}
    {#if record.evidenceUrls?.length}
      <div class="links">
        {#each record.evidenceUrls as url (url)}<a href={url} target="_blank" rel="noopener noreferrer">{url.replace(/^https:\/\/www\.unicode\.org\/irg\/docs\//, '').replace(/^https:\/\/zi\.tools\//, 'zi.tools/')}</a>{/each}
      </div>
    {/if}
  </article>
{/if}

<style>
  .back{padding:var(--ui-space-sm)}
  .record{display:grid;gap:var(--ui-space-lg);padding:var(--ui-space-xl)}
  .head{display:flex;gap:var(--ui-space-lg);align-items:flex-start}
  .glyph{flex:none;display:grid;place-items:center;inline-size:112px;block-size:112px;padding:4px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-canvas)}
  .glyph img,.glyph svg{inline-size:100%;block-size:100%}
  .facts{display:grid;gap:var(--ui-space-2xs);min-inline-size:0}
  .name{margin:0;font-size:var(--ui-text-sm);overflow-wrap:anywhere}
  .facts a{color:var(--ui-color-accent-ink);font-size:var(--ui-text-sm);overflow-wrap:anywhere}
  .mapped,.unified{margin:0}
  .unified a{font-size:24px;line-height:1;color:var(--ui-color-ink);text-decoration:none}
  .mapped a{font-size:56px;line-height:1;color:var(--ui-color-ink);text-decoration:none}
  .links{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs)}
  .links a{padding:2px var(--ui-space-sm);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);font-size:var(--ui-text-xs);color:var(--ui-color-ink);text-decoration:none;overflow-wrap:anywhere}
  @media (prefers-color-scheme:dark){:global(:root:not([data-theme='light'])) .glyph img,:global(:root:not([data-theme='light'])) .glyph svg{filter:invert(1)}}
  :global(:root[data-theme='dark']) .glyph img,:global(:root[data-theme='dark']) .glyph svg{filter:invert(1)}
</style>
