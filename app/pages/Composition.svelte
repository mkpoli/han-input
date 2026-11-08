<script>
  // Old descriptions of how a character is written: Taiwan's 漢字構形資料庫 symbols and the
  // arithmetic signs used by the Korean History Database and CBETA. Each converts to IDS.
  import { tick } from 'svelte'
  import { LEGACY_SYMBOLS, convertLegacy, repeatExample } from '../../src/legacy.js'
  import { convertArithmetic } from '../../src/arithmetic.js'
  import { copy } from '../lib/clip.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import { link } from '../lib/route.svelte.js'

  const params = new URLSearchParams(location.search)
  let input = $state(params.get('q') ?? '')
  let arithmeticInput = $state('')
  let notation = $state(/** @type {'korean' | 'general'} */ ('korean'))
  const result = $derived(convertLegacy(input))
  const arithmetic = $derived(convertArithmetic(arithmeticInput, notation))
  /** @type {HTMLTextAreaElement | null} */
  let field = null
  /** @type {HTMLTextAreaElement | null} */
  let arithmeticField = null

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
  async function insertArithmetic(char) {
    const element = arithmeticField
    if (!element) return
    const focused = document.activeElement === element
    const start = focused ? element.selectionStart ?? arithmeticInput.length : arithmeticInput.length
    const end = focused ? element.selectionEnd ?? start : start
    arithmeticInput = arithmeticInput.slice(0, start) + char + arithmeticInput.slice(end)
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

  const PALETTES = {
    korean: ['+', '-', '/', '*', '(', ')', '▼'],
    general: ['*', '/', '@', '-', '+', '?', '(', ')'],
  }

  function arithmeticExample() {
    arithmeticInput = notation === 'korean' ? '石+(毁-殳)' : '間-日+月'
  }

  function searchArithmetic() {
    location.assign(link('', { q: arithmeticInput.replace(/\s+/g, '') }))
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

  <section class="arithmetic-section">
    <h2 class="ui-label">{t('composition.arithmetic.title')}</h2>
    <p class="ui-hint">{t('composition.arithmetic.intro')}</p>

    <div class="notation" role="group" aria-label={t('composition.arithmetic.notation')}>
      <button class="ui-button" data-size="sm" type="button" aria-pressed={notation === 'korean'} onclick={() => { notation = 'korean' }}>{t('composition.arithmetic.notation.korean')}</button>
      <button class="ui-button" data-size="sm" type="button" aria-pressed={notation === 'general'} onclick={() => { notation = 'general' }}>{t('composition.arithmetic.notation.general')}</button>
    </div>

    <div class="arithmetic-palette" role="group" aria-label={t('composition.arithmetic.palette')}>
      {#each PALETTES[notation] as sign (sign)}
        <button class="key" type="button" onmousedown={event => event.preventDefault()} onclick={() => insertArithmetic(sign)} title={t('composition.arithmetic.insert', { sign })} aria-label={t('composition.arithmetic.insert', { sign })}>
          <span class="arith-sign" aria-hidden="true">{sign}</span>
        </button>
      {/each}
    </div>

    <div class="editors">
      <div class="ui-field">
        <div class="field-head">
          <label class="ui-label" for="arithmetic-input">{t('composition.arithmetic.input')}</label>
          <span class="field-tools">
            <button class="ui-button" data-size="sm" type="button" disabled={!!arithmeticInput} onclick={arithmeticExample}>{t('composition.example')}</button>
            <button class="ui-button" data-size="sm" type="button" disabled={!arithmeticInput} onclick={() => { arithmeticInput = '' }}>{t('writing.clear')}</button>
          </span>
        </div>
        <textarea id="arithmetic-input" class="ui-textarea arithmetic-formula" rows="5" bind:value={arithmeticInput} bind:this={arithmeticField} placeholder={t('composition.arithmetic.placeholder')} spellcheck="false" autocomplete="off" autocapitalize="off" dir="auto"></textarea>
      </div>
      <div class="ui-field">
        <div class="field-head">
          <label class="ui-label" for="arithmetic-output">{t('composition.output')}</label>
          <span class="field-tools">
            <button class="ui-button" data-size="sm" type="button" disabled={!arithmetic.ids || !arithmeticInput} onclick={searchArithmetic}>{t('composition.arithmetic.search')}</button>
            <button class="ui-button" data-size="sm" type="button" disabled={!arithmetic.ids} onclick={() => copy(arithmetic.ids, t('composition.output'))}>{t('common.copy')}</button>
          </span>
        </div>
        <textarea id="arithmetic-output" class="ui-textarea ids" rows="5" value={arithmetic.ids} readonly spellcheck="false" dir="auto"></textarea>
      </div>
    </div>

    <div class="ui-toolbar counts" role="status" aria-live="polite" aria-atomic="true">
      {#if arithmetic.ids}<span>{t('composition.arithmetic.converted')}</span>{/if}
      {#if arithmetic.problems.length}<span>{t('composition.problems', { count: arithmetic.problems.length })}</span>{/if}
    </div>

    {#if arithmetic.notes.length}
      <ul class="arithmetic-notes">
        {#each arithmetic.notes as note (note)}<li>{t(`composition.arithmetic.note.${note}`)}</li>{/each}
      </ul>
    {/if}
    {#if arithmetic.ids}<p class="ui-hint">{t('composition.arithmetic.searchHint')}</p>{/if}

    {#if arithmetic.problems.length}
      <details class="issues">
        <summary class="ui-label">{t('composition.problems', { count: arithmetic.problems.length })}</summary>
        <ul>
          {#each arithmetic.problems as problem, index (index)}<li>{t(`composition.arithmetic.problem.${problem.code}`)}</li>{/each}
        </ul>
      </details>
    {/if}

    <details class="legend">
      <summary class="ui-label">{t('composition.arithmetic.rules')}</summary>
      <div class="ui-table-wrap">
        <table class="ui-table">
          <thead><tr><th scope="col">{t('composition.arithmetic.sign')}</th><th scope="col">{t('composition.arithmetic.relation')}</th><th scope="col">{t('composition.arithmetic.example')}</th><th scope="col">{t('composition.legend.ids')}</th></tr></thead>
          <tbody>
            {#if notation === 'korean'}
              <tr><td class="ui-mono">+</td><td>{t('composition.arithmetic.relation.horizontal')}</td><td class="ui-mono">氵+飛</td><td class="ui-mono">⿰</td></tr>
              <tr><td class="ui-mono">-</td><td>{t('composition.arithmetic.relation.delete')}</td><td class="ui-mono">請-言</td><td class="ui-mono">㇯</td></tr>
              <tr><td class="ui-mono">/</td><td>{t('composition.arithmetic.relation.vertical')}</td><td class="ui-mono">髟/目</td><td class="ui-mono">⿱</td></tr>
              <tr><td class="ui-mono">*</td><td>{t('composition.arithmetic.relation.combine')}</td><td class="ui-mono">(臼*米)/皿</td><td class="ui-mono">⿻</td></tr>
              <tr><td class="ui-mono">()</td><td>{t('composition.arithmetic.relation.group')}</td><td class="ui-mono">穴/(爿+未)</td><td class="ui-mono">—</td></tr>
              <tr><td class="ui-mono">▼</td><td>{t('composition.arithmetic.relation.marker')}</td><td class="ui-mono">{"▼{日/央}"}</td><td class="ui-mono">⿱日央</td></tr>
            {:else}
              <tr><td class="ui-mono">*</td><td>{t('composition.arithmetic.relation.horizontal')}</td><td class="ui-mono">日*月</td><td class="ui-mono">⿰</td></tr>
              <tr><td class="ui-mono">/</td><td>{t('composition.arithmetic.relation.vertical')}</td><td class="ui-mono">立/日</td><td class="ui-mono">⿱</td></tr>
              <tr><td class="ui-mono">@</td><td>{t('composition.arithmetic.relation.contain')}</td><td class="ui-mono">囗@大</td><td class="ui-mono">⿴</td></tr>
              <tr><td class="ui-mono">-</td><td>{t('composition.arithmetic.relation.delete')}</td><td class="ui-mono">請-言</td><td class="ui-mono">㇯</td></tr>
              <tr><td class="ui-mono">-+</td><td>{t('composition.arithmetic.relation.replace')}</td><td class="ui-mono">間-日+月</td><td class="ui-mono">⿻</td></tr>
              <tr><td class="ui-mono">?</td><td>{t('composition.arithmetic.relation.unknown')}</td><td class="ui-mono">(?*匕)/月</td><td class="ui-mono">?</td></tr>
              <tr><td class="ui-mono">()</td><td>{t('composition.arithmetic.relation.group')}</td><td class="ui-mono">穴/(爿+未)</td><td class="ui-mono">—</td></tr>
              <tr><td class="ui-mono">[]</td><td>{t('composition.arithmetic.relation.separator')}</td><td class="ui-mono">羅[目*侯]</td><td class="ui-mono">—</td></tr>
            {/if}
          </tbody>
        </table>
      </div>
      <p class="ui-hint">{t('composition.arithmetic.precedence')}</p>
    </details>
  </section>

  <footer class="ui-section attribution">
    <p><a href="https://cdp.sinica.edu.tw/cdphanzi/" target="_blank" rel="noopener noreferrer">{t('composition.source.database')}</a> · <a href="https://cdp.sinica.edu.tw/service/documents/T960419.pdf" target="_blank" rel="noopener noreferrer">{t('composition.source.paper')}</a></p>
    <p>{t('composition.source.citation')}</p>
    <p><a href="https://db.history.go.kr/resources/unicode/help/help07.jsp" target="_blank" rel="noopener noreferrer">{t('composition.arithmetic.source.korean')}</a> · <a href="https://cbetaonline.dila.edu.tw/doc/en/02-04_create_word.php" target="_blank" rel="noopener noreferrer">{t('composition.arithmetic.source.general')}</a></p>
    <p>{t('composition.arithmetic.citation')}</p>
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
  .arithmetic-section{margin-block-start:var(--ui-space-2xl);padding-block-start:var(--ui-space-lg);border-block-start:1px solid var(--ui-color-border)}
  .notation{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs);margin-block:var(--ui-space-sm)}
  .notation [aria-pressed='true']{border-color:var(--ui-color-accent);background:var(--ui-color-accent-soft);font-weight:var(--ui-weight-semibold)}
  .arithmetic-palette{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:var(--ui-space-2xs);margin-block-end:var(--ui-space-md)}
  .arith-sign{font-family:var(--ui-font-mono),monospace;font-size:24px;line-height:1}
  .arithmetic-formula{font-family:var(--ui-font-script);line-height:1.6}
  .arithmetic-notes{margin:var(--ui-space-xs) 0 0;padding-inline-start:1.4em;color:var(--ui-color-ink-soft);font-size:var(--ui-text-sm)}
  .attribution{gap:var(--ui-space-xs);padding-block-start:var(--ui-space-lg);border-block-start:1px solid var(--ui-color-border);color:var(--ui-color-ink-muted);font-size:var(--ui-text-xs);overflow-wrap:anywhere}
  @media (max-width:800px){
    .palette{grid-template-columns:repeat(5,minmax(0,1fr))}
    .arithmetic-palette{grid-template-columns:repeat(4,minmax(0,1fr))}
    .sign{font-size:28px}
    .key{padding-block:var(--ui-space-2xs)}
    .key-label{font-size:9px}
  }
</style>
