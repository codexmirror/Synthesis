import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import type { EditingViewportState } from './useEditingViewport'
import { useEditingVisualAnchor } from './useEditingVisualAnchor'

class VisualViewportStub extends EventTarget {
  scale = 1
}

const originalVisualViewport = window.visualViewport

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: originalVisualViewport,
  })
})

function state(
  phase: EditingViewportState['phase'],
  holding: boolean,
  acceptanceRevision: number,
): EditingViewportState {
  const editing = phase === 'editing' || phase === 'recovering'
  return {
    hostHeight: 775,
    editTop: editing ? 320 : 0,
    editHeight: editing ? 455 : 775,
    editing,
    phase,
    holding,
    acceptanceRevision,
  }
}

function Harness({
  viewport,
  child = 'rack',
}: {
  viewport: EditingViewportState
  child?: 'rack' | 'handoff'
}) {
  const shellRef = useRef<HTMLDivElement>(null)
  useEditingVisualAnchor(shellRef, viewport)
  return <div ref={shellRef} className="os-shell" data-testid="anchor-shell">
    {child === 'rack'
      ? <section className="rack-os">
        <input aria-label="Remote command A" />
        <input aria-label="Remote command B" />
      </section>
      : <main className="remote-handoff">SESSION ESTABLISHED</main>}
  </div>
}

function installShellRect(shell: HTMLElement) {
  let rawTop = 0
  vi.spyOn(shell, 'getBoundingClientRect').mockImplementation(() => {
    const match = shell.style.transform.match(/translate3d\(0,\s*([\d.-]+)px,\s*0\)/)
    const applied = match ? Number(match[1]) : 0
    const top = rawTop + applied
    return {
      x: 0, y: top, top, left: 0, right: 390, bottom: top + 775,
      width: 390, height: 775, toJSON: () => ({}),
    }
  })
  return (next: number) => { rawTop = next }
}

async function nextFrame() {
  await new Promise((resolve) => requestAnimationFrame(resolve))
}

describe('Shell editing visual anchor lifecycle', () => {
  it('preserves the direct pre-pan target when matching focus arrives after drift', async () => {
    const visualViewport = new VisualViewportStub()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
    render(<Harness viewport={state('normal', false, 0)} />)
    const shell = screen.getByTestId('anchor-shell')
    const setRawTop = installShellRect(shell)
    const input = screen.getByLabelText('Remote command A')

    setRawTop(0)
    fireEvent.pointerDown(input)
    setRawTop(-80)
    fireEvent.focusIn(input)
    act(() => visualViewport.dispatchEvent(new Event('resize')))
    await nextFrame()

    expect(shell.style.transform).toBe('translate3d(0, 80px, 0)')
    expect(shell.getBoundingClientRect().top).toBe(0)
  })

  it('keeps direct pre-acquisition armed until opening HOLD is published', async () => {
    const visualViewport = new VisualViewportStub()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
    const view = render(<Harness viewport={state('normal', false, 0)} />)
    const shell = screen.getByTestId('anchor-shell')
    const setRawTop = installShellRect(shell)
    const input = screen.getByLabelText('Remote command A')

    fireEvent.pointerDown(input)
    fireEvent.focusIn(input)
    setRawTop(-80)
    act(() => visualViewport.dispatchEvent(new Event('resize')))
    await nextFrame()

    expect(shell.style.transform).toBe('translate3d(0, 80px, 0)')
    expect(shell.getBoundingClientRect().top).toBe(0)
    view.rerender(<Harness viewport={state('awaiting-geometry', true, 0)} />)
    expect(shell.style.transform).toBe('translate3d(0, 80px, 0)')
  })

  it('arms recovery before the recovering HOLD commit', async () => {
    const visualViewport = new VisualViewportStub()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
    const view = render(<Harness viewport={state('awaiting-geometry', true, 0)} />)
    const shell = screen.getByTestId('anchor-shell')
    const setRawTop = installShellRect(shell)
    const input = screen.getByLabelText('Remote command A')
    fireEvent.focusIn(input)
    view.rerender(<Harness viewport={state('editing', false, 1)} />)

    fireEvent.focusOut(input)
    setRawTop(95)
    act(() => visualViewport.dispatchEvent(new Event('resize')))
    await nextFrame()

    expect(shell.style.transform).toBe('translate3d(0, -95px, 0)')
    expect(shell.getBoundingClientRect().top).toBe(0)
    view.rerender(<Harness viewport={state('recovering', true, 1)} />)
    expect(shell.style.transform).toBe('translate3d(0, -95px, 0)')
  })

  it('does not provisionally reacquire an already-focused steady editing input', async () => {
    const visualViewport = new VisualViewportStub()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
    const view = render(<Harness viewport={state('awaiting-geometry', true, 0)} />)
    const shell = screen.getByTestId('anchor-shell')
    const setRawTop = installShellRect(shell)
    const input = screen.getByLabelText('Remote command A')
    input.focus()
    view.rerender(<Harness viewport={state('editing', false, 1)} />)

    fireEvent.pointerDown(input)
    setRawTop(-60)
    act(() => visualViewport.dispatchEvent(new Event('scroll')))
    await nextFrame()

    expect(shell.style.transform).toBe('')
  })

  it('deterministically releases direct acquisition when no focus follows', async () => {
    const visualViewport = new VisualViewportStub()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
    render(<Harness viewport={state('normal', false, 0)} />)
    const shell = screen.getByTestId('anchor-shell')
    const setRawTop = installShellRect(shell)
    const input = screen.getByLabelText('Remote command A')

    fireEvent.pointerDown(input)
    setRawTop(-30)
    act(() => visualViewport.dispatchEvent(new Event('resize')))
    await nextFrame()
    expect(shell.style.transform).toBe('translate3d(0, 30px, 0)')

    fireEvent.click(input)
    expect(shell.style.transform).toBe('')
    setRawTop(-70)
    act(() => visualViewport.dispatchEvent(new Event('resize')))
    await nextFrame()
    expect(shell.style.transform).toBe('')

    fireEvent.pointerDown(input)
    fireEvent.pointerCancel(input)
    setRawTop(-100)
    act(() => visualViewport.dispatchEvent(new Event('resize')))
    await nextFrame()
    expect(shell.style.transform).toBe('')
  })

  it('supersedes recovery anchoring during editable focus transfer without clearing it', async () => {
    const visualViewport = new VisualViewportStub()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
    const view = render(<Harness viewport={state('awaiting-geometry', true, 0)} />)
    const shell = screen.getByTestId('anchor-shell')
    const setRawTop = installShellRect(shell)
    const inputA = screen.getByLabelText('Remote command A')
    const inputB = screen.getByLabelText('Remote command B')
    fireEvent.focusIn(inputA)
    view.rerender(<Harness viewport={state('editing', false, 1)} />)

    fireEvent.focusOut(inputA)
    setRawTop(-40)
    act(() => visualViewport.dispatchEvent(new Event('scroll')))
    await nextFrame()
    expect(shell.style.transform).toBe('translate3d(0, 40px, 0)')

    fireEvent.focusIn(inputB)
    expect(shell.style.transform).toBe('translate3d(0, 40px, 0)')
    setRawTop(-65)
    act(() => visualViewport.dispatchEvent(new Event('scroll')))
    await nextFrame()
    expect(shell.style.transform).toBe('translate3d(0, 65px, 0)')
    expect(shell.getBoundingClientRect().top).toBe(0)
  })

  it('activates from an exposed HOLD while accepted editing remains mounted', async () => {
    const visualViewport = new VisualViewportStub()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
    const view = render(<Harness viewport={state('editing', false, 1)} />)
    const shell = screen.getByTestId('anchor-shell')
    const setRawTop = installShellRect(shell)
    setRawTop(-70)

    view.rerender(<Harness viewport={state('editing', true, 1)} />)
    await nextFrame()

    expect(shell.style.transform).toBe('translate3d(0, 70px, 0)')
    expect(shell.getBoundingClientRect().top).toBe(0)
  })

  it('stabilizes RACK recovery across handoff replacement and clears on acceptance', async () => {
    const visualViewport = new VisualViewportStub()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
    const view = render(<Harness viewport={state('editing', false, 1)} />)
    const shell = screen.getByTestId('anchor-shell')
    const setRawTop = installShellRect(shell)
    const input = screen.getByLabelText('Remote command A')

    fireEvent.focusIn(input)
    fireEvent.focusOut(input)
    view.rerender(<Harness viewport={state('recovering', true, 1)} />)
    setRawTop(120)
    act(() => visualViewport.dispatchEvent(new Event('resize')))
    await nextFrame()
    expect(shell.style.transform).toBe('translate3d(0, -120px, 0)')

    view.rerender(<Harness viewport={state('recovering', true, 1)} child="handoff" />)
    expect(screen.getByText('SESSION ESTABLISHED')).toBeInTheDocument()
    expect(shell.style.transform).toBe('translate3d(0, -120px, 0)')

    setRawTop(0)
    view.rerender(<Harness viewport={state('normal', false, 2)} child="handoff" />)
    expect(shell.style.transform).toBe('')
  })

  it('invalidates a queued portrait compensation on orientation change', () => {
    const visualViewport = new VisualViewportStub()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
    render(<Harness viewport={state('awaiting-geometry', true, 0)} />)
    const shell = screen.getByTestId('anchor-shell')
    const setRawTop = installShellRect(shell)
    const input = screen.getByLabelText('Remote command A')
    fireEvent.pointerDown(input)
    fireEvent.focusIn(input)

    const queuedFrames: FrameRequestCallback[] = []
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      queuedFrames.push(callback)
      return queuedFrames.length
    })
    setRawTop(-200)
    act(() => visualViewport.dispatchEvent(new Event('scroll')))
    fireEvent(window, new Event('orientationchange'))
    act(() => queuedFrames.forEach((callback) => callback(performance.now())))

    expect(shell.style.transform).toBe('')
    vi.mocked(requestAnimationFrame).mockRestore()
  })
})
