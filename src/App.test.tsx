import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { GameProvider, useGameState } from './app/GameContext'
import { Shell } from './shell/Shell'
import { ViewportDebug } from './shell/ViewportDebug'

class ViewportStub extends EventTarget {
  height = 844
  width = 390
  offsetTop = 0
  scale = 1
  offsetLeft = 0
  pageLeft = 0
  pageTop = 0
  onresize = null
  onscroll = null
}

class MediaQueryStub extends EventTarget {
  media = ''
  onchange = null

  constructor(public matches: boolean) {
    super()
  }

  addListener(listener: (event: MediaQueryListEvent) => void) {
    this.addEventListener('change', listener as EventListener)
  }

  removeListener(listener: (event: MediaQueryListEvent) => void) {
    this.removeEventListener('change', listener as EventListener)
  }

  dispatchEvent(event: Event): boolean {
    return super.dispatchEvent(event)
  }
}

const originalViewport = window.visualViewport
const originalMatchMedia = window.matchMedia
const originalInnerHeight = window.innerHeight
const originalInnerWidth = window.innerWidth
const originalClientHeight = Object.getOwnPropertyDescriptor(
  document.documentElement,
  'clientHeight',
)
const originalNavigatorStandalone = Object.getOwnPropertyDescriptor(
  navigator,
  'standalone',
)
const originalUrl = window.location.href
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

const EDITING_PRESENTATION_QUERY =
  '(max-width: 700px), (max-width: 900px) and (pointer: coarse)'

interface MediaQueryMatches {
  editingPresentation?: boolean
  standalonePresentation?: boolean
}

function installViewport(viewport?: ViewportStub) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  })
}

function installMediaQueries({
  editingPresentation = true,
  standalonePresentation = false,
}: MediaQueryMatches = {}) {
  const editingQuery = new MediaQueryStub(editingPresentation)
  editingQuery.media = EDITING_PRESENTATION_QUERY
  const standaloneQuery = new MediaQueryStub(standalonePresentation)
  standaloneQuery.media = '(display-mode: standalone)'
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => {
      if (query === EDITING_PRESENTATION_QUERY) return editingQuery
      if (query === '(display-mode: standalone)') return standaloneQuery
      const unmatched = new MediaQueryStub(false)
      unmatched.media = query
      return unmatched
    }),
  })
  return { editingQuery, standaloneQuery }
}

function installEditingPresentation(matches = true) {
  return installMediaQueries({ editingPresentation: matches }).editingQuery
}

function setNavigatorStandalone(value: boolean | undefined) {
  if (value === undefined) {
    Reflect.deleteProperty(navigator, 'standalone')
    return
  }
  Object.defineProperty(navigator, 'standalone', {
    configurable: true,
    value,
  })
}

async function updateViewport(
  viewport: ViewportStub,
  values: Partial<Pick<ViewportStub, 'height' | 'width' | 'offsetTop' | 'scale'>>,
  event: 'resize' | 'scroll' = 'resize',
) {
  Object.assign(viewport, values)
  act(() => viewport.dispatchEvent(new Event(event)))
  await new Promise((resolve) => requestAnimationFrame(resolve))
}

function dispatchTouch(
  target: EventTarget,
  type: 'touchstart' | 'touchmove',
  clientX: number,
  clientY: number,
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: [{ clientX, clientY }],
  })
  return target.dispatchEvent(event)
}

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: originalViewport,
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: originalInnerHeight,
  })
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: originalInnerWidth,
  })
  if (originalClientHeight) {
    Object.defineProperty(
      document.documentElement,
      'clientHeight',
      originalClientHeight,
    )
  } else {
    Reflect.deleteProperty(document.documentElement, 'clientHeight')
  }
  if (originalNavigatorStandalone) {
    Object.defineProperty(
      navigator,
      'standalone',
      originalNavigatorStandalone,
    )
  } else {
    Reflect.deleteProperty(navigator, 'standalone')
  }
  window.history.replaceState(null, '', originalUrl)
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

function StateSnapshot() {
  const state = useGameState()
  return <output data-testid="state-snapshot">{JSON.stringify(state)}</output>
}

async function openTerminal() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: /open terminal/i }))
  return {
    user,
    input: screen.getByLabelText('Command input'),
    shell: screen.getByTestId('os-shell'),
  }
}

async function command(name: string) {
  const { user, input } = await openTerminal()
  await user.type(input, `${name}{enter}`)
  return user
}

describe('standalone presentation contract', () => {
  it('marks normal Safari as non-standalone', () => {
    installMediaQueries({ standalonePresentation: false })
    setNavigatorStandalone(undefined)

    render(<GameProvider><Shell /></GameProvider>)

    expect(screen.getByTestId('os-shell')).toHaveAttribute(
      'data-standalone',
      'false',
    )
  })

  it('recognizes the iOS Home-Screen capability signal', () => {
    installMediaQueries({ standalonePresentation: false })
    setNavigatorStandalone(true)

    render(<GameProvider><Shell /></GameProvider>)

    expect(screen.getByTestId('os-shell')).toHaveAttribute(
      'data-standalone',
      'true',
    )
  })

  it('recognizes standards-based standalone presentation', () => {
    installMediaQueries({ standalonePresentation: true })
    setNavigatorStandalone(false)

    render(<GameProvider><Shell /></GameProvider>)

    expect(screen.getByTestId('os-shell')).toHaveAttribute(
      'data-standalone',
      'true',
    )
  })

  it('samples the current viewport prop in diagnostics', async () => {
    installMediaQueries()
    window.history.replaceState(null, '', '/?viewportDebug=1')
    const initial = {
      hostHeight: 844,
      editTop: 0,
      editHeight: 844,
      editing: false,
    }
    const current = {
      hostHeight: 873,
      editTop: 386,
      editHeight: 487,
      editing: true,
    }
    const { rerender } = render(
      <div className="os-shell" data-standalone="true">
        <ViewportDebug viewport={initial} />
      </div>,
    )
    await screen.findByLabelText('Viewport diagnostics')

    rerender(
      <div className="os-shell" data-standalone="true">
        <ViewportDebug viewport={current} />
      </div>,
    )
    act(() => document.dispatchEvent(new Event('selectionchange')))

    await waitFor(() =>
      expect(screen.getByLabelText('Viewport diagnostics')).toHaveTextContent(
        'hook.editTop: 386',
      ),
    )
    expect(screen.getByLabelText('Viewport diagnostics')).toHaveTextContent(
      'hook.editHeight: 487',
    )
    expect(screen.getByLabelText('Viewport diagnostics')).toHaveTextContent(
      'shell data-standalone: true',
    )
  })
})

describe('dedicated editing viewport', () => {
  it('enters editing immediately on focus before keyboard geometry changes', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()

    await user.click(input)

    expect(shell).toHaveAttribute('data-editing', 'true')
    expect(shell).toHaveStyle({
      '--node-host-height': '844px',
      '--node-edit-top': '0px',
      '--node-edit-height': '844px',
    })
    expect(screen.getByText('EDITING')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finish editing/i })).toHaveTextContent(
      'DONE',
    )
  })

  it('keeps the 844px host while the editing plane follows a 538px viewport', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)

    await updateViewport(viewport, { height: 538 })

    await waitFor(() =>
      expect(shell).toHaveStyle({
        '--node-host-height': '844px',
        '--node-edit-top': '0px',
        '--node-edit-height': '538px',
      }),
    )
  })

  it('maps Safari top pan to editTop without changing host height', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)

    await updateViewport(
      viewport,
      { height: 514, offsetTop: 24 },
      'scroll',
    )

    await waitFor(() =>
      expect(shell).toHaveStyle({
        '--node-host-height': '844px',
        '--node-edit-top': '24px',
        '--node-edit-height': '514px',
      }),
    )
  })

  it('does not mistake Safari chrome movement for keyboard recovery', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 538 })

    // Safari toolbar movement can pan the reduced viewport all the way to the
    // host bottom even though the software keyboard remains open.
    await updateViewport(
      viewport,
      { height: 538, offsetTop: 306 },
      'scroll',
    )

    await waitFor(() => expect(shell).toHaveAttribute('data-editing', 'true'))
    expect(shell).toHaveStyle({
      '--node-host-height': '844px',
      '--node-edit-top': '306px',
      '--node-edit-height': '538px',
    })

    await updateViewport(viewport, { height: 844, offsetTop: 0 })
    await waitFor(() => expect(shell).toHaveAttribute('data-editing', 'false'))
  })

  it('contains editing gestures outside an app-owned scroll region', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input } = await openTerminal()
    await user.click(input)

    const header = screen.getByText(/terminal/i, { selector: 'h1' }).closest(
      '.app-header',
    )
    expect(header).not.toBeNull()
    dispatchTouch(header!, 'touchstart', 20, 200)
    expect(dispatchTouch(header!, 'touchmove', 20, 150)).toBe(false)

    const prompt = input.closest('.terminal-input')
    expect(prompt).not.toBeNull()
    dispatchTouch(prompt!, 'touchstart', 20, 200)
    expect(dispatchTouch(prompt!, 'touchmove', 20, 150)).toBe(false)
  })

  it('lets Terminal output own only gestures it can scroll', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input } = await openTerminal()
    await user.click(input)
    const output = document.querySelector('.terminal-output') as HTMLDivElement
    expect(output).toHaveAttribute('data-editing-scroll-owner')
    expect(input.closest('.terminal-input')).not.toContainElement(output)

    Object.defineProperties(output, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 500 },
    })
    output.scrollTop = 100
    dispatchTouch(output, 'touchstart', 20, 200)
    expect(dispatchTouch(output, 'touchmove', 20, 150)).toBe(true)

    output.scrollTop = 300
    dispatchTouch(output, 'touchstart', 20, 200)
    expect(dispatchTouch(output, 'touchmove', 20, 150)).toBe(false)
  })

  it('keeps editing latched on blur while the viewport remains reduced', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 538 })

    fireEvent.blur(input)

    await waitFor(() => expect(shell).toHaveAttribute('data-editing', 'true'))
    expect(shell).toHaveStyle({ '--node-edit-height': '538px' })
  })

  it('closes only after geometric recovery', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 538 })
    fireEvent.blur(input)

    await updateViewport(viewport, { height: 820, offsetTop: 0 })

    await waitFor(() => expect(shell).toHaveAttribute('data-editing', 'false'))
    expect(shell).toHaveStyle({
      '--node-host-height': '820px',
      '--node-edit-top': '0px',
      '--node-edit-height': '820px',
    })
  })

  it('closes on recovery while focus remains and suppresses stale re-entry', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 538 })

    await updateViewport(viewport, { height: 844 })
    await waitFor(() => expect(shell).toHaveAttribute('data-editing', 'false'))
    expect(input).toHaveFocus()

    await updateViewport(viewport, { height: 538 })
    expect(shell).toHaveAttribute('data-editing', 'false')
    expect(shell).toHaveStyle({ '--node-host-height': '844px' })
  })

  it('starts a fresh editing cycle after blur and refocus', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 538 })
    await updateViewport(viewport, { height: 844 })
    await waitFor(() => expect(shell).toHaveAttribute('data-editing', 'false'))

    input.blur()
    await user.click(input)
    expect(shell).toHaveAttribute('data-editing', 'true')
    await updateViewport(viewport, { height: 538 })
    expect(shell).toHaveStyle({
      '--node-host-height': '844px',
      '--node-edit-height': '538px',
    })
  })

  it('allows healthy host growth outside editing', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    render(<App />)

    await updateViewport(viewport, { height: 900 })

    await waitFor(() =>
      expect(screen.getByTestId('os-shell')).toHaveStyle({
        '--node-host-height': '900px',
      }),
    )
  })

  it('freezes application geometry during pinch zoom', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    render(<App />)
    const shell = screen.getByTestId('os-shell')

    await updateViewport(viewport, {
      scale: 2,
      height: 300,
      offsetTop: 80,
    })

    expect(shell).toHaveAttribute('data-editing', 'false')
    expect(shell).toHaveStyle({
      '--node-host-height': '844px',
      '--node-edit-top': '0px',
      '--node-edit-height': '844px',
    })

    await updateViewport(viewport, {
      scale: 1,
      height: 844,
      offsetTop: 0,
    })
    expect(shell).toHaveStyle({ '--node-host-height': '844px' })
  })

  it('performs one bounded final orientation rebase', async () => {
    vi.useFakeTimers()
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 390,
    })
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 390,
    })
    render(<App />)

    viewport.width = 844
    viewport.height = 500
    fireEvent(window, new Event('orientationchange'))
    viewport.height = 390
    await act(() => vi.advanceTimersByTimeAsync(281))

    expect(screen.getByTestId('os-shell')).toHaveStyle({
      '--node-host-height': '390px',
      '--node-edit-height': '390px',
    })
  })

  it('uses a responsive no-VisualViewport fallback with the same edit plane', async () => {
    installViewport(undefined)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 700,
    })
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    expect(shell).toHaveStyle({
      '--node-host-height': '700px',
      '--node-edit-height': '700px',
    })

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 500,
    })
    fireEvent(window, new Event('resize'))
    await waitFor(() =>
      expect(shell).toHaveStyle({
        '--node-host-height': '700px',
        '--node-edit-height': '500px',
      }),
    )

    fireEvent.blur(input)
    expect(shell).toHaveAttribute('data-editing', 'true')
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 700,
    })
    fireEvent(window, new Event('resize'))
    await waitFor(() => expect(shell).toHaveAttribute('data-editing', 'false'))
  })

  it('does not turn an 860px fine-pointer desktop into editing mode', async () => {
    const viewport = new ViewportStub()
    viewport.width = 860
    installViewport(viewport)
    installEditingPresentation(false)
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 860,
    })
    const { user, input, shell } = await openTerminal()

    await user.click(input)
    await updateViewport(viewport, { height: 538 })

    expect(shell).toHaveAttribute('data-editing', 'false')
  })

  it('shares the editing viewport with Notes and restores after DONE', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open notes/i }))
    const notes = screen.getByRole('textbox')
    expect(notes).toHaveAttribute('data-editing-scroll-owner')
    await user.click(notes)
    await user.type(notes, 'abc')
    const shell = screen.getByTestId('os-shell')

    expect(shell).toHaveAttribute('data-editing', 'true')
    expect(screen.getByLabelText('Note character count')).toHaveTextContent('3 CHR')
    await updateViewport(viewport, { height: 538 })
    expect(shell).toHaveStyle({ '--node-edit-height': '538px' })

    await user.click(screen.getByRole('button', { name: /finish editing/i }))
    expect(shell).toHaveAttribute('data-editing', 'true')
    await updateViewport(viewport, { height: 844 })
    await waitFor(() => expect(shell).toHaveAttribute('data-editing', 'false'))
  })
})

describe('NODE-OS shell and applications', () => {
  it('renders shared status data', () => {
    render(<App />)
    expect(screen.getByTestId('os-shell')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.23')).toBeInTheDocument()
    expect(screen.getByText('$1,250')).toBeInTheDocument()
    expect(screen.getByText('CPU').parentElement).toHaveTextContent('18%')
    expect(screen.getByText('ONLINE')).toBeInTheDocument()
  })

  it('opens an app and returns home', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open wallet/i }))
    expect(screen.getByText('AVAILABLE BALANCE')).toBeInTheDocument()
    expect(screen.getAllByText('$1,250')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: /back to home/i }))
    expect(screen.getByText('Select a module')).toBeInTheDocument()
  })

  it('keeps shell navigation outside canonical game state', async () => {
    const user = userEvent.setup()
    render(
      <GameProvider>
        <StateSnapshot />
        <Shell />
      </GameProvider>,
    )
    const before = screen.getByTestId('state-snapshot').textContent
    await user.click(screen.getByRole('button', { name: /open wallet/i }))
    await user.click(screen.getByRole('button', { name: /back to home/i }))
    expect(screen.getByTestId('state-snapshot')).toHaveTextContent(before ?? '')
  })

  it('shows canonical runtime values in the System app', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open system/i }))
    expect(screen.getAllByText('198.51.100.23')).toHaveLength(2)
    expect(screen.getAllByText('18%')).toHaveLength(2)
    expect(screen.getAllByText('23%')).toHaveLength(2)
    expect(screen.getAllByText('ONLINE')).toHaveLength(2)
  })
})

describe('Terminal', () => {
  it('runs help', async () => {
    await command('help')
    expect(screen.getByText('Available commands:')).toBeInTheDocument()
  })

  it('runs ip', async () => {
    await command('ip')
    expect(screen.getByText('Local address:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy target 198.51.100.23' })).toHaveTextContent('198.51.100.23')
  })

  it('runs status', async () => {
    await command('status')
    expect(screen.getByText('Network: ONLINE')).toBeInTheDocument()
  })

  it('reports an unknown command', async () => {
    await command('hack')
    expect(screen.getByText(/Command not found: hack/)).toBeInTheDocument()
  })

  it('clears terminal output', async () => {
    const { user, input } = await openTerminal()
    await user.type(input, 'ip{enter}')
    expect(screen.getByText(/Local address:/)).toBeInTheDocument()
    await user.type(input, 'clear{enter}')
    expect(screen.queryByText(/Local address:/)).not.toBeInTheDocument()
  })

  it('keeps command focus, exposes the send hint, and navigates history', async () => {
    const { user, input } = await openTerminal()
    expect(input).toHaveAttribute('enterkeyhint', 'send')
    await user.type(input, 'ip{enter}status{enter}')
    expect(input).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('status')
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('ip')
    await user.keyboard('{ArrowDown}')
    expect(input).toHaveValue('status')
    await user.keyboard('{ArrowDown}')
    expect(input).toHaveValue('')
  })

  it('scrolls only the Terminal output container after a command', async () => {
    const { user, input } = await openTerminal()
    const output = document.querySelector('.terminal-output') as HTMLDivElement
    Object.defineProperty(output, 'scrollHeight', {
      configurable: true,
      value: 420,
    })
    output.scrollTop = 0

    await user.type(input, 'ip{enter}')

    await waitFor(() => expect(output.scrollTop).toBe(420))
    expect(input).toHaveFocus()
  })

  it('does not refocus the command input when Terminal output is clicked', async () => {
    const { user, input } = await openTerminal()
    input.focus()
    input.blur()
    await user.click(screen.getByText(/terminal · Type/i))
    expect(input).not.toHaveFocus()
  })

  it('copies an exact target with local feedback without changing input or history', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const { user, input } = await openTerminal()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await user.type(input, 'scan home-net{enter}')
    input.blur()
    const token = screen.getByRole('button', { name: 'Copy target 198.51.100.47' })

    expect(screen.getByText('Scanning home-net...')).not.toHaveAttribute('role', 'button')
    await user.click(token)

    expect(writeText).toHaveBeenCalledExactlyOnceWith('198.51.100.47')
    expect(token).toHaveTextContent('✓')
    expect(input).not.toHaveFocus()
    expect(input).toHaveValue('')
    expect(screen.queryByText('Scanning 198.51.100.47...')).not.toBeInTheDocument()
    input.focus()
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('scan home-net')
  })

  it('preserves focused prompt state on pointer copy and handles clipboard rejection', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    const { user, input } = await openTerminal()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await user.type(input, 'ip{enter}draft')
    const token = screen.getByRole('button', { name: 'Copy target 198.51.100.23' })

    fireEvent.pointerDown(token)
    fireEvent.click(token)
    await waitFor(() => expect(token).toHaveAttribute('data-copy-state', 'failed'))

    expect(input).toHaveFocus()
    expect(input).toHaveValue('draft')
    expect(writeText).toHaveBeenCalledExactlyOnceWith('198.51.100.23')
  })

  it('keeps historical structured targets interactive until clear', async () => {
    const { user, input } = await openTerminal()
    await user.type(input, 'ip{enter}status{enter}')
    expect(screen.getByRole('button', { name: 'Copy target 198.51.100.23' })).toBeEnabled()
    expect(screen.getByText('Network: ONLINE')).toBeInTheDocument()
    await user.type(input, 'clear{enter}')
    expect(screen.queryByRole('button', { name: 'Copy target 198.51.100.23' })).not.toBeInTheDocument()
  })
})
