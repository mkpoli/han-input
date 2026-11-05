<script>
  // The reader's display settings: the light or dark side and the interface language. The same rows
  // serve the desktop popover and the phone's settings sheet.
  import { i18n, LOCALES, setLocale, t } from '../lib/i18n.svelte.js'
  import { setTheme, ui } from '../lib/ui.svelte.js'
</script>

<div class="settings-rows">
  <label class="settings-row">
    <span class="ui-label">{t('theme.label')}</span>
    <span class="ui-select-wrap">
      <select class="ui-select" value={ui.theme}
        onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setTheme(/** @type {'auto' | 'light' | 'dark'} */ (event.currentTarget.value))}>
        <option value="auto">{t('theme.auto')}</option>
        <option value="light">{t('theme.light')}</option>
        <option value="dark">{t('theme.dark')}</option>
      </select>
    </span>
  </label>

  <label class="settings-row">
    <span class="ui-label">{t('lang.label')}</span>
    <span class="ui-select-wrap">
      <select class="ui-select" value={i18n.locale}
        onchange={(/** @type {Event & { currentTarget: HTMLSelectElement }} */ event) => setLocale(/** @type {any} */ (event.currentTarget.value))}>
        {#each LOCALES as locale (locale.key)}<option value={locale.key} lang={locale.key}>{locale.name}</option>{/each}
      </select>
    </span>
  </label>
</div>

<style>
  .settings-rows{display:grid}
  .settings-row{display:grid;grid-template-columns:92px minmax(0,1fr);align-items:center;gap:var(--ui-space-md);padding-block:var(--ui-space-md);border-bottom:1px solid var(--ui-color-border)}
  .settings-row:last-child{border-bottom:0}
  .settings-row > :global(.ui-select-wrap){inline-size:100%}
</style>
