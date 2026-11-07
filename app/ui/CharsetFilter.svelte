<script>
  import { tick } from 'svelte'
  import { nameOf, t } from '../lib/i18n.svelte.js'

  const CNS_GROUP = 'CNS sources'

  /** @type {{ charsets: import('../lib/charsets.js').Charset[], selected: string, onchange: (id: string) => void, failed?: boolean, onretry: () => void }} */
  let { charsets, selected, onchange, failed = false, onretry } = $props()
  /** @type {HTMLElement | null} */
  let trigger = $state(null)
  /** @type {HTMLInputElement | null} */
  let searchInput = $state(null)
  /** @type {HTMLDivElement | null} */
  let groupList = $state(null)
  let search = $state('')
  let expanded = $state(false)
  const chosen = $derived(charsets.find(set => set.id === selected))
  const needle = $derived(search.trim().toLowerCase())
  const groups = $derived([...new Set(charsets.map(set => set.group))].map(group => ({
    name: group,
    sets: charsets.filter(set => set.group === group && (!needle
      || [set.id, set.group, set.group === CNS_GROUP ? t('charset.cnsSources') : '', set.label, ...Object.values(set.names), set.source.name]
        .some(value => value?.toLowerCase().includes(needle)))),
  })).filter(group => group.sets.length))

  async function showCns() {
    expanded = true
    search = CNS_GROUP
    await tick()
    groupList?.scrollTo({ top: 0 })
    searchInput?.focus()
  }

  /** @param {string} id */
  function choose(id) {
    onchange(id)
    expanded = false
    search = ''
    trigger?.focus()
  }
</script>

<div class="charset-filter">
  <details bind:open={expanded}>
    <summary class="ui-button" bind:this={trigger} title={chosen ? nameOf(chosen.names) : undefined}>
      <span>{t('charset.label')}: {chosen ? chosen.label : selected || t('charset.all')}</span>
      <span class="summary-end"><span class="ui-count">{charsets.length}</span><span aria-hidden="true">{expanded ? '▴' : '▾'}</span></span>
    </summary>
    <div class="catalogue">
      <input class="ui-input" type="search" bind:this={searchInput} bind:value={search} aria-label={t('charset.search')} placeholder={t('charset.search')} autocomplete="off" />
      <button class="ui-button all" data-size="sm" type="button" aria-pressed={!selected} onclick={() => choose('')}>{t('charset.all')}</button>
      <div class="groups" bind:this={groupList}>
        {#each groups as group (group.name)}
          <section>
            <h2 class="ui-label">{group.name === CNS_GROUP ? t('charset.cnsSources') : group.name} <span class="ui-count">{group.sets.length}</span></h2>
            {#if group.name === CNS_GROUP}<p class="ui-hint cns-note">{t('charset.cnsIntro')}</p>{/if}
            <div class="sets">
              {#each group.sets as set (set.id)}
                <button class="ui-button set" data-size="sm" data-charset={set.id} type="button" title={nameOf(set.names)} aria-pressed={selected === set.id} onclick={() => choose(set.id)}>
                  <span>{set.label}</span><span class="ui-count">{set.chars.toLocaleString()}</span>
                </button>
              {/each}
            </div>
          </section>
        {/each}
        {#if !groups.length && charsets.length}<p class="ui-hint">{t('charset.none')}</p>{/if}
      </div>
    </div>
  </details>
  <button class="ui-button overview" data-size="sm" type="button" onclick={showCns}>{t('charset.cnsOverview')}</button>
  {#if failed}
    <div role="alert">
      <p class="ui-hint">{t('charset.error')}</p>
      <button class="ui-button" data-size="sm" type="button" onclick={onretry}>{t('charset.retry')}</button>
    </div>
  {/if}
  {#if chosen}
    <div class="metadata">
      <span>{t('charset.mapped', { count: chosen.chars.toLocaleString() })}</span>
      <span>{t('charset.rows', { count: chosen.total.toLocaleString() })}</span>
      {#if chosen.source.version}<span class="ui-count">{chosen.source.version}</span>{/if}
      <a href={chosen.source.url} target="_blank" rel="noopener noreferrer">{t('method.source')}: {chosen.source.name}</a>
      {#if chosen.source.records}<a href={chosen.source.records} target="_blank" rel="noopener noreferrer">{t('charset.records')}</a>{/if}
    </div>
    <p class="set-name">{nameOf(chosen.names)}</p>
    <p class="ui-hint">{t('charset.unencoded')}</p>
    {#if chosen.source.note}<p class="ui-hint">{chosen.source.note}</p>{/if}
  {/if}
</div>

<style>
  .charset-filter{margin-block-start:var(--ui-space-sm)}
  summary{display:flex;justify-content:space-between;gap:var(--ui-space-sm);white-space:normal;text-align:start;list-style:revert}
  summary span:first-child{min-inline-size:0;overflow-wrap:anywhere}
  .summary-end{display:flex;align-items:center;gap:var(--ui-space-sm);flex:none}
  .catalogue{padding:var(--ui-space-sm);margin-block-start:var(--ui-space-xs);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm)}
  .all{margin-block:var(--ui-space-xs)}
  .overview{margin-block-start:var(--ui-space-xs);white-space:normal;text-align:start}
  .cns-note{margin-block-end:var(--ui-space-xs)}
  .groups{display:grid;gap:var(--ui-space-md);max-block-size:22rem;overflow:auto;overscroll-behavior:contain}
  .sets{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:var(--ui-space-2xs)}
  .set{justify-content:space-between;gap:var(--ui-space-sm);white-space:normal;text-align:start;block-size:auto;min-block-size:32px}
  .set span:first-child{overflow-wrap:anywhere}
  button[aria-pressed='true']{border-color:var(--ui-color-accent-ink);color:var(--ui-color-accent-ink)}
  .metadata{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs) var(--ui-space-md);margin-block-start:var(--ui-space-sm);font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft)}
  .set-name{font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft)}
</style>
