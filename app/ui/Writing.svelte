<script>
  // The text being written. Every finder adds to it; it can also be typed or pasted into directly.
  import { text, setText } from '../lib/text.svelte.js'
  import { copy } from '../lib/clip.svelte.js'
  import { t } from '../lib/i18n.svelte.js'
</script>

<section class="writing" aria-label={t('writing.label')}>
  <label class="ui-label writing-label" for="writing">{t('writing.text')}</label>
  <input id="writing" class="ui-input writing-field ui-script" spellcheck="false" autocomplete="off"
    value={text.value} placeholder={t('writing.placeholder')} oninput={event => setText(event.currentTarget.value)}>
  <button class="ui-button" data-size="sm" type="button" disabled={!text.value} onclick={() => copy(text.value, t('writing.text'))}>{t('common.copy')}</button>
  <button class="ui-button" data-variant="quiet" data-size="sm" type="button" disabled={!text.value} onclick={() => setText('')}>{t('writing.clear')}</button>
</section>

<style>
  .writing{position:sticky;top:var(--topbar-h);z-index:14;display:flex;align-items:center;gap:var(--ui-space-sm);padding:var(--ui-space-xs) var(--ui-space-2xl);background:var(--ui-color-surface);border-bottom:1px solid var(--ui-color-border)}
  .writing-label{flex:none}
  .writing-field{flex:1;min-inline-size:0;font-size:20px}
  @media (max-width:900px){
    .writing{padding:var(--ui-space-xs) var(--ui-space-lg)}
    .writing-label{display:none}
  }
</style>
