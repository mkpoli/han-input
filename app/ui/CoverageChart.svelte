<script>
  // How much of a character set carries a Unicode character, and how much has no scalar at all.
  import { i18n, t } from '../lib/i18n.svelte.js'

  let { encoded, unencoded } = $props()
  const total = $derived(encoded + unencoded)
  const share = $derived(total ? unencoded / total : 0)
  const percent = $derived(new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 1 }).format(share * 100))
  const radius = 27
  const circumference = 2 * Math.PI * radius
  const arc = $derived(circumference * share)
  const label = $derived(t('charset.coverageLabel', {
    percent,
    encoded: encoded.toLocaleString(i18n.locale),
    unencoded: unencoded.toLocaleString(i18n.locale),
  }))
</script>

<figure class="coverage">
  <div class="dial">
    <svg viewBox="0 0 72 72" role="img" aria-label={label}>
      <circle class="track" cx="36" cy="36" r={radius} />
      {#if unencoded === total}
        <circle class="unencoded" cx="36" cy="36" r={radius} />
      {:else}
        <circle class="encoded" cx="36" cy="36" r={radius} />
        {#if unencoded}
          <circle class="unencoded" cx="36" cy="36" r={radius}
            stroke-dasharray="{arc} {circumference - arc}" transform="rotate(-90 36 36)" />
        {/if}
      {/if}
    </svg>
    <span class="percent" aria-hidden="true">{percent}%<small>{t('charset.unencodedShort')}</small></span>
  </div>
  <figcaption>
    <p class="caption">{t('charset.coverage')}</p>
    <p class="legend"><span class="swatch encoded" aria-hidden="true"></span>{t('charset.encoded')}<b>{encoded.toLocaleString(i18n.locale)}</b></p>
    <p class="legend"><span class="swatch unencoded" aria-hidden="true"></span>{t('charset.unencodedShort')}<b>{unencoded.toLocaleString(i18n.locale)}</b></p>
  </figcaption>
</figure>

<style>
  .coverage{display:flex;max-inline-size:380px;align-items:center;gap:var(--ui-space-lg);margin-block-start:var(--ui-space-sm);padding:var(--ui-space-sm) var(--ui-space-md);background:var(--ui-color-surface-sunken);border-radius:var(--ui-radius-sm)}
  .dial{position:relative;inline-size:72px;block-size:72px;flex:none}
  svg{display:block;inline-size:100%;block-size:100%}
  circle{fill:none;stroke-width:9}
  .track{stroke:var(--ui-color-border)}
  .encoded{stroke:var(--ui-color-accent)}
  .unencoded{stroke:var(--ui-color-border-strong)}
  .percent{position:absolute;inset:0;display:grid;place-content:center;text-align:center;font-size:var(--ui-text-md);font-weight:var(--ui-weight-semibold);line-height:1.15;font-variant-numeric:tabular-nums}
  .percent small{display:block;font-size:9px;font-weight:var(--ui-weight-normal);color:var(--ui-color-ink-soft);letter-spacing:.02em}
  figcaption{display:grid;gap:2px;flex:1;min-inline-size:0;max-inline-size:260px}
  .caption{margin:0;font-size:var(--ui-text-2xs);color:var(--ui-color-ink-muted);letter-spacing:var(--ui-tracking-caps);text-transform:uppercase}
  .legend{display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:var(--ui-space-xs);font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft);line-height:var(--ui-leading-tight)}
  .legend b{font-weight:var(--ui-weight-medium);color:var(--ui-color-ink);font-variant-numeric:tabular-nums}
  .swatch{inline-size:8px;block-size:8px;border-radius:2px;flex:none}
  .swatch.encoded{background:var(--ui-color-accent)}
  .swatch.unencoded{background:var(--ui-color-border-strong)}
</style>
