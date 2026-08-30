/*
 * Harness helper for the NODE-OS Market visual exploration prototypes.
 *
 * NOT PRODUCTION SYNTHESIS CODE. It does one thing: let the width board embed
 * a single screen of a direction at a single width, so that board can never
 * duplicate — and then drift from — the direction markup it is checking.
 *
 *   direction-a.html?only=catalog&w=320
 */
(() => {
  const params = new URLSearchParams(location.search)
  const only = params.get('only')
  if (!only) return

  const width = params.get('w')
  document.querySelector('.harness-head')?.remove()
  document.body.style.cssText = 'margin:0;padding:0;background:transparent'

  for (const plate of document.querySelectorAll('.plate')) {
    if (plate.querySelector(`[id$="-${only}"]`)) plate.querySelector('figcaption')?.remove()
    else plate.remove()
  }

  if (width) {
    for (const node of document.querySelectorAll('.screen')) {
      node.style.width = `${width}px`
      node.style.height = '820px'
    }
  }
})()
