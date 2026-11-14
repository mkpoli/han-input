<script>
  // The dialect list's rows for one character or IDS: the doculects each row names, its readings by
  // place and its gloss, as the source prints them.
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import { HUES, loadDialects } from '../lib/dialects.js'

  /** @type {{ entryKey: string }} */
  let { entryKey } = $props()
  let data = $state(/** @type {import('../lib/dialects.js').Dialects | null} */ (null))
  loadDialects().then(loaded => { data = loaded }).catch(() => {})
  const entry = $derived(data?.byKey.get(entryKey) ?? null)
  const sets = $derived(new Map((data?.sets ?? []).map(set => [set.id, set])))
</script>

{#if entry}
  <section class="family">
    <h3 class="ui-label">{t('dialects.rows')} <span class="ui-count">{entry.rows.length}</span></h3>
    <ol class="rows">
      {#each entry.rows as row, i (i)}
        <li>
          <span class="tags">
            {#each row.sets as id (id)}
              {@const set = sets.get(id)}
              {#if set}<span class="tag" style:--hue={HUES[id]} title={nameOf(set.names)}>{set.label}</span>{/if}
            {/each}
          </span>
          {#if row.readings?.length}
            <span class="readings">{#each row.readings as [place, form] (place + form)}<span class="reading">{#if place}<b>{place}</b>{/if}<span class="ui-mono">{form}</span></span>{/each}</span>
          {/if}
          {#if row.def}<p class="def">{row.def}</p>{/if}
          {#if row.note}<p class="ui-hint">{row.note}</p>{/if}
        </li>
      {/each}
    </ol>
  </section>
{/if}

<style>
  .family{display:grid;gap:var(--ui-space-xs)}
  .rows{display:grid;gap:var(--ui-space-md);margin:0;padding:0;list-style:none}
  .rows li{display:grid;gap:4px;padding-block-start:var(--ui-space-md);border-block-start:1px solid var(--ui-color-border)}
  .rows li:first-child{padding-block-start:0;border:0}
  .tags{display:flex;flex-wrap:wrap;gap:2px 10px}
  .tag{display:inline-flex;align-items:center;gap:5px;font-size:var(--ui-text-sm);font-weight:var(--ui-weight-medium)}
  .tag::before{content:'';inline-size:8px;block-size:8px;border-radius:50%;background:light-dark(oklch(0.52 0.13 var(--hue)),oklch(0.8 0.11 var(--hue)))}
  .readings{display:flex;flex-wrap:wrap;gap:2px 12px;color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm)}
  .reading{display:inline-flex;gap:4px;align-items:baseline}
  .readings b{font-weight:var(--ui-weight-medium);color:var(--ui-color-ink-muted)}
  .def{margin:0;font-size:var(--ui-text-md);line-height:1.55}
</style>
