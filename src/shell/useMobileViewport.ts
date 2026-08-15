import { useEffect, useState } from 'react'

interface MobileViewportState {
  height: number
  keyboardOpen: boolean
}

function isEditable(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false
  return element.matches('input, textarea') || element.isContentEditable
}

export function keyboardHeightThreshold(stableHeight: number): number {
  return Math.min(150, Math.max(96, stableHeight * 0.18))
}

function getInitialState(): MobileViewportState {
  return {
    height: window.visualViewport?.height ?? window.innerHeight,
    keyboardOpen: false,
  }
}

/** Shell presentation state derived from editable focus and VisualViewport height. */
export function useMobileViewport(): MobileViewportState {
  const [state, setState] = useState<MobileViewportState>(getInitialState)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) {
      setState({ height: window.innerHeight, keyboardOpen: false })
      return
    }

    let stableHeight = viewport.height
    let keyboardWasOpen = false
    let frame: number | null = null

    const measure = () => {
      frame = null
      const height = viewport.height
      const editableFocused = isEditable(document.activeElement)
      const reduction = stableHeight - height
      const keyboardOpen = editableFocused && reduction > keyboardHeightThreshold(stableHeight)

      // Keep the pre-keyboard baseline until the viewport has recovered. Outside
      // that transition, the latest visible height becomes the next baseline.
      if (!keyboardOpen && (!keyboardWasOpen || reduction <= keyboardHeightThreshold(stableHeight))) {
        stableHeight = height
      }
      keyboardWasOpen = keyboardOpen
      setState((current) => current.height === height && current.keyboardOpen === keyboardOpen
        ? current
        : { height, keyboardOpen })
    }

    const scheduleMeasure = () => {
      if (frame === null) frame = window.requestAnimationFrame(measure)
    }

    viewport.addEventListener('resize', scheduleMeasure)
    viewport.addEventListener('scroll', scheduleMeasure)
    document.addEventListener('focusin', scheduleMeasure)
    document.addEventListener('focusout', scheduleMeasure)
    measure()

    return () => {
      viewport.removeEventListener('resize', scheduleMeasure)
      viewport.removeEventListener('scroll', scheduleMeasure)
      document.removeEventListener('focusin', scheduleMeasure)
      document.removeEventListener('focusout', scheduleMeasure)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  return state
}
