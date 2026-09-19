import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  viewportLifecycle: ViewportLifecycle
}

/**
 * The Shell-owned editing surface: the published presentation state plus the
 * one explicit intent the Shell can express into this state machine.
 */
export interface EditingViewportControl extends EditingViewportState {
  /**
   * Explicit end-of-editing intent, owned by the Shell (DONE, an operating
   * context switch, a RACK-OS section change). It releases a Shell editable
   * that still holds focus and always hands the intent to the state machine,
   * so leaving editing never depends on Mobile Safari producing one exact
   * focusout sequence. It never forces normal geometry: convergence still
   * waits for recovered viewport evidence.
   */
  endEditing(): void
}

type EditingPhase = 'normal' | 'awaiting-geometry' | 'editing' | 'recovering'
export type EditingPresentationPhase = 'normal' | 'entering' | 'editing' | 'recovering'
export type ViewportLifecycle = 'active' | 'suspended' | 'resume-acquisition'
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
    viewportLifecycle: 'active',
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
    a.recoveryReady === b.recoveryReady &&
    a.viewportLifecycle === b.viewportLifecycle
}

interface EditingViewportOptions {
  shellRef: RefObject<HTMLElement>
  standalone: boolean
  onDiagnostic?: (name: string, detail?: Record<string, unknown>) => void
}

export function useEditingViewport({ shellRef, standalone, onDiagnostic }: EditingViewportOptions): EditingViewportControl {
  const initial = initialSnapshot()
  const initialAccepted = isValidViewportSensorSnapshot(initial)
    ? initial
    : { ...initial, hostHeight: Math.max(1, window.innerHeight), visualHeight: Math.max(1, window.innerHeight), innerHeight: Math.max(1, window.innerHeight), clientHeight: Math.max(1, document.documentElement.clientHeight || window.innerHeight), scale: 1 }
  const [state, setState] = useState(() => normalState(initialAccepted.hostHeight))
  const lastAcceptedGeometry = useRef(normalState(initialAccepted.hostHeight))
  const endEditingRef = useRef<() => void>()
  const endEditing = useCallback(() => { endEditingRef.current?.() }, [])

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
    let suspended = false
    let viewportLifecycle: ViewportLifecycle = 'active'

    const observe = (name: string, detail: Record<string, unknown> = {}) => onDiagnostic?.(name, {
      phase, presentationPhase, editableFocused, suppressUntilNewFocus, epoch,
      geometryEditing: lastAcceptedGeometry.current.editing,
      lifecycle: viewportLifecycle, suspended, framePending: Boolean(frame),
      weakFramePending: Boolean(weakFrame), weakConfirmations, weakFramesRemaining,
      ...detail,
    })

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
        recoveryReady: presentationPhase === 'normal' && !geometry.editing,
        viewportLifecycle,
      }
      setState((current) => statesMatch(current, next) ? current : next)
    }
    const publishAccepted = (next: Pick<EditingViewportState, 'hostHeight' | 'editTop' | 'editHeight' | 'editing'>) => {
      lastAcceptedGeometry.current = { ...lastAcceptedGeometry.current, ...next }
      publish()
    }
    const writePresentationVariables = (shell: HTMLElement) => {
      shell.style.setProperty('--node-presentation-top', `${presentationTop}px`)
      shell.style.setProperty('--node-presentation-height', `${presentationHeight}px`)
    }
    const clearPresentationVariables = () => {
      const shell = shellRef.current
      if (!shell) return
      shell.style.removeProperty('--node-presentation-top')
      shell.style.removeProperty('--node-presentation-height')
    }
    const finishPresentation = () => {
      const completesRecovery = presentationPhase === 'recovering'
      presentationPhase = 'normal'
      targetViewportTop = 0
      shellTop = 0
      shellBottom = lastAcceptedGeometry.current.hostHeight
      presentationTop = 0
      presentationHeight = lastAcceptedGeometry.current.hostHeight
      viewportLifecycle = 'active'
      clearPresentationVariables()
      if (completesRecovery) observe('RECOVERY COMPLETE')
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
      writePresentationVariables(shell)
      publish()
    }
    const maybeFinishPresentationRecovery = (snapshot: ViewportSensorSnapshot) => {
      if (presentationPhase !== 'recovering') return
      if (editableFocused) { observe('RECOVERY BLOCKED', { reason: 'editable-focus' }); return }
      if (lastAcceptedGeometry.current.editing) { observe('RECOVERY BLOCKED', { reason: 'accepted-editing-geometry' }); return }
      if (!isValidViewportSensorSnapshot(snapshot)) { observe('RECOVERY BLOCKED', { reason: 'invalid-snapshot' }); return }
      const heightRecovered = hasEditingViewportRecovered(snapshot.hostHeight, snapshot.visualHeight)
      if (!heightRecovered) { observe('RECOVERY BLOCKED', { reason: 'viewport-height', hostHeight: snapshot.hostHeight, visualHeight: snapshot.visualHeight }); return }
      if (!standalone) {
        const shell = shellRef.current
        if (!shell) { observe('RECOVERY BLOCKED', { reason: 'shell-missing' }); return }
        const actualShellTop = shell.getBoundingClientRect().top
        const delta = Math.abs(actualShellTop - targetViewportTop)
        if (delta > RECOVERY_TOLERANCE) {
          observe('RECOVERY BLOCKED', { reason: 'shell-displacement', targetViewportTop, actualShellTop, delta, tolerance: RECOVERY_TOLERANCE, heightRecovered })
          return
        }
      }
      finishPresentation()
    }
    const acceptNormal = (snapshot: ViewportSensorSnapshot) => {
      const matchesNormalBaseline = viewportSnapshotsAreEquivalent(snapshot, acceptedNormalSnapshot)
      const height = healthyHostHeight(snapshot)
      const accepted = { ...snapshot, hostHeight: height }
      acceptedNormalSnapshot = accepted
      transitionBaseline = accepted
      phase = 'normal'
      weakCandidate = undefined
      observe('GEOMETRY ACCEPT NORMAL', { matchesNormalBaseline })
      publishAccepted(normalState(height))
    }
    const acceptEditing = (snapshot: ViewportSensorSnapshot, editTop: number, editHeight: number) => {
      phase = presentationPhase === 'recovering' ? 'recovering' : 'editing'
      if (presentationPhase !== 'recovering') presentationPhase = 'editing'
      viewportLifecycle = 'active'
      weakCandidate = undefined
      observe('GEOMETRY ACCEPT EDITING', { editTop, editHeight })
      publishAccepted({ hostHeight: transitionBaseline.hostHeight, editTop, editHeight, editing: true })
      // The accepted sensor state is the baseline for subsequent editing updates.
      transitionBaseline = snapshot
    }
    const clearWeakSampling = () => {
      if (weakFrame) cancelAnimationFrame(weakFrame)
      weakFrame = 0; weakCandidate = undefined; weakConfirmations = 0; weakFramesRemaining = 0
    }
    // Invalidating the epoch also releases the frame slot it owns: a frame
    // requested for a superseded epoch would measure nothing, and leaving it
    // pending used to swallow the next schedule() so recovery had to wait for
    // the close probe or the next browser event.
    const advanceEpoch = () => {
      epoch += 1
      clearWeakSampling()
      if (frame) { cancelAnimationFrame(frame); frame = 0 }
      return epoch
    }

    const processSnapshot = (
      snapshot: ViewportSensorSnapshot,
      measurementEpoch: number,
      source: MeasurementSource,
    ) => {
      if (measurementEpoch !== epoch) { observe('STALE EPOCH DISCARDED', { measurementEpoch, currentEpoch: epoch, source }); return }
      if (!supportsEditingPresentation()) {
        editableFocused = false
        phase = 'normal'
        if (isValidViewportSensorSnapshot(snapshot)) acceptNormal(snapshot)
        finishPresentation()
        return
      }
      const classification = classifyViewportSensorSnapshot(snapshot, transitionBaseline)
      observe('SNAPSHOT CLASSIFIED', {
        classification: classification.kind === 'pending' ? `pending:${classification.reason}` : classification.kind,
        source,
        measurementEpoch,
        matchesNormalBaseline: viewportSnapshotsAreEquivalent(snapshot, acceptedNormalSnapshot),
        heightRecovered: hasEditingViewportRecovered(snapshot.hostHeight, snapshot.visualHeight),
      })
      if (classification.kind === 'invalid') return
      if (classification.kind === 'pending') {
        if (classification.reason === 'hard-contradiction') { clearWeakSampling(); return }
        const weakRecovery = classification.reason === 'weak-recovery'
        // A height-first recovery cannot become accepted merely because the
        // same incomplete sensor state survived several animation frames.
        //
        // It is not height-first, though, when the editing interaction has
        // already ended and every sensor reads exactly the state accepted as
        // normal before editing began. That is the normal baseline itself
        // rather than a partial close still panned away from it, so there is
        // no later movement left to corroborate it, and holding the editing
        // plane would strand the presentation on a physically recovered
        // viewport.
        if (weakRecovery) {
          clearWeakSampling()
          if (phase === 'recovering' && !editableFocused &&
            lastAcceptedGeometry.current.editing &&
            viewportSnapshotsAreEquivalent(snapshot, acceptedNormalSnapshot)) {
            acceptNormal(snapshot)
          }
          maybeFinishPresentationRecovery(snapshot)
          return
        }
        const mayConfirmOpening = phase === 'awaiting-geometry' &&
          editableFocused && !suppressUntilNewFocus
        const mayConfirmNormalRebase = phase === 'normal' &&
          presentationPhase === 'normal' && !editableFocused &&
          !lastAcceptedGeometry.current.editing
        if (!mayConfirmOpening && !mayConfirmNormalRebase) return
        if (source === 'browser-event') {
          weakFramesRemaining = WEAK_FOLLOW_UP_FRAMES
        }
        if (weakCandidate && viewportSnapshotsAreEquivalent(weakCandidate, snapshot)) weakConfirmations += 1
        else { weakCandidate = snapshot; weakConfirmations = 1 }
        if (weakConfirmations >= WEAK_CONFIRMATIONS_REQUIRED) {
          clearWeakSampling()
          if (mayConfirmNormalRebase) {
            observe('NORMAL REBASE CONFIRMED')
            acceptNormal(snapshot)
            return
          }
          const geometry = deriveEditingViewportGeometry(snapshot)
          acceptEditing(snapshot, geometry.editTop, geometry.editHeight)
          return
        }
        if (weakFramesRemaining > 0 && !weakFrame) {
          weakFramesRemaining -= 1
          const scheduledEpoch = epoch
          weakFrame = requestAnimationFrame(() => {
            weakFrame = 0
            observe('WEAK SAMPLE FIRED', { scheduledEpoch })
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
          maybeFinishPresentationRecovery(snapshot)
        } else if (phase === 'normal' && !editableFocused) acceptNormal(snapshot)
        return
      }
      if ((phase === 'awaiting-geometry' && editableFocused && !suppressUntilNewFocus) ||
        phase === 'editing' || phase === 'recovering') {
        acceptEditing(snapshot, classification.geometry.editTop, classification.geometry.editHeight)
      }
    }
    const measure = (measurementEpoch = epoch) => {
      if (measurementEpoch !== epoch || suspended) return
      // Editing intent is Shell-owned, but focus belongs to the browser. This
      // frame is about to interpret sensor state through that intent, so stale
      // bookkeeping is corrected against the browser's own focus first.
      reconcileEditingFocusIntent()
      if (measurementEpoch !== epoch || suspended) return
      const snapshot = readSnapshot(transitionBaseline.hostHeight)
      processSnapshot(
        snapshot,
        measurementEpoch,
        'browser-event',
      )
      if (measurementEpoch !== epoch || suspended) return
      updatePresentationMapping()
      maybeFinishPresentationRecovery(snapshot)
    }
    // The scheduler owns the pending-frame slot, not the measurement.
    const schedule = () => {
      if (suspended) return
      if (!frame) {
        const scheduledEpoch = epoch
        frame = requestAnimationFrame(() => { frame = 0; measure(scheduledEpoch) })
      }
    }
    const cancelCloseProbe = () => { if (closeTimer !== undefined) clearTimeout(closeTimer); closeTimer = undefined }

    /**
     * The single end-of-editing transition. Every way an editing interaction
     * can end — an attributable focusout, a focused editable disappearing, an
     * explicit Shell exit — converges here, so the state machine has exactly
     * one entry into recovery.
     *
     * It only ever moves the presentation toward recovery. Accepting normal
     * geometry stays the job of `maybeFinishPresentationRecovery`, which still
     * requires recovered viewport evidence, so intent can never fabricate a
     * truthful-looking viewport while the keyboard is physically present.
     *
     * It is idempotent: with nothing to release it does nothing, and a repeat
     * signal on an already-converging epoch only re-probes rather than
     * restarting the recovery.
     */
    const releaseEditingIntent = () => {
      const hasEditingInteraction = editableFocused ||
        presentationPhase !== 'normal' ||
        lastAcceptedGeometry.current.editing
      if (!hasEditingInteraction) return
      if (!editableFocused && presentationPhase === 'recovering') { observe('RECOVERY REPROBE REQUESTED'); schedule(); return }
      editableFocused = false
      advanceEpoch()
      phase = 'recovering'
      presentationPhase = 'recovering'
      observe('RECOVERY ENTER')
      publish()
      schedule(); cancelCloseProbe()
      const timerEpoch = epoch
      observe('CLOSE PROBE SCHEDULED', { timerEpoch, delay: CLOSE_PROBE_DELAY })
      closeTimer = setTimeout(() => {
        closeTimer = undefined
        observe('CLOSE PROBE FIRED', { timerEpoch, currentEpoch: epoch })
        if (timerEpoch === epoch) schedule()
      }, CLOSE_PROBE_DELAY)
    }

    /**
     * Mobile Safari can drop editable focus without delivering a focusout this
     * Shell can attribute — most reliably when the focused control is unmounted
     * underneath the keyboard, which is what a RACK-OS section change does.
     * Held editing intent would then survive forever and keep the presentation
     * in EDITING with no editable left to leave.
     *
     * Focus, unlike keyboard visibility, is authoritative and directly
     * readable, so held intent is reconciled against it rather than inferred
     * from geometry. Losing focus only ends the interaction; it never accepts
     * recovered geometry on its own.
     */
    const reconcileEditingFocusIntent = () => {
      if (!editableFocused || suspended || !supportsEditingPresentation()) return
      const shell = shellRef.current
      const active = document.activeElement
      if (shell && isEditable(active) && shell.contains(active)) return
      observe('FOCUS INTENT RECONCILED', { reason: 'stale-browser-focus' })
      releaseEditingIntent()
    }

    /**
     * Explicit Shell-owned exit. A Shell editable that still holds focus is
     * released, but the intent is handed to the state machine either way, so
     * DONE works identically when the browser's focus bookkeeping is already
     * stale, lost, or was never reported.
     */
    endEditingRef.current = () => {
      if (suspended) return
      observe('EDITING END REQUESTED')
      const shell = shellRef.current
      const active = document.activeElement
      if (shell && active instanceof HTMLElement && isEditable(active) && shell.contains(active)) {
        active.blur()
      }
      releaseEditingIntent()
    }

    const capturePresentationBaseline = (shell: HTMLElement) => {
      if (standalone) return
      const rect = shell.getBoundingClientRect()
      targetViewportTop = rect.top
      shellTop = rect.top
      shellBottom = rect.bottom
      presentationTop = 0
      presentationHeight = Number.isFinite(rect.height) && rect.height > 0
        ? rect.height
        : lastAcceptedGeometry.current.hostHeight
      writePresentationVariables(shell)
    }

    const reconcileFocusedEditingIntent = (
      shell: HTMLElement,
      lifecycle: ViewportLifecycle,
    ) => {
      const hadPresentation = presentationPhase !== 'normal'
      editableFocused = true
      suppressUntilNewFocus = false
      advanceEpoch()
      phase = 'awaiting-geometry'
      transitionBaseline = acceptedNormalSnapshot
      presentationPhase = lastAcceptedGeometry.current.editing ? 'editing' : 'entering'
      viewportLifecycle = lifecycle
      if (!hadPresentation) capturePresentationBaseline(shell)
      publish()
      schedule()
    }

    const onSuspend = () => {
      if (suspended) return
      suspended = true
      viewportLifecycle = 'suspended'
      focusExitToken += 1
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      advanceEpoch()
      cancelCloseProbe()
      resetTouchGesture()
      observe('SUSPEND')
      publish()
    }

    const onResume = () => {
      if (!suspended) return
      suspended = false
      observe('RESUME')
      const shell = shellRef.current
      const active = document.activeElement
      if (shell && isEditable(active) && shell.contains(active as Node) &&
        supportsEditingPresentation()) {
        reconcileFocusedEditingIntent(shell, 'resume-acquisition')
        return
      }
      advanceEpoch()
      editableFocused = false
      viewportLifecycle = 'active'
      if (presentationPhase !== 'normal' || lastAcceptedGeometry.current.editing) {
        phase = 'recovering'
        presentationPhase = 'recovering'
        publish()
        schedule()
        return
      }
      phase = 'normal'
      finishPresentation()
      schedule()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') onSuspend()
      else onResume()
    }

    const onPageHide = () => onSuspend()
    const onPageShow = () => onResume()

    const onFocusIn = (event: FocusEvent) => {
      if (suspended) return
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
      capturePresentationBaseline(shell)
      publish()
      schedule()
    }
    const onFocusOut = (event: FocusEvent) => {
      if (suspended) return
      const shell = shellRef.current
      const target = event.target
      if (!shell || !isEditable(target)) return
      // An editable already detached from the document is one this Shell was
      // editing a moment ago; a still-connected editable outside the Shell
      // boundary is somebody else's.
      if ((target as Node).isConnected && !shell.contains(target as Node)) return
      if (!supportsEditingPresentation()) {
        editableFocused = false
        return
      }
      const related = event.relatedTarget
      if (isEditable(related) && shell.contains(related as Node)) return
      const token = ++focusExitToken
      queueMicrotask(() => {
        if (token !== focusExitToken) return
        const active = document.activeElement
        if (isEditable(active) && shell.contains(active as Node)) return
        releaseEditingIntent()
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

    const onMediaChange = () => {
      if (suspended) return
      const shell = shellRef.current
      const active = document.activeElement
      if (mediaQuery?.matches && shell && isEditable(active) && shell.contains(active as Node)) {
        reconcileFocusedEditingIntent(shell, 'active')
      } else schedule()
    }

    const onViewportMovement = () => {
      if (!suspended) updatePresentationMapping()
      schedule()
    }

    viewport?.addEventListener('resize', onViewportMovement); viewport?.addEventListener('scroll', onViewportMovement)
    window.addEventListener('resize', onViewportMovement); window.addEventListener('scroll', onViewportMovement)
    mediaQuery?.addEventListener('change', onMediaChange)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide); window.addEventListener('pageshow', onPageShow)
    document.addEventListener('focusin', onFocusIn); document.addEventListener('focusout', onFocusOut)
    document.addEventListener('touchstart', onTouchStart, { passive: true }); document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', resetTouchGesture, { passive: true }); document.addEventListener('touchcancel', resetTouchGesture, { passive: true })
    window.addEventListener('orientationchange', onOrientationChange); schedule()
    return () => {
      viewport?.removeEventListener('resize', onViewportMovement); viewport?.removeEventListener('scroll', onViewportMovement)
      window.removeEventListener('resize', onViewportMovement); window.removeEventListener('scroll', onViewportMovement)
      mediaQuery?.removeEventListener('change', onMediaChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide); window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('focusin', onFocusIn); document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('touchstart', onTouchStart); document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', resetTouchGesture); document.removeEventListener('touchcancel', resetTouchGesture)
      window.removeEventListener('orientationchange', onOrientationChange)
      cancelAnimationFrame(frame); clearWeakSampling(); cancelCloseProbe()
      endEditingRef.current = undefined
      clearPresentationVariables()
      if (orientationTimer !== undefined) clearTimeout(orientationTimer)
    }
  }, [])
  // Published-state identity still means "a committed Hook state": adding the
  // stable exit intent must not manufacture a new commit on every render.
  return useMemo(() => ({ ...state, endEditing }), [state, endEditing])
}
