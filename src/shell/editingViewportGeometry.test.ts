import { describe, expect, it } from 'vitest'
import {
  classifyViewportSensorSnapshot,
  deriveEditingViewportGeometry,
  hasEditingViewportRecovered,
  isApproximatelyUnscaled,
  viewportSnapshotsAreEquivalent,
  type ViewportSensorSnapshot,
} from './editingViewportGeometry'

const normal: ViewportSensorSnapshot = {
  hostHeight: 775, visualHeight: 775, offsetTop: 0, pageTop: 0,
  innerHeight: 775, clientHeight: 775, scrollY: 0, scale: 1,
}

function classify(snapshot: Partial<ViewportSensorSnapshot>) {
  return classifyViewportSensorSnapshot({ ...normal, ...snapshot }, normal)
}

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

  it('classifies the physically measured coherent iPhone fixtures as ready', () => {
    const fixtures: ViewportSensorSnapshot[] = [
      { ...normal, visualHeight: 455, offsetTop: 320, pageTop: 320, innerHeight: 455, scrollY: 320 },
      { hostHeight: 745, visualHeight: 437, offsetTop: 308, pageTop: 308, innerHeight: 437, clientHeight: 745, scrollY: 308, scale: 1 },
      { hostHeight: 745, visualHeight: 434, offsetTop: 311, pageTop: 311, innerHeight: 434, clientHeight: 745, scrollY: 311, scale: 1 },
      { hostHeight: 873, visualHeight: 487, offsetTop: 386, pageTop: 386, innerHeight: 487, clientHeight: 873, scrollY: 386, scale: 1 },
    ]
    for (const fixture of fixtures) {
      const baseline = { ...fixture, visualHeight: fixture.hostHeight, offsetTop: 0, pageTop: 0, innerHeight: fixture.hostHeight, scrollY: 0 }
      expect(classifyViewportSensorSnapshot(fixture, baseline).kind).toBe('ready')
    }
  })

  it('holds the Safari stale-position split as a hard contradiction', () => {
    expect(classify({ visualHeight: 455, innerHeight: 455, scrollY: 320 })).toEqual({
      kind: 'pending', reason: 'hard-contradiction',
    })
    expect(classify({ visualHeight: 455, offsetTop: 320, pageTop: 320, innerHeight: 455, scrollY: 320 }).kind).toBe('ready')
  })

  it('holds the Chrome height-only partial as a weak candidate', () => {
    const chromeNormal = { ...normal, hostHeight: 745, visualHeight: 745, innerHeight: 745, clientHeight: 745 }
    expect(classifyViewportSensorSnapshot({ ...chromeNormal, visualHeight: 437 }, chromeNormal)).toEqual({
      kind: 'pending', reason: 'weak-candidate',
    })
  })

  it('keeps a no-position reduction weak even after innerHeight changes', () => {
    expect(classify({ visualHeight: 455, innerHeight: 455 })).toEqual({
      kind: 'pending', reason: 'weak-candidate',
    })
  })

  it('holds a height-first partial recovery until another sensor family settles', () => {
    const editing = {
      ...normal,
      visualHeight: 455,
      offsetTop: 320,
      pageTop: 320,
      innerHeight: 455,
      scrollY: 320,
    }
    expect(classifyViewportSensorSnapshot({
      ...editing,
      visualHeight: 775,
    }, editing)).toEqual({ kind: 'pending', reason: 'weak-recovery' })
    expect(classifyViewportSensorSnapshot({
      ...editing,
      visualHeight: 775,
      innerHeight: 775,
    }, editing).kind).toBe('recovered')
  })

  it('does not impose a pageTop = scrollY + offsetTop identity', () => {
    expect(classify({ visualHeight: 455, offsetTop: 320, pageTop: 320, innerHeight: 455, scrollY: 320 }).kind).toBe('ready')
  })

  it('treats tiny sensor jitter as equivalent', () => {
    expect(viewportSnapshotsAreEquivalent(normal, {
      ...normal, visualHeight: 774.2, offsetTop: 1, pageTop: 0.5, scrollY: 1.4,
    })).toBe(true)
  })

  it.each([
    { visualHeight: Number.NaN }, { offsetTop: Number.POSITIVE_INFINITY },
    { pageTop: Number.NEGATIVE_INFINITY }, { visualHeight: 0 },
    { hostHeight: 0 }, { innerHeight: 0 }, { clientHeight: 0 },
    { scale: 0 }, { scale: 1.2 },
  ])('rejects malformed or materially scaled sensor data: $snapshot', (snapshot) => {
    expect(classify(snapshot).kind).toBe('invalid')
  })

  it('recovers at a new coherent page position', () => {
    const editing = { ...normal, visualHeight: 455, offsetTop: 320, pageTop: 320, innerHeight: 455, scrollY: 320 }
    expect(classifyViewportSensorSnapshot({ ...normal, offsetTop: 40, pageTop: 40, scrollY: 40 }, editing).kind).toBe('recovered')
  })
})
