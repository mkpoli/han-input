<script>
  // What the site is for, and where every table came from.
  import { loadMethods, loadVariants } from '../lib/data.js'
  import { i18n, nameOf, t } from '../lib/i18n.svelte.js'
  import { G_SOURCES, noteOf } from '../lib/sources.js'
  import { loadPua } from '../../src/pua.js'
  /** @type {import('../lib/data.js').Method[]} */
  let methods = $state([])
  /** @type {{ id: string, name: string, url: string, licence: string, attribution?: string, version?: string }[]} */
  let writing = $state([])
  loadMethods().then(list => { methods = list })
  fetch('/data/ids.json').then(response => response.ok ? response.json() : { sources: [] })
    .then(doc => { writing = doc.sources ?? [] }).catch(() => {})
  /** @type {{ name: string, url: string, licence: string }[]} */
  let variantSources = $state([])
  loadVariants().then(doc => { variantSources = doc.sources }).catch(() => {})
  /** @type {import('../../src/pua.js').PuaScheme[]} */
  let puaSchemes = $state([])
  loadPua().then(pua => { puaSchemes = pua.schemes }).catch(() => {})
</script>

<div class="ui-page" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('about.title')}</h1>
    <p class="ui-page-intro">{t('about.intro')}</p>
  </header>
  <section class="ui-section">
    <h2 class="ui-label">{t('about.sources', { count: methods.length })}</h2>
    <div class="ui-table-wrap">
      <table class="table">
        <thead><tr><th>{t('about.method')}</th><th>{t('method.source')}</th><th>{t('method.licence')}</th></tr></thead>
        <tbody>
          {#each methods as method (method.id)}
            <tr>
              <td>{nameOf(method.names)}</td>
              <td><a href={method.source.url} target="_blank" rel="noopener noreferrer">{method.source.name}</a>{#if method.source.attribution}<br><span class="ui-hint">{method.source.attribution}</span>{/if}</td>
              <td class="ui-hint">{method.source.licence}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
  <section class="ui-section">
    <h2 class="ui-label">{t('about.pua')}</h2>
    <div class="ui-table-wrap">
      <table class="table">
        <thead><tr><th>{t('convert.source')}</th><th>{t('method.licence')}</th></tr></thead>
        <tbody>
          {#each puaSchemes as item (item.id)}
            <tr>
              <td><a href={item.source.url} target="_blank" rel="noopener noreferrer">{item.source.name}</a> · <a href={item.source.dataUrl} target="_blank" rel="noopener noreferrer">{t('convert.data')}</a></td>
              <td class="ui-hint">{item.source.licence}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
  {#if variantSources.length}
    <section class="ui-section">
      <h2 class="ui-label">{t('about.variants')}</h2>
      <div class="ui-table-wrap">
        <table class="table">
          <thead><tr><th>{t('method.source')}</th><th>{t('method.licence')}</th></tr></thead>
          <tbody>
            {#each variantSources as entry (entry.url)}
              <tr>
                <td>{#if entry.url}<a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.name}</a>{:else}{entry.name}{/if}</td>
                <td class="ui-hint">{entry.licence}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
  <section class="ui-section">
    <h2 class="ui-label">{t('about.gSources')}</h2>
    <p class="ui-hint">{t('about.gSourcesIntro')} <a href="https://www.unicode.org/reports/tr38/#kIRG_GSource" target="_blank" rel="noopener noreferrer">UAX #38</a></p>
    <dl class="glossary">
      {#each Object.entries(G_SOURCES) as [code, source] (code)}
        <div class="gloss-row">
          <dt><span class="ui-mono">{code}</span> {nameOf(source.names)}</dt>
          <dd>{noteOf(source, i18n.locale)}</dd>
        </div>
      {/each}
    </dl>
  </section>
  {#if writing.length}
    <section class="ui-section">
      <h2 class="ui-label">{t('about.writing')}</h2>
      <p class="ui-hint">{t('about.writingIntro')}</p>
      <div class="ui-table-wrap">
        <table class="table">
          <thead><tr><th>{t('method.source')}</th><th>{t('method.licence')}</th></tr></thead>
          <tbody>
            {#each writing as entry (entry.id)}
              <tr>
                <td><a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.name}</a>{#if entry.attribution}<br><span class="ui-hint">{entry.attribution}{#if entry.version} · {entry.version}{/if}</span>{/if}</td>
                <td class="ui-hint">{entry.licence}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
</div>

<style>
  .table{inline-size:100%;border-collapse:collapse;font-size:var(--ui-text-sm)}
  th,td{padding:var(--ui-space-2xs) var(--ui-space-sm);border-bottom:1px solid var(--ui-color-border);text-align:start;vertical-align:top}
  .glossary{display:grid;gap:0;margin:0;font-size:var(--ui-text-sm)}
  .gloss-row{display:grid;grid-template-columns:minmax(160px,240px) minmax(0,1fr);gap:var(--ui-space-sm);padding-block:var(--ui-space-2xs);border-bottom:1px solid var(--ui-color-border)}
  .gloss-row dt{margin:0}
  .gloss-row dd{margin:0;color:var(--ui-color-ink-soft)}
  @media (max-width:700px){.gloss-row{grid-template-columns:minmax(0,1fr);gap:2px}}
</style>
