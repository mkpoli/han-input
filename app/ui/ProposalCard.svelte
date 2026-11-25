<script>
  // One printed proposal record: the glyph as the document shows it, the source or serial code it is
  // named by, and where the document states it. Many of these characters were never encoded.
  import { ui, choose } from '../lib/ui.svelte.js'
  import { link } from '../lib/route.svelte.js'
  import { i18n, t } from '../lib/i18n.svelte.js'
  import SourceCode from './SourceCode.svelte'
  import RecordGlyph from './RecordGlyph.svelte'
  import { convertArithmetic } from '../../src/arithmetic.js'
  import { glyphIds, sourceOf } from '../lib/glyph-ids.js'
  import { isIdsSequence, matchRccByCode, matchRccByIdsList, rccEntryUrl, rccSearchUrl } from '../lib/rcc.js'

  const held = $derived(ui.record)
  const record = $derived(held?.record ?? null)
  const document = $derived(held?.document ?? null)
  const code = $derived(record ? record.source ?? record.serial ?? '' : '')
  /** @param {string | undefined} scalar */
  const charOf = scalar => scalar ? String.fromCodePoint(parseInt(scalar.slice(2), 16)) : ''
  const mapped = $derived(charOf(record?.mappedUnicode))
  const similar = $derived(charOf(record?.similarUnicode))
  // CBETA writes its formulas in the general arithmetic notation; one that does not parse shows alone.
  const ids = $derived(record?.composition ? convertArithmetic(record.composition, 'general').ids : '')
  const unified = $derived(record?.unifiedWith ?? '')
  const unifiedChar = $derived(unified.startsWith('U+') ? String.fromCodePoint(parseInt(unified.slice(2), 16)) : '')
  let reviewed = $state(/** @type {import('../lib/glyph-ids.js').GlyphIds | null} */ (null))
  $effect(() => {
    const key = record?.key
    reviewed = null
    glyphIds(key).then(found => { if (record?.key === key) reviewed = found })
  })
  const reviewedSource = $derived(reviewed?.verdict === 'known' ? sourceOf(reviewed.by) : null)
  const candidateIds = $derived([...new Set([reviewed?.ids, ids, record?.workbook?.ids, record?.workbook?.idsMachine].filter(/** @param {string | undefined} value @returns {value is string} */ value => !!value && isIdsSequence(value)))])
  const rccQuery = $derived(candidateIds[0] || mapped || code)
  /** @type {import('../lib/rcc.js').RccMatch[]} */
  let rccMatches = $state([])
  $effect(() => {
    const idsList = candidateIds
    const unicode = record?.mappedUnicode ?? ''
    rccMatches = []
    if (!idsList.length && !unicode) return
    let active = true
    const controller = new AbortController()
    Promise.all([
      idsList.length ? matchRccByIdsList(idsList, { signal: controller.signal }) : Promise.resolve([]),
      unicode ? matchRccByCode(unicode, { signal: controller.signal }) : Promise.resolve([]),
    ]).then(([byIds, byCode]) => {
      if (!active) return
      /** @type {Map<number, import('../lib/rcc.js').RccMatch>} */
      const merged = new Map()
      for (const item of [...byIds, ...byCode]) if (!merged.has(item.id)) merged.set(item.id, item)
      rccMatches = [...merged.values()].sort((a, b) => a.id - b.id)
    })
    return () => { active = false; controller.abort() }
  })

  /** @param {MouseEvent} event @param {string} char */
  function follow(event, char) {
    event.preventDefault()
    ;(/** @type {HTMLElement} */ (event.currentTarget)).closest('dialog')?.querySelector('button')?.focus()
    choose(char)
  }
</script>

{#if record && document}
  <article class="record">
    <header class="head">
      <div class="glyph">
        {#if record.sprite || record.atlas || record.glyph}<RecordGlyph {record} />{:else}<span class="ui-mono">{code}</span>{/if}
      </div>
      <div class="facts">
        <p class="name"><SourceCode code={code} /></p>
        <p class="ui-hint">{document.title} · {document.source}</p>
        <a href={record.page || document.url.endsWith('.pdf') ? `${document.url}#page=${record.page ?? 1}` : document.url} target="_blank" rel="noopener noreferrer">{document.document}{record.page ? ` · ${t('proposal.page', { page: record.page })}` : ''}</a>
      </div>
    </header>
    {#if record.status}<p class="ui-hint">{record.status}</p>{/if}
    {#if unified}
      <p class="unified"><span class="ui-hint">{t('proposal.unifiedWith')}</span>
        {#if unifiedChar}
          <a href={link('', { c: unifiedChar })} lang="und-Hani" onclick={event => follow(event, unifiedChar)}>{unifiedChar}</a>
        {/if}
        <span class="ui-mono ui-hint">{unified}</span>
      </p>
    {/if}
    {#if mapped}
      <p class="mapped"><a href={link('', { c: mapped })} lang="und-Hani" onclick={event => follow(event, mapped)}>{mapped}</a> <span class="ui-mono ui-hint">{record.mappedUnicode}</span></p>
    {/if}
    {#if similar}
      <p class="related"><span class="ui-hint">{t('proposal.similar')}</span>
        <a href={link('', { c: similar })} lang="und-Hani" onclick={event => { event.preventDefault(); choose(similar) }}>{similar}</a>
        <span class="ui-mono ui-hint">{record.similarUnicode}</span>
      </p>
    {/if}
    {#if record.common}
      <p class="related"><span class="ui-hint">{t('proposal.common')}</span>
        <a href={link('', { c: record.common })} lang="und-Hani" onclick={event => { event.preventDefault(); if (record.common) choose(record.common) }}>{record.common}</a>
      </p>
    {/if}
    {#if reviewed}
      <p class="related"><span class="ui-hint">{reviewed.verdict === 'known' ? 'IDS' : t('proposal.reviewed')}</span> <span class="formula" lang="und-Hani">{reviewed.ids}</span>
        {#if reviewedSource}<a class="source" href={reviewedSource.url} target="_blank" rel="noopener noreferrer">{reviewedSource.name}</a>{/if}
      </p>
    {/if}
    {#if record.composition}
      <p class="related"><span class="ui-hint">{t('proposal.composition')}</span> <span class="formula" lang="und-Hani">{record.composition}</span></p>
      {#if ids}<p class="related"><span class="ui-hint">IDS</span> <span class="formula" lang="und-Hani">{ids}</span></p>{/if}
    {/if}
    {#if record.workbook}
      {@const notes = record.workbook}
      <section class="workbook">
        <h3 class="ui-label">{document.workbook ?? ''}</h3>
        {#if notes.radical || notes.strokes || notes.zhuyin}
          <dl class="notes">
            {#if notes.radical}<div><dt class="ui-hint">{t('proposal.radical')}</dt><dd lang="und-Hani">{notes.radical}</dd></div>{/if}
            {#if notes.strokes}<div><dt class="ui-hint">{t('proposal.strokes')}</dt><dd>{notes.strokes}</dd></div>{/if}
            {#if notes.zhuyin}<div><dt class="ui-hint">{t('proposal.zhuyin')}</dt><dd lang="zh-Bopo">{notes.zhuyin.join(' ')}</dd></div>{/if}
          </dl>
        {/if}
        {#if notes.ids && notes.ids !== ids}<p class="related"><span class="ui-hint">IDS</span> <span class="formula" lang="und-Hani">{notes.ids}</span></p>{/if}
        {#if notes.idsMachine && notes.idsMachine !== ids && notes.idsMachine !== notes.ids}<p class="related"><span class="ui-hint">{t('proposal.idsMachine')}</span> <span class="formula" lang="und-Hani">{notes.idsMachine}</span></p>{/if}
        {#if notes.proposed}
          <p class="related"><span class="ui-hint">{t('proposal.proposed')}</span>
            <a href={link('', { c: notes.proposed })} lang="und-Hani" onclick={event => { event.preventDefault(); if (notes.proposed) choose(notes.proposed) }}>{notes.proposed}</a>
          </p>
        {/if}
      </section>
    {/if}
    {#if rccMatches.length}
      <section class="rcc">
        <h3 class="ui-label">{t('rcc.name')} <span class="ui-count">{rccMatches.length}</span></h3>
        <div class="rcc-links">
          {#each rccMatches as match (match.id)}
            <a class="rcc-link" href={rccEntryUrl(match.id, i18n.locale)} target="_blank" rel="noopener noreferrer" title={t('rcc.entryLabel', { code: match.code })}>
              <span class="ui-mono">{match.code}</span>
              {#if match.ids}<span class="rcc-ids" lang="und-Hani">{match.ids}</span>{/if}
              <span aria-hidden="true">↗</span>
            </a>
          {/each}
        </div>
      </section>
    {/if}
    {#if record.moeVariant || rccQuery}
      <div class="links">
        {#if record.moeVariant}
          <a href={`https://dict.variants.moe.edu.tw/search.jsp?ID=7&WORD=${encodeURIComponent(record.moeVariant)}&WORD=`} target="_blank" rel="noopener noreferrer">{t('proposal.moeVariant')} <span class="ui-mono">{record.moeVariant}</span></a>
        {/if}
        {#if rccQuery}
          <a href={rccSearchUrl(rccQuery, i18n.locale)} target="_blank" rel="noopener noreferrer">{t('rcc.search')} <span aria-hidden="true">↗</span></a>
        {/if}
      </div>
    {/if}
    {#if record.evidenceUrls?.length}
      <div class="links">
        {#each record.evidenceUrls as url (url)}<a href={url} target="_blank" rel="noopener noreferrer">{url.replace(/^https:\/\/www\.unicode\.org\/irg\/docs\//, '').replace(/^https:\/\/zi\.tools\//, 'zi.tools/')}</a>{/each}
      </div>
    {/if}
  </article>
{/if}

<style>
  .record{display:grid;gap:var(--ui-space-lg);padding:var(--ui-space-xl)}
  .head{display:flex;gap:var(--ui-space-lg);align-items:flex-start}
  .glyph{flex:none;display:grid;place-items:center;inline-size:112px;block-size:112px;padding:4px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md);background:var(--ui-color-canvas)}
  .facts{display:grid;gap:var(--ui-space-2xs);min-inline-size:0}
  .name{margin:0;font-size:var(--ui-text-sm);overflow-wrap:anywhere}
  .facts a{color:var(--ui-color-accent-ink);font-size:var(--ui-text-sm);overflow-wrap:anywhere}
  .mapped,.unified,.related{margin:0}
  .workbook{display:grid;gap:var(--ui-space-sm);padding-block-start:var(--ui-space-sm);border-block-start:1px solid var(--ui-color-border)}
  .workbook h3{margin:0}
  .notes{display:flex;flex-wrap:wrap;gap:var(--ui-space-xs) var(--ui-space-lg);margin:0}
  .notes div{display:flex;gap:var(--ui-space-sm);align-items:baseline}
  .notes dd{margin:0}
  .related{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--ui-space-sm)}
  .related a{font-size:24px;line-height:1;color:var(--ui-color-ink);text-decoration:none}
  .related a.source{font-size:var(--ui-text-xs);color:var(--ui-color-accent-ink);text-decoration:underline}
  .related .formula{font-family:var(--ui-font-script);font-size:var(--ui-text-lg);overflow-wrap:anywhere}
  .unified a{font-size:24px;line-height:1;color:var(--ui-color-ink);text-decoration:none}
  .mapped a{font-size:56px;line-height:1;color:var(--ui-color-ink);text-decoration:none}
  .links{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs)}
  .links a{padding:2px var(--ui-space-sm);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);font-size:var(--ui-text-xs);color:var(--ui-color-ink);text-decoration:none;overflow-wrap:anywhere}
  .links a:hover{background:var(--ui-color-surface-hover)}
  .rcc{display:grid;gap:var(--ui-space-xs)}
  .rcc h3{margin:0}
  .rcc-links{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs)}
  .rcc-link{display:inline-flex;align-items:baseline;gap:var(--ui-space-2xs);padding:2px var(--ui-space-sm);border:1px solid var(--ui-color-accent);border-radius:var(--ui-radius-sm);background:var(--ui-color-accent-soft);color:var(--ui-color-accent-ink);font-size:var(--ui-text-xs);text-decoration:none;white-space:nowrap}
  .rcc-link:hover{background:color-mix(in srgb,var(--ui-color-accent) 18%,transparent)}
  .rcc-ids{font-family:var(--ui-font-script);font-size:var(--ui-text-sm)}
</style>
