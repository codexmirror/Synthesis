import { describe, expect, it } from 'vitest'
import { canOwnVerticalGesture } from './editingScrollOwnership'

describe('editing scroll ownership', () => {
  it('rejects vertical gestures when content does not overflow', () => {
    expect(
      canOwnVerticalGesture(
        { scrollTop: 0, clientHeight: 500, scrollHeight: 300 },
        -20,
      ),
    ).toBe(false)
  })

  it('allows an overflow owner to scroll within its boundaries', () => {
    const state = { scrollTop: 100, clientHeight: 500, scrollHeight: 900 }
    expect(canOwnVerticalGesture(state, 20)).toBe(true)
    expect(canOwnVerticalGesture(state, -20)).toBe(true)
  })

  it('stops gesture chaining at the top and bottom boundaries', () => {
    expect(
      canOwnVerticalGesture(
        { scrollTop: 0, clientHeight: 500, scrollHeight: 900 },
        20,
      ),
    ).toBe(false)
    expect(
      canOwnVerticalGesture(
        { scrollTop: 400, clientHeight: 500, scrollHeight: 900 },
        -20,
      ),
    ).toBe(false)
  })
})
