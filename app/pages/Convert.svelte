<script>
  import { PUA_SOURCES, convertPua, codePoint, codePoints, puaTable } from '../../src/pua.js'
  import { copy } from '../lib/clip.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
  import { link } from '../lib/route.svelte.js'
  import { choose } from '../lib/ui.svelte.js'

  const params = new URLSearchParams(location.search)
  let input = $state(params.get('q') ?? '')
  let sourceId = $state(PUA_SOURCES.some(item => item.id === params.get('s')) ? /** @type {string} */ (params.get('s')) : 'all')
  let filter = $state('')
  const result = $derived(convertPua(input, sourceId))
  const needle = $derived(filter.trim().toLowerCase())
  const matches = $derived(puaTable(sourceId).filter(({ legacy, standard, source }) =>
    !needle || codePoint(legacy).toLowerCase().includes(needle) || codePoint(standard).toLowerCase().includes(needle) || standard.includes(needle) || source.includes(needle)))
  const rows = $derived(matches.slice(0, 100))
  /** @type {HTMLDivElement | null} */
  let editor = null
  /** @type {HTMLDivElement | null} */
  let outputEditor = null
  let composing = false

  /** @param {HTMLDivElement} el @param {string} text */
  function renderEditor(el, text) {
    const fragment = document.createDocumentFragment()
    let run = ''
    for (const char of text) {
      if (/\p{Co}/u.test(char)) {
        if (run) { fragment.append(document.createTextNode(run)); run = '' }
        const span = document.createElement('span')
        span.className = 'pua-inline'
        span.dataset.code = codePoint(char)
        span.textContent = char
        fragment.append(span)
      } else run += char
    }
    if (run) fragment.append(document.createTextNode(run))
    el.replaceChildren(fragment)
  }

  /** @param {HTMLElement} el */
  function caretOffset(el) {
    const selection = getSelection()
    if (!selection?.rangeCount) return 0
    const range = selection.getRangeAt(0).cloneRange()
    const before = range.cloneRange()
    before.selectNodeContents(el)
    before.setEnd(range.endContainer, range.endOffset)
    return before.toString().length
  }

  /** @param {HTMLElement} el @param {number} offset */
  function setCaret(el, offset) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let left = offset
    /** @type {Node | null} */
    let node = walker.nextNode()
    while (node) {
      const length = node.textContent?.length ?? 0
      if (left <= length) {
        const range = document.createRange()
        range.setStart(node, left)
        range.collapse(true)
        const selection = getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        return
      }
      left -= length
      node = walker.nextNode()
    }
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const selection = getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  /** @param {Event} event */
  function edited(event) {
    if (composing) return
    const el = /** @type {HTMLDivElement} */ (event.currentTarget)
    const caret = caretOffset(el)
    const next = el.innerText.replace(/\n$/, '')
    if (next === input) return
    input = next
    renderEditor(el, next)
    setCaret(el, Math.min(caret, next.length))
  }

  function composingStart() {
    composing = true
  }

  /** @param {Event} event */
  function composingEnd(event) {
    composing = false
    edited(event)
  }

  /** @param {ClipboardEvent} event */
  function pasted(event) {
    event.preventDefault()
    document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') ?? '')
  }

  $effect(() => {
    const value = input
    if (!editor || composing) return
    if (editor.textContent !== value) renderEditor(editor, value)
  })

  $effect(() => {
    const value = result.text
    if (!outputEditor) return
    if (outputEditor.textContent !== value) renderEditor(outputEditor, value)
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
      <div id="convert-input" class="ui-textarea editor" data-primary bind:this={editor} contenteditable="true" role="textbox" aria-multiline="true" aria-label={t('convert.input')}
        data-placeholder={t('convert.placeholder')} spellcheck="false" dir="auto"
        oninput={edited} oncompositionstart={composingStart} oncompositionend={composingEnd} onpaste={pasted}></div>
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
      <div id="convert-output" class="ui-textarea editor output" bind:this={outputEditor} role="textbox" aria-readonly="true" aria-label={t('convert.output')} spellcheck="false" dir="auto"></div>
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
        {#each result.conflicts as conflict, index (index)}
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
  .editor{font-size:var(--ui-text-lg);min-block-size:180px;max-block-size:420px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;outline:none;cursor:text}
  .editor:focus-visible{outline:2px solid var(--ui-color-accent);outline-offset:1px}
  .output{cursor:default;background:var(--ui-color-surface-sunken)}
  .editor:empty::before{content:attr(data-placeholder);color:var(--ui-color-ink-muted);pointer-events:none}
  :global(.pua-inline){font-size:0;color:transparent;white-space:nowrap}
  :global(.pua-inline)::before{content:attr(data-code);display:inline-block;font-size:10px;line-height:1.4;padding:0 4px;border:1px dashed var(--ui-color-border-strong);border-radius:2px;color:var(--ui-color-ink-soft);font-family:var(--ui-font-mono),monospace;vertical-align:1px}
  .field-tools{display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .field-tools select{inline-size:auto;font-size:var(--ui-text-xs);padding-block:2px}
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
