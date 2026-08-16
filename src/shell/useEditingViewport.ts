import { useEffect, useRef, useState } from 'react'
import {
  deriveEditingViewportGeometry,
  hasEditingViewportRecovered,
  isApproximatelyUnscaled,
} from './editingViewportGeometry'

export interface EditingViewportState {
  hostHeight: number
  editTop: number
  editHeight: number
  editing: boolean
}

interface ViewportMeasurement {
  editTop: number
  editHeight: number
  visibleBottom: number
  healthyHeight: number
}

const EDITING_PRESENTATION_QUERY =
  '(max-width: 700px), (max-width: 900px) and (pointer: coarse)'
const CLOSE_PROBE_DELAY = 360
const ORIENTATION_REBASE_DELAY = 280

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  if (target instanceof HTMLTextAreaElement) {
    return !target.disabled && !target.readOnly
  }

  if (target instanceof HTMLInputElement) {
    return (
      !target.disabled &&
      !target.readOnly &&
      ![
        'checkbox',
        'radio',
        'range',
        'color',
        'file',
        'button',
        'submit',
        'reset',
        'image',
        'hidden',
      ].includes(target.type)
    )
  }

  return target.isContentEditable
}

function supportsEditingPresentation(): boolean {
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(EDITING_PRESENTATION_QUERY).matches
  }

  return window.innerWidth <= 700
}

function initialHostHeight(): number {
  const viewport = window.visualViewport

  if (viewport && isApproximatelyUnscaled(viewport.scale)) {
    return Math.max(1, Math.round(viewport.offsetTop + viewport.height))
  }

  return Math.max(1, Math.round(window.innerHeight))
}

function normalState(hostHeight: number): EditingViewportState {
  return {
    hostHeight,
    editTop: 0,
    editHeight: hostHeight,
    editing: false,
  }
}

function statesMatch(
  current: EditingViewportState,
  next: EditingViewportState,
): boolean {
  return (
    current.hostHeight === next.hostHeight &&
    current.editTop === next.editTop &&
    current.editHeight === next.editHeight &&
    current.editing === next.editing
  )
}

export function useEditingViewport(): EditingViewportState {
  const initialHeight = initialHostHeight()
  const [state, setState] = useState<EditingViewportState>(() =>
    normalState(initialHeight),
  )
  const hostHeightRef = useRef(initialHeight)

  useEffect(() => {
    const viewport = window.visualViewport
    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia(EDITING_PRESENTATION_QUERY)
        : undefined

    let frame = 0
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    let orientationTimer: ReturnType<typeof setTimeout> | undefined
    let editableFocused = false
    let editingLatched = false
    let reducedGeometryObserved = false
    let suppressUntilNewFocus = false

    const publish = (next: EditingViewportState) => {
      hostHeightRef.current = next.hostHeight
      setState((current) => (statesMatch(current, next) ? current : next))
    }

    const publishNormal = (height: number) => {
      publish(normalState(Math.max(1, Math.round(height))))
    }

    const readMeasurement = (
      hostHeight = hostHeightRef.current,
    ): ViewportMeasurement | null => {
      if (!viewport) {
        const healthyHeight = Math.max(1, Math.round(window.innerHeight))
        return {
          editTop: 0,
          editHeight: healthyHeight,
          visibleBottom: Math.min(hostHeight, healthyHeight),
          healthyHeight,
        }
      }

      if (!isApproximatelyUnscaled(viewport.scale)) return null

      const geometry = deriveEditingViewportGeometry({
        hostHeight,
        visualHeight: viewport.height,
        offsetTop: viewport.offsetTop,
        scale: viewport.scale,
      })

      return {
        editTop: geometry.editTop,
        editHeight: geometry.editHeight,
        visibleBottom: geometry.visibleBottom,
        healthyHeight: Math.max(
          1,
          Math.round(viewport.offsetTop + viewport.height),
        ),
      }
    }

    const publishEditing = (measurement: ViewportMeasurement) => {
      publish({
        hostHeight: hostHeightRef.current,
        editTop: measurement.editTop,
        editHeight: measurement.editHeight,
        editing: true,
      })
    }

    const stopEditing = (healthyHeight: number) => {
      editingLatched = false
      reducedGeometryObserved = false
      suppressUntilNewFocus = editableFocused
      publishNormal(healthyHeight)
    }

    const settleLatchedEditing = (
      measurement: ViewportMeasurement,
    ): void => {
      const recovered = hasEditingViewportRecovered(
        hostHeightRef.current,
        measurement.visibleBottom,
      )

      if (!recovered) reducedGeometryObserved = true

      if (
        (reducedGeometryObserved && recovered) ||
        (!editableFocused && recovered)
      ) {
        stopEditing(measurement.healthyHeight)
        return
      }

      publishEditing(measurement)
    }

    const resetForNonEditingPresentation = (
      measurement: ViewportMeasurement,
    ) => {
      editableFocused = false
      editingLatched = false
      reducedGeometryObserved = false
      suppressUntilNewFocus = false
      publishNormal(measurement.healthyHeight)
    }

    const measure = () => {
      frame = 0
      const measurement = readMeasurement()
      if (!measurement) return

      if (!supportsEditingPresentation()) {
        resetForNonEditingPresentation(measurement)
        return
      }

      if (editingLatched) {
        settleLatchedEditing(measurement)
        return
      }

      if (editableFocused && !suppressUntilNewFocus) {
        editingLatched = true
        publishEditing(measurement)
        return
      }

      if (editableFocused && suppressUntilNewFocus) return

      publishNormal(measurement.healthyHeight)
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    const cancelCloseProbe = () => {
      if (closeTimer !== undefined) clearTimeout(closeTimer)
      closeTimer = undefined
    }

    const onFocusIn = (event: FocusEvent) => {
      if (!isEditable(event.target)) return

      cancelCloseProbe()
      editableFocused = true
      reducedGeometryObserved = false
      suppressUntilNewFocus = false

      const measurement = readMeasurement()
      if (supportsEditingPresentation() && measurement) {
        editingLatched = true
        publishEditing(measurement)
      }

      schedule()
    }

    const onFocusOut = (event: FocusEvent) => {
      if (!isEditable(event.target)) return

      editableFocused = false
      schedule()
      cancelCloseProbe()
      closeTimer = setTimeout(() => {
        closeTimer = undefined
        schedule()
      }, CLOSE_PROBE_DELAY)
    }

    const rebaseAfterOrientation = () => {
      orientationTimer = undefined

      const measurement = readMeasurement()
      if (!measurement) return

      const documentHeight =
        document.documentElement.clientHeight || window.innerHeight
      const rebasedHeight = Math.max(
        1,
        measurement.healthyHeight,
        Math.round(documentHeight),
      )

      hostHeightRef.current = rebasedHeight
      const rebasedMeasurement = readMeasurement(rebasedHeight)
      if (!rebasedMeasurement) return

      if (!supportsEditingPresentation()) {
        resetForNonEditingPresentation(rebasedMeasurement)
        return
      }

      if (editingLatched) {
        settleLatchedEditing(rebasedMeasurement)
        return
      }

      if (editableFocused && !suppressUntilNewFocus) {
        editingLatched = true
        publishEditing(rebasedMeasurement)
        return
      }

      publishNormal(rebasedHeight)
    }

    const onOrientationChange = () => {
      if (orientationTimer !== undefined) clearTimeout(orientationTimer)
      orientationTimer = setTimeout(
        rebaseAfterOrientation,
        ORIENTATION_REBASE_DELAY,
      )
    }

    if (viewport) {
      viewport.addEventListener('resize', schedule)
      viewport.addEventListener('scroll', schedule)
    } else {
      window.addEventListener('resize', schedule)
    }

    mediaQuery?.addEventListener('change', schedule)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    window.addEventListener('orientationchange', onOrientationChange)
    schedule()

    return () => {
      if (viewport) {
        viewport.removeEventListener('resize', schedule)
        viewport.removeEventListener('scroll', schedule)
      } else {
        window.removeEventListener('resize', schedule)
      }

      mediaQuery?.removeEventListener('change', schedule)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('orientationchange', onOrientationChange)
      cancelAnimationFrame(frame)
      cancelCloseProbe()
      if (orientationTimer !== undefined) clearTimeout(orientationTimer)
    }
  }, [])

  return state
}
