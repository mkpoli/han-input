<script>
  // The siniform scripts' own code charts: Tangut, Jurchen and the Khitan small script, with the
  // components or radicals separate from the characters and the counts each block gives.
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import CodeChart from '../ui/CodeChart.svelte'

  /** @typedef {{ version: string, count: number }} VersionRow */
  /** @typedef {{ key: string, kind: 'char' | 'part', start: number, end: number, positions: number, count: number, versions: VersionRow[] }} BlockRow */
  /** @typedef {{ count: number, cps: number[], unavailable: number[], versions: VersionRow[], marks?: number[], labelled?: number, uses?: number[] }} Part */
  /** @typedef {{ id: string, names: { en: string, zh?: string, hans?: string, ja?: string, ko?: string }, sample: string, partsKey: string | null, introKey: string, chars: Part, parts: Part | null, blocks: BlockRow[] }} Script */
  /** @typedef {{ unicode: string, retrieved: string, sources: { id: string, name: string, url: string, licence: string, detail: string, attribution?: string }[], scripts: Script[] }} Data */

  let data = $state(/** @type {Data | null} */ (null))
  let failed = $state(false)
  let active = $state('tangut')
  let retry = $state(0)

  $effect(() => {
    retry
    let live = true
    failed = false
    fetch('/data/siniform.json')
      .then(response => response.ok ? response.json() : Promise.reject(new Error('unavailable')))
      .then((json) => { if (live) data = json })
      .catch(() => { if (live) failed = true })
    return () => { live = false }
  })

  const script = $derived(data?.scripts.find(row => row.id === active) ?? data?.scripts[0] ?? null)
  const total = $derived(script ? script.chars.count + (script.parts?.count ?? 0) : 0)
  const partsShare = $derived(script?.parts && total ? script.parts.count / total : 0)
  const charsShare = $derived(total && script ? script.chars.count / total : 0)
  const number = $derived(new Intl.NumberFormat(undefined))
  const percent = (/** @type {number} */ share) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(share * 100)
  const hex = (/** @type {number} */ cp) => cp.toString(16).toUpperCase()
  const range = (/** @type {BlockRow} */ block) => `U+${hex(block.start)}–U+${hex(block.end)}`

  /** Keys stay literal here so the message check can see every translated block name. @param {string} key */
  function blockName(key) {
    if (key === 'siniform.block.tangut') return t('siniform.block.tangut')
    if (key === 'siniform.block.tangutSupplement') return t('siniform.block.tangutSupplement')
    if (key === 'siniform.block.tangutComponents') return t('siniform.block.tangutComponents')
    if (key === 'siniform.block.tangutComponentsSupplement') return t('siniform.block.tangutComponentsSupplement')
    if (key === 'siniform.block.jurchen') return t('siniform.block.jurchen')
    if (key === 'siniform.block.jurchenRadicals') return t('siniform.block.jurchenRadicals')
    return t('siniform.block.khitan')
  }

  /** @param {string} id */
  function introName(id) {
    if (id === 'tangut') return t('siniform.tangut.intro')
    if (id === 'jurchen') return t('siniform.jurchen.intro')
    return t('siniform.khitan.intro')
  }

  /** @param {string} id */
  function partsName(id) {
    return id === 'jurchen' ? t('siniform.parts.jurchen') : t('siniform.parts.tangut')
  }

  /** @param {string} id */
  function useName(id) {
    return id === 'jurchen' ? t('siniform.use.jurchen') : t('siniform.use.tangut')
  }

  /** The share of a script's characters by Unicode version, largest first for the chart. */
  const versions = $derived(script ? [...script.chars.versions].sort((a, b) => parseFloat(a.version) - parseFloat(b.version)) : [])
  const versionMax = $derived(versions.reduce((top, row) => Math.max(top, row.count), 1))

  const buckets = $derived.by(() => {
    if (!script?.parts?.uses) return []
    const rows = [
      { from: 0, to: 0 }, { from: 1, to: 1 }, { from: 2, to: 2 }, { from: 3, to: 5 },
      { from: 6, to: 10 }, { from: 11, to: 20 }, { from: 21, to: Infinity },
    ]
    const uses = script.parts.uses ?? []
    return rows.map(row => ({
      ...row,
      count: uses.filter(value => value >= row.from && value <= row.to).length,
    }))
  })
  const bucketMax = $derived(buckets.reduce((top, row) => Math.max(top, row.count), 1))
  const topParts = $derived.by(() => {
    if (!script?.parts) return []
    return script.parts.cps.map((cp, index) => ({ cp, uses: script.parts?.uses?.[index] ?? 0 }))
      .filter(row => row.uses > 0)
      .sort((a, b) => b.uses - a.uses || a.cp - b.cp)
      .slice(0, 10)
  })

  /** The page is the tab. Arrow keys move between scripts as a tab list. @param {KeyboardEvent} event @param {string} id */
  function tabKey(event, id) {
    if (!data) return
    const at = data.scripts.findIndex(row => row.id === id)
    let next = at
    if (event.key === 'ArrowRight') next = (at + 1) % data.scripts.length
    else if (event.key === 'ArrowLeft') next = (at + data.scripts.length - 1) % data.scripts.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = data.scripts.length - 1
    else return
    event.preventDefault()
    active = data.scripts[next].id
    const nextTab = document.querySelector(`[data-script-tab="${active}"]`)
    if (nextTab instanceof HTMLElement) nextTab.focus()
  }
</script>

<div class="ui-page" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('siniform.title')}</h1>
    <p class="ui-page-intro">{t('siniform.intro')}</p>
  </header>

  {#if failed}
    <section class="ui-section" role="alert">
      <p class="ui-hint">{t('siniform.error')}</p>
      <button class="ui-button" data-size="sm" type="button" onclick={() => retry++}>{t('charset.retry')}</button>
    </section>
  {:else if !data}
    <p class="ui-hint" role="status">{t('charset.loading')}</p>
  {:else if script}
    <div class="scripts" role="tablist" aria-label={t('siniform.scriptLabel')}>
      {#each data.scripts as row (row.id)}
        <button class="script-tab" data-script-tab={row.id} role="tab" type="button"
          aria-selected={active === row.id} tabindex={active === row.id ? 0 : -1}
          aria-controls="script-panel" onclick={() => { active = row.id }} onkeydown={event => tabKey(event, row.id)}>
          <span class="tab-glyph" aria-hidden="true">{row.sample}</span>
          <span class="tab-copy">
            <span class="tab-name">{nameOf(row.names)}</span>
            <span class="tab-count ui-mono">{number.format(row.chars.count + (row.parts?.count ?? 0))}</span>
          </span>
        </button>
      {/each}
    </div>

    <div id="script-panel" role="tabpanel">
      <section class="script-head">
        <div>
          <h2 class="script-title">{nameOf(script.names)}</h2>
          <p class="ui-hint">{introName(script.id)}</p>
        </div>
        <p class="range-line ui-mono">{script.blocks.map(block => range(block)).join(' · ')}</p>
      </section>

      <div class="ui-section-head stats-head"><h2 class="ui-label">{t('siniform.stats')}</h2></div>
      <section class="stats" aria-label={t('siniform.stats')}>
        <figure class="metric inventory">
          <figcaption>
            <span class="caption">{t('siniform.inventory')}</span>
            <strong class="figure-number">{number.format(total)}</strong>
          </figcaption>
          <div class="bar" role="img" aria-label={t('siniform.inventoryLabel', {
            parts: number.format(script.parts?.count ?? 0),
            chars: number.format(script.chars.count),
          })}>
            {#if script.parts}<span class="fill parts" style:width="{partsShare * 100}%"></span>{/if}
            <span class="fill chars" style:width="{charsShare * 100}%"></span>
          </div>
          <p class="legend">
            {#if script.parts}<span><i class="swatch parts"></i>{partsName(script.id)} <b>{number.format(script.parts.count)}</b></span>{/if}
            <span><i class="swatch chars"></i>{t('siniform.characters')} <b>{number.format(script.chars.count)}</b></span>
          </p>
        </figure>

        <figure class="metric">
          <figcaption><span class="caption">{t('siniform.versions')}</span></figcaption>
          <div class="rows">
            {#each versions as row (row.version)}
              <div class="row">
                <span class="row-label">{row.version}</span>
                <span class="row-bar"><i style:width="{(row.count / versionMax) * 100}%"></i></span>
                <span class="row-count ui-mono">{number.format(row.count)}</span>
              </div>
            {/each}
          </div>
        </figure>

        <figure class="metric occupancy" class:full={!script.parts}>
          <figcaption><span class="caption">{t('siniform.occupancy')}</span></figcaption>
          <div class="rows">
            {#each script.blocks as block (block.key)}
              <div class="row block-row">
                <span class="row-label" title={range(block)}>{blockName(block.key)}</span>
                <span class="row-bar"><i style:width="{(block.count / block.positions) * 100}%"></i></span>
                <span class="row-count ui-mono">{percent(block.count / block.positions)}%</span>
                <span class="row-sub ui-mono">{number.format(block.count)}/{number.format(block.positions)}</span>
              </div>
            {/each}
          </div>
          <p class="legend">
            <span><i class="swatch chars"></i>{t('charset.encoded')}</span>
            <span><i class="swatch unassigned"></i>{t('charset.unassigned')}</span>
          </p>
        </figure>

        {#if script.parts}
          <figure class="metric use">
            <figcaption>
              <span class="caption">{useName(script.id)}</span>
              {#if script.parts.labelled}<span class="ui-hint">{t('siniform.described', { count: number.format(script.parts.labelled) })}</span>{/if}
            </figcaption>
            <div class="rows">
              {#each buckets as row (`${row.from}-${row.to}`)}
                <div class="row">
                  <span class="row-label ui-mono">{row.to === Infinity ? `${row.from}+` : row.from === row.to ? row.from : `${row.from}–${row.to}`}</span>
                  <span class="row-bar"><i style:width="{(row.count / bucketMax) * 100}%"></i></span>
                  <span class="row-count ui-mono">{number.format(row.count)}</span>
                </div>
              {/each}
            </div>
            {#if topParts.length}
              <ol class="top">
                {#each topParts as row (row.cp)}
                  <li>
                    <span class="top-glyph" aria-hidden="true">{String.fromCodePoint(row.cp)}</span>
                    <span class="top-code ui-mono">U+{hex(row.cp)}</span>
                    <b>{number.format(row.uses)}</b>
                  </li>
                {/each}
              </ol>
            {/if}
          </figure>
        {/if}
      </section>

      {#if script.parts}
        <section class="ui-section">
          <div class="ui-section-head">
            <h2 class="ui-label">{partsName(script.id)}</h2>
            <span class="ui-count">{number.format(script.parts.count)}</span>
          </div>
          {#if script.parts.unavailable.length}
            <p class="ui-hint">{t('siniform.partsMissing', { count: number.format(script.parts.unavailable.length) })}</p>
          {/if}
          <CodeChart cps={script.parts.cps} unavailable={script.parts.unavailable}
            marks={script.parts.marks ?? []} label={partsName(script.id)} />
        </section>
      {:else}
        <section class="ui-section">
          <div class="ui-section-head">
            <h2 class="ui-label">{t('siniform.parts')}</h2>
            <span class="ui-count">0</span>
          </div>
          <p class="ui-hint">{t('siniform.noParts')}</p>
        </section>
      {/if}

      <section class="ui-section">
        <div class="ui-section-head">
          <h2 class="ui-label">{t('siniform.characters')}</h2>
          <span class="ui-count">{number.format(script.chars.count)}</span>
        </div>
        {#if script.chars.unavailable.length}
          <p class="ui-hint">{t('siniform.charsMissing', { count: number.format(script.chars.unavailable.length) })}</p>
        {/if}
        {#if script.id === 'khitan'}<p class="ui-hint">{t('siniform.khitanNote')}</p>{/if}
        <CodeChart cps={script.chars.cps} unavailable={script.chars.unavailable}
          marks={script.chars.marks ?? []} label={t('siniform.characters')} />
      </section>

      <section class="ui-section sources">
        <h2 class="ui-label">{t('siniform.sources')}</h2>
        <ul>
          {#each data.sources as source (source.id)}
            <li>
              <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a>
              <span class="ui-hint">{source.detail} · {source.licence}{#if source.attribution} · {source.attribution}{/if}</span>
            </li>
          {/each}
          <li>
            {t('siniform.faces')}
            <span class="ui-hint">
              <a href="https://github.com/notofonts/tangut/releases/tag/NotoSerifTangut-v2.170" target="_blank" rel="noopener noreferrer">Noto Serif Tangut 2.170</a> ·
              <a href="https://github.com/notofonts/khitan-small-script" target="_blank" rel="noopener noreferrer">Noto Serif Khitan Small Script</a> ·
              <a href="https://dorontu.com/" target="_blank" rel="noopener noreferrer">Alari Xuwasun Jurchen</a> (Sulfa, Dooran, Raxon7)
              (<a href="/fonts/OFL-NotoSerifTangut.txt" target="_blank" rel="noopener noreferrer">OFL</a>,
              <a href="/fonts/OFL-NotoSerifKhitan.txt" target="_blank" rel="noopener noreferrer">OFL</a>,
              <a href="/fonts/OFL-AlariXuwasunJurchen.txt" target="_blank" rel="noopener noreferrer">OFL</a>)
            </span>
          </li>
          <li>{t('siniform.largeScript')} <span class="ui-hint">{t('siniform.largeScriptHint')}</span></li>
        </ul>
      </section>
    </div>
  {:else}
    <p class="ui-hint">{t('siniform.error')}</p>
  {/if}
</div>

<style>
  .scripts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--ui-space-sm)}
  .script-tab{display:flex;align-items:center;gap:var(--ui-space-md);min-inline-size:0;padding:var(--ui-space-md) var(--ui-space-lg);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface);color:var(--ui-color-ink);text-align:start;cursor:pointer}
  .script-tab:hover{background:var(--ui-color-surface-hover);border-color:var(--ui-color-border-strong)}
  .script-tab[aria-selected='true']{border-color:var(--ui-color-accent);background:var(--ui-color-accent-soft)}
  .tab-glyph{flex:none;font-family:'Siniform',var(--ui-font-serif);font-size:34px;line-height:1}
  .tab-copy{display:grid;gap:1px;min-inline-size:0}
  .tab-name{font-size:var(--ui-text-md);font-weight:var(--ui-weight-medium);overflow-wrap:anywhere}
  .tab-count{color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  .script-head{display:flex;align-items:end;justify-content:space-between;flex-wrap:wrap;gap:var(--ui-space-sm) var(--ui-space-lg);margin-block:var(--ui-space-xl) var(--ui-space-md)}
  .script-title{font-family:var(--ui-font-serif);font-size:var(--ui-text-xl);font-weight:var(--ui-weight-semibold);text-wrap:balance}
  .ui-page-title{text-wrap:balance}
  .script-head .ui-hint{margin:0;max-inline-size:66ch}
  .range-line{margin:0;color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs)}
  .stats-head{margin-block-end:calc(-1 * var(--ui-space-sm))}
  .stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ui-space-md);margin-block-end:var(--ui-space-2xl)}
  .metric{display:grid;align-content:start;gap:var(--ui-space-sm);min-inline-size:0;margin:0;padding:var(--ui-space-md) var(--ui-space-lg);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface)}
  .metric figcaption{display:grid;gap:2px}
  .caption{font-size:var(--ui-text-2xs);color:var(--ui-color-ink-muted);letter-spacing:var(--ui-tracking-caps)}
  .figure-number{font-size:var(--ui-text-2xl);font-variant-numeric:tabular-nums;line-height:1.1}
  .bar{display:flex;block-size:14px;overflow:hidden;border-radius:var(--ui-radius-xs);background:var(--ui-color-surface-sunken)}
  .fill{display:block;block-size:100%}
  .fill.parts{background:var(--ui-color-chart-3)}
  .fill.chars{background:var(--ui-color-accent)}
  .legend{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs) var(--ui-space-md);margin:0;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs)}
  .legend span{display:inline-flex;align-items:center;gap:var(--ui-space-2xs)}
  .legend b{color:var(--ui-color-ink);font-weight:var(--ui-weight-medium);font-variant-numeric:tabular-nums}
  .swatch{inline-size:8px;block-size:8px;border-radius:2px;flex:none}
  .swatch.parts{background:var(--ui-color-chart-3)}
  .swatch.chars{background:var(--ui-color-accent)}
  .swatch.unassigned{background:var(--ui-color-surface-sunken);border:1px solid var(--ui-color-border-strong)}
  .rows{display:grid;gap:3px}
  .row{display:grid;grid-template-columns:minmax(3.4em,auto) minmax(0,1fr) 3.6em;align-items:center;gap:var(--ui-space-xs);font-size:var(--ui-text-xs);line-height:1.2}
  .block-row{grid-template-columns:minmax(7.5em,auto) minmax(0,1fr) 3.4em 5.2em}
  .row-label{color:var(--ui-color-ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .row-bar{block-size:7px;border-radius:2px;background:var(--ui-color-surface-sunken);overflow:hidden}
  .row-bar i{display:block;block-size:100%;min-inline-size:1px;background:var(--ui-color-accent)}
  .row-count{color:var(--ui-color-ink-soft);text-align:end;font-variant-numeric:tabular-nums}
  .row-sub{color:var(--ui-color-ink-muted);text-align:end;font-size:var(--ui-text-2xs);font-variant-numeric:tabular-nums}
  .use{grid-column:span 1}
  .metric.full{grid-column:1 / -1}
  .top{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px var(--ui-space-md);margin:var(--ui-space-xs) 0 0;padding:var(--ui-space-xs) 0 0;border-top:1px solid var(--ui-color-border);list-style:none}
  .top li{display:grid;grid-template-columns:24px minmax(0,1fr) auto;align-items:center;gap:var(--ui-space-xs);font-size:var(--ui-text-2xs)}
  .top-glyph{font-family:'Siniform',var(--ui-font-serif);font-size:18px;line-height:1;text-align:center}
  .top-code{color:var(--ui-color-ink-muted);font-size:9px;white-space:nowrap}
  .top b{font-weight:var(--ui-weight-medium);font-variant-numeric:tabular-nums}
  .sources ul{display:grid;gap:var(--ui-space-xs);margin:0;padding:0;list-style:none;font-size:var(--ui-text-sm)}
  .sources li{display:grid;gap:1px}
  .sources .ui-hint{margin:0}
  @media (max-width:860px){
    .scripts{grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--ui-space-2xs)}
    .script-tab{flex-direction:column;align-items:flex-start;gap:2px;padding:var(--ui-space-sm) var(--ui-space-md)}
    .tab-glyph{font-size:26px}
    .tab-name{font-size:var(--ui-text-xs)}
    .tab-count{font-size:9px}
    .stats{grid-template-columns:1fr}
    .script-head{margin-block-start:var(--ui-space-lg)}
  }
  @media (max-width:420px){
    .ui-page-title{font-size:var(--ui-text-xl)}
    .tab-glyph{font-size:22px}
  }
  @media (max-width:520px){
    .top{grid-template-columns:1fr}
    .block-row{grid-template-columns:minmax(6.4em,auto) minmax(0,1fr) 3.2em}
    .row-sub{display:none}
  }
</style>
