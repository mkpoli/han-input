<script>
  // The frame: the bar, the text being written, the finder of the page, and the card beside it (a
  // sheet over it on a phone).
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
  import Radicals from './pages/Radicals.svelte'
  import About from './pages/About.svelte'

  applyTheme()
  let settings = $state(false)

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
  <header class="top">
    <a class="mark" href="/" onclick={event => nav(event, '')} aria-label={t('app.home')}>
      <span class="badge ui-script" aria-hidden="true">字</span>
      <span class="name">{t('app.name')}</span>
    </a>
    <nav class="finders" aria-label={t('nav.label')}>
      {#each NAV as entry (entry.path)}
        <a href="/{entry.path}" class:on={route.page === entry.path || (entry.path === 'methods' && route.page === 'm')}
          aria-current={route.page === entry.path ? 'page' : undefined} onclick={event => nav(event, entry.path)}>{t(entry.label)}</a>
      {/each}
    </nav>
    <div class="settings">
      <button class="ui-button" data-variant="quiet" data-size="icon" type="button" aria-label={t('settings.label')} title={t('settings.label')}
        aria-expanded={settings} onclick={() => { settings = !settings }}>
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      </button>
      {#if settings}
        <div class="pop ui-popover" role="dialog" aria-label={t('settings.label')}><SettingsRows /></div>
      {/if}
    </div>
  </header>

  <Writing />

  <div class="body">
    <main class="finder">
      {#if route.page === ''}<Find />
      {:else if route.page === 'methods'}<Methods />
      {:else if route.page === 'm'}{#key route.method}<Method />{/key}
      {:else if route.page === 'radicals'}<Radicals />
      {:else}<About />{/if}
    </main>
    <aside class="card" class:open={ui.sheet} aria-label={t('card.label')}><Card /></aside>
  </div>

  <div class="toast" role="status" aria-live="polite">{#if toast.message}<span class="ui-toast">{toast.message}</span>{/if}</div>
</div>

<style>
  .shell{min-block-size:100dvh;display:flex;flex-direction:column}
  .top{position:sticky;top:0;z-index:var(--ui-z-chrome);display:flex;align-items:center;gap:var(--ui-space-xl);block-size:var(--topbar-h);padding-inline:var(--ui-space-2xl);background:var(--ui-color-surface);border-bottom:1px solid var(--ui-color-border)}
  .mark{display:flex;align-items:center;gap:var(--ui-space-sm);color:var(--ui-color-ink);text-decoration:none}
  .badge{display:grid;place-items:center;inline-size:30px;block-size:30px;border-radius:var(--ui-radius-sm);background:var(--ui-color-accent);color:var(--ui-color-on-accent);font-size:21px;line-height:1}
  .name{font-family:var(--ui-font-serif);font-size:17px;font-weight:var(--ui-weight-semibold);white-space:nowrap}
  .finders{align-self:stretch;display:flex;gap:2px;min-inline-size:0;overflow-x:auto;scrollbar-width:none}
  .finders a{position:relative;display:flex;align-items:center;padding:0 var(--ui-space-sm);color:var(--ui-color-ink-soft);text-decoration:none;font-size:var(--ui-text-sm);font-weight:var(--ui-weight-medium);white-space:nowrap}
  .finders a:hover{color:var(--ui-color-ink);background:var(--ui-color-surface-hover)}
  .finders a.on{color:var(--ui-color-ink);font-weight:var(--ui-weight-semibold)}
  .finders a.on::after{content:'';position:absolute;inset-inline:var(--ui-space-sm);bottom:0;block-size:2px;background:var(--ui-color-accent)}
  .settings{position:relative;margin-inline-start:auto}
  .pop{position:absolute;inset-inline-end:0;inset-block-start:calc(100% + var(--ui-space-sm));z-index:var(--ui-z-menu);inline-size:320px;padding:var(--ui-space-2xs) var(--ui-space-lg)}
  .body{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 420px;align-items:start}
  .finder{min-inline-size:0;padding:var(--ui-space-3xl) var(--ui-space-4xl) 72px}
  .card{position:sticky;top:var(--topbar-h);block-size:calc(100dvh - var(--topbar-h));overflow:auto;border-inline-start:1px solid var(--ui-color-border);background:var(--ui-color-surface);overscroll-behavior:contain}
  .toast{position:fixed;left:50%;bottom:var(--ui-space-3xl);transform:translateX(-50%);z-index:var(--ui-z-toast);pointer-events:none}
  @media (max-width:900px){
    .top{gap:var(--ui-space-sm);padding-inline:var(--ui-space-lg)}
    .name{display:none}
    .body{grid-template-columns:minmax(0,1fr)}
    .finder{padding:var(--ui-space-xl) var(--ui-space-lg) 48px}
    .card{position:fixed;inset:0;block-size:100dvh;z-index:var(--ui-z-modal);border:0;transform:translateY(100%);transition:transform var(--ui-duration) var(--ui-ease);visibility:hidden}
    .card.open{transform:none;visibility:visible}
  }
  @media (prefers-reduced-motion:reduce){.card{transition:none}}
</style>
