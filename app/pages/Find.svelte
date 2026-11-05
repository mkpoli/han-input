<script>
  // Find: one box for whatever the reader has. A clue is tried as a code in every method at once and
  // as a word of meaning. Several clues, split by spaces, leave the characters that fit them all.
  import { route, setQuery, link, go } from '../lib/route.svelte.js'
  import { answer, groupHits, intersect, readQuery, tallyReadings } from '../lib/search.js'
  import { loadMethods } from '../lib/data.js'
  import { autofocus } from '../lib/ui.svelte.js'
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import Tiles from '../ui/Tiles.svelte'

  const EXAMPLES = ['ユタヘヘミ', 'jnd', 'luong', '端一東平', '30407', 'tsɿ', '氵 12畫', 'river ジ', 'a672', 'U+5B57']

  let query = $state(route.q)
  /** @type {import('../lib/search.js').Answer[]} */
  let answers = $state([])
  /** @type {string[]} */
  let common = $state([])
  let busy = $state(false)
  /** @type {Map<string, import('../lib/data.js').Method>} */
  let methods = $state(new Map())
  let run = 0

  loadMethods().then(list => { methods = new Map(list.map(method => [method.id, method])) })

  $effect(() => {
    const clues = readQuery(query)
    const mine = ++run
    if (!clues.length) { answers = []; common = []; busy = false; return }
    busy = true
    Promise.all(clues.map(answer)).then(async found => {
      if (mine !== run) return
      const kept = await intersect(found)
      if (mine !== run) return
      answers = found
      common = kept
      busy = false
    })
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

<div class="ui-page">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('find.title')}</h1>
    <p class="ui-page-intro">{t('find.intro', { count: methods.size })}</p>
  </header>

  <input class="ui-input box" data-primary type="search" lang="und-Hani" use:autofocus bind:value={query} aria-label={t('find.label')}
    placeholder={t('find.placeholder')} spellcheck="false" autocomplete="off" autocapitalize="off" oninput={() => setQuery(query)}>

  {#if !query.trim()}
    <section class="ui-section">
      <h2 class="ui-label">{t('find.try')}</h2>
      <div class="examples">
        {#each EXAMPLES as example (example)}
          <button class="ui-button" data-size="sm" type="button" onclick={() => { query = example; setQuery(example) }}>{example}</button>
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
    {#if single.clue.kind === 'text' || single.clue.kind === 'point'}
      <section class="ui-section">
        <h2 class="ui-label">{t('find.characters')}</h2>
        <Tiles chars={single.chars} size={72} label={t('find.characters')} />
      </section>
    {/if}
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
    {#each groups as group (group.method)}
      {@const method = methods.get(group.method)}
      <section class="ui-section">
        <h2 class="ui-label method">
          <a href={link('m', { method: group.method, q: query })} onclick={event => { event.preventDefault(); go('m', group.method); setQuery(query) }}>{method ? nameOf(method.names) : group.method}</a>
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
    {/each}
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
  .code{font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft);font-family:'Jigmo Ext',var(--ui-font-mono),var(--ui-font-sans),'Jigmo'}
  .code.exact{color:var(--ui-color-accent-ink);font-weight:var(--ui-weight-semibold)}
</style>
