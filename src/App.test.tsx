import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { GameProvider, useGameState } from './app/GameContext'
import { Shell } from './shell/Shell'

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

class VisualViewportStub extends EventTarget {
  height = 800
  width = 390
  offsetLeft = 0
  offsetTop = 0
  pageLeft = 0
  pageTop = 0
  scale = 1
  onresize = null
  onscroll = null
}

const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport')
const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')

function setVisualViewport(viewport: VisualViewportStub | undefined) {
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
}

afterEach(() => {
  if (originalVisualViewport) Object.defineProperty(window, 'visualViewport', originalVisualViewport)
  else Reflect.deleteProperty(window, 'visualViewport') VisualViewport }).visualViewport
  if (originalInnerHeight) Object.defineProperty(window, 'innerHeight', originalInnerHeight)
})

describe('NODE-OS shell', () => {
  it('keeps the no-VisualViewport fallback responsive to window resize', async () => {
    setVisualViewport(undefined)
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 })
    render(<App />)
    const shell = screen.getByTestId('os-shell')
    expect(shell).toHaveAttribute('data-keyboard-open', 'false')
    expect(shell).toHaveStyle('--node-vvh: 700px')

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 })
    window.dispatchEvent(new Event('resize'))
    await waitFor(() => {
      expect(shell).toHaveAttribute('data-keyboard-open', 'false')
      expect(shell).toHaveStyle('--node-vvh: 640px')
    })
  })

  it('uses the measured VisualViewport height', () => {
    const viewport = new VisualViewportStub()
    viewport.height = 812
    setVisualViewport(viewport)
    render(<App />)
    expect(screen.getByTestId('os-shell')).toHaveStyle('--node-vvh: 812px')
  })

  it('requires editable focus and a meaningful viewport reduction for keyboard mode', async () => {
    const viewport = new VisualViewportStub()
    setVisualViewport(viewport)
    const { input } = await openTerminal()
    const shell = screen.getByTestId('os-shell')

    input.focus()
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(shell).toHaveAttribute('data-keyboard-open', 'false'))

    viewport.height = 600
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => {
      expect(shell).toHaveAttribute('data-keyboard-open', 'true')
      expect(shell).toHaveStyle('--node-vvh: 600px')
    })

    input.blur()
    await waitFor(() => expect(shell).toHaveAttribute('data-keyboard-open', 'true'))

    viewport.height = 800
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(shell).toHaveStyle('--node-vvh: 800px'))
    expect(shell).toHaveAttribute('data-keyboard-open', 'false')
  })

  it('ignores pinch-zoom geometry until the viewport is unscaled again', async () => {
    const viewport = new VisualViewportStub()
    setVisualViewport(viewport)
    const { input } = await openTerminal()
    const shell = screen.getByTestId('os-shell')
    input.focus()

    viewport.scale = 2
    viewport.height = 400
    viewport.dispatchEvent(new Event('resize'))
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
    expect(shell).toHaveAttribute('data-keyboard-open', 'false')
    expect(shell).toHaveStyle('--node-vvh: 800px')

    viewport.scale = 1
    viewport.height = 780
    viewport.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(shell).toHaveStyle('--node-vvh: 780px'))
    expect(shell).toHaveAttribute('data-keyboard-open', 'false')
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

  it('recovers input focus after command submission', async () => {
    const { user, input } = await openTerminal()
    await user.type(input, 'help')
    input.blur()
    fireEvent.submit(input.closest('form')!)
    expect(input).toHaveFocus()
  })

  it('preserves command history and exposes the mobile send hint', async () => {
    const { user, input } = await openTerminal()
    expect(input).toHaveAttribute('enterkeyhint', 'send')
    await user.type(input, 'ip{enter}')
    await user.type(input, 'status{enter}')
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('status')
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('ip')
  })
})
