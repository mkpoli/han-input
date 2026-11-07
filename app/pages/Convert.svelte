<script>
  import { MOE_PUA, convertMoePua, codePoint } from '../../src/pua.js'
  import { copy } from '../lib/clip.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import { link } from '../lib/route.svelte.js'
  import { choose } from '../lib/ui.svelte.js'

  let input = $state('')
  const result = $derived(convertMoePua(input))
  const mappings = Object.entries(MOE_PUA.mappings)
  const source = MOE_PUA.source

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
    <p class="ui-hint">{t('convert.local')}</p>
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

  <div class="ui-toolbar counts" role="status" aria-live="polite" aria-atomic="true">
    <span>{t('convert.converted', { count: result.converted })}</span>
    <span>{t('convert.remaining', { count: result.unmapped })}</span>
  </div>

  <details class="mapping">
    <summary class="ui-label">{t('convert.mapping')} <span class="ui-count">{mappings.length}</span></summary>
    <div class="ui-table-wrap">
      <table class="ui-table">
        <thead><tr><th scope="col">{t('convert.legacy')}</th><th scope="col">{t('convert.standard')}</th><th scope="col">{t('convert.character')}</th></tr></thead>
        <tbody>
          {#each mappings as [legacy, standard] (legacy)}
            <tr>
              <td class="ui-mono">{codePoint(legacy)}</td>
              <td class="ui-mono">{codePoint(standard)}</td>
              <td><a class="glyph ui-script" lang="und-Hani" href={link('convert', { c: standard })} title={codePoint(standard)} onclick={event => show(event, standard)}>{standard}</a></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </details>

  <footer class="ui-section attribution">
    <p><span class="ui-label">{t('method.source')}</span> <a href={source.url} target="_blank" rel="noopener noreferrer" lang="zh-Hant">{source.name}</a> · <a href={source.dataUrl} target="_blank" rel="noopener noreferrer">{t('convert.data')}</a></p>
    <p><a href={source.url} target="_blank" rel="noopener noreferrer">{t('method.licence')}</a>: <span lang="en">{source.licence}</span></p>
  </footer>
</div>

<style>
  .editors{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:var(--ui-space-lg)}
  .field-head{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-sm)}
  textarea{font-size:var(--ui-text-lg);min-block-size:180px}
  .counts{color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm);font-variant-numeric:tabular-nums}
  .mapping summary{cursor:pointer;padding-block:var(--ui-space-xs)}
  .mapping .ui-table-wrap{margin-block-start:var(--ui-space-sm)}
  .glyph{display:inline-grid;place-items:center;min-inline-size:44px;min-block-size:44px;text-decoration:none}
  .glyph:hover{background:var(--ui-color-accent-soft)}
  .ui-table td{vertical-align:middle}
  .attribution{gap:var(--ui-space-xs);padding-block-start:var(--ui-space-lg);border-block-start:1px solid var(--ui-color-border);color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);overflow-wrap:anywhere}
</style>
