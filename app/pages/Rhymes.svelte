<script>
  // The Guangyun as a table: one rhyme at a time, initials across, grade and tone down.
  import { loadRhymes } from '../lib/data.js'
  import { route, setQuery } from '../lib/route.svelte.js'
  import { choose } from '../lib/ui.svelte.js'
  import { t } from '../lib/i18n.svelte.js'

  const INITIALS = [...'幫滂並明端透定泥來知徹澄孃精清從心邪莊初崇生俟章昌常書船見溪羣疑影曉匣云以日']
  const TONES = [...'平上去入']
  /** @type {import('../lib/data.js').RhymeRow[]} */
  let rows = $state([])
  loadRhymes().then(list => { rows = list })

  const rhymes = $derived([...new Set(rows.map(row => row.韻))])
  const chosen = $derived(route.q && rhymes.includes(route.q) ? route.q : rhymes[0] ?? '')
  const inRhyme = $derived(rows.filter(row => row.韻 === chosen))
  const lines = $derived.by(() => {
    /** @type {Map<string, Map<string, import('../lib/data.js').RhymeRow>>} */
    const out = new Map()
    for (const row of inRhyme) {
      const key = `${row.呼}${row.等}${row.類}${row.聲}`
      if (!out.has(key)) out.set(key, new Map())
      out.get(key)?.set(row.母, row)
    }
    const order = (/** @type {string} */ key) => TONES.indexOf(key.at(-1) ?? '')
    return [...out].sort((a, b) => a[0].slice(0, -1).localeCompare(b[0].slice(0, -1)) || order(a[0]) - order(b[0]))
  })
</script>

<div class="ui-page" data-width="wide">
  <header class="ui-page-head">
    <h1 class="ui-page-title">{t('rhymes.title')}</h1>
    <p class="ui-page-intro">{t('rhymes.intro')}</p>
  </header>
  <div class="rhymes" role="group" aria-label={t('rhymes.pick')}>
    {#each rhymes as rhyme (rhyme)}
      <button class="pick ui-script" class:on={rhyme === chosen} type="button" onclick={() => setQuery(rhyme)}>{rhyme}</button>
    {/each}
  </div>
  <p class="ui-hint">{t('rhymes.small', { count: inRhyme.length })}</p>
  <div class="wrap">
    <table>
      <thead><tr><th></th>{#each INITIALS as initial (initial)}<th class="ui-script">{initial}</th>{/each}</tr></thead>
      <tbody>
        {#each lines as [key, cells] (key)}
          <tr>
            <th class="ui-script">{key}</th>
            {#each INITIALS as initial (initial)}
              {@const cell = cells.get(initial)}
              <td>{#if cell}<button class="cell ui-script" type="button" title="{cell.描述} {cell.反切} {cell.字}" onclick={() => choose([...cell.字][0])}>{[...cell.字][0]}</button>{/if}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="ui-hint">{t('rhymes.source')}</p>
</div>

<style>
  .rhymes{display:flex;flex-wrap:wrap;gap:2px}
  .pick{inline-size:34px;block-size:34px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-sm);background:var(--ui-color-surface);color:var(--ui-color-ink);font-size:18px;cursor:pointer;line-height:1}
  .pick:hover{background:var(--ui-color-surface-hover)}
  .pick.on{background:var(--ui-color-accent);border-color:var(--ui-color-accent);color:var(--ui-color-on-accent)}
  .wrap{overflow-x:auto}
  table{border-collapse:collapse}
  th,td{min-inline-size:28px;block-size:28px;padding:0;border:1px solid var(--ui-color-border);text-align:center;font-weight:normal;font-size:14px;white-space:nowrap}
  tbody th{padding-inline:var(--ui-space-2xs);color:var(--ui-color-ink-soft)}
  thead th{color:var(--ui-color-ink-soft)}
  .cell{inline-size:100%;block-size:28px;border:0;background:none;color:var(--ui-color-ink);font-size:16px;cursor:pointer;padding:0;line-height:1}
  .cell:hover{background:var(--ui-color-accent-soft)}
</style>
