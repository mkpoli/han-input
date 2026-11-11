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
let navigated = false

export const hasNavigated = () => navigated

function newEntry() { return Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(36)).join('-') }

/** @param {string} id @param {number} top */
function state(id, top) {
  return { ...history.state, [key]: { id, top } }
}

function save() {
  if (!pane || !entry || pending) return
  positions.set(entry, pane.scrollTop)
}

function persist() {
  save()
  if (!pending && pane && history.state?.[key]?.id === entry) {
    history.replaceState(state(entry, pane.scrollTop), '')
  }
}

function cancel() {
  pending?.stop()
  pending = undefined
}

/** Install the shared pane once it has mounted. @param {HTMLElement} element */
export function installScroll(element) {
  pane = element
  const saved = history.state?.[key]
  entry = typeof saved?.id === 'string' ? saved.id : newEntry()
  positions.set(entry, typeof saved?.top === 'number' ? saved.top : element.scrollTop)
  history.replaceState(state(entry, positions.get(entry) ?? 0), '')
  history.scrollRestoration = 'manual'
  if (typeof saved?.top === 'number' && saved.top > 0) {
    navigated = true
    void restoreScroll()
  }

  const scroll = () => {
    if (pending && Math.abs(element.scrollTop - pending.applied) > 1) cancel()
    persist()
  }
  const userScroll = () => { if (pending) { cancel(); persist() } }
  /** @param {KeyboardEvent} event */
  const keydown = event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) userScroll()
  }
  element.addEventListener('scroll', scroll, { passive: true })
  element.addEventListener('wheel', userScroll, { passive: true })
  element.addEventListener('touchstart', userScroll, { passive: true })
  element.addEventListener('pointerdown', userScroll, { passive: true })
  window.addEventListener('keydown', keydown)
  return () => {
    cancel()
    element.removeEventListener('scroll', scroll)
    element.removeEventListener('wheel', userScroll)
    element.removeEventListener('touchstart', userScroll)
    element.removeEventListener('pointerdown', userScroll)
    window.removeEventListener('keydown', keydown)
    pane = undefined
  }
}

/** Push a distinct history entry. @param {string} url @param {boolean} reset */
export function pushScroll(url, reset) {
  navigated = true
  persist()
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
  navigated = true
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
      persist()
    }
  }
}
