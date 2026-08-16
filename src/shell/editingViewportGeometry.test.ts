import { describe, expect, it } from 'vitest'
import {
  anchorEditingIntentTop,
  deriveEditingViewportGeometry,
  hasEditingViewportRecovered,
  isApproximatelyUnscaled,
} from './editingViewportGeometry'

describe('editing viewport geometry', () => {
  it('maps an unpanned visible viewport directly into the host', () => {
    expect(
      deriveEditingViewportGeometry({
        hostHeight: 844,
        visualHeight: 538,
        offsetTop: 0,
        scale: 1,
      }),
    ).toEqual({
      unscaled: true,
      editTop: 0,
      editHeight: 538,
      visibleBottom: 538,
    })
  })

  it('preserves Safari top pan as editTop', () => {
    expect(
      deriveEditingViewportGeometry({
        hostHeight: 844,
        visualHeight: 514,
        offsetTop: 24,
        scale: 1,
      }),
    ).toEqual({
      unscaled: true,
      editTop: 24,
      editHeight: 514,
      visibleBottom: 538,
    })
  })

  it('marks pinch-zoom geometry as browser-owned', () => {
    expect(
      deriveEditingViewportGeometry({
        hostHeight: 844,
        visualHeight: 300,
        offsetTop: 80,
        scale: 2,
      }),
    ).toEqual({
      unscaled: false,
      editTop: 0,
      editHeight: 844,
      visibleBottom: 844,
    })
    expect(isApproximatelyUnscaled(2)).toBe(false)
  })

  it('uses viewport height, not its panned bottom, for recovery', () => {
    expect(hasEditingViewportRecovered(844, 820)).toBe(true)
    expect(hasEditingViewportRecovered(844, 819)).toBe(false)
    // Safari can pan a keyboard-reduced viewport until its bottom reaches the
    // host bottom. Its 538px height must still be treated as keyboard-reduced.
    expect(hasEditingViewportRecovered(844, 538)).toBe(false)
  })

  it('counteracts VisualViewport camera movement during editing intent', () => {
    expect(anchorEditingIntentTop(64, 0, 80)).toBe(144)
    expect(anchorEditingIntentTop(64, 24, 0)).toBe(40)
  })
})
