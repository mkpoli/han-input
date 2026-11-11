// The few view states that are not worth an address: the phone's card sheet and the theme.
import { close, open } from './route.svelte.js'
import { insert } from './text.svelte.js'
import { say, toast } from './clip.svelte.js'
import { t } from './i18n.svelte.js'

const THEME = 'han-input:theme'

export const ui = $state({
  sheet: false,
  /** The last notice rendered in the sheet. */
  sheetNoticeId: 0,
  /** @type {'auto' | 'light' | 'dark'} */
  theme: /** @type {'auto' | 'light' | 'dark'} */ ((typeof localStorage !== 'undefined' && localStorage.getItem(THEME)) || 'auto'),
  /** A printed proposal record shown in place of the character card, with its document. */
  record: /** @type {{ record: import('./charsets.js').ProposalRecord, document: import('./charsets.js').ProposalDocument } | null} */ (null),
})

/** @param {string} char */
export function choose(char) {
  ui.record = null
  open(char)
  if (matchMedia('(max-width: 900px)').matches) ui.sheet = true
}

/** @param {import('./charsets.js').ProposalRecord} record @param {import('./charsets.js').ProposalDocument} document */
export function showRecord(record, document) {
  close()
  ui.record = { record, document }
  if (matchMedia('(max-width: 900px)').matches) ui.sheet = true
}

export function hideSheet() {
  if (ui.sheet && ui.sheetNoticeId === toast.id) toast.message = ''
  ui.sheet = false
}

export function closeRecord() {
  ui.record = null
  hideSheet()
}

/** @param {string} char */
export function put(char) {
  insert(char)
  say(t('toast.added', { char }))
}

/** @param {'auto' | 'light' | 'dark'} theme */
export function setTheme(theme) {
  ui.theme = theme
  applyTheme()
  try { localStorage.setItem(THEME, theme) } catch { /* the choice lasts this visit */ }
}

export function applyTheme() {
  if (ui.theme === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = ui.theme
}

/** @param {HTMLElement} node */
export function autofocus(node) {
  if (!matchMedia('(pointer: coarse)').matches) queueMicrotask(() => node.focus())
}
