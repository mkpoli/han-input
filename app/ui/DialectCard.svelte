<script>
  // An IDS-only row of the dialect list in place of the character card: it has no character to open.
  import { t } from '../lib/i18n.svelte.js'
  import { hideSheet, ui } from '../lib/ui.svelte.js'
  import DialectRows from './DialectRows.svelte'
</script>

<article class="dialect-card">
  <header class="head">
    <span class="ids ui-glyph-text" lang="und-Hani">{ui.dialect}</span>
    <span class="ui-hint">{t('dialects.unencoded')}</span>
    <button class="ui-button" data-variant="quiet" data-size="sm" type="button" onclick={() => { ui.dialect = ''; hideSheet() }}>{t('dialects.close')}</button>
  </header>
  <DialectRows entryKey={ui.dialect} />
</article>

<style>
  .dialect-card{display:grid;gap:var(--ui-space-xl);padding:var(--ui-space-xl)}
  .head{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-space-sm) var(--ui-space-lg)}
  .ids{font-size:28px;line-height:1.2;overflow-wrap:anywhere}
  .head .ui-button{margin-inline-start:auto}
</style>
