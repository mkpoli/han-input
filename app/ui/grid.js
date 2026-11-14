// A grid contains native action buttons; only the current button is a tab stop.
/** @param {HTMLElement} grid */
export function gridNavigation(grid) {
  const buttons = () => [...grid.querySelectorAll('button')]
  /** @param {HTMLButtonElement | undefined} current */
  function setCurrent(current) {
    for (const button of buttons()) button.tabIndex = button === current ? 0 : -1
  }
  function sync() {
    const items = buttons()
    const focused = items.find(button => button === document.activeElement)
    setCurrent(focused ?? items.find(button => button.tabIndex === 0) ?? items[0])
  }
  /** @param {FocusEvent} event */
  function focusin(event) {
    if (event.target instanceof HTMLButtonElement && buttons().includes(event.target)) setCurrent(event.target)
  }
  /** @param {KeyboardEvent} event */
  function keydown(event) {
    if (event.defaultPrevented || event.altKey || event.metaKey || event.shiftKey) return
    const items = buttons()
    const current = items.find(button => button === event.target)
    if (!current) return
    let next
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const candidates = event.ctrlKey ? items : [...current.closest('[role="row"]')?.querySelectorAll('button') ?? []]
      next = event.key === 'Home' ? candidates[0] : candidates.at(-1)
    } else if (!event.ctrlKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const rect = current.getBoundingClientRect()
      const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight'
      const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
      const start = horizontal ? rect.left : rect.top
      const end = horizontal ? rect.right : rect.bottom
      const crossStart = horizontal ? rect.top : rect.left
      const crossEnd = horizontal ? rect.bottom : rect.right
      const choices = items.filter(item => item !== current && item.checkVisibility()).map(item => {
        const box = item.getBoundingClientRect()
        const near = horizontal ? box.left : box.top
        const far = horizontal ? box.right : box.bottom
        const otherStart = horizontal ? box.top : box.left
        const otherEnd = horizontal ? box.bottom : box.right
        const gap = forward ? near - end : start - far
        const offset = Math.abs((otherStart + otherEnd - crossStart - crossEnd) / 2)
        return { item, gap, offset, overlap: otherStart < crossEnd && otherEnd > crossStart }
      }).filter(choice => choice.gap >= -1 && choice.overlap)
      choices.sort((a, b) => a.gap - b.gap || a.offset - b.offset)
      next = choices[0]?.item
    }
    if (!next || next === current) return
    event.preventDefault()
    setCurrent(next)
    next.focus()
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  const observer = new MutationObserver(sync)
  observer.observe(grid, { childList: true, subtree: true })
  grid.addEventListener('focusin', focusin)
  grid.addEventListener('keydown', keydown)
  sync()
  return { destroy() { observer.disconnect(); grid.removeEventListener('focusin', focusin); grid.removeEventListener('keydown', keydown) } }
}
