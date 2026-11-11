<script>
  import { tick } from 'svelte'
  import { loadAges, versionRows } from '../lib/ages.js'
  import { blockOccupancy, blockRows, planeRows } from '../lib/blocks.js'
  import { loadCharset, loadRecords, sharedCharacters } from '../lib/charsets.js'
  import { i18n, nameOf, t } from '../lib/i18n.svelte.js'
  import CoverageChart from './CoverageChart.svelte'
  import CoverageDot from './CoverageDot.svelte'

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
  let compare = $state('')
  let compareRetry = $state(0)
  let compareBusy = $state(false)
  let compareFailed = $state(false)
  let comparison = $state(/** @type {{id: string, shared: number, total: number, mapped: number, otherTotal: number, glyphs: number, mappedGlyphs: number} | null} */ (null))
  /** @type {import('../lib/blocks.js').BlockRow[]} */
  let blocks = $state([])
  /** @type {import('../lib/ages.js').VersionRow[] | null} */
  let versions = $state(null)
  /** @type {import('../lib/blocks.js').BlockOccupancy[]} */
  let occupancy = $state([])
  /** @type {import('../lib/blocks.js').PlaneRow[]} */
  let planes = $state([])
  const chosen = $derived(charsets.find(set => set.id === selected))
  const recordsFile = $derived(chosen ? chosen.records?.file ?? chosen.source.records : '')
  const needle = $derived(search.trim().toLowerCase())
  const percentFormat = $derived(new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 1 }))
  const groups = $derived([...new Set(charsets.map(set => set.group))].map(group => ({
    name: group,
    sets: charsets.filter(set => set.group === group && (!needle
      || [set.id, set.group, set.group === CNS_GROUP ? t('charset.cnsSources') : '', set.label, ...Object.values(set.names), set.source.name]
        .some(value => value?.toLowerCase().includes(needle)))),
  })).filter(group => group.sets.length))
  const compareGroups = $derived([...new Set(charsets.map(set => set.group))].map(group => ({
    name: group,
    sets: charsets.filter(set => set.group === group && set.id !== selected && set.chars > 0),
  })).filter(group => group.sets.length))
  const compared = $derived.by(() => {
    if (!comparison || compareBusy) return null
    const { id, shared, total, mapped, otherTotal, glyphs, mappedGlyphs } = comparison
    return { name: charsets.find(set => set.id === id)?.label ?? id, shared, total, mapped, otherTotal, glyphs, mappedGlyphs }
  })

  $effect(() => {
    if (compare && compare === selected) compare = ''
  })

  // The block shares describe the selected set itself, so they need its members, not its counts.
  // Its unencoded records have no block, so they only enlarge the denominator.
  $effect(() => {
    const id = selected
    if (!id) { blocks = []; versions = null; occupancy = []; planes = []; return }
    const blockSet = /^(?:unicode_basic|unicode_ext_[a-j]|unicode_comp_[ab]_tentative|compatibility)$/.test(id)
    const unencoded = charsets.find(set => set.id === id)?.unencoded ?? 0
    versions = null
    let active = true
    loadCharset(id).then(async members => {
      if (!active) return
      const rows = blockRows(members, unencoded)
      blocks = rows.some(row => row.id !== 'other') ? rows : []
      planes = planeRows(members, unencoded)
      try {
        const ages = await loadAges()
        if (!active) return
        versions = versionRows(members, ages, unencoded)
        occupancy = blockSet ? blockOccupancy(ages) : []
      } catch { if (active) { versions = null; occupancy = [] } }
    }).catch(() => { if (active) { blocks = []; versions = null; occupancy = []; planes = [] } })
    return () => { active = false }
  })

  // The overlap dial compares listed characters, so both sets load before either count is drawn.
  $effect(() => {
    const mine = selected
    const other = compare
    compareRetry
    if (!mine || !other || mine === other) {
      comparison = null
      compareBusy = false
      compareFailed = false
      return
    }
    let active = true
    compareBusy = true
    compareFailed = false
    comparison = null
    ;(async () => {
      try {
        const set = charsets.find(entry => entry.id === mine)
        const printed = set?.records?.glyphs ? loadRecords(mine) : null
        const [first, second, records] = await Promise.all([loadCharset(mine), loadCharset(other), printed])
        if (!active) return
        comparison = {
          id: other,
          shared: sharedCharacters(first, second),
          total: records ? records.records.length : first.size,
          mapped: first.size,
          otherTotal: second.size,
          glyphs: records ? set?.records?.glyphs ?? 0 : 0,
          mappedGlyphs: records ? records.records.filter(record => record.glyph && record.mappedUnicode).length : 0,
        }
      } catch {
        if (active) compareFailed = true
      } finally {
        if (active) compareBusy = false
      }
    })()
    return () => { active = false }
  })

  async function showCns() {
    expanded = true
    search = CNS_GROUP
    await tick()
    groupList?.scrollTo({ top: 0 })
    searchInput?.focus()
  }

  /** @param {import('../lib/charsets.js').Charset} set */
  function coverageOf(set) {
    if (!set.unencoded) return ''
    const encoded = set.encoded ?? set.chars
    const total = encoded + set.unencoded
    if (!total) return ''
    const percent = percentFormat.format(set.unencoded / total * 100)
    return t('charset.coverageLabel', {
      percent,
      encoded: encoded.toLocaleString(i18n.locale),
      unencoded: set.unencoded.toLocaleString(i18n.locale),
    })
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
                {@const coverage = coverageOf(set)}
                <button class="ui-button set" data-size="sm" data-charset={set.id} type="button" title={coverage ? `${nameOf(set.names)} · ${coverage}` : nameOf(set.names)} aria-pressed={selected === set.id} onclick={() => choose(set.id)}>
                  <span>{set.label}</span>
                  <span class="set-end">
                    {#if coverage}<CoverageDot encoded={set.encoded ?? set.chars} unencoded={set.unencoded ?? 0} />{/if}
                    <span class="ui-count">{(set.records?.count ?? set.chars).toLocaleString()}</span>
                  </span>
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
      {#if chosen.source.dataUrl}<a href={chosen.source.dataUrl} target="_blank" rel="noopener noreferrer">{t('convert.data')}</a>{/if}
      {#if recordsFile}<a href={recordsFile} target="_blank" rel="noopener noreferrer">{t('charset.records')}</a>{/if}
    </div>
    <p class="set-name">{nameOf(chosen.names)}</p>
    {#if chosen.chars > 0}
      <div class="compare">
        <label class="ui-label" for="charset-compare">{t('charset.compare')}</label>
        <span class="ui-select-wrap">
          <select id="charset-compare" class="ui-select" bind:value={compare}>
            <option value="">{t('charset.compareNone')}</option>
            {#each compareGroups as group (group.name)}
              <optgroup label={group.name === CNS_GROUP ? t('charset.cnsSources') : group.name}>
                {#each group.sets as set (set.id)}<option value={set.id}>{set.label}</option>{/each}
              </optgroup>
            {/each}
          </select>
        </span>
        {#if compareBusy}<span class="ui-hint" role="status">{t('charset.loading')}</span>{/if}
      </div>
      {#if compareFailed}
        <div class="compare-error" role="alert">
          <p class="ui-hint">{t('charset.compareError')}</p>
          <button class="ui-button" data-size="sm" type="button" onclick={() => compareRetry++}>{t('charset.retry')}</button>
        </div>
      {/if}
    {/if}
    {#if chosen.unencoded !== undefined && (chosen.encoded ?? chosen.chars) + chosen.unencoded > 0}
      <CoverageChart encoded={chosen.encoded ?? chosen.chars} unencoded={chosen.unencoded} positions={chosen.positions ?? null} {compared} {blocks} {versions} {occupancy} {planes} />
    {/if}
    {#if !chosen.source.noteKey && chosen.recordsNote !== false}<p class="ui-hint">{chosen.records ? t('charset.recordsNote') : t('charset.unencoded')}</p>{/if}
    {#if chosen.source.noteKey}<p class="ui-hint">{t(chosen.source.noteKey)}</p>
    {:else if chosen.source.note}<p class="ui-hint">{chosen.source.note}</p>{/if}
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
  .set-end{display:flex;align-items:center;gap:var(--ui-space-xs);flex:none}
  button[aria-pressed='true']{border-color:var(--ui-color-accent-ink);color:var(--ui-color-accent-ink)}
  .compare{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:var(--ui-space-xs) var(--ui-space-sm);max-inline-size:380px;margin-block-start:var(--ui-space-xs)}
  .compare .ui-hint{grid-column:2}
  .compare-error{display:flex;align-items:center;gap:var(--ui-space-sm);max-inline-size:380px;margin-block-start:var(--ui-space-xs)}
  .metadata{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs) var(--ui-space-md);margin-block-start:var(--ui-space-sm);font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft)}
  .set-name{font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft)}
</style>
