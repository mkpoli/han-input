<script>
  // What the site is for, and where every table came from.
  import { loadMethods } from '../lib/data.js'
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import { MOE_PUA } from '../../src/pua.js'
  /** @type {import('../lib/data.js').Method[]} */
  let methods = $state([])
  loadMethods().then(list => { methods = list })
</script>

<div class="ui-page" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('about.title')}</h1>
    <p class="ui-page-intro">{t('about.intro')}</p>
  </header>
  <section class="ui-section">
    <h2 class="ui-label">{t('about.sources', { count: methods.length + 1 })}</h2>
    <div class="ui-table-wrap">
      <table class="table">
        <thead><tr><th>{t('about.method')}</th><th>{t('method.source')}</th><th>{t('method.licence')}</th></tr></thead>
        <tbody>
          <tr>
            <td><a href="/convert">{t('convert.title')}</a></td>
            <td><a href={MOE_PUA.source.url} target="_blank" rel="noopener noreferrer">{MOE_PUA.source.name}</a></td>
            <td class="ui-hint">{MOE_PUA.source.licence}</td>
          </tr>
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
</div>

<style>
  .table{inline-size:100%;border-collapse:collapse;font-size:var(--ui-text-sm)}
  th,td{padding:var(--ui-space-2xs) var(--ui-space-sm);border-bottom:1px solid var(--ui-color-border);text-align:start;vertical-align:top}
</style>
