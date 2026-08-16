import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function installViewport(viewport?: ViewportStub) {
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
}

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: originalViewport })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight })
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
    expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-app-height': '700px' })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 620 })
    fireEvent(window, new Event('resize'))
    await waitFor(() => expect(screen.getByTestId('os-shell')).toHaveStyle({ '--node-app-height': '620px' }))
    expect(screen.getByTestId('os-shell')).toHaveAttribute('data-keyboard-open', 'false')
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
})
