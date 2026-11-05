<script>
  // What a character is called: its code in every method, then the sites that say more. Definitions
  // live with those sites, so the card carries one line of gloss and no entry.
  import { codesOf, loadMethods } from '../lib/data.js'
  import { LINKS } from '../lib/links.js'
  import { link, route, go } from '../lib/route.svelte.js'
  import { put, ui } from '../lib/ui.svelte.js'
  import { copy } from '../lib/clip.svelte.js'
  import { nameOf, t } from '../lib/i18n.svelte.js'
  import { FAMILIES } from '../lib/families.js'

  const char = $derived(route.c)
  const cp = $derived(char ? `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}` : '')
  /** @type {Map<string, string[]>} */
  let codes = $state(new Map())
  /** @type {import('../lib/data.js').Method[]} */
  let methods = $state([])

  loadMethods().then(list => { methods = list })
  $effect(() => {
    const at = char
    if (!at) return
    codesOf(at).then(found => { if (at === char) codes = found })
  })

  const gloss = $derived(codes.get(':gloss')?.join(' ') ?? '')
  const families = $derived(FAMILIES.map(family => ({
    family,
    rows: methods.filter(method => method.family === family && codes.has(method.id)).map(method => ({ method, codes: codes.get(method.id) ?? [] })),
  })).filter(group => group.rows.length))
</script>

{#if ui.sheet}
  <div class="back"><button class="ui-button" data-variant="quiet" data-size="sm" type="button" onclick={() => { ui.sheet = false }}>{t('card.back')}</button></div>
{/if}

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

    <section class="more">
      <h3 class="ui-label">{t('card.more')}</h3>
      <div class="links">
        {#each LINKS as site (site.key)}
          <a href={site.url(char)} target="_blank" rel="noopener noreferrer" class:first={site.key === 'zitools'}>{site.name}</a>
        {/each}
      </div>
    </section>

    {#each families as group (group.family)}
      <section class="family">
        <h3 class="ui-label">{t(`family.${group.family}`)}</h3>
        <dl>
          {#each group.rows as row (row.method.id)}
            <div class="row">
              <dt><a href={link('m', { method: row.method.id, c: char })} onclick={event => { event.preventDefault(); go('m', row.method.id) }}>{nameOf(row.method.names)}</a></dt>
              <dd class="ui-mono">{row.codes.join(' · ')}</dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
  </article>
{/if}

<style>
  .back{padding:var(--ui-space-sm)}
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
  dl{display:grid;margin:0}
  .row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--ui-space-sm);padding-block:3px;border-bottom:1px solid var(--ui-color-border)}
  dt{font-size:var(--ui-text-xs);min-inline-size:0}
  dt a{color:var(--ui-color-ink-soft);text-decoration:none}
  dt a:hover{color:var(--ui-color-ink);text-decoration:underline}
  dd{margin:0;font-size:var(--ui-text-xs);overflow-wrap:anywhere;font-family:var(--ui-font-mono),var(--ui-font-sans),'Jigmo','Jigmo2','Jigmo3'}
</style>
