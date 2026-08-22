import { describe, expect, it } from 'vitest'
import { deriveEditingPresentationPlane } from './editingPresentationPlane'

describe('editing presentation plane', () => {
  it.each([
    ['Safari split', 0, -320, 775, false, 775, 320, 455, 455],
    ['Chrome split', 0, -311, 745, false, 745, 311, 434, 434],
    ['accepted Chrome', 0, -311, 745, true, 434, 311, 434, 434],
    ['centered Shell', 24, -276, 780, false, 780, 300, 480, 480],
    ['no displacement', 24, 24, 780, false, 780, 0, 780, 780],
  ])('maps %s document displacement into visible presentation space', (
    _name, targetViewportTop, shellTop, shellHeight, geometryEditing,
    acceptedEditHeight, presentationTop, availablePresentationHeight, presentationHeight,
  ) => {
    expect(deriveEditingPresentationPlane({
      targetViewportTop, shellTop, shellHeight, geometryEditing, acceptedEditHeight,
    })).toEqual({ presentationTop, availablePresentationHeight, presentationHeight })
  })

  it.each([
    { targetViewportTop: Number.NaN, shellTop: 0, shellHeight: 775, geometryEditing: false, acceptedEditHeight: 775 },
    { targetViewportTop: 0, shellTop: 20, shellHeight: 775, geometryEditing: false, acceptedEditHeight: 775 },
    { targetViewportTop: 0, shellTop: -800, shellHeight: 775, geometryEditing: false, acceptedEditHeight: 775 },
    { targetViewportTop: 0, shellTop: 0, shellHeight: 0, geometryEditing: false, acceptedEditHeight: 775 },
  ])('rejects an impossible presentation measurement: %o', (input) => {
    expect(deriveEditingPresentationPlane(input)).toBeNull()
  })
})
