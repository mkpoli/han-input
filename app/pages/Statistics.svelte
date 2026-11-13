<script>
  // What the site holds: the characters and printed records, and how many of each the bundled faces
  // and IDS descriptions reach. The counts come from scripts/build_coverage.mjs.
  import { i18n, t } from '../lib/i18n.svelte.js'
  import { link } from '../lib/route.svelte.js'
  import Meter from '../ui/Meter.svelte'
  import StackedBar from '../ui/StackedBar.svelte'

  /** @typedef {{total:number, reserved:number, scripts:{id:string,total:number,font:number,ids:number}[], fontGaps:{total:number,blocks:{label:string,count:number}[]}}} Characters */
  /** @typedef {{id:string,label:string,group:string,total:number,attested:number,image:number,guessed:number,imageGuessed:number,imageWithoutGuess:number,textOnly:number}} RecordSet */
  /** @typedef {{sets:number,total:number,attested:number,image:number,guessed:number,imageGuessed:number,imageWithoutGuess:number,textOnly:number,confidence:{median:number,buckets:{low:number,count:number}[]},bySet:RecordSet[]}} Records */

  let data = $state(/** @type {{characters: Characters, records: Records} | null} */ (null))
  let failed = $state(false)

  fetch('/data/coverage.json')
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Coverage unavailable')))
    .then(doc => { data = doc })
    .catch(() => { failed = true })

  const number = $derived(new Intl.NumberFormat(i18n.locale))
  /** @param {number} value */
  const count = value => number.format(value)
  /** @param {number} value @param {number} total */
  function share(value, total) {
    if (!total) return 0
    return value / total
  }
  /** @param {number} value @param {number} total */
  function percent(value, total) {
    const part = share(value, total)
    if (part > 0 && part < 0.001) return '<0.1'
    const digits = part > 0.9999 && part < 1 ? 3 : part > 0.999 && part < 1 ? 2 : 1
    return new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: digits }).format(part * 100)
  }
  /** @param {number} value */
  const decimal = value => new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 2 }).format(value)

  const scripts = $derived(data?.characters.scripts ?? [])
  const gaps = $derived(data?.characters.fontGaps.blocks ?? [])
  const biggest = $derived((data?.records.bySet ?? []).slice(0, 16))
  const top = $derived(data?.records.bySet[0]?.total ?? 1)
  const recordSegments = $derived.by(() => {
    if (!data) return []
    const rows = data.records
    return [
      ...(rows.attested ? [{ id: 'attested', count: rows.attested, color: 'var(--ui-color-chart-4)', label: t('statistics.attested') }] : []),
      ...(rows.imageGuessed ? [{ id: 'image', count: rows.imageGuessed, color: 'var(--ui-color-chart-7)', label: t('statistics.imageGuessed') }] : []),
      ...(rows.imageWithoutGuess ? [{ id: 'imagePlain', count: rows.imageWithoutGuess, color: 'var(--ui-color-chart-2)', label: t('statistics.image') }] : []),
      ...(rows.textOnly ? [{ id: 'text', count: rows.textOnly, color: 'var(--ui-color-border-strong)', label: t('statistics.textOnly') }] : []),
    ]
  })
  const recordLabel = $derived(data ? t('statistics.recordsLabel', {
    attested: count(data.records.attested),
    image: count((data.records.imageGuessed ?? 0) + (data.records.imageWithoutGuess ?? 0)),
    text: count(data.records.textOnly),
    total: count(data.records.total),
  }) : '')
  const buckets = $derived(data?.records.confidence.buckets ?? [])
  const peak = $derived(Math.max(1, ...buckets.map(bucket => bucket.count)))
  const histogramLabel = $derived(data ? [
    t('statistics.confidenceLabel', { median: decimal(data.records.confidence.median) }),
    ...buckets.map(bucket => `${decimal(bucket.low)}–${decimal(bucket.low + 0.1)}: ${count(bucket.count)}`),
  ].join('; ') : '')
</script>

<div class="ui-page" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('statistics.title')}</h1>
    <p class="ui-page-intro">{t('statistics.intro')}</p>
  </header>

  {#if failed}
    <div class="failure" role="alert">
      <p class="ui-hint">{t('statistics.failed')}</p>
      <button class="ui-button" data-size="sm" type="button" onclick={() => location.reload()}>{t('statistics.retry')}</button>
    </div>
  {:else if !data}
    <p class="ui-hint" role="status">{t('statistics.loading')}</p>
  {:else}
    <section class="totals" aria-label={t('statistics.summary')}>
      <div class="total">
        <strong>{count(data.characters.total)}</strong>
        <span>{t('statistics.characters')}</span>
      </div>
      <div class="total">
        <strong>{count(data.records.total)}</strong>
        <span>{t('statistics.records')}</span>
      </div>
      <div class="total">
        <strong>{count(data.records.sets)}</strong>
        <span>{t('statistics.sets')}</span>
      </div>
    </section>

    <section class="ui-section">
      <div class="section-head">
        <h2 class="ui-label">{t('statistics.characters')}</h2>
        <span class="ui-count">{t('statistics.fontGapCount', { count: count(data.characters.fontGaps.total) })}{#if data.characters.reserved} · {t('statistics.reserved', { count: count(data.characters.reserved) })}{/if}</span>
      </div>
      <div class="scripts-wrap">
        <div class="scripts">
          {#each scripts as script (script.id)}
            <article class="script">
              <header>
                <h3>{t(`statistics.${script.id}`)}</h3>
                <span class="ui-count">{count(script.total)}</span>
              </header>
              <div class="metric">
                <div class="line">
                  <span>{t('statistics.bundled')}</span>
                  <b>{count(script.font)}</b>
                  <em>{percent(script.font, script.total)}%</em>
                </div>
                <Meter value={script.font} total={script.total} color="var(--ui-color-accent)"
                  label={t('statistics.bundledLabel', { font: count(script.font), total: count(script.total) })} />
              </div>
              {#if script.ids}
                <div class="metric">
                  <div class="line">
                    <span>{t('statistics.ids')}</span>
                    <b>{count(script.ids)}</b>
                    <em>{percent(script.ids, script.total)}%</em>
                  </div>
                  <Meter value={script.ids} total={script.total} color="var(--ui-color-chart-4)"
                    label={t('statistics.idsLabel', { ids: count(script.ids), total: count(script.total) })} />
                </div>
              {:else}
                <div class="metric empty">
                  <div class="line"><span>{t('statistics.ids')}</span><b>—</b><em></em></div>
                </div>
              {/if}
            </article>
          {/each}
        </div>
      </div>
      {#if gaps.length}
        <div class="gaps">
          <p class="caption">{t('statistics.fontGaps')}</p>
          <ol>
            {#each gaps as gap (gap.label)}
              <li>
                <span class="name">{gap.label}</span>
                <span class="track"><i style:inline-size={`${share(gap.count, gaps[0].count) * 100}%`}></i></span>
                <span class="count">{count(gap.count)}</span>
              </li>
            {/each}
          </ol>
        </div>
      {/if}
    </section>

    <section class="ui-section">
      <div class="section-head">
        <h2 class="ui-label">{t('statistics.records')}</h2>
        <span class="ui-count">{t('statistics.setsCount', { count: count(data.records.sets) })}</span>
      </div>
      <div class="records">
        <StackedBar segments={recordSegments} total={data.records.total} label={recordLabel} height={14} />
        <ul class="legend">
          {#each recordSegments as segment (segment.id)}
            <li><i style:background={segment.color}></i><span>{segment.label}</span><b>{count(segment.count)}</b><em>{percent(segment.count, data.records.total)}%</em></li>
          {/each}
        </ul>
      </div>
      {#if data.records.guessed}
        <figure class="hist-figure">
          <figcaption>
            <span class="caption">{t('statistics.confidence')}</span>
            <span class="ui-count">{t('statistics.median', { value: decimal(data.records.confidence.median) })}</span>
          </figcaption>
          <div class="hist" role="img" aria-label={histogramLabel}>
            {#each buckets as bucket (bucket.low)}
              <div class="bin" title={`${decimal(bucket.low)}–${decimal(bucket.low + 0.1)}: ${count(bucket.count)}`}>
                <span style:block-size={`${bucket.count / peak * 100}%`}></span>
              </div>
            {/each}
          </div>
          <div class="axis" aria-hidden="true"><span>0</span><span>0.5</span><span>1</span></div>
        </figure>
      {/if}
    </section>

    <section class="ui-section">
      <h2 class="ui-label">{t('statistics.largest')}</h2>
      <ol class="sets">
        {#each biggest as set (set.id)}
          <li>
            <a class="name" href={link('', { set: set.id })} title={set.group}>{set.label}</a>
            <span class="count">{count(set.total)}</span>
            <div class="bar" style:inline-size={`${share(set.total, top) * 100}%`}>
              <StackedBar segments={[
                { id: 'attested', count: set.attested, color: 'var(--ui-color-chart-4)', label: t('statistics.attested') },
                { id: 'image', count: set.imageGuessed, color: 'var(--ui-color-chart-7)', label: t('statistics.imageGuessed') },
                { id: 'imagePlain', count: set.imageWithoutGuess, color: 'var(--ui-color-chart-2)', label: t('statistics.image') },
                { id: 'text', count: set.textOnly, color: 'var(--ui-color-border-strong)', label: t('statistics.textOnly') },
              ].filter(segment => segment.count)} total={set.total} label={`${set.label}: ${t('statistics.attested')} ${count(set.attested)}, ${t('statistics.imageGuessed')} ${count(set.imageGuessed)}, ${t('statistics.textOnly')} ${count(set.textOnly)}`} height={8} />
            </div>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
</div>

<style>
  .ui-page{gap:var(--ui-space-4xl)}
  .failure{display:flex;align-items:center;gap:var(--ui-space-md);flex-wrap:wrap}
  .failure p{margin:0}
  .totals{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr));gap:var(--ui-space-xl);padding-block:var(--ui-space-2xl) var(--ui-space-xl);border-block:1px solid var(--ui-color-border)}
  .total{display:grid;gap:2px;min-inline-size:0}
  .total strong{font-family:var(--ui-font-serif);font-size:clamp(28px,4vw,44px);font-weight:var(--ui-weight-semibold);line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-0.01em}
  .total span{color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);letter-spacing:var(--ui-tracking-caps);text-transform:uppercase}
  .section-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--ui-space-md)}
  .scripts-wrap{container-type:inline-size}
  .scripts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--ui-space-md)}
  @container (max-width:620px){.scripts{grid-template-columns:minmax(0,1fr)}}
  .script{display:grid;gap:var(--ui-space-md);padding:var(--ui-space-lg);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  .script header{display:flex;align-items:baseline;justify-content:space-between;gap:var(--ui-space-sm)}
  .script h3{margin:0;font-family:var(--ui-font-serif);font-size:var(--ui-text-lg);font-weight:var(--ui-weight-semibold)}
  .metric{display:grid;gap:var(--ui-space-2xs)}
  .line{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:baseline;gap:var(--ui-space-sm);font-size:var(--ui-text-xs);color:var(--ui-color-ink-soft)}
  .line b{font-weight:var(--ui-weight-medium);color:var(--ui-color-ink);font-variant-numeric:tabular-nums}
  .line em{font-style:normal;color:var(--ui-color-ink);font-variant-numeric:tabular-nums;min-inline-size:3.4em;text-align:end}
  .metric.empty .line{opacity:.5}
  .gaps{display:grid;gap:var(--ui-space-sm);padding-block-start:var(--ui-space-xs)}
  .caption{margin:0;font-size:var(--ui-text-2xs);color:var(--ui-color-ink-muted);letter-spacing:var(--ui-tracking-caps);text-transform:uppercase}
  .gaps ol{display:grid;gap:3px;margin:0;padding:0;list-style:none}
  .gaps li{display:grid;grid-template-columns:minmax(84px,120px) minmax(0,1fr) auto;align-items:center;gap:var(--ui-space-md);font-size:var(--ui-text-xs);color:var(--ui-color-ink-soft)}
  .gaps .name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .gaps .track{display:block;block-size:5px;border-radius:var(--ui-radius-pill);background:var(--ui-color-surface-sunken);box-shadow:inset 0 0 0 1px var(--ui-color-border);overflow:hidden}
  .gaps .track i{display:block;block-size:100%;min-inline-size:2px;border-radius:inherit;background:var(--ui-color-border-strong)}
  .gaps .count{min-inline-size:3em;text-align:end;font-variant-numeric:tabular-nums;color:var(--ui-color-ink)}
  .records{display:grid;gap:var(--ui-space-sm);padding:var(--ui-space-lg);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);background:var(--ui-color-surface)}
  .legend{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs) var(--ui-space-xl);margin:0;padding:0;list-style:none;font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft)}
  .legend li{display:flex;align-items:baseline;gap:var(--ui-space-xs);min-inline-size:0}
  .legend i{inline-size:8px;block-size:8px;border-radius:2px;flex:none;align-self:center}
  .legend b{font-weight:var(--ui-weight-medium);color:var(--ui-color-ink);font-variant-numeric:tabular-nums}
  .legend em{font-style:normal;color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}
  .hist-figure{display:grid;gap:var(--ui-space-2xs);margin:0;padding-block-start:var(--ui-space-xs)}
  .hist-figure figcaption{display:flex;align-items:baseline;justify-content:space-between;gap:var(--ui-space-md)}
  .hist{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));align-items:end;gap:3px;block-size:104px;padding-block-end:1px;border-block-end:1px solid var(--ui-color-border-strong)}
  .bin{display:flex;align-items:end;block-size:100%;background:var(--ui-color-surface-sunken);border-radius:2px 2px 0 0;overflow:hidden}
  .bin span{display:block;inline-size:100%;border-radius:2px 2px 0 0;background:var(--ui-color-chart-7);transition:block-size var(--ui-duration) var(--ui-ease)}
  .axis{display:flex;justify-content:space-between;color:var(--ui-color-ink-muted);font-size:10px;font-variant-numeric:tabular-nums}
  .sets{display:grid;gap:4px;margin:0;padding:0;list-style:none}
  .sets li{display:grid;grid-template-columns:minmax(130px,200px) auto minmax(0,1fr);align-items:center;gap:var(--ui-space-md);min-inline-size:0}
  .sets .name{color:var(--ui-color-ink);font-size:var(--ui-text-sm);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sets .name:hover{color:var(--ui-color-accent-ink);text-decoration:underline;text-underline-offset:2px}
  .sets .count{color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);font-variant-numeric:tabular-nums;text-align:end;min-inline-size:4.5em}
  .sets .bar{display:block;min-inline-size:1px;max-inline-size:100%}
  @media (max-width: 620px){
    .totals{grid-template-columns:minmax(0,1fr);gap:var(--ui-space-md)}
    .total{grid-template-columns:auto minmax(0,1fr);align-items:baseline;gap:var(--ui-space-sm)}
    .total strong{font-size:26px}
    .script{grid-template-columns:minmax(0,1fr)}
    .sets li{grid-template-columns:minmax(0,1fr) auto;gap:2px var(--ui-space-sm)}
    .sets .bar{grid-column:1 / -1}
    .hist{block-size:76px}
  }
</style>
