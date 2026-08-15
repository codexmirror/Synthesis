import { useEffect, useState } from 'react'

interface MobileViewportState {
  height: number
  keyboardOpen: boolean
}

const UNSCALED_TOLERANCE = 0.01

function isUnscaled(viewport: VisualViewport): boolean {
  return Math.abs(viewport.scale - 1) < UNSCALED_TOLERANCE
}

function isEditable(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false
  return element.matches('input, textarea') || element.isContentEditable
}

export function keyboardHeightThreshold(stableHeight: number): number {
  return Math.min(150, Math.max(96, stableHeight * 0.18))
}

function getInitialState(): MobileViewportState {
  const viewport = window.visualViewport
  return {
    height: viewport && isUnscaled(viewport) ? viewport.height : window.innerHeight,
    keyboardOpen: false,
  }
}

/** Shell presentation state derived from editable focus and VisualViewport height. */
export function useMobileViewport(): MobileViewportState {
  const [state, setState] = useState<MobileViewportState>(getInitialState)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) {
      let frame: number | null = null
      const measureWindow = () => {
        frame = null
        setState({ height: window.innerHeight, keyboardOpen: false })
      }
      const scheduleWindowMeasure = () => {
        if (frame === null) frame = window.requestAnimationFrame(measureWindow)
      }
      window.addEventListener('resize', scheduleWindowMeasure)
      measureWindow()
      return () => {
        window.removeEventListener('resize', scheduleWindowMeasure)
        if (frame !== null) window.cancelAnimationFrame(frame)
      }
    }

    let stableHeight = isUnscaled(viewport) ? viewport.height : window.innerHeight
    let keyboardWasOpen = false
    let frame: number | null = null

    const measure = () => {
      frame = null
      // Browser pinch zoom is an accessibility feature, not application layout
      // input. Retain the last unscaled height, baseline, and keyboard state.
      if (!isUnscaled(viewport)) return

      const height = viewport.height
      const editableFocused = isEditable(document.activeElement)
      const reduction = stableHeight - height
      const reduced = reduction > keyboardHeightThreshold(stableHeight)
      const keyboardOpen = reduced && (editableFocused || keyboardWasOpen)

      // Once opened, compact mode and its pre-keyboard baseline survive blur
      // until the viewport itself recovers.
      if (!keyboardOpen) stableHeight = height
      keyboardWasOpen = keyboardOpen
      setState((current) => current.height === height && current.keyboardOpen === keyboardOpen
        ? current
        : { height, keyboardOpen })
    }

    const scheduleMeasure = () => {
      if (frame === null) frame = window.requestAnimationFrame(measure)
    }

    viewport.addEventListener('resize', scheduleMeasure)
    document.addEventListener('focusin', scheduleMeasure)
    document.addEventListener('focusout', scheduleMeasure)
    measure()

    return () => {
      viewport.removeEventListener('resize', scheduleMeasure)
      document.removeEventListener('focusin', scheduleMeasure)
      document.removeEventListener('focusout', scheduleMeasure)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  return state
}
