export interface EditingPresentationPlaneInput {
  targetViewportTop: number
  shellTop: number
  shellHeight: number
  geometryEditing: boolean
  acceptedEditHeight: number
}

export interface EditingPresentationPlane {
  presentationTop: number
  availablePresentationHeight: number
  presentationHeight: number
}

export function deriveEditingPresentationPlane({
  targetViewportTop,
  shellTop,
  shellHeight,
  geometryEditing,
  acceptedEditHeight,
}: EditingPresentationPlaneInput): EditingPresentationPlane | null {
  const values = [targetViewportTop, shellTop, shellHeight, acceptedEditHeight]
  if (!values.every(Number.isFinite) || shellHeight <= 0 || acceptedEditHeight < 0) return null

  const presentationTop = targetViewportTop - shellTop
  if (presentationTop < 0 || presentationTop > shellHeight) return null

  const availablePresentationHeight = Math.max(0, shellHeight - presentationTop)
  return {
    presentationTop,
    availablePresentationHeight,
    presentationHeight: geometryEditing
      ? Math.min(availablePresentationHeight, acceptedEditHeight)
      : availablePresentationHeight,
  }
}
