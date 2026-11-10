<script>
  // How much of a character set reaches Unicode, and how many of its characters another set lists
  // too. A printed table or a Unicode block divides by its designed code positions; a source list
  // divides by its characters. A set with printed records counts every record, so a record without
  // a scalar stays visible instead of leaving the dial.
  import { coverageParts } from '../lib/charsets.js'
  import { i18n, t } from '../lib/i18n.svelte.js'
  import { shareColor, unencodedTint } from '../lib/palette.js'
  import SharePie from './SharePie.svelte'

  /**
   * @typedef {object} Compared
   * @property {string} name The other set's short label.
   * @property {number} shared Characters listed by both sets.
   * @property {number} total Characters, or records when the set has printed records.
   * @property {number} [mapped] Characters in this set that carry a scalar.
   * @property {number} [glyphs] Printed records in this set.
   * @property {number} [mappedGlyphs] Printed records that carry a scalar.
   * @property {number} otherTotal Characters listed by the other set.
   */

  /** @type {{ encoded: number, unencoded: number, positions?: import('../lib/charsets.js').Positions | null, compared?: Compared | null, blocks?: import('../lib/blocks.js').BlockRow[], versions?: import('../lib/ages.js').VersionRow[] | null, occupancy?: import('../lib/blocks.js').BlockOccupancy[], planes?: import('../lib/blocks.js').PlaneRow[] }} */
  let { encoded, unencoded, positions = null, compared = null, blocks = [], versions = null, occupancy = [], planes = [] } = $props()
  // A printed table divides by its designed code positions; a source list divides by its characters.
  const parts = $derived(coverageParts(positions, encoded, unencoded))
  const listTotal = $derived(encoded + unencoded)
  const listShare = $derived(listTotal ? unencoded / listTotal : 0)
  const coverageShare = $derived(parts.total ? (parts.positioned ? parts.inUnicode : parts.unencoded) / parts.total : 0)
  const format = (/** @type {number} */ share) =>
    new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 1 }).format(share * 100)
  const percent = $derived(format(coverageShare))
  const formatShare = (/** @type {number} */ share) => new Intl.NumberFormat(i18n.locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: share > 0 && share < 0.001 ? 2 : 1,
  }).format(share * 100)
  const formatVersionShare = (/** @type {number} */ share) => new Intl.NumberFormat(i18n.locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: share > 0.999 ? 3 : share < 0.0001 ? 4 : share < 0.001 ? 3 : 1,
  }).format(share * 100)
  const formatOccupancyShare = (/** @type {number} */ share) => new Intl.NumberFormat(i18n.locale, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(share * 100)
  const hex = (/** @type {number} */ point) => `U+${point.toString(16).toUpperCase()}`
  const rangeLabel = (/** @type {import('../lib/ages.js').VersionRow['ranges']} */ ranges) =>
    ranges.map(range => range.start === range.end ? hex(range.start) : `${hex(range.start)}–${hex(range.end)}`).join(', ')
  const radius = 27
  const circumference = 2 * Math.PI * radius
  const inArc = $derived(circumference * (parts.total ? parts.inUnicode / parts.total : 0))
  const unencodedArc = $derived(circumference * (parts.total ? parts.unencoded / parts.total : 0))
  const label = $derived(parts.positioned
    ? t('charset.coveragePositionsLabel', {
        percent,
        total: parts.total.toLocaleString(i18n.locale),
        encoded: parts.inUnicode.toLocaleString(i18n.locale),
        unencoded: parts.unencoded.toLocaleString(i18n.locale),
        unassigned: parts.unassigned.toLocaleString(i18n.locale),
      })
    : t('charset.coverageLabel', {
        percent,
        encoded: encoded.toLocaleString(i18n.locale),
        unencoded: unencoded.toLocaleString(i18n.locale),
      }))
  const sharedShare = $derived(compared?.total ? compared.shared / compared.total : 0)
  const sharedPercent = $derived(format(sharedShare))
  const sharedArc = $derived(circumference * sharedShare)
  const otherShare = $derived(compared?.otherTotal ? compared.shared / compared.otherTotal : 0)
  const mapped = $derived(compared ? compared.mapped ?? compared.total : 0)
  const unmapped = $derived(compared ? compared.total - mapped : 0)
  const only = $derived(compared ? mapped - compared.shared : 0)
  const onlyShare = $derived(compared?.total ? only / compared.total : 0)
  const onlyArc = $derived(circumference * onlyShare)
  const sharedLabel = $derived(compared ? t(unmapped ? 'charset.sharedRecordsLabel' : 'charset.sharedLabel', {
    percent: sharedPercent,
    shared: compared.shared.toLocaleString(i18n.locale),
    total: compared.total.toLocaleString(i18n.locale),
    mapped: mapped.toLocaleString(i18n.locale),
    name: compared.name,
    otherPercent: format(otherShare),
    otherTotal: compared.otherTotal.toLocaleString(i18n.locale),
  }) : '')
  const planeSlices = $derived([
    ...planes.map((row, index) => ({ id: `p${row.plane ?? 'other'}`, count: row.count, share: row.share, color: shareColor(index) })),
    ...(unencoded ? [{ id: 'unencoded', count: unencoded, share: listShare, color: unencodedTint }] : []),
  ])
  const planeTotal = $derived(planes.reduce((sum, row) => sum + row.count, 0) + unencoded)
  const blockSlices = $derived(blocks.map((row, index) => ({
    id: row.id, count: row.count, share: row.share,
    color: row.id === 'unencoded' ? unencodedTint : shareColor(index),
  })))
  const blockTotal = $derived(blocks.reduce((sum, row) => sum + row.count, 0))
  const versionSlices = $derived([
    ...(versions ?? []).map((row, index) => ({ id: row.version, count: row.count, share: row.share, color: shareColor(index) })),
    ...(unencoded ? [{ id: 'unencoded', count: unencoded, share: listShare, color: unencodedTint }] : []),
  ])
  const versionTotal = $derived((versions ?? []).reduce((sum, row) => sum + row.count, 0) + unencoded)

  const printed = $derived(compared?.glyphs ? t('charset.printedRecords', {
    glyphs: compared.glyphs.toLocaleString(i18n.locale),
    mapped: (compared.mappedGlyphs ?? 0).toLocaleString(i18n.locale),
    unmatched: (compared.glyphs - (compared.mappedGlyphs ?? 0)).toLocaleString(i18n.locale),
  }) : '')
</script>

<div class="coverage" class:two={!!compared}>
  <figure class="metric">
    <div class="dial">
      <svg viewBox="0 0 72 72" role="img" aria-label={label}>
        <circle class="track" cx="36" cy="36" r={radius} />
        {#if parts.inUnicode}
          <circle class="encoded" cx="36" cy="36" r={radius}
            stroke-dasharray="{inArc} {circumference - inArc}" transform="rotate(-90 36 36)" />
        {/if}
        {#if parts.unencoded}
          <circle class="unencoded" cx="36" cy="36" r={radius}
            stroke-dasharray="{unencodedArc} {circumference - unencodedArc}" stroke-dashoffset={-inArc} transform="rotate(-90 36 36)" />
        {/if}
      </svg>
      <span class="percent" aria-hidden="true">{percent}%<small>{parts.positioned ? t('charset.encoded') : t('charset.unencodedShort')}</small></span>
    </div>
    <figcaption>
      <p class="caption">{parts.positioned ? t('charset.coveragePositions') : t('charset.coverage')}</p>
      <p class="legend"><span class="swatch encoded" aria-hidden="true"></span>{t('charset.encoded')}<b>{parts.inUnicode.toLocaleString(i18n.locale)}</b></p>
      <p class="legend"><span class="swatch unencoded" aria-hidden="true"></span>{t('charset.unencodedShort')}<b>{parts.unencoded.toLocaleString(i18n.locale)}</b></p>
      {#if parts.positioned && parts.unassigned}
        <p class="legend"><span class="swatch unassigned" aria-hidden="true"></span>{t('charset.unassigned')}<b>{parts.unassigned.toLocaleString(i18n.locale)}</b></p>
      {/if}
      <p class="basis"><span>{t('charset.denominator')}</span><b>{parts.total.toLocaleString(i18n.locale)}</b></p>
    </figcaption>
  </figure>
  {#if compared}
    <figure class="metric">
      <div class="dial">
        <svg viewBox="0 0 72 72" role="img" aria-label={sharedLabel}>
          <circle class="track" cx="36" cy="36" r={radius} />
          {#if compared.shared === compared.total}
            <circle class="encoded" cx="36" cy="36" r={radius} />
          {:else}
            {#if only}
              <circle class="unencoded" cx="36" cy="36" r={radius}
                stroke-dasharray="{onlyArc} {circumference - onlyArc}" stroke-dashoffset={-sharedArc} transform="rotate(-90 36 36)" />
            {/if}
            {#if compared.shared}
              <circle class="encoded" cx="36" cy="36" r={radius}
                stroke-dasharray="{sharedArc} {circumference - sharedArc}" transform="rotate(-90 36 36)" />
            {/if}
          {/if}
        </svg>
        <span class="percent" aria-hidden="true">{sharedPercent}%<small>{t('charset.sharedShort')}</small></span>
      </div>
      <figcaption>
        <p class="caption">{t('charset.sharedCaption', { name: compared.name })}</p>
        <p class="legend"><span class="swatch encoded" aria-hidden="true"></span>{t('charset.shared')}<b>{compared.shared.toLocaleString(i18n.locale)}</b></p>
        <p class="legend"><span class="swatch unencoded" aria-hidden="true"></span>{t('charset.onlyHere')}<b>{only.toLocaleString(i18n.locale)}</b></p>
        {#if unmapped}
          <p class="legend"><span class="swatch noscalar" aria-hidden="true"></span>{t('charset.noScalar')}<b>{unmapped.toLocaleString(i18n.locale)}</b></p>
        {/if}
        <p class="ui-hint">{t('charset.otherShare', {
          percent: format(otherShare),
          name: compared.name,
          shared: compared.shared.toLocaleString(i18n.locale),
          total: compared.otherTotal.toLocaleString(i18n.locale),
        })}</p>
        {#if printed}<p class="ui-hint">{printed}</p>{/if}
      </figcaption>
    </figure>
  {/if}
  {#if planes.length}
    <div class="share-section">
      <SharePie slices={planeSlices} total={planeTotal} />
      <div class="share-body planes">
        <p class="caption">{t('charset.planes')}</p>
        <p class="plane-chips">
          {#each planes as row, index (row.plane ?? 'other')}
            <span class="plane-chip"><i class="swatch" style:background={planeSlices[index].color}></i><b>{row.plane === null ? t('charset.blockOther') : `P${row.plane}`}</b>{formatVersionShare(row.share)}%</span>
          {/each}
          {#if unencoded}
            <span class="plane-chip"><i class="swatch" style:background={unencodedTint}></i><b>{t('charset.unencodedShort')}</b>{formatVersionShare(listShare)}%</span>
          {/if}
        </p>
      </div>
    </div>
  {/if}
  {#if blocks.length}
    <div class="share-section">
      <SharePie slices={blockSlices} total={blockTotal} />
      <div class="share-body">
        <p class="caption">{t('charset.blocks')}</p>
        <ol class="blocks">
          {#each blocks as row, index (row.id)}
            <li>
              <i class="swatch" style:background={blockSlices[index].color}></i>
              <span class="name">{row.id === 'other' ? t('charset.blockOther') : row.id === 'unencoded' ? t('charset.unencodedShort') : row.label}</span>
              <span class="count">{row.count.toLocaleString(i18n.locale)}</span>
              <b>{formatShare(row.share)}%</b>
            </li>
          {/each}
        </ol>
      </div>
    </div>
  {/if}
  {#if versions !== null}
    <div class="share-section">
      <SharePie slices={versionSlices} total={versionTotal} />
      <div class="share-body">
        <p class="caption">{t('charset.versions')}</p>
        <ol class="versions">
          {#each versions as row, index (row.version)}
            <li>
              <i class="swatch" style:background={versionSlices[index].color}></i>
              <span class="name">{row.version}</span>
              {#if row.ranges.length <= 2}
                <span class="range" title={rangeLabel(row.ranges)}>{rangeLabel(row.ranges)}</span>
              {:else}
                <span class="range"></span>
              {/if}
              <span class="count">{row.count.toLocaleString(i18n.locale)}</span>
              <b>{formatVersionShare(row.share)}%</b>
            </li>
          {/each}
          {#if unencoded}
            <li>
              <i class="swatch" style:background={unencodedTint}></i>
              <span class="name">{t('charset.unencodedShort')}</span>
              <span class="range"></span>
              <span class="count">{unencoded.toLocaleString(i18n.locale)}</span>
              <b>{formatVersionShare(listShare)}%</b>
            </li>
          {/if}
        </ol>
      </div>
    </div>
  {/if}
  {#if occupancy.length}
    <div class="occupancy">
      <p class="caption">{t('charset.occupancy')}</p>
      <table>
        <thead>
          <tr>
            <th scope="col">{t('charset.block')}</th>
            <th scope="col">{t('charset.total')}</th>
            <th scope="col">{t('charset.empty')}</th>
            <th scope="col">{t('charset.emptyShare')}</th>
          </tr>
        </thead>
        <tbody>
          {#each occupancy as row (row.id)}
            <tr>
              <th scope="row">{row.label}</th>
              <td>{row.total.toLocaleString(i18n.locale)}</td>
              <td>{row.empty.toLocaleString(i18n.locale)}</td>
              <td>{formatOccupancyShare(row.share)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .coverage{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-md) var(--ui-space-lg);max-inline-size:380px;margin-block-start:var(--ui-space-sm);padding:var(--ui-space-sm) var(--ui-space-md);background:var(--ui-color-surface-sunken);border-radius:var(--ui-radius-sm)}
  .coverage.two{max-inline-size:760px}
  .metric{display:flex;flex:1 1 260px;min-inline-size:0;align-items:center;gap:var(--ui-space-lg);margin:0}
  .dial{position:relative;inline-size:84px;block-size:84px;flex:none}
  svg{display:block;inline-size:100%;block-size:100%}
  circle{fill:none;stroke-width:9}
  .track{stroke:var(--ui-color-border)}
  .encoded{stroke:var(--ui-color-accent)}
  .unencoded{stroke:var(--ui-color-border-strong)}
  .percent{position:absolute;inset:0;display:grid;place-content:center;text-align:center;font-size:var(--ui-text-md);font-weight:var(--ui-weight-semibold);line-height:1.15;font-variant-numeric:tabular-nums}
  .percent small{display:block;font-size:8px;font-weight:var(--ui-weight-normal);color:var(--ui-color-ink-soft);letter-spacing:.02em}
  figcaption{display:grid;gap:2px;flex:1;min-inline-size:0;max-inline-size:260px}
  .caption{margin:0;font-size:var(--ui-text-2xs);color:var(--ui-color-ink-muted);letter-spacing:var(--ui-tracking-caps);text-transform:uppercase}
  .legend{display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:var(--ui-space-xs);font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft);line-height:var(--ui-leading-tight)}
  .legend b{font-weight:var(--ui-weight-medium);color:var(--ui-color-ink);font-variant-numeric:tabular-nums}
  .swatch{inline-size:8px;block-size:8px;border-radius:2px;flex:none}
  .swatch.encoded{background:var(--ui-color-accent)}
  .swatch.unencoded{background:var(--ui-color-border-strong)}
  .swatch.noscalar{background:var(--ui-color-surface-sunken);border:1px solid var(--ui-color-border)}
  .swatch.unassigned{background:var(--ui-color-border)}
  .basis{display:flex;justify-content:space-between;gap:var(--ui-space-sm);margin:var(--ui-space-2xs) 0 0;padding-block-start:2px;border-block-start:1px solid var(--ui-color-border);font-size:var(--ui-text-2xs);color:var(--ui-color-ink-muted)}
  .basis b{font-weight:var(--ui-weight-medium);color:var(--ui-color-ink);font-variant-numeric:tabular-nums}
  figcaption .ui-hint{margin-block-start:var(--ui-space-2xs)}
  .share-section{flex:1 0 100%;display:grid;grid-template-columns:64px minmax(0,1fr);align-items:start;gap:var(--ui-space-md);padding-block-start:var(--ui-space-sm);border-block-start:1px solid var(--ui-color-border)}
  .share-body{display:grid;gap:var(--ui-space-2xs);min-inline-size:0}
  .share-body .caption{margin:0}
  .blocks{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,168px),1fr));gap:2px var(--ui-space-md);margin:0;padding:0;list-style:none}
  .blocks li{display:grid;grid-template-columns:8px minmax(0,1fr) auto auto;align-items:baseline;gap:var(--ui-space-xs);font-size:var(--ui-text-xs);line-height:var(--ui-leading-tight)}
  .blocks .name{color:var(--ui-color-ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .blocks .count{color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}
  .blocks b{font-weight:var(--ui-weight-medium);color:var(--ui-color-ink);font-variant-numeric:tabular-nums}
  .plane-chips{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs) var(--ui-space-md);margin:0;font-size:var(--ui-text-xs);color:var(--ui-color-ink-soft);font-variant-numeric:tabular-nums}
  .plane-chip{display:inline-flex;align-items:center;gap:4px}
  .plane-chip b{font-weight:var(--ui-weight-medium);color:var(--ui-color-ink)}
  .versions{display:grid;gap:2px;margin:0;padding:0;list-style:none}
  .versions li{display:grid;grid-template-columns:8px minmax(38px,auto) minmax(0,1fr) auto auto;align-items:baseline;gap:var(--ui-space-xs);font-size:var(--ui-text-xs);line-height:var(--ui-leading-tight)}
  .versions .name{color:var(--ui-color-ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap}
  .versions .range{color:var(--ui-color-ink-muted);font-family:var(--ui-font-mono);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .versions .count{color:var(--ui-color-ink-muted);font-variant-numeric:tabular-nums}
  .versions b{font-weight:var(--ui-weight-medium);color:var(--ui-color-ink);font-variant-numeric:tabular-nums}
  .blocks .swatch,.versions .swatch{align-self:center}
  .occupancy{flex:1 0 100%;padding-block-start:var(--ui-space-sm);border-block-start:1px solid var(--ui-color-border)}
  .occupancy .caption{margin:0 0 var(--ui-space-2xs)}
  .occupancy table{inline-size:100%;border-collapse:collapse;font-size:var(--ui-text-xs);line-height:var(--ui-leading-tight)}
  .occupancy th,.occupancy td{padding:2px 0;text-align:end;font-weight:var(--ui-weight-normal);font-variant-numeric:tabular-nums}
  .occupancy th:first-child{text-align:start;color:var(--ui-color-ink-soft)}
  .occupancy thead th{color:var(--ui-color-ink-muted);font-size:var(--ui-text-2xs);text-transform:uppercase;letter-spacing:var(--ui-tracking-caps)}
  .occupancy tbody tr+tr{border-block-start:1px solid var(--ui-color-border)}
</style>
