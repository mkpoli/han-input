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
  /** A nested scrollport can consume the gesture or prevent it from chaining to the finder.
   * @param {EventTarget | null} target @param {number} delta */
  const nestedScroll = (target, delta) => {
    for (let node = target instanceof Element ? target : null; node && node !== element; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (!['auto', 'scroll'].includes(style.overflowY)) continue
      const available = delta < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight
      if (available || ['contain', 'none'].includes(style.overscrollBehaviorY)) return true
    }
    return false
  }
  /** @param {WheelEvent} event */
  const wheel = event => {
    if (pending && !event.defaultPrevented && !event.ctrlKey && event.deltaY && !nestedScroll(event.target, event.deltaY)) userScroll()
  }
  /** @type {number | undefined} */
  let touchY
  /** @param {TouchEvent} event */
  const touchstart = event => { touchY = event.touches.length === 1 ? event.touches[0].clientY : undefined }
  /** @param {TouchEvent} event */
  const touchmove = event => {
    if (touchY === undefined || event.touches.length !== 1) { touchY = undefined; return }
    const delta = touchY - event.touches[0].clientY
    touchY = event.touches[0].clientY
    if (pending && delta && !event.defaultPrevented && !nestedScroll(event.target, delta)) userScroll()
  }
  const touchend = () => { touchY = undefined }
  /** @param {KeyboardEvent} event */
  const keydown = event => {
    const target = /** @type {Element | null} */ (event.target)
    if (!pending || !target || event.defaultPrevented || !element.contains(target) || target.closest('textarea, select, [contenteditable]')) return
    const input = target.closest('input')
    if (input && (!['text', 'search', 'email', 'url', 'tel', 'password'].includes(input.type) ||
        !['PageUp', 'PageDown'].includes(event.key) || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)) return
    if (event.key === ' ' && target.closest('button, summary, [role="button"]')) return
    const direction = ['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey) ? -1
      : ['ArrowDown', 'PageDown', 'End', ' '].includes(event.key) ? 1 : 0
    if (direction && !nestedScroll(target, direction)) userScroll()
  }
  /** @param {PointerEvent} event */
  const pointerdown = event => {
    const bounds = element.getBoundingClientRect()
    if (event.target === element && event.clientX >= bounds.left + element.clientLeft + element.clientWidth) userScroll()
  }
  element.addEventListener('scroll', scroll, { passive: true })
  element.addEventListener('wheel', wheel, { passive: true })
  element.addEventListener('touchstart', touchstart, { passive: true })
  element.addEventListener('touchmove', touchmove, { passive: true })
  element.addEventListener('touchend', touchend, { passive: true })
  element.addEventListener('touchcancel', touchend, { passive: true })
  element.addEventListener('pointerdown', pointerdown, { passive: true })
  window.addEventListener('keydown', keydown)
  return () => {
    cancel()
    element.removeEventListener('scroll', scroll)
    element.removeEventListener('wheel', wheel)
    element.removeEventListener('touchstart', touchstart)
    element.removeEventListener('touchmove', touchmove)
    element.removeEventListener('touchend', touchend)
    element.removeEventListener('touchcancel', touchend)
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
