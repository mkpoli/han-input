<script>
  import { PUA_SOURCES, convertPua, codePoint, puaEntries } from '../../src/pua.js'
  import { copy } from '../lib/clip.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import { link } from '../lib/route.svelte.js'
  import { choose } from '../lib/ui.svelte.js'

  let input = $state('')
  let sourceId = $state('moe')
  let filter = $state('')
  const source = $derived(PUA_SOURCES.find(item => item.id === sourceId) ?? PUA_SOURCES[0])
  const result = $derived(convertPua(input, sourceId))
  const needle = $derived(filter.trim().toLowerCase())
  const matches = $derived(puaEntries(sourceId).filter(([legacy, standard]) =>
    !needle || codePoint(legacy).toLowerCase().includes(needle) || codePoint(standard).toLowerCase().includes(needle) || standard.includes(needle)))
  const rows = $derived(matches.slice(0, 100))

  /** @param {MouseEvent} event @param {string} char */
  function show(event, char) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    choose(char)
  }
</script>

<div class="ui-page" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('convert.title')}</h1>
    <p class="ui-page-intro">{t('convert.intro')}</p>
  </header>

  <div class="editors">
    <div class="ui-field">
      <div class="field-head">
        <label class="ui-label" for="convert-input">{t('convert.input')}</label>
        <button class="ui-button" data-size="sm" type="button" disabled={!input} onclick={() => { input = '' }}>{t('writing.clear')}</button>
      </div>
      <textarea id="convert-input" class="ui-textarea" data-primary rows="7" bind:value={input} placeholder={t('convert.placeholder')} spellcheck="false" autocomplete="off" autocapitalize="off" dir="auto"></textarea>
    </div>
    <div class="ui-field">
      <div class="field-head">
        <label class="ui-label" for="convert-output">{t('convert.output')}</label>
        <button class="ui-button" data-size="sm" type="button" disabled={!result.text} onclick={() => copy(result.text, t('convert.output'))}>{t('common.copy')}</button>
      </div>
      <textarea id="convert-output" class="ui-textarea" rows="7" value={result.text} readonly spellcheck="false" dir="auto"></textarea>
    </div>
  </div>

  <div class="ui-toolbar counts">
    <label class="ui-label" for="convert-source">{t('convert.source')}</label>
    <select id="convert-source" class="ui-input" bind:value={sourceId}>
      {#each PUA_SOURCES as item (item.id)}<option value={item.id}>{t(`pua.source.${item.id}`)}</option>{/each}
    </select>
    <span role="status" aria-live="polite">{t('convert.converted', { count: result.converted })}</span>
    <span>{t('convert.remaining', { count: result.unmapped })}</span>
  </div>

  <details class="mapping">
    <summary class="ui-label">{t('convert.mapping')} <span class="ui-count">{matches.length}</span></summary>
    <div class="tools">
      <input class="ui-input" type="search" bind:value={filter} placeholder={t('convert.filter')} aria-label={t('convert.filter')}>
    </div>
    <div class="ui-table-wrap">
      <table class="ui-table">
        <thead><tr><th scope="col">{t('convert.legacy')}</th><th scope="col">{t('convert.standard')}</th><th scope="col">{t('convert.character')}</th></tr></thead>
        <tbody>
          {#each rows as [legacy, standard] (legacy)}
            <tr>
              <td class="ui-mono">{codePoint(legacy)}</td>
              <td class="ui-mono">{codePoint(standard)}</td>
              <td><a class="glyph ui-script" lang="und-Hani" href={link('convert', { c: standard })} title={codePoint(standard)} onclick={event => show(event, standard)}>{standard}</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if matches.length > rows.length}<p class="ui-hint">{t('common.cut', { shown: rows.length, total: matches.length })}</p>{/if}
  </details>

  <footer class="ui-section attribution">
    {#each PUA_SOURCES as item (item.id)}
      <p><a href={item.source.url} target="_blank" rel="noopener noreferrer">{item.source.name}</a> · <a href={item.source.dataUrl} target="_blank" rel="noopener noreferrer">{t('convert.data')}</a> <span class="ui-hint">{item.source.licence}</span></p>
    {/each}
  </footer>
</div>

<style>
  .editors{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:var(--ui-space-lg)}
  .field-head{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-sm)}
  textarea{font-size:var(--ui-text-lg);min-block-size:180px}
  .counts{color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm);font-variant-numeric:tabular-nums;gap:var(--ui-space-sm)}
  .counts select{inline-size:auto}
  .mapping summary{cursor:pointer;padding-block:var(--ui-space-xs)}
  .tools{display:flex;align-items:center;gap:var(--ui-space-sm);flex-wrap:wrap;margin-block:var(--ui-space-sm)}
  .tools select{inline-size:auto}
  .tools input{flex:1;min-inline-size:160px}
  .mapping .ui-table-wrap{margin-block-start:0}
  .glyph{display:inline-grid;place-items:center;min-inline-size:44px;min-block-size:44px;text-decoration:none}
  .glyph:hover{background:var(--ui-color-accent-soft)}
  .ui-table td{vertical-align:middle}
  .attribution{gap:var(--ui-space-xs);padding-block-start:var(--ui-space-lg);border-block-start:1px solid var(--ui-color-border);color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);overflow-wrap:anywhere}
</style>
