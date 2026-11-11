<script>
  // The frame: a dark rail of pages down the side, the finder in the middle, the card of the open
  // character on the right (a sheet on a phone), and the text being written docked along the bottom.
  import { onMount, tick } from 'svelte'
  import { NAV, go, route } from './lib/route.svelte.js'
  import { pageMetadata } from './lib/title.js'
  import { applySeo } from './lib/seo.js'
  import { ui, applyTheme, closeRecord } from './lib/ui.svelte.js'
  import { toast } from './lib/clip.svelte.js'
  import { t } from './lib/i18n.svelte.js'
  import Writing from './ui/Writing.svelte'
  import SettingsRows from './ui/SettingsRows.svelte'
  import Card from './ui/Card.svelte'
  import ProposalCard from './ui/ProposalCard.svelte'
  import SiteSelect from './ui/SiteSelect.svelte'
  import Find from './pages/Find.svelte'
  import Methods from './pages/Methods.svelte'
  import Method from './pages/Method.svelte'
  import Readings from './pages/Readings.svelte'
  import Rhymes from './pages/Rhymes.svelte'
  import Radicals from './pages/Radicals.svelte'
  import About from './pages/About.svelte'
  import Convert from './pages/Convert.svelte'
  import NotFound from './pages/NotFound.svelte'
  import Composition from './pages/Composition.svelte'

  applyTheme()
  let settings = $state(false)
  let mobile = $state(matchMedia('(max-width: 900px)').matches)
  /** @type {HTMLDialogElement} */
  let sheet
  /** @type {HTMLElement} */
  let card
  /** @type {HTMLElement} */
  let shell
  let sheetHeaderHeight = $state(0)
  let sheetStatusHeight = $state(0)
  /** @type {number | null} */
  let savedScroll = null
  /** @type {HTMLElement | null} */
  let resumeFocus = null

  onMount(() => {
    const media = matchMedia('(max-width: 900px)')
    const resize = () => {
      const next = media.matches
      const scroll = savedScroll ?? card.scrollTop
      if (next) {
        const active = document.activeElement
        if (active instanceof HTMLElement && card.contains(active)) {
          resumeFocus = active
          const main = document.querySelector('main')
          if (main) { main.tabIndex = -1; main.focus() }
          ui.sheet = true
        }
        savedScroll = scroll
        sheet.append(card)
      } else {
        if (sheet.open) sheet.close()
        shell.insertBefore(card, sheet)
        savedScroll = scroll
        ui.sheet = false
        void tick().then(() => {
          if (!media.matches) { card.scrollTop = scroll; savedScroll = null }
        })
      }
      mobile = next
    }
    if (media.matches) resize()
    media.addEventListener('change', resize)
    return () => {
      media.removeEventListener('change', resize)
      if (sheet.open) sheet.close()
      if (card.parentElement !== shell && sheet.parentElement === shell) shell.insertBefore(card, sheet)
      ui.sheet = false
    }
  })

  $effect(() => {
    if (!mobile) return
    if (ui.sheet && !sheet.open) {
      sheet.showModal()
      if (savedScroll !== null) { card.scrollTop = savedScroll; savedScroll = null }
      if (resumeFocus?.isConnected) resumeFocus.focus({ preventScroll: true })
      resumeFocus = null
    } else if (!ui.sheet && sheet.open) {
      savedScroll = card.scrollTop
      sheet.close()
    }
  })

  function keepFocusVisible() {
    if (!sheet.open || !mobile) return
    const active = document.activeElement
    if (!(active instanceof HTMLElement) || !card.contains(active) || active.closest('.back')) return
    const bounds = active.getBoundingClientRect()
    const view = card.getBoundingClientRect()
    if (bounds.top < view.top + sheetHeaderHeight) card.scrollTop -= view.top + sheetHeaderHeight - bounds.top + 4
    else if (bounds.bottom > view.bottom - sheetStatusHeight) card.scrollTop += bounds.bottom - (view.bottom - sheetStatusHeight) + 4
  }

  $effect(() => {
    void sheetHeaderHeight
    void sheetStatusHeight
    if (mobile && ui.sheet) void tick().then(keepFocusVisible)
  })

  function dismissSheet() {
    if (ui.record && !route.c) closeRecord()
    else ui.sheet = false
  }

  $effect(() => {
    void route.method
    const { title, description } = pageMetadata(route.page)
    const name = t('app.name')
    applySeo(route.page, location.pathname, {
      title: route.page === '' ? `${name} — ${t(title)}` : `${t(title)} — ${name}`,
      description: t(description),
    })
  })
  const OWNER = /** @type {Record<string, string>} */ ({ m: 'methods', v: 'readings' })
  const current = $derived(OWNER[route.page] ?? route.page)

  /** @param {MouseEvent} event @param {string} page */
  function nav(event, page) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    go(page)
  }

  /** @param {KeyboardEvent} event */
  function keys(event) {
    const target = /** @type {HTMLElement} */ (event.target)
    if (event.key === '/' && !ui.sheet && !target.closest('input, textarea, [contenteditable]')) {
      const input = /** @type {HTMLElement | null} */ (document.querySelector('[data-primary]'))
      if (input) { event.preventDefault(); input.focus() }
    }
    if (event.key === 'Escape') settings = false
  }
</script>

<svelte:window onkeydown={keys} />

<div class="shell" bind:this={shell}>
  <nav class="rail" aria-label={t('nav.label')}>
    <div class="site">
      <SiteSelect home={event => nav(event, '')}><span class="seal ui-script" aria-hidden="true">字</span></SiteSelect>
    </div>
    <div class="pages">
      {#each NAV as entry (entry.path)}
        <a href="/{entry.path}" class:on={current === entry.path} aria-current={current === entry.path ? 'page' : undefined} onclick={event => nav(event, entry.path)}>{t(entry.label)}</a>
      {/each}
    </div>
    <div class="settings">
      <button class="gear" type="button" aria-label={t('settings.label')} title={t('settings.label')} aria-expanded={settings} onclick={() => { settings = !settings }}>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      </button>
      {#if settings}<div class="pop ui-popover" role="dialog" aria-label={t('settings.label')}><SettingsRows /></div>{/if}
    </div>
  </nav>

  <main class="finder">
    {#if route.page === ''}<Find />
    {:else if route.page === 'methods'}<Methods />
    {:else if route.page === 'm' || route.page === 'v'}{#key route.page + route.method}<Method />{/key}
    {:else if route.page === 'readings'}<Readings />
    {:else if route.page === 'rhymes'}<Rhymes />
    {:else if route.page === 'radicals'}<Radicals />
    {:else if route.page === 'convert'}<Convert />
    {:else if route.page === 'notfound'}<NotFound />
    {:else if route.page === 'composition'}<Composition />
    {:else}<About />{/if}
  </main>

  <aside class="card" class:in-sheet={mobile} bind:this={card} onfocusin={() => requestAnimationFrame(keepFocusVisible)} style:scroll-padding-block-start={mobile ? `calc(${sheetHeaderHeight}px + 4px)` : undefined} style:scroll-padding-block-end={mobile ? `calc(${sheetStatusHeight}px + 4px)` : undefined} style:padding-block-end={mobile ? `${sheetStatusHeight}px` : undefined} aria-label={t('card.label')}>
    {#if mobile}
      <div class="back" bind:clientHeight={sheetHeaderHeight}>
        <button class="ui-button" data-variant="quiet" data-size="sm" type="button" onclick={dismissSheet}>{t('card.back')}</button>
        <div class="sheet-status ui-hint ui-glyph-text" class:show={ui.sheet && !!toast.message} bind:clientHeight={sheetStatusHeight} role="status" aria-live="polite">{#if ui.sheet}{#key toast.id}{toast.message}{/key}{/if}</div>
      </div>
    {/if}
    {#if ui.record && !route.c}<ProposalCard />{:else}<Card />{/if}
  </aside>
  <dialog class="sheet" bind:this={sheet} aria-label={t('card.label')} oncancel={event => { event.preventDefault(); dismissSheet() }}></dialog>

  <div class="dock"><Writing /></div>

  <div class="toast" role="status" aria-live="polite">{#if toast.message && !ui.sheet}{#key toast.id}<span class="ui-toast">{toast.message}</span>{/key}{/if}</div>
</div>

<style>
  .shell{--rail-w:104px;--card-w:440px;--dock-h:56px;display:grid;grid-template-columns:var(--rail-w) minmax(0,1fr) var(--card-w);grid-template-rows:minmax(0,1fr) var(--dock-h);block-size:100dvh}
  .rail{grid-row:1 / span 2;display:flex;flex-direction:column;align-items:stretch;background:var(--p-rail);color:var(--p-rail-ink);padding-block:var(--ui-space-lg)}
  .site{position:relative;display:flex;justify-content:center}
  .seal{display:grid;place-items:center;inline-size:48px;block-size:48px;border-radius:2px;background:var(--p-seal);color:#fff8f2;font-size:34px;line-height:1;text-decoration:none}
  .pages{display:flex;flex-direction:column;gap:2px;margin-block-start:var(--ui-space-2xl)}
  .pages a{padding:var(--ui-space-sm) var(--ui-space-sm);color:var(--p-rail-soft);text-decoration:none;font-size:var(--ui-text-sm);text-align:center;border-inline-start:3px solid transparent;line-height:1.25}
  .pages a:hover{color:var(--p-rail-ink);background:color-mix(in srgb,var(--p-rail-active) 55%,transparent)}
  .pages a.on{color:#fff;background:var(--p-rail-active);border-inline-start-color:var(--p-seal);font-weight:var(--ui-weight-semibold)}
  .settings{position:relative;margin-block-start:auto;align-self:center}
  .gear{display:grid;place-items:center;inline-size:40px;block-size:40px;border:0;border-radius:var(--ui-radius-sm);background:none;color:var(--p-rail-soft);cursor:pointer}
  .gear:hover{color:var(--p-rail-ink);background:var(--p-rail-active)}
  .pop{position:absolute;inset-inline-start:calc(100% + var(--ui-space-sm));inset-block-end:0;z-index:var(--ui-z-menu);inline-size:320px;padding:var(--ui-space-2xs) var(--ui-space-lg);color:var(--ui-color-ink)}
  .finder{grid-column:2;grid-row:1;min-inline-size:0;overflow:auto;padding:var(--ui-space-3xl) clamp(var(--ui-space-xl),4vw,72px) var(--ui-space-3xl)}
  .card{grid-column:3;grid-row:1;overflow:auto;background:var(--ui-color-surface);border-inline-start:1px solid var(--ui-color-border);overscroll-behavior:contain}
  .back{position:sticky;top:0;z-index:1;padding:var(--ui-space-sm);background:var(--ui-color-surface)}
  .sheet-status{position:fixed;inset-block-end:0;inset-inline:0;overflow-wrap:anywhere;background:var(--ui-color-surface)}
  .sheet-status.show{padding:var(--ui-space-sm) var(--ui-space-lg)}
  .card.in-sheet{grid-column:auto;block-size:100%;border:0}
  .sheet{position:fixed;inset:0;inline-size:100%;block-size:100%;max-inline-size:none;max-block-size:none;margin:0;padding:0;border:0;overflow:hidden}
  .sheet::backdrop{overflow:hidden;overscroll-behavior:contain}
  .dock{grid-column:2 / span 2;grid-row:2;min-inline-size:0}
  .toast{position:fixed;left:50%;bottom:calc(var(--dock-h) + var(--ui-space-lg));transform:translateX(-50%);z-index:var(--ui-z-toast);pointer-events:none}
  @media (max-width:1200px){.shell{--card-w:360px;--rail-w:88px}}
  @media (max-width:900px){
    .shell{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) var(--dock-h) auto}
    .rail{grid-column:1;grid-row:3;flex-direction:row;align-items:center;padding:var(--ui-space-2xs) var(--ui-space-xs) calc(var(--ui-space-2xs) + env(safe-area-inset-bottom));min-inline-size:0}
    .site{display:none}
    .pages{flex-direction:row;flex:1;margin:0;overflow-x:auto;scrollbar-width:none}
    .pages a{flex:none;padding:var(--ui-space-xs) var(--ui-space-sm);border-inline-start:0;border-block-end:2px solid transparent;white-space:nowrap}
    .pages a.on{border-block-end-color:var(--p-seal)}
    .settings{margin:0}
    .pop{inset-inline-start:auto;inset-inline-end:0;inset-block-end:calc(100% + var(--ui-space-sm));inline-size:min(320px,calc(100vw - 32px))}
    .finder{grid-column:1;padding:var(--ui-space-xl) var(--ui-space-lg)}
    .dock{grid-column:1;grid-row:2}
  }
</style>
