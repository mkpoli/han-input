// The finder is shared by every route, so keep its position for each history entry.
import { tick } from 'svelte'

const key = '__finderScroll'
/** @type {Map<string, number>} */
const positions = new Map()
/** @type {HTMLElement | undefined} */
let pane
let entry = ''
let generation = 0
/** @type {{ applied: number, stop: () => void } | undefined} */
let pending
let restoringHistory = false

export const isRestoringHistory = () => restoringHistory

function newEntry() { return Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(36)).join('-') }
/** @param {string} id */
function state(id) { return { ...history.state, [key]: { id } } }

function save() {
  if (pane && entry && !pending) positions.set(entry, pane.scrollTop)
}

function cancel() {
  generation++
  pending?.stop()
  pending = undefined
}

/** Stop restoring an old view when the current query changes. */
export function cancelScroll() {
  cancel()
  save()
}

/** Install the shared pane once it has mounted. @param {HTMLElement} element */
export function installScroll(element) {
  pane = element
  const saved = history.state?.[key]
  entry = typeof saved?.id === 'string' ? saved.id : newEntry()
  positions.set(entry, element.scrollTop)
  history.replaceState(state(entry), '')

  const scroll = () => {
    if (pending && Math.abs(element.scrollTop - pending.applied) > 1) cancel()
    save()
  }
  const userScroll = () => { if (pending) cancelScroll() }
  /** @param {KeyboardEvent} event */
  const keydown = event => {
    const target = /** @type {Element | null} */ (event.target)
    if (target && element.contains(target) && !target.closest('input, textarea, select, button, [contenteditable]') &&
        ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) userScroll()
  }
  /** @param {PointerEvent} event */
  const pointerdown = event => {
    const bounds = element.getBoundingClientRect()
    if (event.target === element && event.clientX >= bounds.left + element.clientLeft + element.clientWidth) userScroll()
  }
  element.addEventListener('scroll', scroll, { passive: true })
  element.addEventListener('wheel', userScroll, { passive: true })
  element.addEventListener('touchmove', userScroll, { passive: true })
  element.addEventListener('pointerdown', pointerdown, { passive: true })
  window.addEventListener('keydown', keydown)
  return () => {
    cancel()
    element.removeEventListener('scroll', scroll)
    element.removeEventListener('wheel', userScroll)
    element.removeEventListener('touchmove', userScroll)
    element.removeEventListener('pointerdown', pointerdown)
    window.removeEventListener('keydown', keydown)
    pane = undefined
  }
}

/** Push a distinct history entry. @param {string} url @param {boolean} reset */
export function pushScroll(url, reset) {
  restoringHistory = false
  save()
  cancel()
  entry = newEntry()
  const top = reset ? 0 : pane?.scrollTop ?? 0
  positions.set(entry, top)
  history.pushState(state(entry), '', url)
  if (reset && pane) pane.scrollTop = 0
}

/** Preserve our entry metadata when changing the URL. @param {string} url */
export function replaceScroll(url) {
  history.replaceState(history.state, '', url)
}

/** Capture the outgoing entry before the route is updated on popstate. */
export function leaveScroll() {
  restoringHistory = true
  save()
  cancel()
}

/** Restore after Svelte renders; keep trying as asynchronous content grows. */
export async function restoreScroll() {
  const saved = history.state?.[key]
  entry = typeof saved?.id === 'string' ? saved.id : newEntry()
  const target = positions.get(entry)
  if (!saved?.id) history.replaceState(state(entry), '')
  if (target === undefined) return
  const destination = target
  const id = entry
  const attempt = generation
  await tick()
  if (!pane || entry !== id || generation !== attempt) return
  const element = pane
  const observer = new ResizeObserver(apply)
  const mutations = new MutationObserver(() => {
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    apply()
  })
  // Stop retrying if the content never becomes tall enough, such as after a failed load.
  const expiry = setTimeout(() => { cancel(); save() }, 30_000)
  pending = { applied: element.scrollTop, stop: () => { clearTimeout(expiry); observer.disconnect(); mutations.disconnect() } }
  observer.observe(element)
  if (element.firstElementChild) observer.observe(element.firstElementChild)
  mutations.observe(element, { childList: true, subtree: true, characterData: true })
  apply()

  function apply() {
    if (!pending) return
    element.scrollTop = destination
    pending.applied = element.scrollTop
    if (Math.abs(element.scrollTop - destination) <= 1) {
      cancel()
      save()
    }
  }
}
