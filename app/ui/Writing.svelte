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
  .writing{display:flex;align-items:center;gap:var(--ui-space-sm);block-size:100%;padding-inline:var(--ui-space-xl);background:var(--ui-color-surface-sunken);border-block-start:1px solid var(--ui-color-border-strong)}
  .writing-label{flex:none}
  .writing-field{flex:1;min-inline-size:0;font-size:20px;background:var(--ui-color-surface)}
  @media (max-width:900px){
    .writing{padding-inline:var(--ui-space-sm)}
    .writing-label{display:none}
  }
</style>
