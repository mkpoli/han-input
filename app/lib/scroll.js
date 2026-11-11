// The finder is shared by every route, so browser document scroll restoration cannot restore it.
import { tick } from 'svelte'

const key = '__finderScroll'
/** @type {Map<string, number>} */
const positions = new Map()
/** @type {HTMLElement | undefined} */
let pane
let entry = ''
/** @type {{ target: number, applied: number, stop: () => void } | undefined} */
let pending
let restoringHistory = false
let flushOutgoing = () => {}

export const isRestoringHistory = () => restoringHistory

function newEntry() { return Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(36)).join('-') }

/** @param {string} id @param {number} top */
function state(id, top) {
  return { ...history.state, [key]: { id, top } }
}

function save() {
  if (!pane || !entry || pending) return
  positions.set(entry, pane.scrollTop)
}

function cancel() {
  pending?.stop()
  pending = undefined
}

/** Install the shared pane once it has mounted. @param {HTMLElement} element */
export function installScroll(element) {
  pane = element
  let storageAvailable = true
  try {
    sessionStorage.setItem(`${key}:probe`, '1')
    sessionStorage.removeItem(`${key}:probe`)
  } catch { storageAvailable = false }
  if (storageAvailable) {
    try {
      const stored = JSON.parse(sessionStorage.getItem(key) ?? '[]')
      if (Array.isArray(stored)) {
        for (const [id, top] of stored) {
          if (typeof id === 'string' && typeof top === 'number') positions.set(id, top)
        }
      }
    } catch { /* History still works within this document when storage is unavailable. */ }
  }
  const saved = history.state?.[key]
  entry = typeof saved?.id === 'string' ? saved.id : newEntry()
  const top = positions.get(entry) ?? (typeof saved?.top === 'number' ? saved.top : element.scrollTop)
  positions.set(entry, top)
  history.replaceState(state(entry, top), '')
  if (top > 0) {
    restoringHistory = true
    void restoreScroll()
  }

  let lastFallback = -Infinity
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let fallbackTimer
  /** @param {boolean} [force] */
  const saveFallback = (force = false) => {
    if (storageAvailable) return
    if (force) {
      clearTimeout(fallbackTimer)
      fallbackTimer = undefined
    } else if (fallbackTimer) return
    const write = () => {
      fallbackTimer = undefined
      if ((!force && pending) || history.state?.[key]?.id !== entry) return
      lastFallback = performance.now()
      try { history.replaceState(state(entry, positions.get(entry) ?? 0), '') } catch { /* The in-memory map still works. */ }
    }
    const delay = 1000 - (performance.now() - lastFallback)
    if (force || delay <= 0) write()
    else fallbackTimer = setTimeout(write, delay)
  }
  flushOutgoing = () => saveFallback(true)
  const scroll = () => {
    if (pending && Math.abs(element.scrollTop - pending.applied) > 1) cancel()
    save()
    saveFallback()
  }
  const userScroll = () => { if (pending) { cancel(); save() } }
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
  const pagehide = () => {
    save()
    try { sessionStorage.setItem(key, JSON.stringify([...positions])) }
    catch {
      // If storage is unavailable, retain the current entry when history permits it.
      try { history.replaceState(state(entry, positions.get(entry) ?? 0), '') } catch { /* The in-memory map still works. */ }
    }
  }
  element.addEventListener('scroll', scroll, { passive: true })
  element.addEventListener('wheel', userScroll, { passive: true })
  element.addEventListener('touchmove', userScroll, { passive: true })
  element.addEventListener('pointerdown', pointerdown, { passive: true })
  window.addEventListener('keydown', keydown)
  window.addEventListener('pagehide', pagehide)
  return () => {
    cancel()
    clearTimeout(fallbackTimer)
    element.removeEventListener('scroll', scroll)
    element.removeEventListener('wheel', userScroll)
    element.removeEventListener('touchmove', userScroll)
    element.removeEventListener('pointerdown', pointerdown)
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('pagehide', pagehide)
    flushOutgoing = () => {}
    pane = undefined
  }
}

/** Push a distinct history entry. @param {string} url @param {boolean} reset */
export function pushScroll(url, reset) {
  restoringHistory = false
  save()
  flushOutgoing()
  cancel()
  entry = newEntry()
  const top = reset ? 0 : pane?.scrollTop ?? 0
  positions.set(entry, top)
  history.pushState(state(entry, top), '', url)
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
  const target = positions.get(entry) ?? (typeof saved?.top === 'number' ? saved.top : 0)
  positions.set(entry, target)
  if (!saved?.id) history.replaceState(state(entry, target), '')
  const id = entry
  await tick()
  if (!pane || entry !== id) return
  const element = pane
  const observer = new ResizeObserver(apply)
  const mutations = new MutationObserver(() => {
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    apply()
  })
  pending = { target, applied: element.scrollTop, stop: () => { observer.disconnect(); mutations.disconnect() } }
  observer.observe(element)
  if (element.firstElementChild) observer.observe(element.firstElementChild)
  mutations.observe(element, { childList: true, subtree: true, characterData: true })
  apply()

  function apply() {
    if (!pending) return
    element.scrollTop = target
    pending.applied = element.scrollTop
    if (Math.abs(element.scrollTop - target) <= 1) {
      cancel()
      save()
    }
  }
}
