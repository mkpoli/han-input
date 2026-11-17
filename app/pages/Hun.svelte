<script>
  // Every character the Ministry of Education dictionary marks 替, one tile each, with the first
  // reading under it. The card lists every reading of the character and the characters recorded
  // beside each one.
  import { t } from '../lib/i18n.svelte.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { choose, put } from '../lib/ui.svelte.js'
  import { loadHun } from '../lib/hun.js'
  import { gridNavigation } from '../ui/grid.js'
  import GridRows from '../ui/GridRows.svelte'

  const PAGE = 480
  let data = $state(/** @type {import('../lib/hun.js').Hun | null} */ (null))
  let failed = $state(false)
  let retry = $state(0)
  let withBenzi = $state(false)
  let limit = $state(PAGE)
  /** @type {HTMLDivElement | null} */
  let grid = $state(null)

  $effect(() => {
    void retry
    let active = true
    failed = false
    loadHun().then(loaded => { if (active) data = loaded }).catch(() => { if (active) failed = true })
    return () => { active = false }
  })

  const needle = $derived(route.q.trim().toLowerCase())
  const list = $derived((data?.entries ?? []).filter(entry =>
    (!withBenzi || entry.rows.some(row => row.benzi.length))
    && (!needle || entry.char.includes(needle) || entry.rows.some(row =>
      row.reading.toLowerCase().includes(needle) || row.gloss.toLowerCase().includes(needle) || row.benzi.some(char => char.includes(needle)))),
  ))
  const shown = $derived(list.slice(0, limit))
  const readings = $derived(list.reduce((count, entry) => count + entry.rows.length, 0))

  /** @param {import('../lib/hun.js').HunEntry} entry */
  const pick = entry => choose(entry.char)
  /** @param {import('../lib/hun.js').HunEntry} entry */
  const current = entry => route.c === entry.char
</script>

<div class="ui-page" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('hun.title')}</h1>
    <p class="ui-page-intro">{t('hun.intro')}</p>
    {#if data}
      <p class="ui-hint source">{t('hun.sourceLabel')} <a href={data.source.site} target="_blank" rel="noopener noreferrer">{data.source.name}</a> · <a href={data.source.licenceUrl} target="_blank" rel="noopener noreferrer">{data.source.licence}</a></p>
    {/if}
  </header>

  {#if failed}
    <p class="ui-hint">{t('hun.failed')} <button class="ui-button" data-size="sm" type="button" onclick={() => { retry++ }}>{t('hun.retry')}</button></p>
  {:else if data}
    <div class="controls">
      <input class="ui-input search" data-primary type="search" value={route.q} oninput={event => { setQuery(event.currentTarget.value); limit = PAGE }} placeholder={t('hun.search')} aria-label={t('hun.search')} autocomplete="off" />
      <label class="ui-check-row"><input class="ui-switch" type="checkbox" role="switch" bind:checked={withBenzi} onchange={() => { limit = PAGE }} /><span>{t('hun.withBenzi')}</span></label>
    </div>

    <section class="ui-section">
      <h2 class="ui-label">{t('hun.count', { chars: list.length, readings })}</h2>
      {#if list.length}
        <div class="ui-tiles" style:--ui-tile-size="76px" role="grid" aria-label={t('hun.title')} bind:this={grid} use:gridNavigation>
          <GridRows {grid} items={shown}>
            {#snippet children(/** @type {import('../lib/hun.js').HunEntry} */ entry, index)}
              <button class="ui-tile" type="button" tabindex={index === 0 ? 0 : -1} aria-current={current(entry) ? 'true' : undefined}
                title={`${entry.char} · ${entry.rows.map(row => row.reading).join(' / ')}`}
                onclick={() => pick(entry)} ondblclick={() => put(entry.char)}>
                <span class="ui-tile-glyph ui-script" lang="und-Hani">{entry.char}</span>
                <span class="ui-tile-note ui-mono">{entry.rows[0].reading}</span>
              </button>
            {/snippet}
          </GridRows>
        </div>
        {#if list.length > limit}<button class="ui-button more" type="button" onclick={() => { limit += PAGE }}>{t('hun.more', { count: Math.min(PAGE, list.length - limit) })}</button>{/if}
      {:else}
        <p class="ui-hint">{t('hun.none')}</p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .controls{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-sm) var(--ui-space-xl);margin-block-end:var(--ui-space-xl)}
  .search{flex:1 1 260px;min-inline-size:0}
  .source{margin-block-start:var(--ui-space-sm)}
  .more{margin-block-start:var(--ui-space-md)}
</style>
