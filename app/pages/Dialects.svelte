<script>
  // Every dialect character on one page: each doculect is a filter, and shapes that more than one
  // doculect uses can be shown alone. Shared shapes come first.
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import { close, route, setQuery } from '../lib/route.svelte.js'
  import { choose, put, ui } from '../lib/ui.svelte.js'
  import { HUES, loadDialects } from '../lib/dialects.js'
  import { gridNavigation } from '../ui/grid.js'
  import GridRows from '../ui/GridRows.svelte'

  const PAGE = 480
  let data = $state(/** @type {import('../lib/dialects.js').Dialects | null} */ (null))
  let failed = $state(false)
  let retry = $state(0)
  /** @type {string[]} */
  let on = $state([])
  let shared = $state(false)
  let limit = $state(PAGE)
  /** @type {HTMLDivElement | null} */
  let grid = $state(null)

  $effect(() => {
    void retry
    let active = true
    failed = false
    loadDialects().then(loaded => { if (active) data = loaded }).catch(() => { if (active) failed = true })
    return () => { active = false }
  })

  const needle = $derived(route.q.trim())
  const counts = $derived(new Map((data?.sets ?? []).map(set => [set.id, data?.entries.filter(entry => entry.sets.includes(set.id)).length ?? 0])))
  const list = $derived((data?.entries ?? []).filter(entry =>
    (!on.length || entry.sets.some(id => on.includes(id)))
    && (!shared || entry.doculects > 1)
    && (!needle || entry.key.includes(needle) || entry.rows.some(row => row.def?.includes(needle) || row.readings?.some(([, form]) => form.includes(needle)))),
  ).toSorted((a, b) => b.doculects - a.doculects))
  const shown = $derived(list.slice(0, limit))

  /** @param {string} id */
  function toggle(id) {
    on = on.includes(id) ? on.filter(other => other !== id) : [...on, id]
    limit = PAGE
  }

  /** @param {import('../lib/dialects.js').DialectEntry} entry */
  function pick(entry) {
    if (entry.char) {
      choose(entry.char)
      return
    }
    close()
    ui.record = null
    ui.dialect = entry.key
    if (matchMedia('(max-width: 900px)').matches) ui.sheet = true
  }

  /** @param {import('../lib/dialects.js').DialectEntry} entry */
  const current = entry => entry.char ? route.c === entry.char : !route.c && ui.dialect === entry.key
</script>

<div class="ui-page" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('dialects.title')}</h1>
    <p class="ui-page-intro">{t('dialects.intro')}</p>
  </header>

  {#if failed}
    <p class="ui-hint">{t('dialects.failed')} <button class="ui-button" data-size="sm" type="button" onclick={() => { retry++ }}>{t('dialects.retry')}</button></p>
  {:else if data}
    <div class="controls">
      <input class="ui-input search" data-primary type="search" value={route.q} oninput={event => { setQuery(event.currentTarget.value); limit = PAGE }} placeholder={t('dialects.search')} aria-label={t('dialects.search')} autocomplete="off" />
      <label class="ui-check-row shared"><input class="ui-switch" type="checkbox" role="switch" bind:checked={shared} onchange={() => { limit = PAGE }} /><span>{t('dialects.shared')}</span></label>
    </div>
    <div class="ui-chip-row" role="group" aria-label={t('dialects.doculects')}>
      {#each data.sets as set (set.id)}
        <button class="ui-chip" type="button" aria-pressed={on.includes(set.id)} title={nameOf(set.names)} style:--hue={HUES[set.id]} onclick={() => toggle(set.id)}>
          <span class="dot" aria-hidden="true"></span>{set.label}<span class="ui-count">{counts.get(set.id)}</span>
        </button>
      {/each}
      {#if on.length}<button class="ui-chip" type="button" onclick={() => { on = []; limit = PAGE }}>{t('dialects.all')}</button>{/if}
    </div>

    <section class="ui-section">
      <h2 class="ui-label">{t('dialects.count', { count: list.length })}</h2>
      {#if list.length}
        <div class="ui-tiles" style:--ui-tile-size="64px" role="grid" aria-label={t('dialects.title')} bind:this={grid} use:gridNavigation>
          <GridRows {grid} items={shown}>
            {#snippet children(/** @type {import('../lib/dialects.js').DialectEntry} */ entry, index)}
              <button class="ui-tile" type="button" tabindex={index === 0 ? 0 : -1} aria-current={current(entry) ? 'true' : undefined}
                title={`${entry.key} · ${entry.sets.map(id => data?.sets.find(set => set.id === id)?.label).join('、')}`}
                onclick={() => pick(entry)} ondblclick={() => { if (entry.char) put(entry.char) }}>
                <span class={entry.char ? 'ui-tile-glyph ui-script' : 'ids ui-glyph-text'} lang="und-Hani">{entry.key}</span>
                <span class="dots" aria-hidden="true">{#each entry.sets as id (id)}<i style:--hue={HUES[id]}></i>{/each}</span>
              </button>
            {/snippet}
          </GridRows>
        </div>
        {#if list.length > limit}<button class="ui-button more" type="button" onclick={() => { limit += PAGE }}>{t('dialects.more', { count: Math.min(PAGE, list.length - limit) })}</button>{/if}
      {:else}
        <p class="ui-hint">{t('dialects.none')}</p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .controls{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-sm) var(--ui-space-xl)}
  .search{flex:1 1 260px;min-inline-size:0}
  .shared{align-items:center}
  .ui-chip-row{margin-block:var(--ui-space-lg) var(--ui-space-xl)}
  .ui-chip{font-size:var(--ui-text-sm)}
  .dot,.dots i{flex:none;border-radius:50%;background:light-dark(oklch(0.52 0.13 var(--hue)),oklch(0.8 0.11 var(--hue)))}
  .dot{inline-size:8px;block-size:8px}
  .dots{display:flex;flex-wrap:wrap;justify-content:center;gap:2px;max-inline-size:100%}
  .dots i{inline-size:6px;block-size:6px}
  .ids{align-self:center;font-size:var(--ui-text-xs);line-height:1.2;text-align:center;overflow-wrap:anywhere;color:var(--ui-color-ink-soft)}
  .more{margin-block-start:var(--ui-space-md)}
</style>
