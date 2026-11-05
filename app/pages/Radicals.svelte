<script>
  // The 214 Kangxi radicals, then a radical's characters by the strokes beyond it.
  import { loadChars } from '../lib/data.js'
  import { t } from '../lib/i18n.svelte.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import Tiles from '../ui/Tiles.svelte'

  const RADICALS = Array.from({ length: 214 }, (_, i) => String.fromCodePoint(0x2F00 + i))
  /** @type {Map<string, import('../lib/data.js').CharRow>} */
  let rows = $state(new Map())
  loadChars().then(map => { rows = map })

  const chosen = $derived(/^\d+$/.test(route.q) ? Number(route.q) : 0)
  const groups = $derived.by(() => {
    if (!chosen) return []
    /** @type {Map<number, string[]>} */
    const byRest = new Map()
    for (const [char, row] of rows) {
      const [radical, rest] = row.radical.split('.')
      if (parseInt(radical, 10) !== chosen) continue
      const key = parseInt(rest, 10) || 0
      const list = byRest.get(key)
      if (list) list.push(char)
      else byRest.set(key, [char])
    }
    return [...byRest].sort((a, b) => a[0] - b[0])
  })
</script>

<div class="ui-page" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('radicals.title')}</h1>
    <p class="ui-page-intro">{t('radicals.intro')}</p>
  </header>
  <div class="grid">
    {#each RADICALS as radical, i (radical)}
      <button class="rad ui-script" class:on={chosen === i + 1} type="button" lang="und-Hani" title={String(i + 1)} onclick={() => setQuery(String(i + 1))}>{radical}</button>
    {/each}
  </div>
  {#each groups as [rest, chars] (rest)}
    <section class="ui-section">
      <h2 class="ui-label">{t('radicals.rest', { count: rest })} <span class="ui-count">{chars.length}</span></h2>
      <Tiles {chars} limit={400} size={48} label={t('radicals.rest', { count: rest })} />
    </section>
  {/each}
</div>

<style>
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:2px}
  .rad{block-size:38px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface);color:var(--ui-color-ink);font-size:22px;cursor:pointer;line-height:1}
  .rad:hover{background:var(--ui-color-surface-hover)}
  .rad.on{background:var(--ui-color-accent);color:var(--ui-color-on-accent);border-color:var(--ui-color-accent)}
</style>
