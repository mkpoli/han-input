<script>
  // Every scheme's reading of a private-use slot. A scheme gives a Unicode character, keeps the slot
  // as a character of its own (a CNS row, drawn by the CNS font), or keeps it as a record with its glyph.
  import { loadRecords } from '../lib/charsets.js'
  import { choose, showRecord, ui } from '../lib/ui.svelte.js'
  import { link } from '../lib/route.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import { codePoint } from '../../src/pua.js'
  import RecordGlyph from './RecordGlyph.svelte'

  /** @type {{ readings: import('../../src/pua.js').PuaReading[], label: string }} */
  let { readings, label } = $props()

  /** @type {Map<string, { record: import('../lib/charsets.js').ProposalRecord, document: import('../lib/charsets.js').ProposalDocument }>} */
  let records = $state(new Map())

  $effect(() => {
    const wanted = readings.filter(reading => reading.records && !reading.char)
    if (!wanted.length) return
    let active = true
    Promise.all([...new Set(wanted.map(reading => /** @type {string} */ (reading.records)))].map(async id => {
      const data = await loadRecords(id)
      const documents = new Map(data.documents.map(doc => [doc.id, doc]))
      return wanted.filter(reading => reading.records === id).flatMap(reading => {
        const record = data.records.find(item => item.source === reading.code)
        const document = record && documents.get(record.document)
        return record && document ? [/** @type {const} */ ([`${reading.source}:${reading.slot}`, { record, document }])] : []
      })
    })).then(lists => { if (active) records = new Map(lists.flat()) }).catch(() => {})
    return () => { active = false }
  })

  /** @param {import('../../src/pua.js').PuaReading} reading */
  const key = reading => `${reading.source}:${reading.slot}`
</script>

<ul class="readings" aria-label={label}>
  {#each readings as reading (key(reading))}
    {@const held = records.get(key(reading))}
    <li>
      {#if reading.char}
        <a class="ui-tile glyph" href={link('', { c: reading.char })} lang="und-Hani" onclick={event => { event.preventDefault(); choose(reading.char) }}>{reading.char}</a>
      {:else if reading.records}
        <button class="ui-tile glyph" type="button" disabled={!held} aria-pressed={!!held && ui.record?.record === held.record}
          onclick={() => { if (held) showRecord(held.record, held.document) }}>
          {#if held}<RecordGlyph record={held.record} />{:else}<span class="ui-mono code">{reading.code}</span>{/if}
        </button>
      {:else}
        <a class="ui-tile glyph" href={link('', { c: reading.slot })} lang="und-Hani" onclick={event => { event.preventDefault(); choose(reading.slot) }}>{reading.slot}</a>
      {/if}
      <span class="facts">
        <span class="tag">{t(`pua.source.${reading.source}`)}</span>
        {#if reading.code}<span class="ui-mono">{reading.code}</span>{/if}
        <span class="ui-mono ui-hint">{codePoint(reading.slot)}{reading.char ? ` → ${codePoint(reading.char)}` : ''}</span>
      </span>
    </li>
  {/each}
</ul>

<style>
  .readings{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--ui-space-sm);margin:0;padding:0;list-style:none}
  li{display:flex;align-items:center;gap:var(--ui-space-sm);min-inline-size:0}
  .glyph{flex:none;display:grid;place-items:center;inline-size:72px;block-size:72px;padding:6px;font-family:var(--ui-font-script);font-size:44px;line-height:1;color:var(--ui-color-ink);text-decoration:none}
  .code{font-size:var(--ui-text-2xs)}
  .facts{display:grid;gap:2px;min-inline-size:0;font-size:var(--ui-text-sm);overflow-wrap:anywhere}
  .tag{justify-self:start;padding:0 var(--ui-space-xs);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);font-size:var(--ui-text-xs)}
</style>
