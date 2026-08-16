import { useEffect, useRef, useState } from 'react'
import {
  anchorEditingIntentTop,
  deriveEditingViewportGeometry,
  hasEditingViewportRecovered,
  isApproximatelyUnscaled,
} from './editingViewportGeometry'
import { canOwnVerticalGesture } from './editingScrollOwnership'

export interface EditingViewportState {
  hostHeight: number
  editTop: number
  editHeight: number
  editing: boolean
}

interface ViewportMeasurement {
  editTop: number
  editHeight: number
  visualHeight: number
  visualTop: number
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
    let editingGeometryReady = false
    let intentGeometry: ViewportMeasurement | null = null
    let intentViewportTop = 0
    let reducedGeometryObserved = false
    let suppressUntilNewFocus = false
    let touchX = 0
    let touchY = 0
    let touchScrollOwner: HTMLElement | null = null

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
          visualHeight: healthyHeight,
          visualTop: 0,
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
        visualHeight: Math.max(0, Math.round(viewport.height)),
        visualTop: Math.max(0, Math.round(viewport.offsetTop)),
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

    // Preserve the focused app's on-screen rectangle while iOS begins its
    // native focus/keyboard transaction. Promoting a healthy viewport to the
    // full host here moves the focused control after Safari chose what to keep
    // visible; reduced VisualViewport geometry becomes authoritative below.
    const readIntentGeometry = (
      target: EventTarget | null,
    ): ViewportMeasurement | null => {
      if (!(target instanceof Element)) return null

      const appView = target.closest<HTMLElement>('.app-view')
      const shell = target.closest<HTMLElement>('.os-shell')
      if (!appView || !shell) return null

      const appRect = appView.getBoundingClientRect()
      const shellRect = shell.getBoundingClientRect()
      if (appRect.height <= 0) return null

      return {
        editTop: Math.max(0, Math.round(appRect.top - shellRect.top)),
        editHeight: Math.max(1, Math.round(appRect.height)),
        visualHeight: hostHeightRef.current,
        visualTop: 0,
        healthyHeight: hostHeightRef.current,
      }
    }

    const stopEditing = (healthyHeight: number) => {
      editingLatched = false
      editingGeometryReady = false
      intentGeometry = null
      reducedGeometryObserved = false
      suppressUntilNewFocus = editableFocused
      publishNormal(healthyHeight)
    }

    const settleLatchedEditing = (
      measurement: ViewportMeasurement,
    ): void => {
      const recovered = hasEditingViewportRecovered(
        hostHeightRef.current,
        measurement.visualHeight,
      )

      if (!editingGeometryReady && recovered) {
        if (!editableFocused) {
          stopEditing(measurement.healthyHeight)
        } else if (intentGeometry) {
          // offsetTop is browser camera movement here, not application scroll.
          // Apply its delta inside the Shell so the intent rectangle keeps the
          // same physical screen position until keyboard height is authoritative.
          publishEditing({
            ...intentGeometry,
            editTop: anchorEditingIntentTop(
              intentGeometry.editTop,
              intentViewportTop,
              measurement.visualTop,
            ),
          })
        }
        return
      }

      if (!recovered) {
        editingGeometryReady = true
        intentGeometry = null
        reducedGeometryObserved = true
      }

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
      editingGeometryReady = false
      intentGeometry = null
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
        const recovered = hasEditingViewportRecovered(
          hostHeightRef.current,
          measurement.visualHeight,
        )

        if (recovered) {
          editingGeometryReady = false
          intentGeometry = readIntentGeometry(event.target) ?? measurement
          intentViewportTop = measurement.visualTop
          publishEditing(intentGeometry)
        } else {
          editingGeometryReady = true
          intentGeometry = null
          reducedGeometryObserved = true
          publishEditing(measurement)
        }
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

    const onTouchStart = (event: TouchEvent) => {
      if (!editingLatched || event.touches.length !== 1) {
        touchScrollOwner = null
        return
      }

      const touch = event.touches[0]
      touchX = touch.clientX
      touchY = touch.clientY
      touchScrollOwner =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-editing-scroll-owner]')
          : null
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!editingLatched || event.touches.length !== 1) return

      const touch = event.touches[0]
      const deltaX = touch.clientX - touchX
      const deltaY = touch.clientY - touchY
      touchX = touch.clientX
      touchY = touch.clientY

      if (Math.abs(deltaY) <= Math.abs(deltaX)) return
      if (
        touchScrollOwner &&
        canOwnVerticalGesture(touchScrollOwner, deltaY)
      ) {
        return
      }

      event.preventDefault()
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
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
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
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('orientationchange', onOrientationChange)
      cancelAnimationFrame(frame)
      cancelCloseProbe()
      if (orientationTimer !== undefined) clearTimeout(orientationTimer)
    }
  }, [])

  return state
}
