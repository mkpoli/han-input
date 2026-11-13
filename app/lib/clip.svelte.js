// Copying, with a short confirmation of what went to the clipboard.
import { t } from './i18n.svelte.js'

export const toast = $state({ message: '', id: 0 })
let lastMessage = ''

/** @param {string} message */
export function say(message) {
  toast.message = message === lastMessage ? `${message}\u00a0` : message
  lastMessage = toast.message
  const id = ++toast.id
  setTimeout(() => { if (toast.id === id) toast.message = '' }, 1800)
}

/** @param {string} value @param {string} [label] what was copied, for the confirmation */
export async function copy(value, label = value) {
  try {
    await navigator.clipboard.writeText(value)
    say(t('toast.copied', { what: label }))
  } catch {
    say(t('toast.clipboard'))
  }
}
