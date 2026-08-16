export const RECOVERY_TOLERANCE = 24
export const SCALE_TOLERANCE = 0.01

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

export function isApproximatelyUnscaled(scale: number): boolean {
  return Math.abs(scale - 1) < SCALE_TOLERANCE
}

export function deriveEditingViewportGeometry({
  hostHeight,
  visualHeight,
  offsetTop,
  scale,
}: EditingViewportGeometryInput): EditingViewportGeometry {
  const host = Math.max(1, Math.round(hostHeight))

  if (!isApproximatelyUnscaled(scale)) {
    return {
      unscaled: false,
      editTop: 0,
      editHeight: host,
      visibleBottom: host,
    }
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
  visibleBottom: number,
  tolerance = RECOVERY_TOLERANCE,
): boolean {
  return hostHeight - visibleBottom <= tolerance
}
