<script>
  // Page navigation for a grid too large to show at once: first, previous, a window of page numbers,
  // next, last, and a jump field. The parent owns the page and loads it before it changes.
  import { t } from '../lib/i18n.svelte.js'

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
  function go(next) {
    if (disabled || next < 1 || next > pages || next === page) return
    onchange(next)
  }

  function jumpTo() {
    const wanted = Number.parseInt(jump, 10)
    jump = ''
    if (Number.isFinite(wanted)) go(Math.min(pages, Math.max(1, wanted)))
  }
</script>

<nav class="pager" aria-label={t('pager.label')}>
  <div class="buttons">
    <button class="ui-button" data-size="sm" data-page="first" type="button" aria-label={t('pager.first')} title={t('pager.first')} disabled={disabled || page === 1} onclick={() => go(1)}>«</button>
    <button class="ui-button" data-size="sm" data-page="prev" type="button" aria-label={t('pager.previous')} title={t('pager.previous')} disabled={disabled || page === 1} onclick={() => go(page - 1)}>‹</button>
    {#each steps as step, at (step === 'gap' ? `gap-${at}` : step)}
      {#if step === 'gap'}
        <span class="gap" aria-hidden="true">…</span>
      {:else}
        <button class="ui-button" data-size="sm" data-page={String(step)} type="button" aria-current={step === page ? 'page' : undefined} disabled={disabled} onclick={() => go(step)}>{step}</button>
      {/if}
    {/each}
    <button class="ui-button" data-size="sm" data-page="next" type="button" aria-label={t('pager.next')} title={t('pager.next')} disabled={disabled || page === pages} onclick={() => go(page + 1)}>›</button>
    <button class="ui-button" data-size="sm" data-page="last" type="button" aria-label={t('pager.last')} title={t('pager.last')} disabled={disabled || page === pages} onclick={() => go(pages)}>»</button>
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
  .buttons button{min-inline-size:32px;padding-inline:var(--ui-space-xs);font-variant-numeric:tabular-nums}
  .buttons button[aria-current='page']{border-color:var(--ui-color-accent-ink);color:var(--ui-color-accent-ink);font-weight:var(--ui-weight-semibold)}
  .gap{padding-inline:2px;color:var(--ui-color-ink-muted)}
  .summary{font-variant-numeric:tabular-nums}
  .jump{display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .jump label{display:flex;align-items:center;gap:var(--ui-space-2xs)}
  .jump input{inline-size:5em;block-size:32px;padding-inline:var(--ui-space-xs);font-variant-numeric:tabular-nums}
</style>
