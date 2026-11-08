<script>
  // What the site is for, and where every table came from.
  import { loadMethods } from '../lib/data.js'
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import { PUA_SOURCES } from '../../src/pua.js'
  /** @type {import('../lib/data.js').Method[]} */
  let methods = $state([])
  /** @type {{ id: string, name: string, url: string, licence: string, attribution?: string, version?: string }[]} */
  let writing = $state([])
  loadMethods().then(list => { methods = list })
  fetch('/data/ids.json').then(response => response.ok ? response.json() : { sources: [] })
    .then(doc => { writing = doc.sources ?? [] }).catch(() => {})
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
          {#each PUA_SOURCES as item (item.id)}
            <tr>
              <td><a href={item.source.url} target="_blank" rel="noopener noreferrer">{item.source.name}</a> · <a href={item.source.dataUrl} target="_blank" rel="noopener noreferrer">{t('convert.data')}</a></td>
              <td class="ui-hint">{item.source.licence}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
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
</style>
