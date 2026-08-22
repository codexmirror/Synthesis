export const RECOVERY_TOLERANCE = 24
export const SCALE_TOLERANCE = 0.01
export const SENSOR_EPSILON = 1.5

export interface ViewportSensorSnapshot {
  hostHeight: number
  visualHeight: number
  offsetTop: number
  pageTop: number
  innerHeight: number
  clientHeight: number
  scrollY: number
  scale: number
}

export interface EditingViewportGeometry {
  unscaled: boolean
  editTop: number
  editHeight: number
  visibleBottom: number
}

export interface EditingViewportGeometryInput {
  hostHeight: number
  visualHeight: number
  offsetTop: number
  scale: number
}

export type ViewportSnapshotClassification =
  | { kind: 'invalid' }
  | {
      kind: 'pending'
      reason: 'hard-contradiction' | 'weak-candidate' | 'weak-recovery'
    }
  | { kind: 'ready'; geometry: EditingViewportGeometry }
  | { kind: 'recovered' }

export function isApproximatelyUnscaled(scale: number): boolean {
  return Number.isFinite(scale) && Math.abs(scale - 1) < SCALE_TOLERANCE
}

export function isValidViewportSensorSnapshot(
  snapshot: ViewportSensorSnapshot,
): boolean {
  const values = Object.values(snapshot)
  return (
    values.every(Number.isFinite) &&
    snapshot.hostHeight > 0 &&
    snapshot.visualHeight > 0 &&
    snapshot.innerHeight > 0 &&
    snapshot.clientHeight > 0 &&
    snapshot.scale > 0 &&
    isApproximatelyUnscaled(snapshot.scale)
  )
}

function materiallyChanged(a: number, b: number): boolean {
  return Math.abs(a - b) > SENSOR_EPSILON
}

function hasHardContradiction(
  snapshot: ViewportSensorSnapshot,
  baseline: ViewportSensorSnapshot,
): boolean {
  return (
    materiallyChanged(snapshot.scrollY, baseline.scrollY) &&
    !materiallyChanged(snapshot.pageTop, baseline.pageTop) &&
    !materiallyChanged(snapshot.offsetTop, baseline.offsetTop)
  )
}

export function viewportSnapshotsAreEquivalent(
  a: ViewportSensorSnapshot,
  b: ViewportSensorSnapshot,
): boolean {
  return (Object.keys(a) as (keyof ViewportSensorSnapshot)[]).every(
    (key) => Math.abs(a[key] - b[key]) <= SENSOR_EPSILON,
  )
}

export function classifyViewportSensorSnapshot(
  snapshot: ViewportSensorSnapshot,
  transitionBaseline: ViewportSensorSnapshot,
): ViewportSnapshotClassification {
  if (
    !isValidViewportSensorSnapshot(snapshot) ||
    !isValidViewportSensorSnapshot(transitionBaseline)
  ) return { kind: 'invalid' }

  if (hasHardContradiction(snapshot, transitionBaseline)) {
    return { kind: 'pending', reason: 'hard-contradiction' }
  }

  const positionCorroborates =
    materiallyChanged(snapshot.offsetTop, transitionBaseline.offsetTop) ||
    materiallyChanged(snapshot.pageTop, transitionBaseline.pageTop)
  const layoutCorroborates =
    materiallyChanged(snapshot.innerHeight, transitionBaseline.innerHeight) ||
    materiallyChanged(snapshot.hostHeight, transitionBaseline.hostHeight)

  if (hasEditingViewportRecovered(snapshot.hostHeight, snapshot.visualHeight)) {
    if (!positionCorroborates && !layoutCorroborates) {
      return { kind: 'pending', reason: 'weak-recovery' }
    }
    return { kind: 'recovered' }
  }

  if (!positionCorroborates) {
    return { kind: 'pending', reason: 'weak-candidate' }
  }

  return {
    kind: 'ready',
    geometry: deriveEditingViewportGeometry(snapshot),
  }
}

export function deriveEditingViewportGeometry({
  hostHeight,
  visualHeight,
  offsetTop,
  scale,
}: EditingViewportGeometryInput): EditingViewportGeometry {
  const host = Math.max(1, Math.round(hostHeight))
  if (!isApproximatelyUnscaled(scale)) {
    return { unscaled: false, editTop: 0, editHeight: host, visibleBottom: host }
  }
  const editTop = Math.min(host, Math.max(0, Math.round(offsetTop)))
  const visualBottom = editTop + Math.max(0, Math.round(visualHeight))
  const visibleBottom = Math.min(host, visualBottom)
  return {
    unscaled: true,
    editTop,
    editHeight: Math.max(0, visibleBottom - editTop),
    visibleBottom,
  }
}

export function hasEditingViewportRecovered(
  hostHeight: number,
  visualHeight: number,
  tolerance = RECOVERY_TOLERANCE,
): boolean {
  return hostHeight - visualHeight <= tolerance
}
