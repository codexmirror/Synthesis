export const VISUAL_ANCHOR_EPSILON = 0.5
export const VISUAL_ANCHOR_SCALE_EPSILON = 0.01

export interface VisualAnchorCompensation {
  rawTop: number
  nextTranslationY: number
  changed: boolean
}

export function deriveVisualAnchorCompensation(
  targetTop: number,
  measuredTop: number,
  appliedTranslationY: number,
  epsilon = VISUAL_ANCHOR_EPSILON,
): VisualAnchorCompensation | undefined {
  if (![targetTop, measuredTop, appliedTranslationY, epsilon].every(Number.isFinite)) {
    return undefined
  }

  const rawTop = measuredTop - appliedTranslationY
  const requiredTranslation = targetTop - rawTop
  const nextTranslationY = Math.abs(requiredTranslation) <= epsilon
    ? 0
    : requiredTranslation

  return {
    rawTop,
    nextTranslationY,
    changed: Math.abs(nextTranslationY - appliedTranslationY) > epsilon,
  }
}

export function visualAnchorScaleChanged(
  acquiredScale: number,
  currentScale: number,
): boolean {
  return !Number.isFinite(acquiredScale) || !Number.isFinite(currentScale) ||
    Math.abs(acquiredScale - currentScale) >= VISUAL_ANCHOR_SCALE_EPSILON
}
