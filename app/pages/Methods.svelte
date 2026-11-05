<script>
  // Every way in, by kind, with how much of Han each one reaches and where it came from.
  import { loadMethods } from '../lib/data.js'
  import { FAMILIES } from '../lib/families.js'
  import { go, link } from '../lib/route.svelte.js'
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import { UNAVAILABLE } from '../lib/unavailable.js'

  /** @type {import('../lib/data.js').Method[]} */
  let methods = $state([])
  let filter = $state('')
  loadMethods().then(list => { methods = list })
  const needle = $derived(filter.trim().toLowerCase())
  const groups = $derived(FAMILIES.map(family => ({
    family,
    rows: methods.filter(method => method.family === family
      && (!needle || [method.id, ...Object.values(method.names)].some(name => (name ?? '').toLowerCase().includes(needle))))
      .sort((a, b) => b.chars - a.chars),
  })).filter(group => group.rows.length))
</script>

<div class="ui-page" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('methods.title')}</h1>
    <p class="ui-page-intro">{t('methods.intro', { count: methods.length })}</p>
  </header>
  <input class="ui-input" type="search" bind:value={filter} placeholder={t('methods.filter')} aria-label={t('methods.filter')}>
  {#each groups as group (group.family)}
    <section class="ui-section">
      <h2 class="ui-label">{t(`family.${group.family}`)} <span class="ui-count">{group.rows.length}</span></h2>
      <ul class="list">
        {#each group.rows as method (method.id)}
          <li>
            <a class="name" href={link('m', { method: method.id })} onclick={event => { event.preventDefault(); go('m', method.id) }}>{nameOf(method.names)}</a>
            <span class="ui-count">{t('methods.count', { chars: method.chars.toLocaleString() })}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
  <section class="ui-section">
    <h2 class="ui-label">{t('methods.unavailable')}</h2>
    <p class="ui-hint">{t('methods.unavailableIntro')}</p>
    <dl class="none">
      {#each UNAVAILABLE as item (item.names)}
        <div>
          <dt class="ui-label">{t(`family.${item.family}`)} · {t(`methods.reason.${item.reason}`)}</dt>
          <dd>{#if item.url}<a href={item.url} target="_blank" rel="noopener noreferrer">{item.names}</a>{:else}{item.names}{/if}{#if item.note} <span class="ui-hint">({item.note})</span>{/if}</dd>
        </div>
      {/each}
    </dl>
  </section>
</div>

<style>
  .list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0 var(--ui-space-xl);margin:0;padding:0;list-style:none}
  li{display:flex;justify-content:space-between;gap:var(--ui-space-sm);align-items:baseline;padding-block:var(--ui-space-2xs);border-bottom:1px solid var(--ui-color-border)}
  .none{display:grid;gap:var(--ui-space-sm);margin:0}
  .none dd{margin:0;font-size:var(--ui-text-sm);line-height:1.6}
  .name{color:var(--ui-color-ink);text-decoration:none;min-inline-size:0}
  .name:hover{text-decoration:underline}
</style>
