<script>
  // Every variety in 漢字音典, grouped by the atlas's classification.
  import { loadVarieties } from '../lib/data.js'
  import { go, link } from '../lib/route.svelte.js'
  import { t } from '../lib/i18n.svelte.js'

  /** @type {import('../lib/data.js').Variety[]} */
  let varieties = $state([])
  let filter = $state('')
  loadVarieties().then(list => { varieties = list })
  const needle = $derived(filter.trim().toLowerCase())
  const groups = $derived.by(() => {
    /** @type {Map<string, import('../lib/data.js').Variety[]>} */
    const out = new Map()
    for (const variety of varieties) {
      if (needle && !`${variety.name} ${variety.short} ${variety.atlas} ${variety.region} ${variety.place}`.toLowerCase().includes(needle)) continue
      const key = variety.atlas.split('－')[0] || t('card.unclassed')
      const list = out.get(key)
      if (list) list.push(variety)
      else out.set(key, [variety])
    }
    return [...out].sort((a, b) => b[1].length - a[1].length)
  })
</script>

<div class="ui-page" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('readings.title')}</h1>
    <p class="ui-page-intro">{t('readings.intro', { count: varieties.length.toLocaleString() })}</p>
  </header>
  <input class="ui-input" type="search" data-primary bind:value={filter} placeholder={t('readings.filter')} aria-label={t('readings.filter')}>
  {#each groups as [group, rows] (group)}
    <details class="group" open={needle !== '' || rows.length < 30}>
      <summary class="ui-label">{group} <span class="ui-count">{rows.length}</span></summary>
      <ul class="list">
        {#each rows as variety (variety.n)}
          <li><a href={link('v', { method: String(variety.n) })} title={variety.atlas} onclick={event => { event.preventDefault(); go('v', String(variety.n)) }}>{variety.name}</a> <span class="ui-count">{variety.chars.toLocaleString()}</span></li>
        {/each}
      </ul>
    </details>
  {/each}
</div>

<style>
  .group summary{cursor:pointer;padding-block:var(--ui-space-xs)}
  .list{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0 var(--ui-space-lg);margin:0;padding:0;list-style:none}
  li{display:flex;justify-content:space-between;gap:var(--ui-space-xs);padding-block:2px;border-bottom:1px solid var(--ui-color-border);font-size:var(--ui-text-sm)}
  a{color:var(--ui-color-ink);text-decoration:none;min-inline-size:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  a:hover{text-decoration:underline}
</style>
