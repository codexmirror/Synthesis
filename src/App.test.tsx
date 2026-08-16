import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { GameProvider, useGameState } from './app/GameContext'
import { Shell } from './shell/Shell'

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

const originalViewport = window.visualViewport
const originalInnerHeight = window.innerHeight
const originalClientHeight = Object.getOwnPropertyDescriptor(document.documentElement, 'clientHeight')

function installViewport(viewport?: ViewportStub) {
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
}

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: originalViewport })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight })
  if (originalClientHeight) Object.defineProperty(document.documentElement, 'clientHeight', originalClientHeight)
  else Reflect.deleteProperty(document.documentElement, 'clientHeight')
})

function StateSnapshot() {
  const state = useGameState()
  return <output data-testid="state-snapshot">{JSON.stringify(state)}</output>
}

async function openTerminal() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: /terminal/i }))
  return { user, input: screen.getByLabelText('Command input') }
}

async function command(name: string) {
  const { user, input } = await openTerminal()
  await user.type(input, `${name}{enter}`)
  return user
}

describe('NODE-OS shell', () => {
  it('protects the healthy baseline throughout progressive keyboard opening', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    const { user, input } = await openTerminal()
    await user.click(input)
    const shell = screen.getByTestId('os-shell')

    viewport.height = 780
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(shell).toHaveStyle({ '--node-app-height': '844px' }))
    expect(shell).toHaveAttribute('data-keyboard-open', 'false')

    viewport.height = 650
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(shell).toHaveAttribute('data-keyboard-open', 'true'))
    expect(shell).toHaveStyle({ '--node-app-height': '844px' })

    viewport.height = 538
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(shell).toHaveStyle({ '--node-keyboard-inset': '306px' }))
    expect(shell).toHaveStyle({ '--node-app-height': '844px' })
  })

  it('does not open for focused geometry below the opening threshold', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    const { user, input } = await openTerminal()
    await user.click(input)
    viewport.height = 780
    viewport.offsetTop = 8
    viewport.dispatchEvent(new Event('resize'))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'false')
    expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-keyboard-inset': '0px', '--node-vv-top': '0px' })
  })

  it('keeps keyboard mode latched on blur and closes only after geometric recovery', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    const { user, input } = await openTerminal()
    await user.click(input)
    viewport.height = 538
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'true'))
    fireEvent.blur(input)
    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'true')

    viewport.height = 820
    viewport.offsetTop = 0
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'false'))
    expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-keyboard-inset': '0px', '--node-vv-top': '0px' })
  })

  it('remeasures offsetTop from VisualViewport scroll events', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    const { user, input } = await openTerminal()
    await user.click(input)
    viewport.height = 538
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'true'))
    viewport.height = 514
    viewport.offsetTop = 24
    viewport.dispatchEvent(new Event('scroll'))
    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-vv-top': '24px', '--node-keyboard-inset': '306px' }))
  })

  it('uses the recovered healthy baseline for a full reopen cycle', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    const { user, input } = await openTerminal()
    await user.click(input)
    viewport.height = 538
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'true'))
    viewport.height = 820
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'false'))
    expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-app-height': '820px' })
    viewport.height = 500
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'true'))
    expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-app-height': '820px', '--node-keyboard-inset': '320px' })
  })

  it('cancels a pending close probe when editable focus returns', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    const { user, input } = await openTerminal()
    await user.click(input)
    viewport.height = 538
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'true'))
    vi.useFakeTimers()
    fireEvent.blur(input)
    fireEvent.focusIn(input)
    await act(() => vi.advanceTimersByTimeAsync(20))
    viewport.height = 844
    await act(() => vi.advanceTimersByTimeAsync(480))
    expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'true')
    viewport.dispatchEvent(new Event('resize'))
    await act(() => vi.advanceTimersByTimeAsync(20))
    expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'false')
  })

  it('runs a final bounded orientation recalibration with corrected geometry', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 0 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 0 })
    render(<App />)
    vi.useFakeTimers()
    viewport.width = 844
    viewport.height = 500
    fireEvent(window, new Event('orientationchange'))
    await act(() => vi.advanceTimersByTimeAsync(20))
    expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-app-height': '500px' })
    viewport.height = 390
    await act(() => vi.advanceTimersByTimeAsync(300))
    expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-app-height': '390px' })
  })

  it('uses the full opening threshold for new orientation keyboard geometry', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 390 })
    const { user, input } = await openTerminal()
    await user.click(input)
    viewport.width = 844
    viewport.height = 350
    fireEvent(window, new Event('orientationchange'))
    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-app-height': '390px' }))
    expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'false')
    viewport.height = 194
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'true'))
  })

  it('keeps a fixed host and derives local keyboard occlusion including Safari top pan', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    const { user, input } = await openTerminal()
    await user.click(input)
    viewport.height = 514
    viewport.offsetTop = 24
    viewport.dispatchEvent(new Event('resize'))

    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'true'))
    const shell = screen.getByTestId('os-shell')
    expect(shell).toHaveStyle({ '--node-app-height': '844px', '--node-keyboard-inset': '306px', '--node-vv-top': '24px' })
  })

  it('freezes geometry during pinch zoom and resumes unscaled measurement', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    const { user, input } = await openTerminal()
    await user.click(input)
    viewport.scale = 2
    viewport.height = 300
    viewport.offsetTop = 80
    viewport.dispatchEvent(new Event('resize'))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-app-height': '844px', '--node-keyboard-inset': '0px', '--node-vv-top': '0px' })
    expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'false')
    viewport.scale = 1
    viewport.height = 538
    viewport.offsetTop = 0
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'true'))
  })

  it('uses a responsive innerHeight fallback without VisualViewport', async () => {
    installViewport(undefined)
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 })
    render(<App />)
    expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-app-height': '700px', '--node-keyboard-inset': '0px', '--node-vv-top': '0px' })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 620 })
    fireEvent(window, new Event('resize'))
    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-app-height': '620px' }))
    expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'false')
    expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-keyboard-inset': '0px', '--node-vv-top': '0px' })
  })

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
    await user.click(screen.getByRole('button', { name: /wallet/i }))
    expect(screen.getByText('AVAILABLE BALANCE')).toBeInTheDocument()
    expect(screen.getAllByText('$1,250')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: /back to home/i }))
    expect(screen.getByText('Select a module')).toBeInTheDocument()
  })

  it('keeps shell navigation outside canonical game state', async () => {
    const user = userEvent.setup()
    render(<GameProvider><StateSnapshot /><Shell /></GameProvider>)
    const before = screen.getByTestId('state-snapshot').textContent
    await user.click(screen.getByRole('button', { name: /wallet/i }))
    await user.click(screen.getByRole('button', { name: /back to home/i }))
    expect(screen.getByTestId('state-snapshot')).toHaveTextContent(before ?? '')
  })

  it('shows canonical runtime values in the System app', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /system/i }))
    expect(screen.getAllByText('198.51.100.23')).toHaveLength(2)
    expect(screen.getAllByText('18%')).toHaveLength(2)
    expect(screen.getAllByText('23%')).toHaveLength(2)
    expect(screen.getAllByText('ONLINE')).toHaveLength(2)
  })

  it('runs help', async () => { await command('help'); expect(screen.getByText('Available commands:')).toBeInTheDocument() })
  it('runs ip', async () => { await command('ip'); expect(screen.getByText('Local address: 198.51.100.23')).toBeInTheDocument() })
  it('runs status', async () => { await command('status'); expect(screen.getByText('Network: ONLINE')).toBeInTheDocument() })
  it('reports an unknown command', async () => { await command('hack'); expect(screen.getByText(/Command not found: hack/)).toBeInTheDocument() })
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

  it('does not refocus the command input when Terminal output is clicked', async () => {
    const { user, input } = await openTerminal()
    input.focus()
    input.blur()
    await user.click(screen.getByText(/terminal · Type/i))
    expect(input).not.toHaveFocus()
  })
})
