<script>
  // The characters that a character's variants name, each with the relation and the sources that state it.
  import { link, route } from '../lib/route.svelte.js'
  import { t } from '../lib/i18n.svelte.js'

  /** @type {{ rows: import('../../src/variants.js').CharacterVariant[], labels: Record<string, string>, pick: (char: string, from: HTMLElement) => void }} */
  let { rows, labels, pick } = $props()

  /** @param {MouseEvent} event @param {string} char */
  function follow(event, char) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    pick(char, /** @type {HTMLElement} */ (event.currentTarget))
  }
</script>

<dl class="variants">
  {#each rows as row (row.char + row.relation)}
    <div class="row">
      <dt><a class="variant-char" href={link(route.page, { method: route.method, c: row.char })} lang="und-Hani" onclick={event => follow(event, row.char)}>{row.char}</a></dt>
      <dd>{t(`variant.relation.${row.relation}`)} · {row.sources.map(id => labels[id] ?? id).join(' · ')}</dd>
    </div>
  {/each}
</dl>

<style>
  .variants{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr));column-gap:var(--ui-space-md);margin:0}
  .row{display:grid;grid-template-columns:2.2rem minmax(0,1fr);gap:var(--ui-space-sm);align-items:baseline;padding-block:3px;border-bottom:1px solid var(--ui-color-border)}
  dt{min-inline-size:0}
  dt a{color:var(--ui-color-ink);text-decoration:none}
  dt a:hover{text-decoration:underline}
  dd{margin:0;font-size:var(--ui-text-xs);color:var(--ui-color-ink-soft);overflow-wrap:anywhere}
  .variant-char{font-family:var(--ui-font-script);font-size:22px;line-height:1.2}
</style>
