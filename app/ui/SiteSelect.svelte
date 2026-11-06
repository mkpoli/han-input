<script>
  // The logo as a select: the input sites, and a line to the wider set of writing-system projects.
  import { tick } from 'svelte'
  import { i18n, t } from '../lib/i18n.svelte.js'

  /** @type {{ home: (event: MouseEvent) => unknown, children: import('svelte').Snippet }} */
  let { home, children } = $props()

  const uid = $props.id()
  const SITES = [
    { id: 'tangut', href: 'https://tangut.mkpo.li/', logo: '/sites/tangut.svg', name: 'Tangut Input' },
    { id: 'jurchen', href: 'https://jurchen.mkpo.li/', logo: '/sites/jurchen.svg', name: 'Jurchen Input' },
    { id: 'ids', href: 'https://ids.mkpo.li/', logo: '/sites/ids.svg', name: 'IDS Workshop' },
    { id: 'han', href: '/', logo: '/favicon.svg', name: 'Han Input' },
  ]
  const more = $derived(`https://scripts.mkpo.li/${i18n.locale === 'en' ? '' : `${i18n.locale}/`}`)

  let open = $state(false)
  /** @type {HTMLDivElement | null} */
  let root = $state(null)
  /** @type {HTMLButtonElement | null} */
  let trigger = $state(null)
  const items = () => /** @type {HTMLElement[]} */ ([...(root?.querySelectorAll('[role="menuitem"]') ?? [])])

  async function show() {
    open = true
    await tick()
    ;/** @type {HTMLElement | null | undefined} */ (root?.querySelector('[aria-current]'))?.focus()
  }

  /** @param {boolean} [restore] */
  function hide(restore = false) {
    open = false
    if (restore) trigger?.focus()
  }

  /** @param {KeyboardEvent} event */
  function triggerKeys(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      show()
    }
  }

  // The menu's keys stay in it, so the page's shortcuts do not act behind it.
  /** @param {KeyboardEvent} event */
  function menuKeys(event) {
    event.stopPropagation()
    const list = items()
    const at = list.indexOf(/** @type {HTMLElement} */ (document.activeElement))
    if (event.key === 'Escape') {
      event.preventDefault()
      hide(true)
    } else if (event.key === 'Tab') {
      hide(true)
    } else if (event.key === ' ') {
      event.preventDefault()
      list[at]?.click()
    } else {
      const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: list.length - 1 }[event.key]
      if (to === undefined) return
      event.preventDefault()
      list[(to + list.length) % list.length].focus()
    }
  }

  $effect(() => {
    if (!open) return
    const away = (/** @type {PointerEvent} */ event) => {
      if (root && !event.composedPath().includes(root)) hide()
    }
    addEventListener('pointerdown', away, true)
    return () => removeEventListener('pointerdown', away, true)
  })
</script>

<div class="site-select" bind:this={root}>
  <button class="site-trigger" type="button" bind:this={trigger}
    aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `sites-${uid}` : undefined} aria-label={t('app.sites')}
    onclick={() => (open ? hide() : show())} onkeydown={triggerKeys}>
    {@render children()}
    <svg class="chevron" class:up={open} viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  {#if open}
    <div class="ui-menu site-menu" id={`sites-${uid}`} role="menu" tabindex="-1" aria-label={t('app.sites')} onkeydown={menuKeys}>
      {#each SITES as site (site.id)}
        {@const current = site.id === 'han'}
        <a class="ui-menu-item site-item" role="menuitem" tabindex="-1" href={site.href}
          aria-current={current ? 'page' : undefined}
          onclick={event => { if (current) home(event); hide() }}>
          <img src={site.logo} alt="" width="28" height="28" />
          <span class="site-name">{site.name}</span>
          {#if current}
            <svg class="check" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="m3 8.5 3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {/if}
        </a>
      {/each}
      <hr class="ui-menu-separator" />
      <a class="ui-menu-item site-item site-more" role="menuitem" tabindex="-1" href={more} onclick={() => hide()}>
        <span class="site-name">{t('app.sites.more')}</span>
        <span class="out" aria-hidden="true">↗</span>
      </a>
    </div>
  {/if}
</div>

<style>
  /* The menu anchors to the positioned element that holds the select, so it opens beside the rail. */
  .site-trigger{display:flex;flex-direction:column;align-items:center;gap:var(--ui-space-2xs);padding:0;border:0;background:none;color:var(--p-rail-soft);font:inherit;cursor:pointer}
  .site-trigger:hover{color:var(--p-rail-ink)}
  .chevron{flex:none;transition:transform var(--ui-duration) var(--ui-ease)}
  .chevron.up{transform:rotate(180deg)}
  .site-menu{position:absolute;inset-block-start:0;inset-inline-start:calc(100% + var(--ui-space-sm));z-index:var(--ui-z-menu);inline-size:248px;max-inline-size:calc(100vw - 2 * var(--ui-space-lg));color:var(--ui-color-ink)}
  .site-item{align-items:center;gap:var(--ui-space-md);padding:var(--ui-space-sm)}
  .site-item img{flex:none;border-radius:6px}
  .site-name{flex:1;min-inline-size:0;font-weight:var(--ui-weight-medium)}
  .check{flex:none;color:var(--ui-color-accent-ink)}
  .site-more{justify-content:space-between;padding-inline:var(--ui-space-md);color:var(--ui-color-ink-soft)}
  .site-more .site-name{font-weight:var(--ui-weight-normal)}
  .out{color:var(--ui-color-ink-muted)}
  @media (prefers-reduced-motion:reduce){.chevron{transition:none}}
</style>
