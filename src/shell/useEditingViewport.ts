import { useEffect, useRef, useState } from 'react'
import {
  classifyViewportSensorSnapshot,
  deriveEditingViewportGeometry,
  isValidViewportSensorSnapshot,
  viewportSnapshotsAreEquivalent,
  type ViewportSensorSnapshot,
} from './editingViewportGeometry'
import { canOwnVerticalGesture } from './editingScrollOwnership'

export interface EditingViewportState {
  hostHeight: number
  editTop: number
  editHeight: number
  editing: boolean
}

type EditingPhase = 'normal' | 'awaiting-geometry' | 'editing' | 'recovering'
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
  return { hostHeight, editTop: 0, editHeight: hostHeight, editing: false }
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
    a.editHeight === b.editHeight && a.editing === b.editing
}

export function useEditingViewport(): EditingViewportState {
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

    const publishAccepted = (next: EditingViewportState) => {
      lastAcceptedGeometry.current = next
      setState((current) => statesMatch(current, next) ? current : next)
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
      phase = 'editing'
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

    const processSnapshot = (snapshot: ViewportSensorSnapshot, measurementEpoch: number) => {
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
        const mayConfirmRecovery = weakRecovery && (
          phase === 'recovering' || phase === 'editing' ||
          (phase === 'normal' && !editableFocused)
        )
        const mayConfirmOpening = !weakRecovery && phase === 'awaiting-geometry' &&
          editableFocused && !suppressUntilNewFocus
        if (!mayConfirmRecovery && !mayConfirmOpening) return
        if (weakCandidate && viewportSnapshotsAreEquivalent(weakCandidate, snapshot)) weakConfirmations += 1
        else { weakCandidate = snapshot; weakConfirmations = 1; weakFramesRemaining = WEAK_FOLLOW_UP_FRAMES }
        if (weakConfirmations >= WEAK_CONFIRMATIONS_REQUIRED) {
          clearWeakSampling()
          if (weakRecovery) {
            suppressUntilNewFocus = editableFocused
            acceptNormal(snapshot)
          } else {
            const geometry = deriveEditingViewportGeometry(snapshot)
            acceptEditing(snapshot, geometry.editTop, geometry.editHeight)
          }
          return
        }
        if (weakFramesRemaining > 0 && !weakFrame) {
          weakFramesRemaining -= 1
          const scheduledEpoch = epoch
          weakFrame = requestAnimationFrame(() => {
            weakFrame = 0
            processSnapshot(readSnapshot(transitionBaseline.hostHeight), scheduledEpoch)
          })
        }
        return
      }
      clearWeakSampling()
      if (classification.kind === 'recovered') {
        if (phase === 'recovering' || phase === 'editing') {
          suppressUntilNewFocus = editableFocused
          acceptNormal(snapshot)
        } else if (phase === 'normal' && !editableFocused) acceptNormal(snapshot)
        return
      }
      if ((phase === 'awaiting-geometry' && editableFocused && !suppressUntilNewFocus) || phase === 'editing') {
        acceptEditing(snapshot, classification.geometry.editTop, classification.geometry.editHeight)
      }
    }
    const measure = (measurementEpoch = epoch) => {
      frame = 0
      processSnapshot(readSnapshot(transitionBaseline.hostHeight), measurementEpoch)
    }
    const schedule = () => {
      if (!frame) { const scheduledEpoch = epoch; frame = requestAnimationFrame(() => measure(scheduledEpoch)) }
    }
    const cancelCloseProbe = () => { if (closeTimer !== undefined) clearTimeout(closeTimer); closeTimer = undefined }

    const onFocusIn = (event: FocusEvent) => {
      if (!isEditable(event.target)) return
      cancelCloseProbe()
      editableFocused = true
      suppressUntilNewFocus = false
      advanceEpoch()
      phase = 'awaiting-geometry'
      transitionBaseline = acceptedNormalSnapshot
      schedule()
    }
    const onFocusOut = (event: FocusEvent) => {
      if (!isEditable(event.target)) return
      editableFocused = false
      advanceEpoch()
      if (phase === 'editing') phase = 'recovering'
      else if (phase === 'awaiting-geometry') {
        phase = 'normal'
        transitionBaseline = acceptedNormalSnapshot
        publishAccepted(normalState(acceptedNormalSnapshot.hostHeight))
      }
      schedule(); cancelCloseProbe()
      const timerEpoch = epoch
      closeTimer = setTimeout(() => { closeTimer = undefined; if (timerEpoch === epoch) schedule() }, CLOSE_PROBE_DELAY)
    }
    const rebaseAfterOrientation = (timerEpoch: number) => {
      orientationTimer = undefined
      if (timerEpoch !== epoch) return
      const raw = readSnapshot(lastAcceptedGeometry.current.hostHeight)
      if (!isValidViewportSensorSnapshot(raw)) return
      const rebasedHeight = Math.max(1, raw.offsetTop + raw.visualHeight, raw.clientHeight)
      const rebased = { ...raw, hostHeight: rebasedHeight }
      if (phase === 'normal') {
        processSnapshot(rebased, epoch)
      } else {
        acceptedNormalSnapshot = {
          ...acceptedNormalSnapshot,
          hostHeight: rebasedHeight,
        }
        transitionBaseline = acceptedNormalSnapshot
        processSnapshot(rebased, epoch)
      }
    }
    const onOrientationChange = () => {
      if (orientationTimer !== undefined) clearTimeout(orientationTimer)
      const timerEpoch = advanceEpoch()
      orientationTimer = setTimeout(() => rebaseAfterOrientation(timerEpoch), ORIENTATION_REBASE_DELAY)
    }

    const resetTouchGesture = () => { touchAxis = 'pending'; touchScrollOwner = null }
    const onTouchStart = (event: TouchEvent) => {
      if (phase !== 'editing' || event.touches.length !== 1) { resetTouchGesture(); return }
      const touch = event.touches[0]; touchStartX = touchX = touch.clientX; touchStartY = touchY = touch.clientY
      touchAxis = 'pending'; touchScrollOwner = event.target instanceof Element ? event.target.closest('[data-editing-scroll-owner]') : null
    }
    const onTouchMove = (event: TouchEvent) => {
      if (phase !== 'editing' || event.touches.length !== 1) { resetTouchGesture(); return }
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
    if (!viewport) window.addEventListener('resize', schedule)
    mediaQuery?.addEventListener('change', schedule)
    document.addEventListener('focusin', onFocusIn); document.addEventListener('focusout', onFocusOut)
    document.addEventListener('touchstart', onTouchStart, { passive: true }); document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', resetTouchGesture, { passive: true }); document.addEventListener('touchcancel', resetTouchGesture, { passive: true })
    window.addEventListener('orientationchange', onOrientationChange); schedule()
    return () => {
      viewport?.removeEventListener('resize', schedule); viewport?.removeEventListener('scroll', schedule)
      if (!viewport) window.removeEventListener('resize', schedule)
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
