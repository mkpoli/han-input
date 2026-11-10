<script>
  // The codes a clue matches, one group per method. A broad clue reaches a hundred methods, so the
  // list turns a page at a time: each page settles near the tile budget of a browsed set.
  import { tick } from 'svelte'
  import { go, link, setQuery } from '../lib/route.svelte.js'
  import { GROUP_CHARS, GROUP_HITS, groupPages } from '../lib/search.js'
  import { i18n, nameOf, t } from '../lib/i18n.svelte.js'
  import { gSourceOf, noteOf } from '../lib/sources.js'
  import Pager from './Pager.svelte'
  import Tiles from './Tiles.svelte'

  /** `heading` names the half of the hits this list holds: those the query spells whole, or
   * those it only begins.
   * @type {{ groups: import('../lib/search.js').MethodGroup[], methods: Map<string, import('../lib/data.js').Method>, query: string, heading: string }} */
  let { groups, methods, query, heading } = $props()
  let page = $state(0)
  /** @type {HTMLElement | null} */
  let top = $state(null)
  const pages = $derived(groupPages(groups))
  const current = $derived(Math.min(pages.length - 1, Math.max(0, page)))
  const shown = $derived(pages[current] ?? [])

  $effect(() => { groups; page = 0 })

  /** @param {number} next */
  async function turnTo(next) {
    next = Math.max(0, Math.min(pages.length - 1, next))
    if (next === current) return
    page = next
    await tick()
    top?.scrollIntoView({ block: 'start' })
  }
</script>

{#if groups.length}
<section class="ui-section" bind:this={top}>
  <h2 class="ui-label">{heading} <span class="ui-count">{groups.length}</span></h2>
  <Pager page={current + 1} pages={pages.length} onchange={next => turnTo(next - 1)} />
  <div class="groups">
    {#each shown as group (group.method)}
      {@const method = methods.get(group.method)}
      <section class="group">
        <h3 class="ui-label method">
          <a href={link('m', { method: group.method, q: query })} onclick={event => { event.preventDefault(); const q = query; go('m', group.method); setQuery(q) }}>{method ? nameOf(method.names) : group.method}</a>
          <span class="ui-count">{group.total}</span>
        </h3>
        <div class="hits">
          {#each group.hits.slice(0, GROUP_HITS) as hit (hit.code)}
            {@const gsource = group.method === 'irg-g' ? gSourceOf(hit.code) : null}
            <div class="hit">
              <span class="code ui-mono" class:exact={hit.exact} title={gsource ? `${nameOf(gsource.names)} — ${noteOf(gsource, i18n.locale)}` : undefined}>{hit.code}</span>
              <Tiles chars={hit.chars} size={44} limit={GROUP_CHARS} label={hit.code} />
            </div>
          {/each}
          {#if group.hits.length > GROUP_HITS}<p class="ui-hint">{t('find.moreCodes', { count: group.hits.length - GROUP_HITS })}</p>{/if}
        </div>
      </section>
    {/each}
  </div>
  <Pager page={current + 1} pages={pages.length} onchange={next => turnTo(next - 1)} />
</section>
{/if}

<style>
  .groups{display:grid;gap:var(--ui-space-lg)}
  .group{display:grid;gap:var(--ui-space-md);min-inline-size:0}
  .method a{color:inherit}
  .hits{display:grid;gap:var(--ui-space-xs)}
  .hit{display:grid;grid-template-columns:minmax(72px,auto) minmax(0,1fr);gap:var(--ui-space-md);align-items:center}
  .code{font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft);font-family:'Han Ext',var(--ui-font-mono),var(--ui-font-sans),'Jigmo'}
  .code.exact{color:var(--ui-color-accent-ink);font-weight:var(--ui-weight-semibold)}
</style>
