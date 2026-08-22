import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../App'
import source from './EditingPlaneDebug.tsx?raw'

const originalUrl = window.location.href
const originalViewport = window.visualViewport
const originalMatchMedia = window.matchMedia

class ViewportStub extends EventTarget {
  height = 844
  width = 390
  offsetTop = 0
  offsetLeft = 0
  pageTop = 0
  pageLeft = 0
  scale = 1
  onresize = null
  onscroll = null
}

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', originalUrl)
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: originalViewport })
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
})

describe('editing plane experiment', () => {
  it('does not add experimental DOM without its query flag', () => {
    render(<App />)

    expect(screen.queryByLabelText('Fixed plane input')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Visual viewport plane input')).not.toBeInTheDocument()
    expect(screen.getByTestId('os-shell')).toBeInTheDocument()
  })

  it('portals both isolated positioning strategies only when enabled', () => {
    window.history.replaceState(null, '', '/?editingPlaneDebug=1')
    render(<App />)

    expect(screen.getByLabelText('Fixed plane input')).toBeInTheDocument()
    expect(screen.getByLabelText('Visual viewport plane input')).toBeInTheDocument()
    expect(document.body.querySelectorAll(':scope > [data-editing-plane]')).toHaveLength(2)
    expect(screen.getByTestId('os-shell').contains(screen.getByLabelText('Fixed plane input'))).toBe(false)
  })

  it('contains no prohibited scrolling, user-agent, transform, timer, or keyboard constants', () => {
    expect(source).not.toMatch(/scrollTo|scrollIntoView|userAgent|setTimeout|setInterval|\.os-shell[^'"\n]*transform/i)
  })

  it.each([
    ['Fixed plane input'],
    ['Visual viewport plane input'],
  ])('contains focus from %s outside the production editing controller', async (label) => {
    window.history.replaceState(null, '', '/?editingPlaneDebug=1')
    const viewport = new ViewportStub()
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => true,
      }),
    })
    render(<App />)
    const input = screen.getByLabelText(label)

    act(() => input.focus())
    expect(input).toHaveFocus()
    expect(input.closest('[data-editing-plane]')?.querySelector('output')).toHaveTextContent('focusin')

    viewport.height = 455
    viewport.offsetTop = 320
    viewport.pageTop = 320
    act(() => viewport.dispatchEvent(new Event('resize')))
    for (let frame = 0; frame < 6; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    }

    expect(input).toHaveFocus()
    expect(screen.getByLabelText(label)).toBeInTheDocument()
    expect(screen.getByTestId('os-shell')).toHaveAttribute('data-editing', 'false')
  })
})
