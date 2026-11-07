<script>
  // Find: one box for whatever the reader has. A clue is tried as a code in every method at once and
  // as a word of meaning. Several clues, split by spaces, leave the characters that fit them all.
  import { route, setQuery, setCharset, link, go } from '../lib/route.svelte.js'
  import { loadCharsets, loadCharset, filterAnswer, browseCharset } from '../lib/charsets.js'
  import { answer, groupHits, intersect, readQuery, tallyReadings } from '../lib/search.js'
  import { loadMethods } from '../lib/data.js'
  import { autofocus } from '../lib/ui.svelte.js'
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import Tiles from '../ui/Tiles.svelte'
  import CharsetFilter from '../ui/CharsetFilter.svelte'

  const EXAMPLES = ['ユタヘヘミ', 'jnd', 'luong', '端一東平', '30407', 'tsɿ', '氵 12畫', 'river ジ', 'chữ', 'a-1', 'a672', 'U+5B57']

  const query = $derived(route.q)
  /** @type {import('../lib/search.js').Answer[]} */
  let answers = $state([])
  /** @type {string[]} */
  let common = $state([])
  /** @type {string[]} */
  let browsed = $state([])
  /** @type {import('../lib/charsets.js').Charset[]} */
  let charsets = $state([])
  const chosen = $derived(charsets.find(set => set.id === route.set))
  let busy = $state(false)
  let failed = $state(false)
  let catalogueFailed = $state(false)
  let retry = $state(0)
  /** @type {Map<string, import('../lib/data.js').Method>} */
  let methods = $state(new Map())

  loadMethods().then(list => { methods = new Map(list.map(method => [method.id, method])) }).catch(() => {})

  $effect(() => {
    retry
    let active = true
    catalogueFailed = false
    loadCharsets().then(list => { if (active) charsets = list }).catch(() => { if (active) catalogueFailed = true })
    return () => { active = false }
  })

  $effect(() => {
    const clues = readQuery(query)
    const selected = route.set
    retry
    let active = true
    answers = []
    common = []
    browsed = []
    failed = false
    busy = true
    ;(async () => {
      try {
        if (selected) {
          const catalogue = await loadCharsets()
          if (!active) return
          charsets = catalogue
          catalogueFailed = false
          if (!catalogue.some(set => set.id === selected)) throw new Error('Unknown character set')
        }
        const membership = selected ? await loadCharset(selected) : null
        if (!active) return
        if (!clues.length) {
          const chars = selected ? await browseCharset(selected) : []
          if (active) browsed = chars
          return
        }
        const found = await Promise.all(clues.map(answer))
        if (!active) return
        const filtered = membership ? found.map(item => filterAnswer(item, membership)) : found
        const kept = await intersect(filtered)
        if (!active) return
        answers = filtered
        common = kept
      } catch {
        if (active) failed = true
      } finally {
        if (active) busy = false
      }
    })()
    return () => { active = false }
  })

  const many = $derived(answers.length > 1)
  const single = $derived(answers.length === 1 ? answers[0] : null)
  const groups = $derived(single ? groupHits(single.hits) : [])
  const tally = $derived(single ? tallyReadings(single.readings) : [])
  const tallyChars = $derived(tally.map(([char]) => char))
  const tallyNotes = $derived(new Map(tally.map(([char, count]) => [char, String(count)])))
  const varieties = $derived(single ? new Set(single.readings.map(hit => hit.n)).size : 0)
  const empty = $derived(!busy && answers.length > 0 && !common.length && !groups.length)
</script>

{#snippet methodGroup(/** @type {ReturnType<typeof groupHits>[number]} */ group)}
      {@const method = methods.get(group.method)}
      <section class="ui-section">
        <h2 class="ui-label method">
          <a href={link('m', { method: group.method, q: query })} onclick={event => { event.preventDefault(); const q = query; go('m', group.method); setQuery(q) }}>{method ? nameOf(method.names) : group.method}</a>
          <span class="ui-count">{group.total}</span>
        </h2>
        <div class="hits">
          {#each group.hits.slice(0, 8) as hit (hit.code)}
            <div class="hit">
              <span class="code ui-mono" class:exact={hit.exact}>{hit.code}</span>
              <Tiles chars={hit.chars} size={44} limit={24} label={hit.code} />
            </div>
          {/each}
          {#if group.hits.length > 8}<p class="ui-hint">{t('find.moreCodes', { count: group.hits.length - 8 })}</p>{/if}
        </div>
      </section>
    {/snippet}

<div class="ui-page">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('find.title')}</h1>
    <p class="ui-page-intro">{t('find.intro')}</p>
  </header>

  <input class="ui-input box" data-primary type="search" lang="und-Hani" use:autofocus value={query} aria-label={t('find.label')}
    placeholder={t('find.placeholder')} spellcheck="false" autocomplete="off" autocapitalize="off" oninput={(/** @type {Event & { currentTarget: HTMLInputElement }} */ event) => setQuery(event.currentTarget.value)}>
  <CharsetFilter {charsets} selected={route.set} onchange={setCharset} failed={catalogueFailed && !route.set} onretry={() => retry++} />

  {#if failed}
    <div class="ui-section" role="alert">
      <p class="ui-hint">{t('charset.error')}</p>
      <button class="ui-button" data-size="sm" type="button" onclick={() => retry++}>{t('charset.retry')}</button>
    </div>
  {:else if busy}
    <p class="ui-hint" role="status">{t('charset.loading')}</p>
  {:else if !query.trim() && route.set}
    <section class="ui-section">
      <h2 class="ui-label">{t('find.characters')} <span class="ui-count">{browsed.length.toLocaleString()}</span></h2>
      <Tiles chars={browsed} limit={240} label={chosen ? nameOf(chosen.names) : route.set} />
      {#if !browsed.length}<p class="ui-hint">{t('find.none')}</p>{/if}
    </section>
  {:else if !query.trim()}
    <section class="ui-section">
      <h2 class="ui-label">{t('find.try')}</h2>
      <div class="examples">
        {#each EXAMPLES as example (example)}
          <button class="ui-button" data-size="sm" type="button" onclick={() => setQuery(example)}>{example}</button>
        {/each}
      </div>
    </section>
  {:else if empty}
    <p class="ui-hint">{t('find.none')}</p>
  {:else if many}
    <section class="ui-section">
      <h2 class="ui-label">{t('find.common', { count: common.length })}</h2>
      <p class="clues">
        {#each answers as item, i (i)}
          <span class="clue">{item.clue.text} <span class="ui-count">{item.chars.length}</span></span>
        {/each}
      </p>
      <Tiles chars={common} label={t('find.common', { count: common.length })} limit={240} />
    </section>
  {:else if single}
    {#if single.chars.length && ['text', 'point', 'strokes', 'pua'].includes(single.clue.kind)}
      <section class="ui-section">
        <h2 class="ui-label">{t('find.characters')}</h2>
        <Tiles chars={single.chars} size={72} label={t('find.characters')} />
      </section>
    {/if}
    {#each groups.filter(group => group.literal) as group (group.method)}{@render methodGroup(group)}{/each}
    {#if single.meaning.length}
      <section class="ui-section">
        <h2 class="ui-label">{t('find.meaning', { word: single.clue.text })} <span class="ui-count">{single.meaning.length}</span></h2>
        <Tiles chars={single.meaning} limit={48} label={t('find.meaning', { word: single.clue.text })} />
      </section>
    {/if}
    {#if single.parts.length}
      <section class="ui-section">
        <h2 class="ui-label">{t('find.parts', { part: single.clue.text })} <span class="ui-count">{single.parts.length}</span></h2>
        <Tiles chars={single.parts} limit={48} label={t('find.parts', { part: single.clue.text })} />
      </section>
    {/if}
    {#if tally.length}
      <section class="ui-section">
        <h2 class="ui-label">{t('find.readings', { count: varieties, chars: tally.length })}</h2>
        <Tiles chars={tallyChars} notes={tallyNotes} limit={48} label={t('find.readings', { count: varieties, chars: tally.length })} />
      </section>
    {/if}
    {#each groups.filter(group => !group.literal) as group (group.method)}{@render methodGroup(group)}{/each}
  {/if}
</div>

<style>
  .box{font-size:22px;block-size:52px}
  .examples{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs)}
  .clues{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs)}
  .clue{padding:2px var(--ui-space-sm);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm)}
  .method a{color:inherit}
  .hits{display:grid;gap:var(--ui-space-xs)}
  .hit{display:grid;grid-template-columns:minmax(72px,auto) minmax(0,1fr);gap:var(--ui-space-md);align-items:center}
  .code{font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft);font-family:'Han Ext',var(--ui-font-mono),var(--ui-font-sans),'Jigmo'}
  .code.exact{color:var(--ui-color-accent-ink);font-weight:var(--ui-weight-semibold)}
</style>
