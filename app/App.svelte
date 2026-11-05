<script>
  // The frame: a dark rail of pages down the side, the finder in the middle, the card of the open
  // character on the right (a sheet on a phone), and the text being written docked along the bottom.
  import { NAV, go, route } from './lib/route.svelte.js'
  import { ui, applyTheme } from './lib/ui.svelte.js'
  import { toast } from './lib/clip.svelte.js'
  import { t } from './lib/i18n.svelte.js'
  import Writing from './ui/Writing.svelte'
  import SettingsRows from './ui/SettingsRows.svelte'
  import Card from './ui/Card.svelte'
  import Find from './pages/Find.svelte'
  import Methods from './pages/Methods.svelte'
  import Method from './pages/Method.svelte'
  import Readings from './pages/Readings.svelte'
  import Rhymes from './pages/Rhymes.svelte'
  import Radicals from './pages/Radicals.svelte'
  import About from './pages/About.svelte'

  applyTheme()
  let settings = $state(false)
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
    if (event.key === '/' && !target.closest('input, textarea, [contenteditable]')) {
      const input = /** @type {HTMLElement | null} */ (document.querySelector('[data-primary]'))
      if (input) { event.preventDefault(); input.focus() }
    }
    if (event.key === 'Escape') { ui.sheet = false; settings = false }
  }
</script>

<svelte:window onkeydown={keys} />

<div class="shell">
  <nav class="rail" aria-label={t('nav.label')}>
    <a class="seal ui-script" href="/" aria-label={t('app.home')} onclick={event => nav(event, '')}>字</a>
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
    {:else}<About />{/if}
  </main>

  <aside class="card" class:open={ui.sheet} aria-label={t('card.label')}><Card /></aside>

  <div class="dock"><Writing /></div>

  <div class="toast" role="status" aria-live="polite">{#if toast.message}<span class="ui-toast">{toast.message}</span>{/if}</div>
</div>

<style>
  .shell{--rail-w:104px;--card-w:440px;--dock-h:56px;display:grid;grid-template-columns:var(--rail-w) minmax(0,1fr) var(--card-w);grid-template-rows:minmax(0,1fr) var(--dock-h);block-size:100dvh}
  .rail{grid-row:1 / span 2;display:flex;flex-direction:column;align-items:stretch;background:var(--p-rail);color:var(--p-rail-ink);padding-block:var(--ui-space-lg)}
  .seal{align-self:center;display:grid;place-items:center;inline-size:48px;block-size:48px;border-radius:2px;background:var(--p-seal);color:#fff8f2;font-size:34px;line-height:1;text-decoration:none}
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
  .dock{grid-column:2 / span 2;grid-row:2;min-inline-size:0}
  .toast{position:fixed;left:50%;bottom:calc(var(--dock-h) + var(--ui-space-lg));transform:translateX(-50%);z-index:var(--ui-z-toast);pointer-events:none}
  @media (max-width:1200px){.shell{--card-w:360px;--rail-w:88px}}
  @media (max-width:900px){
    .shell{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) var(--dock-h) auto}
    .rail{grid-column:1;grid-row:3;flex-direction:row;align-items:center;padding:var(--ui-space-2xs) var(--ui-space-xs) calc(var(--ui-space-2xs) + env(safe-area-inset-bottom));min-inline-size:0}
    .seal{display:none}
    .pages{flex-direction:row;flex:1;margin:0;overflow-x:auto;scrollbar-width:none}
    .pages a{flex:none;padding:var(--ui-space-xs) var(--ui-space-sm);border-inline-start:0;border-block-end:2px solid transparent;white-space:nowrap}
    .pages a.on{border-block-end-color:var(--p-seal)}
    .settings{margin:0}
    .pop{inset-inline-start:auto;inset-inline-end:0;inset-block-end:calc(100% + var(--ui-space-sm));inline-size:min(320px,calc(100vw - 32px))}
    .finder{grid-column:1;padding:var(--ui-space-xl) var(--ui-space-lg)}
    .dock{grid-column:1;grid-row:2}
    .card{position:fixed;inset:0;grid-column:auto;z-index:var(--ui-z-modal);border:0;transform:translateY(100%);transition:transform var(--ui-duration) var(--ui-ease);visibility:hidden}
    .card.open{transform:none;visibility:visible}
  }
  @media (prefers-reduced-motion:reduce){.card{transition:none}}
</style>
