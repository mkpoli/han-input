<script>
  // Page navigation for a grid too large to show at once: first, previous, a window of page numbers,
  // next, last, and a jump field. With an `href` maker every step is a link to its address; without
  // one the steps are buttons and the page stays local to the grid. The parent loads the page.
  import { t } from '../lib/i18n.svelte.js'

  /** @type {{ page: number, pages: number, disabled?: boolean, href?: ((page: number) => string) | null, onchange: (page: number) => void }} */
  let { page, pages, disabled = false, href = null, onchange } = $props()
  let jump = $state('')

  // First and last always stay; two numbers either side of the current page fill the window.
  const steps = $derived.by(() => {
    const shown = new Set([1, pages])
    for (let at = page - 2; at <= page + 2; at++) if (at > 1 && at < pages) shown.add(at)
    /** @type {(number | 'gap')[]} */
    const out = []
    let previous = 0
    for (const number of [...shown].sort((a, b) => a - b)) {
      if (number - previous > 1) out.push('gap')
      out.push(number)
      previous = number
    }
    return out
  })

  /** @param {number} next */
  const available = next => !disabled && next >= 1 && next <= pages
  /** @param {number} next */
  const turnable = next => available(next) && next !== page

  /** A link keeps the browser's own behaviour under Ctrl, Command, Shift or Alt; a plain click turns in place.
   * @param {MouseEvent} event @param {number} next */
  function follow(event, next) {
    if (!available(next) || next === page) { event.preventDefault(); return }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onchange(next)
  }

  /** @param {number} next */
  function take(next) { if (turnable(next)) onchange(next) }

  function jumpTo() {
    const wanted = Number.parseInt(jump, 10)
    jump = ''
    if (Number.isFinite(wanted)) take(Math.min(pages, Math.max(1, wanted)))
  }
</script>

{#if pages > 1}
<nav class="pager" aria-label={t('pager.label')}>
  <div class="buttons">
    {#if href}
      <a class="ui-button" data-size="sm" data-page="first" aria-label={t('pager.first')} title={t('pager.first')} aria-disabled={turnable(1) ? undefined : 'true'} href={turnable(1) ? href(1) : undefined} onclick={event => follow(event, 1)}>«</a>
      <a class="ui-button" data-size="sm" data-page="prev" aria-label={t('pager.previous')} title={t('pager.previous')} aria-disabled={turnable(page - 1) ? undefined : 'true'} href={turnable(page - 1) ? href(page - 1) : undefined} onclick={event => follow(event, page - 1)}>‹</a>
      {#each steps as step, at (step === 'gap' ? `gap-${at}` : step)}
        {#if step === 'gap'}
          <span class="gap" aria-hidden="true">…</span>
        {:else}
          <a class="ui-button" data-size="sm" data-page={String(step)} aria-current={step === page ? 'page' : undefined} aria-disabled={available(step) ? undefined : 'true'} href={available(step) ? href(step) : undefined} onclick={event => follow(event, step)}>{step}</a>
        {/if}
      {/each}
      <a class="ui-button" data-size="sm" data-page="next" aria-label={t('pager.next')} title={t('pager.next')} aria-disabled={turnable(page + 1) ? undefined : 'true'} href={turnable(page + 1) ? href(page + 1) : undefined} onclick={event => follow(event, page + 1)}>›</a>
      <a class="ui-button" data-size="sm" data-page="last" aria-label={t('pager.last')} title={t('pager.last')} aria-disabled={turnable(pages) ? undefined : 'true'} href={turnable(pages) ? href(pages) : undefined} onclick={event => follow(event, pages)}>»</a>
    {:else}
      <button class="ui-button" data-size="sm" data-page="first" type="button" aria-label={t('pager.first')} title={t('pager.first')} disabled={!turnable(1)} onclick={() => take(1)}>«</button>
      <button class="ui-button" data-size="sm" data-page="prev" type="button" aria-label={t('pager.previous')} title={t('pager.previous')} disabled={!turnable(page - 1)} onclick={() => take(page - 1)}>‹</button>
      {#each steps as step, at (step === 'gap' ? `gap-${at}` : step)}
        {#if step === 'gap'}
          <span class="gap" aria-hidden="true">…</span>
        {:else}
          <button class="ui-button" data-size="sm" data-page={String(step)} type="button" aria-current={step === page ? 'page' : undefined} disabled={!turnable(step)} onclick={() => take(step)}>{step}</button>
        {/if}
      {/each}
      <button class="ui-button" data-size="sm" data-page="next" type="button" aria-label={t('pager.next')} title={t('pager.next')} disabled={!turnable(page + 1)} onclick={() => take(page + 1)}>›</button>
      <button class="ui-button" data-size="sm" data-page="last" type="button" aria-label={t('pager.last')} title={t('pager.last')} disabled={!turnable(pages)} onclick={() => take(pages)}>»</button>
    {/if}
  </div>
  <span class="summary">{t('pager.summary', { page, pages })}</span>
  <form class="jump" onsubmit={event => { event.preventDefault(); jumpTo() }}>
    <label>{t('pager.jump')} <input class="ui-input" type="text" inputmode="numeric" pattern="[0-9]*" bind:value={jump} disabled={disabled} /></label>
    <button class="ui-button" data-size="sm" type="submit" disabled={disabled}>{t('pager.go')}</button>
  </form>
</nav>
{/if}

<style>
  .pager{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-xs) var(--ui-space-sm);margin-block:var(--ui-space-sm)}
  .buttons{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-2xs)}
  .buttons :is(a,button){min-inline-size:32px;padding-inline:var(--ui-space-xs);font-variant-numeric:tabular-nums}
  .buttons [aria-current='page']{border-color:var(--ui-color-accent-ink);color:var(--ui-color-accent-ink);font-weight:var(--ui-weight-semibold)}
  .gap{padding-inline:2px;color:var(--ui-color-ink-muted)}
  .summary{font-variant-numeric:tabular-nums}
  .jump{display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .jump label{display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .jump input{inline-size:5em;block-size:32px;padding-inline:var(--ui-space-xs);font-variant-numeric:tabular-nums}
</style>
