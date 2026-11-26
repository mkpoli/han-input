<script>
  // An IDS-only row of the dialect list in place of the character card: it has no character to open.
  import { i18n, t } from '../lib/i18n.svelte.js'
  import { matchRccByIds, rccSearchUrl } from '../lib/rcc.js'
  import { hideSheet, ui } from '../lib/ui.svelte.js'
  import DialectRows from './DialectRows.svelte'
  import RccTiles from './RccTiles.svelte'

  /** @type {import('../lib/rcc.js').RccMatch[]} */
  let rccMatches = $state([])

  $effect(() => {
    const seq = ui.dialect
    rccMatches = []
    if (!seq) return
    let active = true
    const controller = new AbortController()
    matchRccByIds(seq, { signal: controller.signal }).then(found => { if (active) rccMatches = found })
    return () => { active = false; controller.abort() }
  })
</script>

<article class="dialect-card">
  <header class="head">
    <span class="ids ui-glyph-text" lang="und-Hani">{ui.dialect}</span>
    <span class="ui-hint">{t('dialects.unencoded')}</span>
    <button class="ui-button" data-variant="quiet" data-size="sm" type="button" onclick={() => { ui.dialect = ''; hideSheet() }}>{t('dialects.close')}</button>
  </header>
  {#if ui.dialect}
    <section class="rcc">
      <h3 class="ui-label">{t('rcc.name')}{#if rccMatches.length}{' '}<span class="ui-count">{rccMatches.length}</span>{/if}</h3>
      {#if rccMatches.length}
        <RccTiles items={rccMatches} compact />
      {/if}
      <div class="rcc-links">
        <a class="rcc-search" href={rccSearchUrl(ui.dialect, i18n.locale)} target="_blank" rel="noopener noreferrer">{t('rcc.search')} <span aria-hidden="true">↗</span></a>
      </div>
    </section>
  {/if}
  <DialectRows entryKey={ui.dialect} />
</article>

<style>
  .dialect-card{display:grid;gap:var(--ui-space-xl);padding:var(--ui-space-xl)}
  .head{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-sm) var(--ui-space-lg)}
  .ids{font-size:28px;line-height:1.2;overflow-wrap:anywhere}
  .head .ui-button{margin-inline-start:auto}
  .rcc{display:grid;gap:var(--ui-space-xs)}
  .rcc h3{margin:0}
  .rcc-links{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs)}
  .rcc-search{display:inline-flex;align-items:baseline;gap:var(--ui-space-2xs);padding:2px var(--ui-space-sm);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);color:var(--ui-color-ink);font-size:var(--ui-text-xs);text-decoration:none;white-space:nowrap}
  .rcc-search:hover{background:var(--ui-color-surface-hover)}
</style>
