/*
 * Harness helper for the VEYRA visual exploration prototypes.
 *
 * NOT PRODUCTION SYNTHESIS CODE. It only lets the width-plausibility board
 * embed one screen of a direction at one width, so that board never has to
 * duplicate (and then drift from) the direction markup it is checking.
 *
 *   direction-a.html?only=home&w=320
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
    for (const node of document.querySelectorAll('.plate, .screen')) node.style.width = `${width}px`
  }
})()
