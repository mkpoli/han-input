<script>
  // Renders an RCC character as a glyph: its Unicode character when encoded, otherwise a serif SVG
  // composed live from its IDS via han-compose, falling back to its attestation photo or IDS text.
  import { onMount } from 'svelte'
  import { composeGlyph } from '../lib/compose.js'
  import { rccMediaUrl } from '../lib/rcc-data.js'

  /** @type {{ ids?: string | null, mappedChar?: string, coverKey?: string | null, size?: 'sm' | 'tile' | 'card' }} */
  let { ids = null, mappedChar = '', coverKey = null, size = 'tile' } = $props()

  const uid = $props.id()
  /** @type {HTMLElement | null} */
  let host = $state(null)
  let visible = $state(false)
  let composed = $state.raw(/** @type {{ of: string, drawn: import('../lib/compose.js').ComposedGlyph | null } | null} */ (null))
  let coverFailed = $state(false)

  const clean = $derived(ids ? ids.normalize('NFC').replace(/\s+/gu, '') : '')
  const drawn = $derived(composed?.of === clean ? composed.drawn : null)
  const coverUrl = $derived(rccMediaUrl(coverKey))

  $effect(() => {
    void coverUrl
    coverFailed = false
  })

  onMount(() => {
    if (!host || typeof IntersectionObserver === 'undefined') {
      visible = true
      return
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        visible = true
        observer.disconnect()
      }
    }, { rootMargin: '400px' })
    observer.observe(host)
    return () => observer.disconnect()
  })

  $effect(() => {
    const seq = clean
    if (mappedChar || !visible || !seq) return
    if (composed?.of === seq) return
    let active = true
    const controller = new AbortController()
    composeGlyph(seq, { signal: controller.signal }).then(result => {
      if (active) composed = { of: seq, drawn: result }
    })
    return () => { active = false; controller.abort() }
  })
</script>

<span class="rcc-glyph" data-size={size} bind:this={host}>
  {#if mappedChar}
    <span class="mapped ui-script" lang="und-Hani">{mappedChar}</span>
  {:else if drawn}
    <svg class="composed" viewBox="0 0 1000 1000" aria-hidden="true">
      {#if drawn.cut}
        <defs>
          <mask id={`rcc-cut-${uid}`}>
            <rect x="0" y="0" width="1000" height="1000" fill="#fff" />
            <path d={drawn.cut} fill="#000" />
          </mask>
        </defs>
        <path d={drawn.d} fill="currentColor" mask={`url(#rcc-cut-${uid})`} />
      {:else}
        <path d={drawn.d} fill="currentColor" />
      {/if}
    </svg>
  {:else if coverUrl && !coverFailed}
    <img class="cover" src={coverUrl} alt="" loading="lazy" decoding="async" onerror={() => { coverFailed = true }} />
  {:else if ids}
    <span class="ids-fallback ui-script" lang="und-Hani">{ids}</span>
  {/if}
</span>

<style>
  .rcc-glyph{display:grid;place-items:center;inline-size:100%;block-size:100%;min-inline-size:0;min-block-size:0;overflow:hidden;color:var(--ui-color-ink)}
  .mapped{font-family:var(--ui-font-script);font-size:40px;line-height:1}
  .rcc-glyph[data-size='sm'] .mapped{font-size:28px}
  .rcc-glyph[data-size='card'] .mapped{font-size:80px}
  .composed{display:block;inline-size:84%;block-size:84%;max-inline-size:100%;max-block-size:100%}
  .rcc-glyph[data-size='card'] .composed{inline-size:90%;block-size:90%}
  .cover{display:block;inline-size:100%;block-size:100%;max-inline-size:100%;max-block-size:100%;object-fit:contain;border-radius:3px}
  .ids-fallback{font-family:var(--ui-font-script);font-size:var(--ui-text-xs);line-height:1.2;text-align:center;overflow-wrap:anywhere;padding:2px;color:var(--ui-color-ink-soft)}
  .rcc-glyph[data-size='card'] .ids-fallback{font-size:var(--ui-text-lg)}
</style>
