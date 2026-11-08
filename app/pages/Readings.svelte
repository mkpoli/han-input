<script>
  // Every variety in 漢字音典, grouped by the atlas's classification.
  import { loadVarieties } from '../lib/data.js'
  import { varietyTree } from '../lib/classification.js'
  import { go, link } from '../lib/route.svelte.js'
  import { t } from '../lib/i18n.svelte.js'

  /** @type {import('../lib/data.js').Variety[]} */
  let varieties = $state([])
  let filter = $state('')
  loadVarieties().then(list => { varieties = list })
  const needle = $derived(filter.trim().toLowerCase())
  const tree = $derived(varietyTree(varieties, needle, t('card.unclassed')))
</script>

<div class="ui-page" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('readings.title')} <span class="ui-count">{varieties.length.toLocaleString()}</span></h1>
    <p class="ui-page-intro">{t('readings.intro')}</p>
  </header>
  <input class="ui-input" type="search" data-primary bind:value={filter} placeholder={t('readings.filter')} aria-label={t('readings.filter')}>
  {#snippet branch(/** @type {import('../lib/classification.js').VarietyNode} */ node, /** @type {number} */ depth)}
    <details class="group" open={needle !== '' || (depth === 0 && node.count < 30)}>
      <summary class="ui-label">{node.name} <span class="ui-count">{node.count}</span></summary>
      {#if node.items.length}
        <ul class="list">
          {#each node.items as variety (variety.n)}
            <li><a href={link('v', { method: String(variety.n) })} title={variety.atlas} onclick={event => { event.preventDefault(); go('v', String(variety.n)) }}>{variety.name}</a> <span class="ui-count">{variety.chars.toLocaleString()}</span></li>
          {/each}
        </ul>
      {/if}
      {#each node.children as child (child.path)}
        {@render branch(child, depth + 1)}
      {/each}
    </details>
  {/snippet}
  {#each tree as node (node.path)}
    {@render branch(node, 0)}
  {/each}
</div>

<style>
  .group summary{cursor:pointer;padding-block:var(--ui-space-xs)}
  .group .group{margin-inline-start:var(--ui-space-sm);padding-inline-start:var(--ui-space-2xs);border-inline-start:1px solid var(--ui-color-border)}
  .list{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0 var(--ui-space-lg);margin:0;padding:0;list-style:none}
  li{display:flex;justify-content:space-between;gap:var(--ui-space-xs);padding-block:2px;border-bottom:1px solid var(--ui-color-border);font-size:var(--ui-text-sm)}
  a{color:var(--ui-color-ink);text-decoration:none;min-inline-size:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  a:hover{text-decoration:underline}
</style>
