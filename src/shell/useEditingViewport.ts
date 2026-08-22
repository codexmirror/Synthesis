import { type RefObject, useEffect, useRef, useState } from 'react'
import {
  RECOVERY_TOLERANCE,
  classifyViewportSensorSnapshot,
  deriveEditingViewportGeometry,
  hasEditingViewportRecovered,
  isApproximatelyUnscaled,
  isValidViewportSensorSnapshot,
  viewportSnapshotsAreEquivalent,
  type ViewportSensorSnapshot,
} from './editingViewportGeometry'
import { canOwnVerticalGesture } from './editingScrollOwnership'
import { deriveEditingPresentationPlane } from './editingPresentationPlane'

export interface EditingViewportState {
  hostHeight: number
  editTop: number
  editHeight: number
  editing: boolean
  editingPresentation: boolean
  presentationPhase: EditingPresentationPhase
  targetViewportTop: number
  shellTop: number
  shellBottom: number
  presentationTop: number
  presentationHeight: number
  recoveryReady: boolean
}

type EditingPhase = 'normal' | 'awaiting-geometry' | 'editing' | 'recovering'
export type EditingPresentationPhase = 'normal' | 'entering' | 'editing' | 'recovering'
type MeasurementSource = 'browser-event' | 'follow-up'
type TouchAxis = 'pending' | 'horizontal' | 'vertical'

const EDITING_PRESENTATION_QUERY =
  '(max-width: 700px), (max-width: 900px) and (pointer: coarse)'
const CLOSE_PROBE_DELAY = 360
const ORIENTATION_REBASE_DELAY = 280
const WEAK_CONFIRMATIONS_REQUIRED = 3
const WEAK_FOLLOW_UP_FRAMES = 2
const TOUCH_SLOP = 6

function isEditable(target: EventTarget | null): boolean {
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

function supportsEditingPresentation(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(EDITING_PRESENTATION_QUERY).matches
    : window.innerWidth <= 700
}

function readSnapshot(hostHeight: number): ViewportSensorSnapshot {
  const viewport = window.visualViewport
  const visualHeight = viewport?.height ?? window.innerHeight
  return {
    hostHeight,
    visualHeight,
    offsetTop: viewport?.offsetTop ?? 0,
    pageTop: viewport?.pageTop ?? window.scrollY,
    innerHeight: window.innerHeight,
    clientHeight: document.documentElement.clientHeight || window.innerHeight,
    scrollY: window.scrollY,
    scale: viewport?.scale ?? 1,
  }
}

function initialSnapshot(): ViewportSensorSnapshot {
  const viewport = window.visualViewport
  const height = Math.max(1, Math.round(
    viewport ? viewport.offsetTop + viewport.height : window.innerHeight,
  ))
  return readSnapshot(height)
}

function normalState(hostHeight: number): EditingViewportState {
  return {
    hostHeight, editTop: 0, editHeight: hostHeight, editing: false,
    editingPresentation: false, presentationPhase: 'normal',
    targetViewportTop: 0, shellTop: 0, shellBottom: hostHeight,
    presentationTop: 0, presentationHeight: hostHeight, recoveryReady: true,
  }
}

function healthyHostHeight(snapshot: ViewportSensorSnapshot): number {
  return Math.max(
    1,
    Math.round(snapshot.offsetTop + snapshot.visualHeight),
    Math.round(snapshot.clientHeight),
  )
}

function statesMatch(a: EditingViewportState, b: EditingViewportState): boolean {
  return a.hostHeight === b.hostHeight && a.editTop === b.editTop &&
    a.editHeight === b.editHeight && a.editing === b.editing &&
    a.editingPresentation === b.editingPresentation &&
    a.presentationPhase === b.presentationPhase &&
    a.targetViewportTop === b.targetViewportTop &&
    a.shellTop === b.shellTop && a.shellBottom === b.shellBottom &&
    a.presentationTop === b.presentationTop &&
    a.presentationHeight === b.presentationHeight &&
    a.recoveryReady === b.recoveryReady
}

interface EditingViewportOptions {
  shellRef: RefObject<HTMLElement>
  standalone: boolean
}

export function useEditingViewport({ shellRef, standalone }: EditingViewportOptions): EditingViewportState {
  const initial = initialSnapshot()
  const initialAccepted = isValidViewportSensorSnapshot(initial)
    ? initial
    : { ...initial, hostHeight: Math.max(1, window.innerHeight), visualHeight: Math.max(1, window.innerHeight), innerHeight: Math.max(1, window.innerHeight), clientHeight: Math.max(1, document.documentElement.clientHeight || window.innerHeight), scale: 1 }
  const [state, setState] = useState(() => normalState(initialAccepted.hostHeight))
  const lastAcceptedGeometry = useRef(normalState(initialAccepted.hostHeight))

  useEffect(() => {
    const viewport = window.visualViewport
    const mediaQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia(EDITING_PRESENTATION_QUERY) : undefined
    let acceptedNormalSnapshot = initialAccepted
    let transitionBaseline = initialAccepted
    let phase: EditingPhase = 'normal'
    let presentationPhase: EditingPresentationPhase = 'normal'
    let editableFocused = false
    let suppressUntilNewFocus = false
    let epoch = 0
    let frame = 0
    let weakFrame = 0
    let weakCandidate: ViewportSensorSnapshot | undefined
    let weakConfirmations = 0
    let weakFramesRemaining = 0
    let closeTimer: ReturnType<typeof setTimeout> | undefined
    let orientationTimer: ReturnType<typeof setTimeout> | undefined
    let touchStartX = 0, touchStartY = 0, touchX = 0, touchY = 0
    let touchAxis: TouchAxis = 'pending'
    let touchScrollOwner: HTMLElement | null = null
    let targetViewportTop = 0
    let shellTop = 0
    let shellBottom = initialAccepted.hostHeight
    let presentationTop = 0
    let presentationHeight = initialAccepted.hostHeight
    let focusExitToken = 0

    const publish = () => {
      const geometry = lastAcceptedGeometry.current
      const next: EditingViewportState = {
        ...geometry,
        editingPresentation: presentationPhase !== 'normal',
        presentationPhase,
        targetViewportTop,
        shellTop,
        shellBottom,
        presentationTop,
        presentationHeight,
        recoveryReady: presentationPhase === 'normal',
      }
      setState((current) => statesMatch(current, next) ? current : next)
    }
    const publishAccepted = (next: Pick<EditingViewportState, 'hostHeight' | 'editTop' | 'editHeight' | 'editing'>) => {
      lastAcceptedGeometry.current = { ...lastAcceptedGeometry.current, ...next }
      publish()
    }
    const finishPresentation = () => {
      presentationPhase = 'normal'
      targetViewportTop = 0
      shellTop = 0
      shellBottom = lastAcceptedGeometry.current.hostHeight
      presentationTop = 0
      presentationHeight = lastAcceptedGeometry.current.hostHeight
      publish()
    }
    const updatePresentationMapping = () => {
      if (presentationPhase === 'normal' || standalone) return
      const viewportScale = window.visualViewport?.scale ?? 1
      if (!isApproximatelyUnscaled(viewportScale)) return
      const shell = shellRef.current
      if (!shell) return
      const rect = shell.getBoundingClientRect()
      const plane = deriveEditingPresentationPlane({
        targetViewportTop,
        shellTop: rect.top,
        shellHeight: rect.height,
        geometryEditing: lastAcceptedGeometry.current.editing,
        acceptedEditHeight: lastAcceptedGeometry.current.editHeight,
      })
      if (!plane) return
      shellTop = rect.top
      shellBottom = rect.bottom
      presentationTop = plane.presentationTop
      presentationHeight = plane.presentationHeight
      publish()
    }
    const acceptNormal = (snapshot: ViewportSensorSnapshot) => {
      const height = healthyHostHeight(snapshot)
      const accepted = { ...snapshot, hostHeight: height }
      acceptedNormalSnapshot = accepted
      transitionBaseline = accepted
      phase = 'normal'
      weakCandidate = undefined
      publishAccepted(normalState(height))
    }
    const acceptEditing = (snapshot: ViewportSensorSnapshot, editTop: number, editHeight: number) => {
      phase = presentationPhase === 'recovering' ? 'recovering' : 'editing'
      if (presentationPhase !== 'recovering') presentationPhase = 'editing'
      weakCandidate = undefined
      publishAccepted({ hostHeight: transitionBaseline.hostHeight, editTop, editHeight, editing: true })
      // The accepted sensor state is the baseline for subsequent editing updates.
      transitionBaseline = snapshot
    }
    const clearWeakSampling = () => {
      if (weakFrame) cancelAnimationFrame(weakFrame)
      weakFrame = 0; weakCandidate = undefined; weakConfirmations = 0; weakFramesRemaining = 0
    }
    const advanceEpoch = () => { epoch += 1; clearWeakSampling(); return epoch }

    const processSnapshot = (
      snapshot: ViewportSensorSnapshot,
      measurementEpoch: number,
      source: MeasurementSource,
    ) => {
      if (measurementEpoch !== epoch) return
      if (!supportsEditingPresentation()) {
        if (isValidViewportSensorSnapshot(snapshot)) acceptNormal(snapshot)
        return
      }
      const classification = classifyViewportSensorSnapshot(snapshot, transitionBaseline)
      if (classification.kind === 'invalid') return
      if (classification.kind === 'pending') {
        if (classification.reason === 'hard-contradiction') { clearWeakSampling(); return }
        const weakRecovery = classification.reason === 'weak-recovery'
        // A height-first recovery cannot become accepted merely because the
        // same incomplete sensor state survived several animation frames.
        if (weakRecovery) {
          clearWeakSampling()
          const shell = shellRef.current
          const shellReturned = shell && Math.abs(shell.getBoundingClientRect().top - targetViewportTop) <= RECOVERY_TOLERANCE
          if (phase === 'recovering' && !editableFocused && shellReturned &&
            hasEditingViewportRecovered(snapshot.hostHeight, snapshot.visualHeight)) {
            acceptNormal(snapshot)
            finishPresentation()
          }
          return
        }
        const mayConfirmOpening = phase === 'awaiting-geometry' &&
          editableFocused && !suppressUntilNewFocus
        if (!mayConfirmOpening) return
        if (source === 'browser-event') {
          weakFramesRemaining = WEAK_FOLLOW_UP_FRAMES
        }
        if (weakCandidate && viewportSnapshotsAreEquivalent(weakCandidate, snapshot)) weakConfirmations += 1
        else { weakCandidate = snapshot; weakConfirmations = 1 }
        if (weakConfirmations >= WEAK_CONFIRMATIONS_REQUIRED) {
          clearWeakSampling()
          const geometry = deriveEditingViewportGeometry(snapshot)
          acceptEditing(snapshot, geometry.editTop, geometry.editHeight)
          return
        }
        if (weakFramesRemaining > 0 && !weakFrame) {
          weakFramesRemaining -= 1
          const scheduledEpoch = epoch
          weakFrame = requestAnimationFrame(() => {
            weakFrame = 0
            processSnapshot(
              readSnapshot(transitionBaseline.hostHeight),
              scheduledEpoch,
              'follow-up',
            )
          })
        }
        return
      }
      clearWeakSampling()
      if (classification.kind === 'recovered') {
        if (phase === 'recovering' || phase === 'editing') {
          suppressUntilNewFocus = editableFocused
          acceptNormal(snapshot)
          if (!editableFocused) finishPresentation()
        } else if (phase === 'normal' && !editableFocused) acceptNormal(snapshot)
        return
      }
      if ((phase === 'awaiting-geometry' && editableFocused && !suppressUntilNewFocus) ||
        phase === 'editing' || phase === 'recovering') {
        acceptEditing(snapshot, classification.geometry.editTop, classification.geometry.editHeight)
      }
    }
    const measure = (measurementEpoch = epoch) => {
      frame = 0
      processSnapshot(
        readSnapshot(transitionBaseline.hostHeight),
        measurementEpoch,
        'browser-event',
      )
      updatePresentationMapping()
    }
    const schedule = () => {
      if (!frame) { const scheduledEpoch = epoch; frame = requestAnimationFrame(() => measure(scheduledEpoch)) }
    }
    const cancelCloseProbe = () => { if (closeTimer !== undefined) clearTimeout(closeTimer); closeTimer = undefined }

    const onFocusIn = (event: FocusEvent) => {
      const shell = shellRef.current
      if (!supportsEditingPresentation() || !isEditable(event.target) ||
        !shell?.contains(event.target as Node)) return
      focusExitToken += 1
      cancelCloseProbe()
      if (editableFocused && presentationPhase !== 'normal') {
        suppressUntilNewFocus = false
        if (!lastAcceptedGeometry.current.editing) {
          phase = 'awaiting-geometry'
          transitionBaseline = acceptedNormalSnapshot
          presentationPhase = 'entering'
          publish()
        }
        schedule()
        return
      }
      if (presentationPhase === 'recovering') {
        editableFocused = true
        suppressUntilNewFocus = false
        phase = lastAcceptedGeometry.current.editing ? 'editing' : 'awaiting-geometry'
        presentationPhase = lastAcceptedGeometry.current.editing ? 'editing' : 'entering'
        publish()
        schedule()
        return
      }
      editableFocused = true
      suppressUntilNewFocus = false
      advanceEpoch()
      phase = 'awaiting-geometry'
      presentationPhase = 'entering'
      transitionBaseline = acceptedNormalSnapshot
      if (!standalone) {
        const rect = shell.getBoundingClientRect()
        targetViewportTop = rect.top
        shellTop = rect.top
        shellBottom = rect.bottom
        presentationTop = 0
        presentationHeight = Number.isFinite(rect.height) && rect.height > 0
          ? rect.height
          : lastAcceptedGeometry.current.hostHeight
      }
      publish()
      schedule()
    }
    const onFocusOut = (event: FocusEvent) => {
      const shell = shellRef.current
      if (!isEditable(event.target) || !shell?.contains(event.target as Node)) return
      const related = event.relatedTarget
      if (isEditable(related) && shell.contains(related as Node)) return
      const token = ++focusExitToken
      queueMicrotask(() => {
        if (token !== focusExitToken) return
        const active = document.activeElement
        if (isEditable(active) && shell.contains(active as Node)) return
        editableFocused = false
        advanceEpoch()
        phase = 'recovering'
        presentationPhase = 'recovering'
        publish()
        schedule(); cancelCloseProbe()
        const timerEpoch = epoch
        closeTimer = setTimeout(() => { closeTimer = undefined; if (timerEpoch === epoch) schedule() }, CLOSE_PROBE_DELAY)
      })
    }
    const rebaseAfterOrientation = (timerEpoch: number) => {
      orientationTimer = undefined
      if (timerEpoch !== epoch) return
      const raw = readSnapshot(lastAcceptedGeometry.current.hostHeight)
      if (!isValidViewportSensorSnapshot(raw)) return
      const rebasedHeight = Math.max(1, raw.offsetTop + raw.visualHeight, raw.clientHeight)
      const rebased = { ...raw, hostHeight: rebasedHeight }
      if (phase === 'normal') {
        processSnapshot(rebased, epoch, 'browser-event')
      } else {
        acceptedNormalSnapshot = {
          ...acceptedNormalSnapshot,
          hostHeight: rebasedHeight,
        }
        transitionBaseline = acceptedNormalSnapshot
        processSnapshot(rebased, epoch, 'browser-event')
      }
    }
    const onOrientationChange = () => {
      if (orientationTimer !== undefined) clearTimeout(orientationTimer)
      const timerEpoch = advanceEpoch()
      orientationTimer = setTimeout(() => rebaseAfterOrientation(timerEpoch), ORIENTATION_REBASE_DELAY)
    }

    const resetTouchGesture = () => { touchAxis = 'pending'; touchScrollOwner = null }
    const onTouchStart = (event: TouchEvent) => {
      if (presentationPhase === 'normal' || event.touches.length !== 1) { resetTouchGesture(); return }
      const touch = event.touches[0]; touchStartX = touchX = touch.clientX; touchStartY = touchY = touch.clientY
      touchAxis = 'pending'; touchScrollOwner = event.target instanceof Element ? event.target.closest('[data-editing-scroll-owner]') : null
    }
    const onTouchMove = (event: TouchEvent) => {
      if (presentationPhase === 'normal' || event.touches.length !== 1) { resetTouchGesture(); return }
      const touch = event.touches[0], deltaY = touch.clientY - touchY
      const totalDeltaX = touch.clientX - touchStartX, totalDeltaY = touch.clientY - touchStartY
      touchX = touch.clientX; touchY = touch.clientY
      if (touchAxis === 'pending') {
        if (Math.hypot(totalDeltaX, totalDeltaY) < TOUCH_SLOP) return
        touchAxis = Math.abs(totalDeltaY) > Math.abs(totalDeltaX) ? 'vertical' : 'horizontal'
      }
      if (touchAxis === 'horizontal') return
      if (touchScrollOwner && canOwnVerticalGesture(touchScrollOwner, deltaY)) return
      event.preventDefault()
    }

    viewport?.addEventListener('resize', schedule); viewport?.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule); window.addEventListener('scroll', schedule)
    mediaQuery?.addEventListener('change', schedule)
    document.addEventListener('focusin', onFocusIn); document.addEventListener('focusout', onFocusOut)
    document.addEventListener('touchstart', onTouchStart, { passive: true }); document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', resetTouchGesture, { passive: true }); document.addEventListener('touchcancel', resetTouchGesture, { passive: true })
    window.addEventListener('orientationchange', onOrientationChange); schedule()
    return () => {
      viewport?.removeEventListener('resize', schedule); viewport?.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule)
      mediaQuery?.removeEventListener('change', schedule)
      document.removeEventListener('focusin', onFocusIn); document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('touchstart', onTouchStart); document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', resetTouchGesture); document.removeEventListener('touchcancel', resetTouchGesture)
      window.removeEventListener('orientationchange', onOrientationChange)
      cancelAnimationFrame(frame); clearWeakSampling(); cancelCloseProbe()
      if (orientationTimer !== undefined) clearTimeout(orientationTimer)
    }
  }, [])
  return state
}
