<script>
  // The printed records behind a character set. Many were never encoded, so the only form a reader
  // can see is the glyph printed in the proposal; the record keeps its source or serial code.
  import { ui, showRecord } from '../lib/ui.svelte.js'
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import { gSourceOf } from '../lib/sources.js'

  /** @type {{ records: import('../lib/charsets.js').ProposalRecords, label: string }} */
  let { records, label } = $props()
  const documents = $derived(new Map(records.documents.map(doc => /** @type {[string, import('../lib/charsets.js').ProposalDocument]} */ ([doc.id, doc]))))
  const LIMIT = 240
  const shown = $derived(records.records.slice(0, LIMIT))
  const idsMode = $derived(records.records.some(record => record.kind === 'ids'))

  /** @param {import('../lib/charsets.js').ProposalRecord} record */
  const code = record => record.source ?? record.serial ?? ''
  /** @param {import('../lib/charsets.js').ProposalRecord} record */
  const sourceName = record => {
    const source = gSourceOf(code(record))
    return source ? nameOf(source.names) : ''
  }
</script>

<section class="ui-section">
  <h2 class="ui-label">{t('charset.records')} <span class="ui-count">{records.records.length.toLocaleString()}</span></h2>
  {#if idsMode}
    <ol class="ids-list" aria-label={`${label} ${t('charset.records')}`}>
      {#each shown as record, i (record.document + ':' + code(record) + ':' + i)}
        <li class="ui-script" title={code(record)}>{code(record)}</li>
      {/each}
    </ol>
  {:else}
    <div class="ui-tiles records" role="listbox" aria-label={`${label} ${t('charset.records')}`}>
      {#each shown as record, i (record.document + ':' + code(record) + ':' + i)}
        <button class="ui-tile" type="button" role="option" aria-selected={ui.record?.record === record}
          title={[code(record), sourceName(record), documents.get(record.document)?.document].filter(Boolean).join(' · ')}
          onclick={() => { const doc = documents.get(record.document); if (doc) showRecord(record, doc) }}>
          {#if record.glyph}<img src={`/charsets/${record.glyph}`} alt="" width="128" height="128" decoding="async" />{:else}<span class="code ui-mono">{code(record)}</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</section>
{#if records.records.length > LIMIT}<p class="ui-hint">{t('common.cut', { shown: LIMIT, total: records.records.length })}</p>{/if}

<style>
  .records{grid-template-columns:repeat(auto-fill,minmax(56px,1fr))}
  .records .ui-tile{grid-template-rows:1fr;padding:3px}
  .records img{inline-size:100%;block-size:auto;min-inline-size:0}
  .code{font-size:var(--ui-text-2xs);overflow-wrap:anywhere}
.ids-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:4px;margin:0;padding:0;list-style:none}
.ids-list li{font-family:'Han Ext','Noto Sans CJK JP','Source Han Sans JP',var(--ui-font-serif),serif;font-size:18px;line-height:1.35;padding:4px 6px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);overflow-wrap:anywhere}
  @media (prefers-color-scheme:dark){:global(:root:not([data-theme='light'])) .records img{filter:invert(1)}}
  :global(:root[data-theme='dark']) .records img{filter:invert(1)}
</style>
