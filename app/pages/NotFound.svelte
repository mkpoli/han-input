<script>
  // A mistyped address keeps its path; this page says so and offers the way back.
  import { go } from '../lib/route.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
</script>

<div class="ui-page notfound">
  <p class="code ui-mono" aria-hidden="true">404</p>
  <h1 class="ui-page-title">{t('notfound.title')}</h1>
  <p class="ui-page-intro">{t('notfound.intro')}</p>
  <a class="ui-button" data-variant="primary" href="/" onclick={event => { event.preventDefault(); go('') }}>{t('nav.find')}</a>
</div>

<style>
  .notfound{display:grid;gap:var(--ui-space-sm);justify-items:center;text-align:center;padding-block:var(--ui-space-4xl)}
  .code{font-size:64px;line-height:1;color:var(--ui-color-border-strong)}
  .notfound .ui-page-intro{max-inline-size:32rem}
</style>
