import { useEffect, useState } from 'react'

export interface MobileViewportState {
  stableHeight: number
  offsetTop: number
  keyboardInset: number
  keyboardOpen: boolean
}

const RECOVERY_TOLERANCE = 24
const SCALE_TOLERANCE = 0.01

const isUnscaled = (scale: number) =>
  Math.abs(scale - 1) < SCALE_TOLERANCE

function isTextEntry(target: EventTarget | null): boolean {
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

function getOpeningThreshold(height: number): number {
  return Math.min(150, Math.max(96, height * 0.18))
}

function initialState(): MobileViewportState {
  const viewport = window.visualViewport

  const stableHeight =
    viewport && isUnscaled(viewport.scale)
      ? viewport.offsetTop + viewport.height
      : window.innerHeight

  return {
    stableHeight,
    offsetTop: 0,
    keyboardInset: 0,
    keyboardOpen: false,
  }
}

export function useMobileViewport(): MobileViewportState {
  const [state, setState] =
    useState<MobileViewportState>(initialState)

  useEffect(() => {
    const viewport = window.visualViewport

        let frame = 0
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    let openTimer: ReturnType<typeof setTimeout> | undefined
    let orientationTimer: ReturnType<typeof setTimeout> | undefined

    let protectedSequence = false
    let editableFocused = false
    let orientationPending = false
    let lastWidth = viewport?.width ?? window.innerWidth

    let current = state

    const publish = (next: MobileViewportState) => {
      current = next
      setState(next)
    }

    if (!viewport) {
      const measureFallback = () => {
        frame = 0

        publish({
          stableHeight: window.innerHeight,
          offsetTop: 0,
          keyboardInset: 0,
          keyboardOpen: false,
        })
      }

      const scheduleFallback = () => {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(measureFallback)
      }

      window.addEventListener('resize', scheduleFallback)

      return () => {
        window.removeEventListener('resize', scheduleFallback)
        cancelAnimationFrame(frame)
      }
    }

    const measure = () => {
      frame = 0

      if (!isUnscaled(viewport.scale)) return

      const widthChanged =
        Math.abs(viewport.width - lastWidth) >= 80

      if (widthChanged) {
        lastWidth = viewport.width
        orientationPending = true
        queueOrientationProbe()
      }

      const visibleBottom =
        viewport.offsetTop + viewport.height

      if (orientationPending) {
        lastWidth = viewport.width

        const documentHeight =
          document.documentElement.clientHeight ||
          window.innerHeight

        const hostHeight = Math.max(
          visibleBottom,
          documentHeight,
        )

        const keyboardInset = Math.max(
          0,
          hostHeight - visibleBottom,
        )

        const threshold =
          getOpeningThreshold(hostHeight)

        const open = current.keyboardOpen
          ? keyboardInset > RECOVERY_TOLERANCE
          : editableFocused &&
            keyboardInset > threshold

        orientationPending = false
        protectedSequence = open || editableFocused

        publish({
          stableHeight: hostHeight,
          offsetTop: open ? viewport.offsetTop : 0,
          keyboardInset: open ? keyboardInset : 0,
          keyboardOpen: open,
        })

        return
      }

      const keyboardInset = Math.max(
        0,
        current.stableHeight - visibleBottom,
      )

      const viewportLoss = Math.max(
        0,
        current.stableHeight - viewport.height,
      )

      const threshold =
        getOpeningThreshold(current.stableHeight)

      const open = current.keyboardOpen
        ? viewportLoss > RECOVERY_TOLERANCE
        : editableFocused &&
          viewportLoss > threshold

      if (open) {
        protectedSequence = true

        publish({
          ...current,
          offsetTop: viewport.offsetTop,
          keyboardInset,
          keyboardOpen: true,
        })

        return
      }

      if (protectedSequence) {
        /*
         * Do not replace the healthy viewport baseline while the
         * keyboard is still opening or closing.
         */
        if (viewportLoss > RECOVERY_TOLERANCE) return

        protectedSequence = editableFocused

        publish({
          stableHeight: visibleBottom,
          offsetTop: 0,
          keyboardInset: 0,
          keyboardOpen: false,
        })

        return
      }

      publish({
        stableHeight: visibleBottom,
        offsetTop: 0,
        keyboardInset: 0,
        keyboardOpen: false,
      })
    }

    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(measure)
      }
    }

    const queueOrientationProbe = () => {
      if (orientationTimer !== undefined) {
        clearTimeout(orientationTimer)
      }

      orientationTimer = setTimeout(() => {
        orientationTimer = undefined
        orientationPending = true
        schedule()
      }, 280)
    }

    const cancelCloseProbe = () => {
      if (closeTimer !== undefined) {
        clearTimeout(closeTimer)
      }

      closeTimer = undefined
    }

        const onFocusIn = (event: FocusEvent) => {
      cancelCloseProbe()

      editableFocused = isTextEntry(event.target)

      if (editableFocused) {
        protectedSequence = true
      }

      schedule()

      if (openTimer !== undefined) {
        clearTimeout(openTimer)
      }

      openTimer = setTimeout(() => {
        openTimer = undefined
        schedule()
      }, 300)
    }

    const onFocusOut = () => {
      editableFocused = false
      schedule()

      cancelCloseProbe()

      closeTimer = setTimeout(() => {
        closeTimer = undefined
        schedule()
      }, 420)
    }

    const onOrientation = () => {
      orientationPending = true
      schedule()
      queueOrientationProbe()
    }

    viewport.addEventListener('resize', schedule)
    viewport.addEventListener('scroll', schedule)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    window.addEventListener(
      'orientationchange',
      onOrientation,
    )

    return () => {
      viewport.removeEventListener('resize', schedule)
      viewport.removeEventListener('scroll', schedule)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener(
        'focusout',
        onFocusOut,
      )
      window.removeEventListener(
        'orientationchange',
        onOrientation,
      )

            cancelAnimationFrame(frame)
      cancelCloseProbe()

      if (openTimer !== undefined) {
        clearTimeout(openTimer)
      }

      if (orientationTimer !== undefined) {
        clearTimeout(orientationTimer)
      }
    }

    // The initial snapshot is intentionally captured once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return state
}