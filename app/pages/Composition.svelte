<script>
  // Old composition formulas: Taiwan's 漢字構形資料庫 wrote characters with thirteen Big5 symbols
  // before IDS. A formula converts to IDS; a shape marker can only give its parts in writing order.
  import { tick } from 'svelte'
  import { LEGACY_SYMBOLS, convertLegacy, repeatExample } from '../../src/legacy.js'
  import { copy } from '../lib/clip.svelte.js'
  import { t } from '../lib/i18n.svelte.js'

  const params = new URLSearchParams(location.search)
  let input = $state(params.get('q') ?? '')
  const result = $derived(convertLegacy(input))
  /** @type {HTMLTextAreaElement | null} */
  let field = null

  /** @param {string} char */
  async function insert(char) {
    const element = field
    if (!element) return
    const focused = document.activeElement === element
    const start = focused ? element.selectionStart ?? input.length : input.length
    const end = focused ? element.selectionEnd ?? start : start
    input = input.slice(0, start) + char + input.slice(end)
    await tick()
    element.focus()
    element.setSelectionRange(start + 1, start + 1)
  }

  /** @param {string} char */
  const codePoint = char => `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`

  /** @param {string} id */
  const symbol = id => /** @type {string} */ (LEGACY_SYMBOLS.find(item => item.id === id)?.char)

  function example() {
    input = `髟${symbol('ud')}八`
  }
</script>

<div class="ui-page" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('composition.title')}</h1>
    <p class="ui-page-intro">{t('composition.intro')}</p>
  </header>

  <div class="palette" role="group" aria-label={t('composition.palette')}>
    {#each LEGACY_SYMBOLS as item (item.id)}
      <button class="key" type="button" onmousedown={event => event.preventDefault()} onclick={() => insert(item.char)} title={`${t(`composition.symbol.${item.id}`)} · ${item.big5}`} aria-label={t(`composition.symbol.${item.id}`)}>
        <span class="sign" aria-hidden="true">{item.char}</span>
        <span class="key-label">{t(`composition.symbol.${item.id}`)}</span>
      </button>
    {/each}
  </div>
  <p class="ui-hint palette-hint">{t('composition.hint')}</p>

  <div class="editors">
    <div class="ui-field">
      <div class="field-head">
        <label class="ui-label" for="composition-input">{t('composition.input')}</label>
        <span class="field-tools">
          <button class="ui-button" data-size="sm" type="button" disabled={!!input} onclick={example}>{t('composition.example')}</button>
          <button class="ui-button" data-size="sm" type="button" disabled={!input} onclick={() => { input = '' }}>{t('writing.clear')}</button>
        </span>
      </div>
      <textarea id="composition-input" class="ui-textarea formula" rows="5" bind:value={input} bind:this={field} placeholder={t('composition.placeholder')} spellcheck="false" autocomplete="off" autocapitalize="off" dir="auto"></textarea>
    </div>
    <div class="ui-field">
      <div class="field-head">
        <label class="ui-label" for="composition-output">{t('composition.output')}</label>
        <button class="ui-button" data-size="sm" type="button" disabled={!result.text} onclick={() => copy(result.text, t('composition.output'))}>{t('common.copy')}</button>
      </div>
      <textarea id="composition-output" class="ui-textarea ids" rows="5" value={result.text} readonly spellcheck="false" dir="auto"></textarea>
    </div>
  </div>

  <div class="ui-toolbar counts" role="status" aria-live="polite" aria-atomic="true">
    <span>{t('composition.converted', { count: result.converted })}</span>
    {#if result.shapes}<span>{t('composition.shapes', { count: result.shapes })}</span>{/if}
    {#if result.unresolved}<span>{t('composition.unresolved', { count: result.unresolved })}</span>{/if}
    {#if result.problems.length}<span>{t('composition.problems', { count: result.problems.length })}</span>{/if}
  </div>

  {#if result.shapes}<p class="ui-hint">{t('composition.parts')}</p>{/if}
  {#if result.unresolvedChars.length}
    <p class="ui-hint private">{t('composition.unresolvedHint')}
      {#each result.unresolvedChars as char (char)}<span class="ui-mono">{codePoint(char)}</span>{/each}
    </p>
  {/if}

  {#if result.problems.length}
    <details class="issues">
      <summary class="ui-label">{t('composition.problems', { count: result.problems.length })}</summary>
      <ul>
        {#each result.problems as problem, index (index)}<li>{t(`composition.problem.${problem.code}`)}</li>{/each}
      </ul>
    </details>
  {/if}

  <details class="legend">
    <summary class="ui-label">{t('composition.legend')}</summary>
    <div class="ui-table-wrap">
      <table class="ui-table">
        <thead><tr><th scope="col">{t('composition.legend.symbol')}</th><th scope="col">{t('composition.legend.big5')}</th><th scope="col">{t('composition.legend.ids')}</th><th scope="col">{t('composition.legend.meaning')}</th></tr></thead>
        <tbody>
          {#each LEGACY_SYMBOLS as item (item.id)}
            <tr>
              <td class="sign-cell" aria-hidden="true">{item.char}</td>
              <td class="ui-mono">{item.big5}</td>
              <td class="ui-mono">{item.kind === 'connect' ? item.ids : item.kind === 'repeat' ? repeatExample(item) : '—'}</td>
              <td>{t(`composition.symbol.${item.id}`)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </details>

  <footer class="ui-section attribution">
    <p><a href="https://cdp.sinica.edu.tw/cdphanzi/" target="_blank" rel="noopener noreferrer">{t('composition.source.database')}</a> · <a href="https://cdp.sinica.edu.tw/service/documents/T960419.pdf" target="_blank" rel="noopener noreferrer">{t('composition.source.paper')}</a></p>
    <p>{t('composition.source.citation')}</p>
  </footer>
</div>

<style>
  .palette-hint{margin-block-end:var(--ui-space-md)}
  .palette{display:grid;grid-template-columns:repeat(13,minmax(0,1fr));gap:var(--ui-space-2xs);margin-block-end:var(--ui-space-lg)}
  .key{display:flex;flex-direction:column;align-items:center;gap:2px;min-inline-size:0;padding:var(--ui-space-xs) 2px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface);color:var(--ui-color-ink);cursor:pointer}
  .key:hover{background:var(--ui-color-accent-soft);border-color:var(--ui-color-border-strong)}
  .key:focus-visible{outline:2px solid var(--ui-color-accent);outline-offset:1px}
  .sign{font-family:'CDP Composition',serif;font-size:30px;line-height:1}
  .key-label{font-size:10px;line-height:1.25;color:var(--ui-color-ink-soft);text-align:center;overflow-wrap:anywhere;max-inline-size:100%}
  .editors{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:var(--ui-space-lg)}
  .field-head{display:flex;align-items:center;justify-content:space-between;gap:var(--ui-space-sm);flex-wrap:wrap}
  .field-tools{display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .ui-textarea{font-size:var(--ui-text-lg);min-block-size:150px;max-block-size:360px}
  .formula{font-family:var(--ui-font-script);line-height:1.6}
  .ids{font-family:var(--ui-font-script);background:var(--ui-color-surface-sunken)}
  .counts{color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm);font-variant-numeric:tabular-nums}
  .private{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px}
  .legend summary,.issues summary{cursor:pointer;padding-block:var(--ui-space-xs)}
  .legend .ui-table-wrap{margin-block-start:0}
  .sign-cell{font-family:'CDP Composition',serif;font-size:26px;line-height:1;text-align:center}
  .issues ul{margin:var(--ui-space-xs) 0 0;padding-inline-start:1.4em;color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm)}
  .attribution{gap:var(--ui-space-xs);padding-block-start:var(--ui-space-lg);border-block-start:1px solid var(--ui-color-border);color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);overflow-wrap:anywhere}
  @media (max-width:800px){
    .palette{grid-template-columns:repeat(5,minmax(0,1fr))}
    .sign{font-size:28px}
    .key{padding-block:var(--ui-space-2xs)}
    .key-label{font-size:9px}
  }
</style>
