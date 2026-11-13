<script>
  // The printed records behind a character set. Many were never encoded, so the only form a reader
  // can see is the glyph printed in the proposal; the record keeps its source or serial code.
  import { tick } from 'svelte'
  import { ui, showRecord } from '../lib/ui.svelte.js'
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import { gSourceOf } from '../lib/sources.js'
  import { compareCodes } from '../lib/charsets.js'
  import Pager from './Pager.svelte'
  import RecordGlyph from './RecordGlyph.svelte'
  import GridRows from './GridRows.svelte'
  import { gridNavigation } from './grid.js'
  /** @type {HTMLDivElement | null} */
  let grid = $state(null)

  /** @type {{ records: import('../lib/charsets.js').ProposalRecords, label: string }} */
  let { records, label } = $props()
  const documents = $derived(new Map(records.documents.map(doc => /** @type {[string, import('../lib/charsets.js').ProposalDocument]} */ ([doc.id, doc]))))
  const PER_PAGE = 240
  let page = $state(0)
  /** @type {HTMLElement | null} */
  let top = $state(null)
  const idsMode = $derived(records.records.some(record => record.kind === 'ids'))
  const textOnly = $derived(records.records.every(record => !record.glyph && !record.sprite && !record.atlas && !record.mappedUnicode && !record.ids && record.kind !== 'ids'))
  /** @type {'all' | 'encoded' | 'unencoded'} */
  let show = $state('all')
  let byCode = $state(false)

  /** @param {import('../lib/charsets.js').ProposalRecord} record */
  const code = record => record.source ?? record.serial ?? ''
  /** @param {import('../lib/charsets.js').ProposalRecord} record */
  const sourceName = record => {
    const source = gSourceOf(code(record))
    return source ? nameOf(source.names) : ''
  }
  const arranged = $derived.by(() => {
    let list = show === 'all' ? records.records : records.records.filter(record => show === 'encoded' ? record.mappedUnicode : !record.mappedUnicode)
    if (byCode) list = [...list].sort((a, b) => compareCodes(code(a), code(b)))
    return list
  })
  const pages = $derived(Math.max(1, Math.ceil(arranged.length / PER_PAGE)))
  const shown = $derived(arranged.slice(page * PER_PAGE, (page + 1) * PER_PAGE))

  $effect(() => { arranged; page = 0 })

  /** @param {number} next */
  async function turnTo(next) {
    next = Math.max(0, Math.min(pages - 1, next))
    if (next === page) return
    page = next
    await tick()
    top?.scrollIntoView({ block: 'start' })
  }
</script>

<section class="ui-section" bind:this={top}>
  <h2 class="ui-label">{t('charset.records')} <span class="ui-count">{arranged.length.toLocaleString()}</span></h2>
  {#if !idsMode}
    <div class="records-tools">
      <button class="ui-button" data-size="sm" type="button" aria-pressed={byCode} onclick={() => { byCode = !byCode }}>{t('find.codeOrder')}</button>
      <div class="seg" role="group" aria-label={t('find.showLabel')}>
        <button class="ui-button" data-size="sm" type="button" aria-pressed={show === 'all'} onclick={() => { show = 'all' }}>{t('find.showAll')}</button>
        <button class="ui-button" data-size="sm" type="button" aria-pressed={show === 'encoded'} onclick={() => { show = 'encoded' }}>{t('find.showEncoded')}</button>
        <button class="ui-button" data-size="sm" type="button" aria-pressed={show === 'unencoded'} onclick={() => { show = 'unencoded' }}>{t('find.showUnencoded')}</button>
      </div>
    </div>
  {/if}
  <Pager page={page + 1} {pages} onchange={next => turnTo(next - 1)} />
  {#if idsMode}
    <ol class="ids-list" aria-label={`${label} ${t('charset.records')}`}>
      {#each shown as record, i (record.document + ':' + code(record) + ':' + i)}
        <li class="ui-script" title={code(record)}>{code(record)}</li>
      {/each}
    </ol>
  {:else}
    <div class="ui-tiles records" class:text-only={textOnly} role="grid" aria-label={`${label} ${t('charset.records')}`} bind:this={grid} use:gridNavigation>
      <GridRows {grid} items={shown}>
        {#snippet children(record, index)}
          <button class="ui-tile" type="button" tabindex={index === 0 ? 0 : -1} aria-current={ui.record?.record === record ? 'true' : undefined}
            title={[code(record), sourceName(record), documents.get(record.document)?.document].filter(Boolean).join(' · ')}
            onclick={() => { const doc = documents.get(record.document); if (doc) showRecord(record, doc) }}>
            {#if record.sprite || record.atlas || record.glyph}
              <RecordGlyph {record} />
              <span class="ui-tile-note ui-mono">{code(record)}</span>
            {:else if record.mappedUnicode}
              <span class="mapped" lang="und-Hani">{String.fromCodePoint(parseInt(record.mappedUnicode.slice(2), 16))}</span>
              <span class="ui-tile-note ui-mono">{code(record)}</span>
            {:else if record.ids}
              <span class="ids" lang="und-Hani">{record.ids}</span>
              <span class="ui-tile-note ui-mono">{code(record)}</span>
            {:else}<span class="code ui-mono">{code(record)}</span>{/if}
          </button>
        {/snippet}
      </GridRows>
    </div>
    {#if !arranged.length}<p class="ui-hint">{t('find.none')}</p>{/if}
  {/if}
  <Pager page={page + 1} {pages} onchange={next => turnTo(next - 1)} />
</section>

<style>
  .records{grid-template-columns:repeat(auto-fill,minmax(72px,1fr))}
  .records .ui-tile{grid-template-rows:1fr auto;padding:3px}
  .records .ui-tile-note{font-size:9px;line-height:1.2;white-space:normal;overflow-wrap:anywhere;text-align:center}
  .records-tools{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-2xs)}
  .seg{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs)}
  .records-tools button[aria-pressed='true']{border-color:var(--ui-color-accent);background:var(--ui-color-accent-soft);color:var(--ui-color-accent-ink)}
  .code{font-size:var(--ui-text-2xs);overflow-wrap:anywhere}
  .mapped{display:grid;place-items:center;font-family:var(--ui-font-script);font-size:40px;line-height:1}
  .ids{display:grid;place-items:center;font-family:var(--ui-font-script);font-size:var(--ui-text-sm);line-height:1.2;overflow-wrap:anywhere;text-align:center}
  .text-only{grid-template-columns:repeat(auto-fill,minmax(104px,1fr))}
  .text-only .code{white-space:nowrap}
.ids-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:4px;margin:0;padding:0;list-style:none}
.ids-list li{font-family:'Han Ext','Noto Sans CJK JP','Source Han Sans JP',var(--ui-font-serif),serif;font-size:18px;line-height:1.35;padding:4px 6px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);overflow-wrap:anywhere}
</style>
