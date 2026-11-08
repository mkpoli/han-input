<script module>
  let uid = 0
</script>

<script>
  // One G-source code: the code stays text, the source name opens a note on hover, focus or tap.
  import { tick } from 'svelte'
  import { i18n, nameOf } from '../lib/i18n.svelte.js'
  import { gSourceOf, noteOf } from '../lib/sources.js'

  /** @type {{ code: string, showName?: boolean }} */
  let { code, showName = true } = $props()
  const id = `g-source-${++uid}`
  const source = $derived(gSourceOf(code))
  const name = $derived(source ? nameOf(source.names) : '')
  const note = $derived(source ? noteOf(source, i18n.locale) : '')

  /** @type {HTMLSpanElement | null} */
  let wrap = $state(null)
  /** @type {HTMLButtonElement | null} */
  let trigger = $state(null)
  /** @type {HTMLSpanElement | null} */
  let tip = $state(null)
  let open = $state(false)
  let ready = $state(false)
  let left = $state(0)
  let top = $state(0)
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let leaveTimer

  function place() {
    if (!trigger || !tip) return
    const margin = 8
    const rect = trigger.getBoundingClientRect()
    const width = tip.offsetWidth
    const height = tip.offsetHeight
    left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin)
    const below = rect.bottom + 6
    // Keep clear of the writing dock along the bottom of the shell.
    top = below + height > window.innerHeight - 72 ? Math.max(margin, rect.top - height - 6) : below
  }

  async function show() {
    if (!source || open) return
    open = true
    ready = false
    await tick()
    place()
    ready = true
  }

  function hide() {
    open = false
    ready = false
  }

  function enter() {
    if (!matchMedia('(hover: hover)').matches) return
    clearTimeout(leaveTimer)
    show()
  }

  function leave() {
    if (!matchMedia('(hover: hover)').matches) return
    clearTimeout(leaveTimer)
    leaveTimer = setTimeout(hide, 120)
  }

  /** @param {KeyboardEvent} event */
  function escape(event) {
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    hide()
    trigger?.focus()
  }

  $effect(() => {
    if (!open) return
    /** @param {PointerEvent} event */
    const outside = event => {
      if (!wrap || !(event.target instanceof Node) || wrap.contains(event.target)) return
      hide()
    }
    /** @param {KeyboardEvent} event */
    const key = event => {
      if (event.key === 'Escape') hide()
    }
    const follow = () => {
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) { hide(); return }
      place()
    }
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('keydown', key)
    window.addEventListener('scroll', follow, true)
    window.addEventListener('resize', follow)
    return () => {
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('keydown', key)
      window.removeEventListener('scroll', follow, true)
      window.removeEventListener('resize', follow)
    }
  })

  $effect(() => () => clearTimeout(leaveTimer))
</script>

<span class="source-code" bind:this={wrap}>
  <code class="code" title={source ? [name, note].filter(Boolean).join(' — ') : undefined}>{code}</code>
  {#if source}
    <span class="ui-visually-hidden" id={`${id}-desc`}>{name}{#if note}. {note}{/if}</span>
  {/if}
  {#if source && showName}
    <button class="trigger" type="button" bind:this={trigger}
      aria-describedby={`${id}-desc`}
      onclick={show} onmouseenter={enter} onmouseleave={leave} onfocus={show} onblur={hide} onkeydown={escape}>{name}</button>
  {/if}
  {#if open && source}
    <span class="tip" id={`${id}-tip`} role="tooltip" bind:this={tip}
      style:left="{left}px" style:top="{top}px" style:visibility={ready ? 'visible' : 'hidden'}>
      <span class="tip-head"><code class="tip-code">{code}</code> <strong>{name}</strong></span>
      {#if note}<span class="tip-note">{note}</span>{/if}
    </span>
  {/if}
</span>

<style>
  .source-code{display:inline-flex;align-items:baseline;gap:var(--ui-space-2xs);flex-wrap:wrap;min-inline-size:0}
  .code{font-family:var(--ui-font-mono);overflow-wrap:anywhere}
  .trigger{padding:0;border:0;background:none;font:inherit;font-family:var(--ui-font-sans);color:var(--ui-color-accent-ink);cursor:help;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px}
  .trigger:hover{color:var(--ui-color-accent-hover)}
  .trigger:focus-visible{outline:2px solid var(--ui-color-focus);outline-offset:2px;border-radius:2px}
  .tip{position:fixed;z-index:var(--ui-z-hint);display:block;inline-size:min(300px,calc(100vw - 16px));padding:var(--ui-space-sm) var(--ui-space-md);border:1px solid var(--ui-color-border-strong);border-radius:var(--ui-radius-md);background:var(--ui-color-surface);color:var(--ui-color-ink);box-shadow:var(--ui-shadow-2);font-size:var(--ui-text-sm);line-height:1.45;text-align:start}
  .tip-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:var(--ui-space-2xs)}
  .tip-head strong{font-weight:var(--ui-weight-semibold)}
  .tip-code{font-family:var(--ui-font-mono);font-size:var(--ui-text-xs);color:var(--ui-color-ink-muted)}
  .tip-note{display:block;margin-block-start:var(--ui-space-2xs);color:var(--ui-color-ink-soft)}
</style>
