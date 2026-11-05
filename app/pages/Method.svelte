<script>
  // One method as an input method: type its code, take a numbered candidate into the text.
  import { loadMethods, loadScheme } from '../lib/data.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { autofocus, choose, put } from '../lib/ui.svelte.js'
  import { backspace } from '../lib/text.svelte.js'
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import { fold } from '../../src/fold.js'

  /** @type {import('../lib/data.js').Method | undefined} */
  let method = $state()
  /** @type {import('../lib/data.js').SchemeRow[]} */
  let rows = $state([])
  let code = $state(route.q)
  let page = $state(0)
  const PER_PAGE = 9

  $effect(() => {
    const id = route.method
    loadMethods().then(list => { method = list.find(entry => entry.id === id) })
    rows = []
    loadScheme(id).then(table => { if (id === route.method) rows = table })
  })

  const query = $derived(fold(code))
  const matches = $derived(query
    ? rows.filter(row => row.folded.startsWith(query) || row.digits.startsWith(query)).slice(0, 400)
    : [])
  const candidates = $derived(matches.flatMap(row => row.chars.map(char => ({ char, code: row.code, exact: row.folded === query || row.digits === query }))))
  const shown = $derived(candidates.slice(page * PER_PAGE, (page + 1) * PER_PAGE))
  const pages = $derived(Math.max(1, Math.ceil(candidates.length / PER_PAGE)))

  $effect(() => { void query; page = 0 })

  /** @param {string} char */
  function take(char) {
    put(char)
    code = ''
    setQuery('')
  }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    const number = /^[1-9]$/.test(event.key) ? Number(event.key) - 1 : -1
    // A digit picks a candidate only where digits are not part of the codes being typed.
    if (number >= 0 && !digitCodes && shown[number]) { event.preventDefault(); take(shown[number].char); return }
    if (event.key === ' ' && shown[0]) { event.preventDefault(); take(shown[0].char); return }
    if (event.key === 'Enter' && shown[0]) { event.preventDefault(); take(shown[0].char); return }
    if (event.key === 'Backspace' && !code) { backspace(); return }
    if (event.key === 'PageDown' || event.key === '=') { event.preventDefault(); page = Math.min(pages - 1, page + 1); return }
    if (event.key === 'PageUp' || event.key === '-') { event.preventDefault(); page = Math.max(0, page - 1) }
  }

  const digitCodes = $derived(rows.length > 0 && /\d/.test(rows[Math.floor(rows.length / 2)]?.code ?? ''))
</script>

<div class="ui-page">
  {#if method}
    <header class="ui-page-head">
      <p class="ui-label">{t(`family.${method.family}`)}</p>
      <h1 class="ui-page-title">{nameOf(method.names)}</h1>
      <p class="ui-page-intro">{t('method.reach', { codes: method.codes.toLocaleString(), chars: method.chars.toLocaleString() })}{#if method.about} {method.about}{/if}</p>
    </header>
    <input class="ui-input box" data-primary lang="und-Hani" use:autofocus bind:value={code} oninput={() => setQuery(code)} onkeydown={keys}
      placeholder={method.keys ? t('method.keys', { keys: method.keys }) : t('method.type')} aria-label={t('method.type')}
      spellcheck="false" autocomplete="off" autocapitalize="off">
    {#if shown.length}
      <ol class="cands">
        {#each shown as item, i (item.char + item.code)}
          <li>
            <button class="cand" class:exact={item.exact} type="button" onclick={() => take(item.char)} oncontextmenu={event => { event.preventDefault(); choose(item.char) }} onmouseenter={() => choose(item.char)}>
              <span class="num">{i + 1}</span><span class="ch ui-script" lang="und-Hani">{item.char}</span><span class="cd ui-mono">{item.code}</span>
            </button>
          </li>
        {/each}
      </ol>
      <p class="ui-hint pager">
        <button class="ui-button" data-size="sm" type="button" disabled={page === 0} onclick={() => { page-- }}>−</button>
        {t('method.page', { page: page + 1, pages, total: candidates.length })}
        <button class="ui-button" data-size="sm" type="button" disabled={page >= pages - 1} onclick={() => { page++ }}>+</button>
      </p>
    {:else if query && rows.length}
      <p class="ui-hint">{t('method.none')}</p>
    {/if}
    <section class="ui-section source">
      <h2 class="ui-label">{t('method.source')}</h2>
      <p><a href={method.source.url} target="_blank" rel="noopener noreferrer">{method.source.name}</a>{#if method.source.attribution}, {method.source.attribution}{/if}</p>
      <p class="ui-hint">{t('method.licence')}: {method.source.licence}</p>
      {#if method.source.note}<p class="ui-hint">{method.source.note}</p>{/if}
    </section>
  {/if}
</div>

<style>
  .box{font-size:22px;block-size:52px}
  .cands{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--ui-space-2xs);margin:0;padding:0;list-style:none}
  .cand{display:grid;grid-template-columns:auto auto minmax(0,1fr);align-items:center;gap:var(--ui-space-xs);inline-size:100%;padding:var(--ui-space-2xs) var(--ui-space-sm);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface);color:var(--ui-color-ink);cursor:pointer;text-align:start}
  .cand:hover{background:var(--ui-color-surface-hover)}
  .cand.exact{border-color:var(--ui-color-accent)}
  .num{font-size:var(--ui-text-xs);color:var(--ui-color-ink-muted)}
  .ch{font-size:28px;line-height:1.2}
  .cd{font-size:var(--ui-text-xs);color:var(--ui-color-ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ui-font-mono),var(--ui-font-sans)}
  .pager{display:flex;align-items:center;gap:var(--ui-space-sm)}
  .source{margin-top:var(--ui-space-xl)}
</style>
