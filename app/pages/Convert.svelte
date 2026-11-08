<script>
  import { PUA_SOURCES, convertPua, codePoint, codePoints, puaTable } from '../../src/pua.js'
  import { copy } from '../lib/clip.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import { link } from '../lib/route.svelte.js'
  import { choose } from '../lib/ui.svelte.js'

  let input = $state('')
  let sourceId = $state('all')
  let filter = $state('')
  const result = $derived(convertPua(input, sourceId))
  const needle = $derived(filter.trim().toLowerCase())
  const matches = $derived(puaTable(sourceId).filter(({ legacy, standard, source }) =>
    !needle || codePoint(legacy).toLowerCase().includes(needle) || codePoint(standard).toLowerCase().includes(needle) || standard.includes(needle) || source.includes(needle)))
  const rows = $derived(matches.slice(0, 100))
  const puaInInput = $derived.by(() => {
    /** @type {Map<string, number>} */
    const counts = new Map()
    for (const char of input) if (/\p{Co}/u.test(char)) counts.set(char, (counts.get(char) ?? 0) + 1)
    return [...counts]
  })

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
      {#if puaInInput.length}
        <div class="pua-preview" aria-label={t('convert.puaInInput')}>
          {#each puaInInput as [char, count] (char)}
            <span class="pua-box"><span class="ui-mono">{codePoint(char)}</span>{#if count > 1}<span class="pua-count">×{count}</span>{/if}</span>
          {/each}
        </div>
      {/if}
    </div>
    <div class="ui-field">
      <div class="field-head">
        <label class="ui-label" for="convert-output">{t('convert.output')}</label>
        <span class="field-tools">
          <select id="convert-source" class="ui-input" aria-label={t('convert.source')} bind:value={sourceId}>
            <option value="all">{t('pua.source.all')}</option>
            {#each PUA_SOURCES as item (item.id)}<option value={item.id}>{t(`pua.source.${item.id}`)}</option>{/each}
          </select>
          <button class="ui-button" data-size="sm" type="button" disabled={!result.text} onclick={() => copy(result.text, t('convert.output'))}>{t('common.copy')}</button>
        </span>
      </div>
      <textarea id="convert-output" class="ui-textarea" rows="7" value={result.text} readonly spellcheck="false" dir="auto"></textarea>
    </div>
  </div>

  <div class="ui-toolbar counts" role="status" aria-live="polite" aria-atomic="true">
    <span>{t('convert.converted', { count: result.converted })}</span>
    <span>{t('convert.remaining', { count: result.unmapped })}</span>
    {#if result.ambiguous}<span>{t('convert.ambiguous', { count: result.ambiguous })}</span>{/if}
  </div>

  {#if result.conflicts.length}
    <details class="conflicts">
      <summary class="ui-label">{t('convert.conflicts', { count: result.conflicts.length })}</summary>
      <ul>
        {#each result.conflicts as conflict (conflict.code)}
          <li>
            <span class="ui-mono">{codePoint(conflict.code)}</span>
            {#each conflict.options as option (option.source)}
              <span class="option">{option.char} <span class="tag">{t(`pua.source.${option.source}`)}</span></span>
            {/each}
          </li>
        {/each}
      </ul>
    </details>
  {/if}

  <details class="mapping">
    <summary class="ui-label">{t('convert.mapping')} <span class="ui-count">{matches.length}</span></summary>
    <div class="tools">
      <input class="ui-input" type="search" bind:value={filter} placeholder={t('convert.filter')} aria-label={t('convert.filter')}>
    </div>
    <div class="ui-table-wrap">
      <table class="ui-table">
        <thead><tr><th scope="col">{t('convert.legacy')}</th><th scope="col">{t('convert.standard')}</th><th scope="col">{t('convert.character')}</th><th scope="col">{t('convert.source')}</th></tr></thead>
        <tbody>
          {#each rows as row (row.legacy + row.source)}
            <tr>
              <td class="ui-mono">{codePoint(row.legacy)}</td>
              <td class="ui-mono">{codePoints(row.standard)}</td>
              <td>{#if [...row.standard].length === 1}<a class="glyph ui-script" lang="und-Hani" href={link('convert', { c: row.standard })} title={codePoint(row.standard)} onclick={event => show(event, row.standard)}>{row.standard}</a>{:else}<span class="ui-mono">{row.standard}</span>{/if}</td>
              <td><span class="tag">{t(`pua.source.${row.source}`)}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if matches.length > rows.length}<p class="ui-hint">{t('common.cut', { shown: rows.length, total: matches.length })}</p>{/if}
  </details>

  <footer class="ui-section attribution">
    {#each PUA_SOURCES as item (item.id)}
      <p><a href={item.source.url} target="_blank" rel="noopener noreferrer">{item.source.name}</a> · <a href={item.source.dataUrl} target="_blank" rel="noopener noreferrer">{t('convert.data')}</a></p>
    {/each}
  </footer>
</div>

<style>
  .editors{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:var(--ui-space-lg)}
  .field-head{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-sm);flex-wrap:wrap}
  .pua-preview{display:flex;flex-wrap:wrap;gap:4px;margin-block-start:var(--ui-space-2xs)}
  .pua-box{display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border:1px dashed var(--ui-color-border-strong);border-radius:3px;color:var(--ui-color-ink-soft);font-size:var(--ui-text-xs)}
  .pua-count{font-size:10px;color:var(--ui-color-ink-muted)}
  .field-tools{display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .field-tools select{inline-size:auto;font-size:var(--ui-text-xs);padding-block:2px}
  textarea{font-size:var(--ui-text-lg);min-block-size:180px}
  .counts{color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm);font-variant-numeric:tabular-nums}
  .mapping summary{cursor:pointer;padding-block:var(--ui-space-xs)}
  .tools{display:flex;align-items:center;gap:var(--ui-space-sm);margin-block:var(--ui-space-sm)}
  .tools input{flex:1}
  .mapping .ui-table-wrap{margin-block-start:0}
  .glyph{display:inline-grid;place-items:center;min-inline-size:44px;min-block-size:44px;text-decoration:none}
  .glyph:hover{background:var(--ui-color-accent-soft)}
  .ui-table td{vertical-align:middle}
  .conflicts ul{list-style:none;display:grid;gap:4px;margin:var(--ui-space-xs) 0 0;padding:0}
  .conflicts li{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs)}
  .option{display:inline-flex;align-items:center;gap:4px}
  .tag{padding:0 4px;border:1px solid var(--ui-color-border);border-radius:2px;font-size:10px;line-height:15px;color:var(--ui-color-ink-soft);white-space:nowrap}
  .attribution{gap:var(--ui-space-xs);padding-block-start:var(--ui-space-lg);border-block-start:1px solid var(--ui-color-border);color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);overflow-wrap:anywhere}
</style>
