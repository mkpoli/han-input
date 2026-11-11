<script>
  // What a character is called: its code in every method, then the sites that say more. Definitions
  // live with those sites, so the card carries one line of gloss and no entry.
  import { tick } from 'svelte'
  import { codesOf, descriptionsOf, loadMethods, loadVariants, loadVarieties, readingsOf } from '../lib/data.js'
  import { readingTree } from '../lib/classification.js'
  import { LINKS } from '../lib/links.js'
  import { link, route, go, open } from '../lib/route.svelte.js'
  import { put, ui } from '../lib/ui.svelte.js'
  import { copy } from '../lib/clip.svelte.js'
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import { FAMILIES } from '../lib/families.js'
  import SourceCode from './SourceCode.svelte'
  import { isHan } from '../../src/fold.js'
  import { codePoints, puaOf } from '../../src/pua.js'
  import { characterVariants } from '../../src/variants.js'
  import { pieces } from '../lib/notation.js'

  const char = $derived(route.c)
  // A member may be a jamo sequence: GB 12052 spells archaic Hangul with two or three code points.
  const cp = $derived(char ? codePoints(char) : '')
  const puaRows = $derived(char ? puaOf(char) : [])
  /** @param {string} code */
  const puaText = code => String.fromCodePoint(parseInt(code.slice(2), 16))

  /** @param {MouseEvent} event @param {string} to */
  function follow(event, to) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    ;(/** @type {HTMLElement} */ (event.currentTarget)).closest('dialog')?.querySelector('button')?.focus()
    open(to)
  }
  /** @param {MouseEvent} event @param {string} page @param {string} method */
  async function visit(event, page, method) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    const dialog = /** @type {HTMLElement} */ (event.currentTarget).closest('dialog')
    if (dialog) { dialog.close(); ui.sheet = false }
    go(page, method)
    if (dialog) {
      await tick()
      const main = /** @type {HTMLElement | null} */ (document.querySelector('main'))
      if (main) { main.tabIndex = -1; main.focus() }
    }
  }
  /** @type {Map<string, string[]>} */
  let codes = $state(new Map())
  /** @type {import('../lib/data.js').Method[]} */
  let methods = $state([])

  /** @type {import('../lib/data.js').Variety[]} */
  let varieties = $state([])
  /** @type {{ n: number, forms: string[] }[]} */
  let readings = $state([])
  /** @type {import('../lib/data.js').Description[]} */
  let writings = $state([])
  /** @type {import('../../src/variants.js').CharacterVariant[]} */
  let variants = $state([])
  /** @type {import('../lib/notation.js').Components} */
  let components = $state({ numbers: {}, entities: {} })
  let filter = $state('')

  loadMethods().then(list => { methods = list })
  // The card is empty on most page loads, and the variety list is a megabyte; it waits for a
  // character to open.
  fetch('/data/ids-components.json').then(response => response.ok ? response.json() : { numbers: {}, entities: {} })
    .then(doc => { components = doc }).catch(() => {})
  $effect(() => {
    const at = char
    if (!at) return
    loadVarieties().then(list => { if (at === char) varieties = list })
    codesOf(at).then(found => { if (at === char) codes = found })
    readingsOf(at).then(found => { if (at === char) readings = found })
    descriptionsOf(at).then(found => { if (at === char) writings = found })
    loadVariants().then(found => { if (at === char) variants = characterVariants(at, found) }).catch(() => {})
  })

  const needle = $derived(filter.trim().toLowerCase())
  const tree = $derived(readingTree(varieties, readings, needle, t('card.unclassed')))

  /** A mark's hover text, from the message it names. @param {import('../lib/notation.js').Piece} piece */
  const titleOf = piece => {
    if (!piece.title) return undefined
    const params = piece.title[1]
    switch (piece.title[0]) {
      case 'card.number': return t('card.number', params)
      case 'card.numberUnknown': return t('card.numberUnknown', params)
      case 'card.unnamed': return t('card.unnamed', params)
      case 'card.entity': return t('card.entity', params)
      case 'card.entityNumber': return t('card.entityNumber', params)
      default: return undefined
    }
  }

  const gloss = $derived(codes.get(':gloss')?.join(' ') ?? '')
  const families = $derived(FAMILIES.map(family => ({
    family,
    rows: methods.filter(method => method.family === family && codes.has(method.id)).map(method => ({ method, codes: codes.get(method.id) ?? [] })),
  })).filter(group => group.rows.length))
</script>

{#snippet draw(/** @type {import('../lib/notation.js').Piece[]} */ list)}
  {#each list as piece}
    {#if piece.children}
      <span class="mark" title={titleOf(piece)}>{@render draw(piece.children)}</span>
    {:else if piece.kind === 'plain'}
      {piece.text}
    {:else}
      <span class="mark" class:pua={piece.pua} title={titleOf(piece)}>{piece.text}</span>
    {/if}
  {/each}
{/snippet}

{#if !char}
  <div class="blank">
    <p class="blank-glyph ui-script" aria-hidden="true">字</p>
    <p>{t('card.blank')}</p>
  </div>
{:else}
  <article class="record">
    <header class="head">
      <div class="glyph ui-script" lang="und-Hani">{char}</div>
      <div class="facts">
        <button class="cp ui-mono" type="button" title={t('card.copyCodePoint')} onclick={() => copy(cp)}>{cp}</button>
        {#if gloss}<p class="gloss">{gloss}</p>{/if}
        <div class="acts">
          <button class="ui-button" data-variant="primary" data-size="sm" type="button" onclick={() => put(char)}>{t('card.add')}</button>
          <button class="ui-button" data-size="sm" type="button" onclick={() => copy(char)}>{t('common.copy')}</button>
        </div>
      </div>
    </header>

    {#if puaRows.length}
      <section class="family">
        <h3 class="ui-label">{t('pua.title')} <span class="ui-count">{puaRows.length}</span></h3>
        <dl class="pua">
          {#each puaRows as row (row.code + row.char + row.relation)}
            <div class="row">
              <dt class="ui-mono"><a class="code" href={`/convert?q=${encodeURIComponent(puaText(row.code))}&s=${row.source}`}>{row.code}</a></dt>
              <dd>
                {#if row.relation === 'own'}
                  {row.char}
                {:else}
                  <a href={link(route.page, { method: route.method, c: row.char })} lang="und-Hani" onclick={event => follow(event, row.char)}>{row.char}</a> · {t(`pua.relation.${row.relation}`)}
                {/if}
                <span class="tags"><span class="tag">{t(`pua.source.${row.source}`)}</span>{#if row.relationSource}<span class="tag">{t(`pua.source.${row.relationSource}`)}</span>{/if}</span>
              </dd>
            </div>
          {/each}
        </dl>
      </section>
    {/if}

    {#if variants.length}
      <section class="family">
        <h3 class="ui-label">{t('card.variants')} <span class="ui-count">{variants.length}</span></h3>
        <dl>
          {#each variants as row (row.char + row.relation)}
            <div class="row">
              <dt><a class="variant-char" href={link(route.page, { method: route.method, c: row.char })} lang="und-Hani" onclick={event => follow(event, row.char)}>{row.char}</a></dt>
              <dd>{t(`variant.relation.${row.relation}`)} · {t(`variant.source.${row.source}`)}</dd>
            </div>
          {/each}
        </dl>
      </section>
    {/if}

    {#if writings.length}
      <section class="family">
        <h3 class="ui-label">{t('card.writing')} <span class="ui-count">{writings.length}</span></h3>
        <dl class="writing">
          {#each writings as row (row.notation + row.regions)}
            <div class="row">
              <dt class="seq" lang="und-Hani">{@render draw(pieces(row.notation, components))}</dt>
              <dd>
                {#if row.regions}<span class="regions" title={t('card.regions', { regions: row.regions })}>{row.regions}</span>{/if}
                <span class="tags">{#each row.sources as source (source)}<span class="tag">{t(`ids.source.${source}`)}</span>{/each}</span>
              </dd>
            </div>
          {/each}
        </dl>
      </section>
    {/if}

    <section class="more">
      <h3 class="ui-label">{t('card.more')}</h3>
      <div class="links">
        {#each LINKS.filter(site => site.every || isHan(char)) as site (site.key)}
          <a href={site.url(char)} target="_blank" rel="noopener noreferrer" class:first={site.key === 'zitools'}>{site.name}</a>
        {/each}
      </div>
    </section>

    {#if readings.length}
      <section class="family">
        <h3 class="ui-label">{t('card.readings', { count: readings.length })}</h3>
        <input class="ui-input" type="search" bind:value={filter} placeholder={t('card.readingsFilter')} aria-label={t('card.readingsFilter')}>
        {#snippet branch(/** @type {import('../lib/classification.js').ReadingNode} */ node)}
          <details class="branch" open={needle !== ''}>
            <summary><span>{node.name}</span> <span class="ui-count">{node.count}</span></summary>
            {#if node.rows.length}
              <dl class="rows">
                {#each node.rows as row (row.n)}
                  <div class="row">
                    <dt><a href={link('v', { method: String(row.n), c: char })} onclick={event => visit(event, 'v', String(row.n))}>{row.name}</a></dt>
                    <dd class="ui-mono">{row.forms.join(' · ')}</dd>
                  </div>
                {/each}
              </dl>
            {/if}
            {#each node.children as child (child.path)}
              {@render branch(child)}
            {/each}
          </details>
        {/snippet}
        {#each tree as node (node.path)}
          {@render branch(node)}
        {/each}
      </section>
    {/if}

    {#each families as group (group.family)}
      <section class="family">
        <h3 class="ui-label">{t(`family.${group.family}`)}</h3>
        <dl>
          {#each group.rows as row (row.method.id)}
            <div class="row">
              <dt><a href={link('m', { method: row.method.id, c: char })} onclick={event => visit(event, 'm', row.method.id)}>{nameOf(row.method.names)}</a></dt>
              <dd class="ui-mono">
                {#if row.method.id === 'irg-g'}
                  {#each row.codes as code, i (code)}
                    {#if i}<span class="sep" aria-hidden="true"> · </span>{/if}
                    <SourceCode {code} />
                  {/each}
                {:else}
                  {row.codes.join(' · ')}
                {/if}
              </dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
  </article>
{/if}

<style>
  .blank{display:grid;gap:var(--ui-space-sm);padding:var(--ui-space-4xl) var(--ui-space-2xl);text-align:center;color:var(--ui-color-ink-soft)}
  .blank-glyph{font-size:72px;line-height:1;color:var(--ui-color-border-strong)}
  .record{display:grid;gap:var(--ui-space-xl);padding:var(--ui-space-xl)}
  .head{display:flex;gap:var(--ui-space-lg);align-items:flex-start}
  .glyph{flex:none;inline-size:112px;block-size:112px;display:grid;place-items:center;font-size:84px;line-height:1;background:var(--ui-color-canvas);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-md)}
  .facts{display:grid;gap:var(--ui-space-xs);min-inline-size:0}
  .cp{justify-self:start;padding:0;border:0;background:none;color:var(--ui-color-ink-soft);cursor:pointer;font-size:var(--ui-text-sm)}
  .gloss{font-size:var(--ui-text-sm);line-height:var(--ui-leading-normal,1.5);color:var(--ui-color-ink)}
  .acts{display:flex;gap:var(--ui-space-2xs);flex-wrap:wrap}
  .more,.family{display:grid;gap:var(--ui-space-xs)}
  .links{display:flex;flex-wrap:wrap;gap:var(--ui-space-2xs)}
  .links a{padding:2px var(--ui-space-sm);border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);font-size:var(--ui-text-xs);color:var(--ui-color-ink);text-decoration:none;white-space:nowrap}
  .links a:hover{background:var(--ui-color-surface-hover)}
  .links a.first{background:var(--ui-color-accent);border-color:var(--ui-color-accent);color:var(--ui-color-on-accent)}
  .branch summary{cursor:pointer;padding-block:3px;font-size:var(--ui-text-sm);border-bottom:1px solid var(--ui-color-border)}
  .branch .branch{margin-inline-start:var(--ui-space-sm);padding-inline-start:var(--ui-space-2xs);border-inline-start:1px solid var(--ui-color-border)}
  .rows{margin-inline-start:var(--ui-space-sm)}
  dl{display:grid;margin:0}
  .row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--ui-space-sm);padding-block:3px;border-bottom:1px solid var(--ui-color-border)}
  dt{font-size:var(--ui-text-xs);min-inline-size:0}
  dt a{color:var(--ui-color-ink-soft);text-decoration:none}
  dt a:hover{color:var(--ui-color-ink);text-decoration:underline}
  dd{margin:0;font-size:var(--ui-text-xs);overflow-wrap:anywhere;font-family:'Han Ext',var(--ui-font-mono),var(--ui-font-sans),'Jigmo'}
  .pua .row{grid-template-columns:max-content minmax(0,1fr);gap:var(--ui-space-sm)}
  .writing .row{grid-template-columns:max-content minmax(0,1fr);gap:var(--ui-space-sm);align-items:baseline}
  .variant-char{font-family:var(--ui-font-script);font-size:20px;line-height:1.2}
  .writing .seq{font-size:18px;line-height:1.3;overflow-wrap:anywhere;font-family:var(--ui-font-script)}
  .writing .mark{text-decoration:underline dotted;text-underline-offset:2px;text-decoration-color:var(--ui-color-accent);color:var(--ui-color-accent);cursor:help}
  .writing .pua{font-family:'IDS Numbered','Han Ext',serif}
  .regions{margin-inline-end:4px;padding:0 4px;border-radius:2px;font-size:10px;letter-spacing:.08em;color:var(--ui-color-ink-soft);background:var(--ui-color-canvas);cursor:help}
  .code{color:inherit;text-decoration:none}
  .code:hover{text-decoration:underline}
  .tags{display:inline-flex;gap:3px;margin-inline-start:6px;vertical-align:1px}
  .tag{padding:0 4px;border:1px solid var(--ui-color-border);border-radius:2px;font-size:10px;line-height:15px;color:var(--ui-color-ink-soft);white-space:nowrap}
</style>
