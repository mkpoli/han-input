<script>
  // Find: one box for whatever the reader has. A clue is tried as a code in every method at once and
  // as a word of meaning. Several clues, split by spaces, leave the characters that fit them all.
  import { tick, untrack } from 'svelte'
  import { route, setQuery, setCharset, setPage, pageHref } from '../lib/route.svelte.js'
  import { loadCharsets, loadCharset, loadCharsetCodes, loadRecords, filterAnswer, browseCharset, compareCodes, isPrivateUse } from '../lib/charsets.js'
  import { answer, groupHits, intersect, readQuery, tallyReadings } from '../lib/search.js'
  import { loadMethods } from '../lib/data.js'
  import { loadGlyphs } from '../lib/fonts.js'
  import { isHan } from '../../src/fold.js'
  import { autofocus } from '../lib/ui.svelte.js'
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import Tiles from '../ui/Tiles.svelte'
  import Pager from '../ui/Pager.svelte'
  import PaginatedTiles from '../ui/PaginatedTiles.svelte'
  import MethodGroups from '../ui/MethodGroups.svelte'
  import CharsetFilter from '../ui/CharsetFilter.svelte'
  import ProposalRecords from '../ui/ProposalRecords.svelte'
  import PuaReadings from '../ui/PuaReadings.svelte'

  const EXAMPLES = ['ユタヘヘミ', 'jnd', 'luong', '端一東平', '30407', 'tsɿ', '氵 12畫', '口匕', 'river ジ', 'chữ', 'a-1', 'a672', 'U+5B57', '氵+青', '日*月']
  // A browsed set and the common-results grid turn 240 characters at a time; other grids use 96.
  const GRID_LIMIT = 240

  const query = $derived(route.q)
  /** @type {import('../lib/search.js').Answer[]} */
  let answers = $state([])
  /** @type {string[]} */
  let common = $state([])
  /** @type {string[]} */
  let browsed = $state([])
  /** @type {Map<string, string>} */
  let codes = $state(new Map())
  /** @type {'all' | 'encoded' | 'unencoded'} */
  let show = $state('all')
  let hanOnly = $state(false)
  let byCode = $state(false)
  /** @type {import('../lib/charsets.js').ProposalRecords | null} */
  let records = $state(null)
  /** @type {import('../lib/charsets.js').Charset[]} */
  let charsets = $state([])
  const chosen = $derived(charsets.find(set => set.id === route.set))
  let busy = $state(false)
  let failed = $state(false)
  let catalogueFailed = $state(false)
  let retry = $state(0)
  /** @type {Map<string, import('../lib/data.js').Method>} */
  let methods = $state(new Map())
  let turning = $state(false)
  /** @type {HTMLElement | null} */
  let browseTop = $state(null)
  /** @param {string[]} list @param {Map<string, string>} codeOf @param {'all' | 'encoded' | 'unencoded'} mode @param {boolean} sorted @param {boolean} hanOnly */
  function arrange(list, codeOf, mode, sorted, hanOnly) {
    let out = mode === 'all' ? list : list.filter(char => mode === 'unencoded' ? isPrivateUse(char) : !isPrivateUse(char))
    // A private-use slot is a Han record without a scalar, so it stays in the Han view.
    if (hanOnly) out = out.filter(char => isHan(char) || isPrivateUse(char))
    if (sorted) {
      out = [...out].sort((a, b) => {
        const left = codeOf.get(a)
        const right = codeOf.get(b)
        if (left && right) return compareCodes(left, right)
        if (left) return -1
        if (right) return 1
        return (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0)
      })
    }
    return out
  }
  const arranged = $derived(arrange(browsed, codes, show, byCode && codes.size > 0, hanOnly))
  const longCodes = $derived([...codes.values()].some(code => code.length > 7))
  const pages = $derived(Math.max(1, Math.ceil(arranged.length / GRID_LIMIT)))
  const page = $derived(Math.min(pages - 1, Math.max(0, route.p - 1)))
  const pageChars = $derived(arranged.slice(page * GRID_LIMIT, (page + 1) * GRID_LIMIT))

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
    codes = new Map()
    records = null
    failed = false
    busy = true
    ;(async () => {
      try {
        let entry = null
        if (selected) {
          const catalogue = await loadCharsets()
          if (!active) return
          charsets = catalogue
          catalogueFailed = false
          entry = catalogue.find(set => set.id === selected) ?? null
          if (!entry) throw new Error('Unknown character set')
        }
        const membership = selected ? await loadCharset(selected) : null
        if (!active) return
        if (!clues.length) {
          const chars = selected ? await browseCharset(selected) : []
          if (!active) return
          const setCodes = selected && entry?.codes ? await loadCharsetCodes(selected) : new Map()
          if (!active) return
          const visible = arrange(chars, setCodes, untrack(() => show), untrack(() => byCode), untrack(() => hanOnly))
          const requested = untrack(() => route.p)
          const wanted = Math.min(Math.max(1, Math.ceil(visible.length / GRID_LIMIT)), Math.max(1, requested))
          const start = (wanted - 1) * GRID_LIMIT
          await loadGlyphs(visible.slice(start, start + GRID_LIMIT))
          if (!active) return
          codes = setCodes
          browsed = chars
          if (wanted !== requested) setPage(wanted, { replace: true })
          busy = false
          if (selected && entry?.records) {
            loadRecords(selected).then(data => { if (active) records = data }).catch(() => {})
          }
          return
        }
        const found = await Promise.all(clues.map(answer))
        if (!active) return
        const filtered = membership ? found.map(item => filterAnswer(item, membership, selected)) : found
        const kept = await intersect(filtered)
        if (!active) return
        // `kept` is a grid only when several clues remain; one clue renders its hits instead.
        if (filtered.length > 1) await loadGlyphs(kept.slice(0, GRID_LIMIT))
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
  // Each method list keeps its page when other parts of the result change.
  const exactGroups = $derived(groups.filter(group => group.literal))
  const prefixGroups = $derived(groups.filter(group => !group.literal))
  const tally = $derived(single ? tallyReadings(single.readings) : [])
  const tallyChars = $derived(tally.map(([char]) => char))
  const variantChars = $derived(single ? single.variants.map(row => row.char) : [])
  const tallyNotes = $derived(new Map(tally.map(([char, count]) => [char, String(count)])))
  const varieties = $derived(single ? new Set(single.readings.map(hit => hit.n)).size : 0)
  const empty = $derived(!busy && answers.length > 0 && !common.length && !groups.length && !single?.pua.length)

  /** A page of a browsed set arrives as one grid, so its face is fetched before the page turns.
   * @param {number} next */
  async function turnTo(next) {
    if (turning) return
    const from = arranged
    next = Math.max(0, Math.min(pages - 1, next))
    if (next === page) return
    turning = true
    try {
      await loadGlyphs(from.slice(next * GRID_LIMIT, (next + 1) * GRID_LIMIT))
      if (arranged !== from) return
      setPage(next + 1)
      await tick()
      browseTop?.scrollIntoView({ block: 'start' })
    } finally { turning = false }
  }

  /** A filter or an order starts at the first page of the new list. @param {'all' | 'encoded' | 'unencoded'} next */
  async function setShow(next) {
    if (show === next) return
    show = next
    setPage(1, { replace: true })
    await tick()
    await loadGlyphs(arranged.slice(0, GRID_LIMIT))
  }

  /** @param {boolean} next */
  async function setHan(next) {
    if (hanOnly === next) return
    hanOnly = next
    setPage(1, { replace: true })
    await tick()
    await loadGlyphs(arranged.slice(0, GRID_LIMIT))
  }

  /** @param {boolean} next */
  async function setOrder(next) {
    if (byCode === next) return
    byCode = next
    setPage(1, { replace: true })
    await tick()
    await loadGlyphs(arranged.slice(0, GRID_LIMIT))
  }
</script>

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
    {#if browsed.length || !records}
      <section class="ui-section" bind:this={browseTop}>
        <h2 class="ui-label">{t('find.characters')} <span class="ui-count">{arranged.length.toLocaleString()}</span></h2>
        {#if chosen && chosen.group !== 'Proposals'}
          <div class="browse-tools">
            {#if chosen.codes}
              <button class="ui-button" data-size="sm" type="button" aria-pressed={byCode} onclick={() => setOrder(!byCode)}>{t('find.codeOrder')}</button>
            {/if}
            <div class="seg" role="group" aria-label={t('find.showLabel')}>
              <button class="ui-button" data-size="sm" type="button" aria-pressed={show === 'all'} onclick={() => setShow('all')}>{t('find.showAll')}</button>
              <button class="ui-button" data-size="sm" type="button" aria-pressed={show === 'encoded'} onclick={() => setShow('encoded')}>{t('find.showEncoded')}</button>
              <button class="ui-button" data-size="sm" type="button" aria-pressed={show === 'unencoded'} onclick={() => setShow('unencoded')}>{t('find.showUnencoded')}</button>
            </div>
            <div class="seg" role="group" aria-label={t('find.scriptLabel')}>
              <button class="ui-button" data-size="sm" type="button" aria-pressed={!hanOnly} onclick={() => setHan(false)}>{t('find.showAllChars')}</button>
              <button class="ui-button" data-size="sm" type="button" aria-pressed={hanOnly} onclick={() => setHan(true)}>{t('find.showHan')}</button>
            </div>
          </div>
        {/if}
        <Pager page={page + 1} {pages} disabled={turning} href={pageHref} onchange={next => turnTo(next - 1)} />
        <Tiles chars={pageChars} notes={codes} columns={chosen?.columns ?? 0} limit={GRID_LIMIT} codeNotes={longCodes} label={chosen ? nameOf(chosen.names) : route.set} />
        {#if !arranged.length}<p class="ui-hint">{t('find.none')}</p>{/if}
        <Pager page={page + 1} {pages} disabled={turning} href={pageHref} onchange={next => turnTo(next - 1)} />
      </section>
    {/if}
    {#if records}<ProposalRecords {records} label={chosen ? nameOf(chosen.names) : route.set} />{/if}
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
      <PaginatedTiles chars={common} perPage={GRID_LIMIT} label={t('find.common', { count: common.length })} />
    </section>
  {:else if single}
    {#if single.pua.length}
      <section class="ui-section">
        <h2 class="ui-label">{t('pua.readings')} <span class="ui-count">{single.pua.length}</span></h2>
        <PuaReadings readings={single.pua} label={t('pua.readings')} />
      </section>
    {/if}
    {#if single.chars.length && !single.shapes.some(shape => shape.exact) && (['text', 'point', 'strokes'].includes(single.clue.kind) || (single.clue.kind === 'pua' && !single.pua.length))}
      <section class="ui-section">
        <h2 class="ui-label">{t('find.characters')}</h2>
        <PaginatedTiles chars={single.chars} size={72} label={t('find.characters')} />
      </section>
    {/if}
    {#each single.shapes as shape, at (shape.text)}
      {#if at === 1}<p class="ui-hint">{t('find.structureNote')}</p>{/if}
      {@const title = shape.exact ? t('find.structure', { parts: shape.text }) : t('find.structureVariant', { parts: shape.text })}
      <section class="ui-section">
        <h2 class="ui-label">{title} <span class="ui-count">{shape.chars.length}</span></h2>
        <PaginatedTiles chars={shape.chars} label={title} />
      </section>
    {/each}
    {#if single.variants.length}
      <section class="ui-section">
        <h2 class="ui-label">{t('find.sameCharacter')} <span class="ui-count">{single.variants.length}</span></h2>
        <p class="ui-hint">{t('find.sameCharacterNote')}</p>
        <PaginatedTiles chars={variantChars} label={t('find.sameCharacter')} />
      </section>
    {/if}
    <MethodGroups groups={exactGroups} {methods} {query} heading={t('find.sameCode')} />
    {#if single.meaning.length}
      <section class="ui-section">
        <h2 class="ui-label">{t('find.meaning', { word: single.clue.text })} <span class="ui-count">{single.meaning.length}</span></h2>
        <PaginatedTiles chars={single.meaning} label={t('find.meaning', { word: single.clue.text })} />
      </section>
    {/if}
    {#if single.parts.length}
      <section class="ui-section">
        <h2 class="ui-label">{t('find.parts', { part: single.clue.text })} <span class="ui-count">{single.parts.length}</span></h2>
        <PaginatedTiles chars={single.parts} label={t('find.parts', { part: single.clue.text })} />
      </section>
    {/if}
    {#each single.partVariants as group (group.text)}
      <section class="ui-section">
        <h2 class="ui-label">{t('find.variantOf', { part: group.text })} <span class="ui-count">{group.chars.length}</span></h2>
        <PaginatedTiles chars={group.chars} label={t('find.variantOf', { part: group.text })} />
      </section>
    {/each}
    {#if single.similarParts.length}<p class="ui-hint">{t('find.similarNote')}</p>{/if}
    {#each single.similarParts as group (group.text)}
      <section class="ui-section">
        <h2 class="ui-label">{t('find.similarPart', { part: group.text })} <span class="ui-count">{group.chars.length}</span></h2>
        <PaginatedTiles chars={group.chars} label={t('find.similarPart', { part: group.text })} />
      </section>
    {/each}
    {#if tally.length}
      <section class="ui-section">
        <h2 class="ui-label">{t('find.readings', { count: varieties, chars: tally.length })}</h2>
        <PaginatedTiles chars={tallyChars} notes={tallyNotes} label={t('find.readings', { count: varieties, chars: tally.length })} />
      </section>
    {/if}
    <MethodGroups groups={prefixGroups} {methods} {query} heading={t('find.codePrefix')} />
  {/if}
</div>

<style>
  .box{font-size:22px;block-size:52px}
  .examples{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs)}
  .clues{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs)}
  .clue{padding:2px var(--ui-space-sm);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm)}
  .browse-tools{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-2xs)}
  .seg{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs)}
  .browse-tools button[aria-pressed='true']{border-color:var(--ui-color-accent);background:var(--ui-color-accent-soft);color:var(--ui-color-accent-ink)}
</style>
