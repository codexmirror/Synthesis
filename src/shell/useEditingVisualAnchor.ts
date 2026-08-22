import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react'
import {
  deriveVisualAnchorCompensation,
  visualAnchorScaleChanged,
} from './editingVisualAnchor'
import type { EditingViewportState } from './useEditingViewport'

export interface EditingVisualAnchorSnapshot {
  phase: EditingViewportState['phase']
  holding: boolean
  targetTop?: number
  measuredTop?: number
  rawTop?: number
  appliedY: number
  epoch: number
  acceptanceRevision: number
  suspendedByScale: boolean
}

export interface EditingVisualAnchor {
  getSnapshot(): EditingVisualAnchorSnapshot
}

function isEditable(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLTextAreaElement) return !target.disabled && !target.readOnly
  if (target instanceof HTMLInputElement) {
    return !target.disabled && !target.readOnly && ![
      'checkbox', 'radio', 'range', 'color', 'file', 'button', 'submit',
      'reset', 'image', 'hidden',
    ].includes(target.type)
  }
  return target.isContentEditable
}

function viewportScale(): number {
  return window.visualViewport?.scale ?? 1
}

export function useEditingVisualAnchor(
  shellRef: RefObject<HTMLDivElement | null>,
  viewportState: EditingViewportState,
): EditingVisualAnchor {
  const viewportStateRef = useRef(viewportState)
  const active = useRef(false)
  const armedKind = useRef<'direct' | 'focus' | 'recovery'>()
  const armedTarget = useRef<HTMLElement>()
  const suspendedByScale = useRef(false)
  const targetTop = useRef<number>()
  const measuredTop = useRef<number>()
  const rawTop = useRef<number>()
  const acquiredScale = useRef(1)
  const appliedY = useRef(0)
  const epoch = useRef(0)
  const frame = useRef(0)
  const snapshot = useRef<EditingVisualAnchorSnapshot>({
    phase: viewportState.phase,
    holding: viewportState.holding,
    appliedY: 0,
    epoch: 0,
    acceptanceRevision: viewportState.acceptanceRevision,
    suspendedByScale: false,
  })

  viewportStateRef.current = viewportState

  const updateSnapshot = () => {
    snapshot.current = {
      phase: viewportStateRef.current.phase,
      holding: viewportStateRef.current.holding,
      targetTop: targetTop.current,
      measuredTop: measuredTop.current,
      rawTop: rawTop.current,
      appliedY: appliedY.current,
      epoch: epoch.current,
      acceptanceRevision: viewportStateRef.current.acceptanceRevision,
      suspendedByScale: suspendedByScale.current,
    }
  }

  const writeTranslation = (next: number) => {
    const shell = shellRef.current
    if (!shell) return
    appliedY.current = next
    if (next === 0) shell.style.removeProperty('transform')
    else shell.style.transform = `translate3d(0, ${next}px, 0)`
    updateSnapshot()
  }

  const invalidateFrame = () => {
    epoch.current += 1
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = 0
  }

  const release = () => {
    invalidateFrame()
    active.current = false
    armedKind.current = undefined
    armedTarget.current = undefined
    suspendedByScale.current = false
    targetTop.current = undefined
    measuredTop.current = undefined
    rawTop.current = undefined
    writeTranslation(0)
  }

  const acquire = (
    kind: NonNullable<typeof armedKind.current>,
    target?: HTMLElement,
  ) => {
    const shell = shellRef.current
    if (!shell) return
    invalidateFrame()
    active.current = true
    armedKind.current = kind
    armedTarget.current = target
    suspendedByScale.current = false
    targetTop.current = shell.getBoundingClientRect().top
    measuredTop.current = targetTop.current
    rawTop.current = targetTop.current - appliedY.current
    acquiredScale.current = viewportScale()
    updateSnapshot()
  }

  const measure = (measurementEpoch: number) => {
    frame.current = 0
    if (measurementEpoch !== epoch.current || !active.current || suspendedByScale.current) return
    const shell = shellRef.current
    const target = targetTop.current
    if (!shell || target === undefined) return

    const scale = viewportScale()
    if (visualAnchorScaleChanged(acquiredScale.current, scale)) {
      invalidateFrame()
      suspendedByScale.current = true
      active.current = false
      armedKind.current = undefined
      armedTarget.current = undefined
      targetTop.current = undefined
      measuredTop.current = undefined
      rawTop.current = undefined
      writeTranslation(0)
      return
    }

    const measured = shell.getBoundingClientRect().top
    const compensation = deriveVisualAnchorCompensation(
      target,
      measured,
      appliedY.current,
    )
    if (!compensation) return
    measuredTop.current = measured
    rawTop.current = compensation.rawTop
    if (compensation.changed) writeTranslation(compensation.nextTranslationY)
    else updateSnapshot()
  }

  const schedule = () => {
    const state = viewportStateRef.current
    if (!active.current || suspendedByScale.current ||
      (!armedKind.current && !state.holding)) return
    if (!frame.current) {
      const scheduledEpoch = epoch.current
      frame.current = requestAnimationFrame(() => measure(scheduledEpoch))
    }
  }

  useLayoutEffect(() => {
    updateSnapshot()
    // A new accepted frame supersedes every translation derived from the old
    // accepted presentation. Clear before the browser can paint that frame.
    writeTranslation(0)
    invalidateFrame()

    if (viewportState.phase === 'editing') {
      const shell = shellRef.current
      active.current = Boolean(shell)
      armedKind.current = undefined
      armedTarget.current = undefined
      suspendedByScale.current = false
      targetTop.current = shell?.getBoundingClientRect().top
      measuredTop.current = targetTop.current
      rawTop.current = targetTop.current
      acquiredScale.current = viewportScale()
      updateSnapshot()
    } else if (viewportState.phase === 'normal') {
      active.current = false
      armedKind.current = undefined
      armedTarget.current = undefined
      targetTop.current = undefined
      measuredTop.current = undefined
      rawTop.current = undefined
      updateSnapshot()
    }
    // acceptanceRevision is the commit boundary; phase-only HOLD updates must
    // not clear an active compensation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportState.acceptanceRevision, shellRef])

  useLayoutEffect(() => {
    updateSnapshot()
    if (viewportState.holding) {
      armedKind.current = undefined
      armedTarget.current = undefined
      schedule()
    }
    // Phase/HOLD publication does not change accepted geometry, but it can
    // activate stabilization after the geometry listener classified an event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportState.phase, viewportState.holding])

  useEffect(() => {
    const shell = shellRef.current
    const visualViewport = window.visualViewport
    if (!shell) return

    const onDirectStart = (event: Event) => {
      if (!isEditable(event.target) || !shell.contains(event.target)) {
        if (armedKind.current === 'direct') release()
        return
      }
      const state = viewportStateRef.current
      if (event.target === document.activeElement &&
        state.phase === 'editing' && !state.holding) return
      if (armedKind.current === 'direct' && armedTarget.current === event.target &&
        targetTop.current !== undefined) return
      acquire('direct', event.target)
    }
    const onFocusIn = (event: FocusEvent) => {
      if (!isEditable(event.target) || !shell.contains(event.target)) return
      // Focus confirms the direct interaction, but geometry HOLD may not have
      // committed yet. Remain armed through that handoff.
      if (active.current && armedKind.current === 'direct' &&
        armedTarget.current === event.target && targetTop.current !== undefined) {
        armedKind.current = 'focus'
        updateSnapshot()
        return
      }
      acquire('focus', event.target)
    }
    const onFocusOut = (event: FocusEvent) => {
      if (!isEditable(event.target) || !shell.contains(event.target)) return
      // Recovery browser motion can begin before React publishes RECOVERING.
      acquire('recovery', event.target)
    }
    const cancelUnconfirmedDirect = () => {
      if (armedKind.current === 'direct') release()
    }
    const onSelectionChange = () => {
      if (armedKind.current === 'direct' &&
        document.activeElement !== armedTarget.current) release()
    }
    const onOrientationChange = () => {
      release()
      suspendedByScale.current = true
      updateSnapshot()
    }

    shell.addEventListener('pointerdown', onDirectStart, true)
    shell.addEventListener('touchstart', onDirectStart, { capture: true, passive: true })
    shell.addEventListener('focusin', onFocusIn)
    shell.addEventListener('focusout', onFocusOut)
    shell.addEventListener('click', cancelUnconfirmedDirect, true)
    shell.addEventListener('pointercancel', cancelUnconfirmedDirect, true)
    shell.addEventListener('touchcancel', cancelUnconfirmedDirect, true)
    shell.addEventListener('contextmenu', cancelUnconfirmedDirect, true)
    document.addEventListener('selectionchange', onSelectionChange)
    visualViewport?.addEventListener('resize', schedule)
    visualViewport?.addEventListener('scroll', schedule)
    if (!visualViewport) window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', onOrientationChange)
    return () => {
      shell.removeEventListener('pointerdown', onDirectStart, true)
      shell.removeEventListener('touchstart', onDirectStart, true)
      shell.removeEventListener('focusin', onFocusIn)
      shell.removeEventListener('focusout', onFocusOut)
      shell.removeEventListener('click', cancelUnconfirmedDirect, true)
      shell.removeEventListener('pointercancel', cancelUnconfirmedDirect, true)
      shell.removeEventListener('touchcancel', cancelUnconfirmedDirect, true)
      shell.removeEventListener('contextmenu', cancelUnconfirmedDirect, true)
      document.removeEventListener('selectionchange', onSelectionChange)
      visualViewport?.removeEventListener('resize', schedule)
      visualViewport?.removeEventListener('scroll', schedule)
      if (!visualViewport) window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', onOrientationChange)
      release()
    }
    // Listeners remain stable and read current lifecycle values from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellRef])

  return {
    getSnapshot: () => snapshot.current,
  }
}
