import { describe, expect, it } from 'vitest'
import {
  deriveVisualAnchorCompensation,
  visualAnchorScaleChanged,
} from './editingVisualAnchor'

describe('editing visual anchor compensation', () => {
  it('cancels an upward browser-owned drift', () => {
    expect(deriveVisualAnchorCompensation(0, -320, 0)).toEqual({
      rawTop: -320,
      nextTranslationY: 320,
      changed: true,
    })
  })

  it('removes its own transform before deriving raw position', () => {
    expect(deriveVisualAnchorCompensation(0, 0, 320)).toEqual({
      rawTop: -320,
      nextTranslationY: 320,
      changed: false,
    })
  })

  it('keeps no-drift and subpixel noise at zero', () => {
    expect(deriveVisualAnchorCompensation(10, 10, 0)?.nextTranslationY).toBe(0)
    expect(deriveVisualAnchorCompensation(10, 9.7, 0)).toMatchObject({
      nextTranslationY: 0,
      changed: false,
    })
  })

  it('cancels positive downward drift', () => {
    expect(deriveVisualAnchorCompensation(0, 42, 0)?.nextTranslationY).toBe(-42)
  })

  it('rejects non-finite measurements', () => {
    expect(deriveVisualAnchorCompensation(0, Number.NaN, 0)).toBeUndefined()
    expect(deriveVisualAnchorCompensation(0, 0, Number.POSITIVE_INFINITY)).toBeUndefined()
  })

  it('distinguishes material scale changes from sensor noise', () => {
    expect(visualAnchorScaleChanged(1, 1.005)).toBe(false)
    expect(visualAnchorScaleChanged(1, 1.01)).toBe(true)
    expect(visualAnchorScaleChanged(1, Number.NaN)).toBe(true)
  })
})
