<script>
  // The 訓用字 rows of one character: each reading, the other characters the dictionary records
  // for the word, its first gloss, and a link to the entry.
  import { t } from '../lib/i18n.svelte.js'
  import { loadHun } from '../lib/hun.js'

  /** @type {{ char: string }} */
  let { char } = $props()
  let data = $state(/** @type {import('../lib/hun.js').Hun | null} */ (null))
  let failed = $state(false)
  let retry = $state(0)
  $effect(() => {
    void retry
    let active = true
    failed = false
    loadHun().then(loaded => { if (active) data = loaded }).catch(() => { if (active) failed = true })
    return () => { active = false }
  })
  const entry = $derived(data?.byChar.get(char) ?? null)
</script>

{#if failed}
  <p class="ui-hint">{t('hun.failed')} <button class="ui-button" data-size="sm" type="button" onclick={() => { retry++ }}>{t('hun.retry')}</button></p>
{:else if entry}
  <section class="family">
    <h3 class="ui-label">{t('hun.rows')} <span class="ui-count">{entry.rows.length}</span></h3>
    <ol class="rows">
      {#each entry.rows as row (row.id + row.reading)}
        <li>
          <div class="head">
            <span class="reading ui-mono">{row.reading}</span>
            {#if row.benzi.length}<span class="benzi">{t('hun.benzi')} <b>{row.benzi.join('、')}</b></span>{/if}
          </div>
          {#if row.gloss}<p class="def">{row.gloss}</p>{/if}
          {#if row.url}<a class="entry" href={row.url} target="_blank" rel="noopener noreferrer">{t('hun.entry')}</a>{/if}
        </li>
      {/each}
    </ol>
  </section>
{/if}

<style>
  .family{display:grid;gap:var(--ui-space-xs)}
  .rows{display:grid;gap:var(--ui-space-md);margin:0;padding:0;list-style:none}
  .rows li{display:grid;gap:4px;padding-block-start:var(--ui-space-md);border-block-start:1px solid var(--ui-color-border)}
  .rows li:first-child{padding-block-start:0;border:0}
  .head{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px}
  .reading{font-size:var(--ui-text-md);font-weight:var(--ui-weight-medium)}
  .benzi{font-size:var(--ui-text-sm);color:var(--ui-color-ink-soft)}
  .benzi b{font-weight:var(--ui-weight-medium);color:var(--ui-color-ink)}
  .def{margin:0;font-size:var(--ui-text-md);line-height:1.55}
  .entry{justify-self:start;font-size:var(--ui-text-sm)}
</style>
