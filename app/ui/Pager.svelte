<script>
  // Page navigation for a grid too large to show at once: first, previous, a window of page numbers,
  // next, last, and a jump field. Every step is a link to its address, so a page opens in a new tab
  // or copies as a URL; a plain click turns the page in place. The parent loads the page's face.
  import { t } from '../lib/i18n.svelte.js'
  import { pageHref } from '../lib/route.svelte.js'

  /** @type {{ page: number, pages: number, disabled?: boolean, onchange: (page: number) => void }} */
  let { page, pages, disabled = false, onchange } = $props()
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
  /** @param {number} next */
  const available = next => !disabled && next >= 1 && next <= pages
  /** @param {number} next */
  const turnable = next => available(next) && next !== page

  /** @param {MouseEvent} event @param {number} next */
  function follow(event, next) {
    if (!available(next) || next === page) { event.preventDefault(); return }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onchange(next)
  }

  function jumpTo() {
    const wanted = Number.parseInt(jump, 10)
    jump = ''
    if (Number.isFinite(wanted)) {
      const next = Math.min(pages, Math.max(1, wanted))
      if (turnable(next)) onchange(next)
    }
  }
</script>

<nav class="pager" aria-label={t('pager.label')}>
  <div class="buttons">
    <a class="ui-button" data-size="sm" data-page="first" aria-label={t('pager.first')} title={t('pager.first')} aria-disabled={turnable(1) ? undefined : 'true'} href={turnable(1) ? pageHref(1) : undefined} onclick={event => follow(event, 1)}>«</a>
    <a class="ui-button" data-size="sm" data-page="prev" aria-label={t('pager.previous')} title={t('pager.previous')} aria-disabled={turnable(page - 1) ? undefined : 'true'} href={turnable(page - 1) ? pageHref(page - 1) : undefined} onclick={event => follow(event, page - 1)}>‹</a>
    {#each steps as step, at (step === 'gap' ? `gap-${at}` : step)}
      {#if step === 'gap'}
        <span class="gap" aria-hidden="true">…</span>
      {:else}
        <a class="ui-button" data-size="sm" data-page={String(step)} aria-current={step === page ? 'page' : undefined} aria-disabled={available(step) ? undefined : 'true'} href={available(step) ? pageHref(step) : undefined} onclick={event => follow(event, step)}>{step}</a>
      {/if}
    {/each}
    <a class="ui-button" data-size="sm" data-page="next" aria-label={t('pager.next')} title={t('pager.next')} aria-disabled={turnable(page + 1) ? undefined : 'true'} href={turnable(page + 1) ? pageHref(page + 1) : undefined} onclick={event => follow(event, page + 1)}>›</a>
    <a class="ui-button" data-size="sm" data-page="last" aria-label={t('pager.last')} title={t('pager.last')} aria-disabled={turnable(pages) ? undefined : 'true'} href={turnable(pages) ? pageHref(pages) : undefined} onclick={event => follow(event, pages)}>»</a>
  </div>
  <span class="summary">{t('pager.summary', { page, pages })}</span>
  <form class="jump" onsubmit={event => { event.preventDefault(); jumpTo() }}>
    <label>{t('pager.jump')} <input class="ui-input" type="text" inputmode="numeric" pattern="[0-9]*" bind:value={jump} disabled={disabled} /></label>
    <button class="ui-button" data-size="sm" type="submit" disabled={disabled}>{t('pager.go')}</button>
  </form>
</nav>

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
