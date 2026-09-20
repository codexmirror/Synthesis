import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import {
  act,
  cleanup,
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
import {
  VIEWPORT_DEBUG_TIMELINE_LIMIT,
  ViewportDiagnosticsRecorder,
  exportViewportDiagnosticCapture,
  summarizeFocus,
} from './shell/viewportDiagnostics'
import { useEditingViewport, type EditingViewportState } from './shell/useEditingViewport'
import { connectRemoteFromObservation } from './core/game/remoteSession'
import { createInitialGameState } from './core/game/initialState'
import { RACK_OS_FIRMWARE_ID } from './core/game/firmwareIdentity'
import type { FileTransfer, GameState } from './core/game/types'
import { withoutBookstoreBackgroundTiming } from './test/canonicalSnapshot'

function withActiveTransfer(direction: 'download' | 'upload', base: GameState = createInitialGameState()): GameState {
  const localDeviceId = base.player.localDevice.id
  const sourceFileId = direction === 'download'
    ? 'file-0002'
    : base.player.localDevice.filesystem.files[1].id
  const transfer: FileTransfer = {
    id: 'transfer-0001',
    origin: 'device_access',
    accessId: 'access-0001',
    sourceDeviceId: direction === 'download' ? 'host-lan-001' : localDeviceId,
    sourceFileId,
    destinationDeviceId: direction === 'download' ? localDeviceId : 'host-lan-001',
    destinationPath: direction === 'download' ? '/home/user/downloads/nodescan-exp-1.1.pkg' : '/home/user/node-miner-1.0.pkg',
    bytesTotal: 18_400_000,
    bytesTransferred: 4_600_000,
  }
  return {
    ...base,
    deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: localDeviceId, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
    fileTransfer: { nextId: 2, active: transfer },
  }
}

function viewportState(
  overrides: Partial<EditingViewportState> = {},
): EditingViewportState {
  return {
    hostHeight: 844, editTop: 0, editHeight: 844, editing: false,
    editingPresentation: false, presentationPhase: 'normal',
    targetViewportTop: 0, shellTop: 0, shellBottom: 844,
    presentationTop: 0, presentationHeight: 844, recoveryReady: true,
    viewportLifecycle: 'active',
    ...overrides,
  }
}

function EditingViewportHarness({ standalone = true }: { standalone?: boolean }) {
  const shellRef = useRef<HTMLDivElement>(null)
  const viewport = useEditingViewport({ shellRef, standalone })
  return (
    <div
      ref={shellRef}
      data-testid="editing-viewport-harness"
      data-host-height={viewport.hostHeight}
      data-edit-height={viewport.editHeight}
      data-editing={String(viewport.editing)}
      data-phase={viewport.presentationPhase}
      data-ready={String(viewport.recoveryReady)}
    >
      <input aria-label="Neutral Shell editor" />
    </div>
  )
}

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
const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY')
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
  // The editing controller may take two bounded follow-up sensor samples when
  // an otherwise coherent reduced viewport has only weak corroboration.
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))
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
  if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY)
  else Reflect.deleteProperty(window, 'scrollY')
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
  // Only ever an own shadowing property installed by a focus-loss simulation.
  Reflect.deleteProperty(document, 'activeElement')
})

function StateSnapshot() {
  const state = useGameState()
  return <output data-testid="state-snapshot">{JSON.stringify(state)}</output>
}

/**
 * A "before vs. after" comparison meant to prove some unrelated interaction
 * touched no canonical state should not fail merely because Bookstore Sales
 * Cadence's own timing legitimately moved forward during the interaction, so
 * this reads the snapshot with `withoutBookstoreBackgroundTiming` applied.
 */
function stateSnapshotWithoutBookstoreCadenceTiming(): unknown {
  const state = JSON.parse(screen.getByTestId('state-snapshot').textContent ?? '{}') as GameState
  return withoutBookstoreBackgroundTiming(state)
}

/** An entered-Session world: one accessed represented host, connected. */
function remoteConnectedState(): GameState {
  const base = createInitialGameState()
  const target = base.world.network.hosts[0]
  const accessed: GameState = {
    ...base,
    world: { network: { ...base.world.network, hosts: [{
      ...target,
      displayName: 'truth-server',
      firmware: { id: RACK_OS_FIRMWARE_ID, name: 'TRUTH-OS', version: '2.4' },
    }, ...base.world.network.hosts.slice(1)] } },
    deviceAccess: { nextId: 2, established: [{
      id: 'access-truth', sourceDeviceId: base.player.localDevice.id,
      targetDeviceId: target.id, viaServiceId: 'service-ssh-001', privilege: 'USER',
    }] },
  }
  return connectRemoteFromObservation(accessed, {
    targetDeviceId: target.id, address: '198.51.100.47',
  }).state
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

describe('NODE-OS shell and applications', () => {
  it('derives Home and status-bar Device context from canonical state', () => {
    const base = createInitialGameState()
    const state = {
      ...base,
      player: {
        ...base.player,
        localDevice: {
          ...base.player.localDevice,
          displayName: 'field-node',
          network: { ip: '203.0.113.77', transferCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 2_097_152 } },
          operational: { lifecycle: 'RUNNING' as const, connectivity: 'DISCONNECTED' as const },
          firmware: { ...base.player.localDevice.firmware, name: 'TEST-OS' },
        },
      },
    }

    render(<GameProvider initialState={state}><Shell /></GameProvider>)

    expect(screen.getAllByText(/TEST-OS/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/field-node/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('203.0.113.77').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Network OFFLINE')).toHaveAttribute(
      'data-network-status',
      'OFFLINE',
    )
    expect(screen.getByText('NETWORK').parentElement).toHaveTextContent('OFFLINE')
    expect(screen.queryByText('NODE-OS')).not.toBeInTheDocument()
  })

  it('renders canonical runtime data without Wallet balance in shared chrome', () => {
    render(<App />)
    expect(screen.getByTestId('os-shell')).toBeInTheDocument()
    expect(screen.getAllByText('198.51.100.23')).toHaveLength(2)
    expect(screen.queryByText('$1,250.00')).not.toBeInTheDocument()
    expect(screen.getByText('CPU').parentElement).toHaveTextContent('18%')
    expect(screen.getByText('NET').parentElement).toHaveTextContent('ONLINE')
    expect(screen.getByLabelText('Network ONLINE')).toHaveAttribute(
      'data-network-status',
      'ONLINE',
    )
  })

  it('orders and exposes exactly the nine Home launcher controls, with NodeScan the one network surface', () => {
    render(<App />)
    const launchers = screen.getAllByRole('button', { name: /^open /i })
    expect(launchers.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Open Terminal', 'Open NodeScan', 'Open NodeMail', 'Open Processes',
      'Open Files', 'Open Market', 'Open Wallet', 'Open Notes', 'Open System',
    ])
    // Network administration is reached inside NodeScan, not from a second launcher.
    expect(screen.queryByRole('button', { name: 'Open Network' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open tools/i })).not.toBeInTheDocument()
    expect(screen.queryByText('/ OPEN')).not.toBeInTheDocument()
  })

  it('derives the Processes launcher status from canonical Process state', () => {
    const base = createInitialGameState()
    const state = {
      ...base,
      process: {
        nextId: 3,
        processes: [
          { id: 'process-1', kind: 'generic' as const, label: 'One', executorDeviceId: base.player.localDevice.id, status: 'running' as const, workRequired: 10, workCompleted: 2, ramRequiredMiB: 1 },
          { id: 'process-2', kind: 'generic' as const, label: 'Two', executorDeviceId: base.player.localDevice.id, status: 'completed' as const, workRequired: 10, workCompleted: 10, ramRequiredMiB: 1 },
        ],
      },
    }
    render(<GameProvider initialState={state}><Shell /></GameProvider>)
    expect(screen.getByRole('button', { name: /open processes/i })).toHaveTextContent('1 RUNNING')
  })

  it.each(['download', 'upload'] as const)('counts an active %s in the Processes launcher', (direction) => {
    render(<GameProvider initialState={withActiveTransfer(direction)}><Shell /></GameProvider>)

    expect(screen.getByRole('button', { name: /open processes/i })).toHaveTextContent('1 RUNNING')
  })

  it('counts an active local Process and active transfer in the Processes launcher', () => {
    const base = createInitialGameState()
    const state = withActiveTransfer('download', {
      ...base,
      process: {
        nextId: 2,
        processes: [{ id: 'process-1', kind: 'generic', label: 'Local work', executorDeviceId: base.player.localDevice.id, status: 'running', workRequired: 10, workCompleted: 2, ramRequiredMiB: 1 }],
      },
    })

    render(<GameProvider initialState={state}><Shell /></GameProvider>)

    expect(screen.getByRole('button', { name: /open processes/i })).toHaveTextContent('2 RUNNING')
  })

  it('does not count recent or completed activity in the Processes launcher', () => {
    const base = createInitialGameState()
    const completedProcess = { id: 'process-1', kind: 'generic' as const, label: 'Finished work', executorDeviceId: base.player.localDevice.id, status: 'completed' as const, workRequired: 10, workCompleted: 10, ramRequiredMiB: 1 }
    const completedTransfer: FileTransfer = {
      id: 'transfer-0001', origin: 'device_access', accessId: 'access-0001', sourceDeviceId: 'host-lan-001', sourceFileId: 'file-0002',
      destinationDeviceId: base.player.localDevice.id, destinationPath: '/home/user/downloads/complete.pkg',
      bytesTotal: 100, bytesTransferred: 100,
    }
    const state: GameState = {
      ...base,
      process: { nextId: 2, processes: [completedProcess] },
      recentActivity: { entries: [
        { kind: 'process', id: completedProcess.id, process: completedProcess },
        { kind: 'file_transfer', id: completedTransfer.id, transfer: completedTransfer },
      ] },
    }

    render(<GameProvider initialState={state}><Shell /></GameProvider>)

    expect(screen.getByRole('button', { name: /open processes/i })).toHaveTextContent('0 RUNNING')
  })

  it('opens an app and returns home', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open wallet/i }))
    expect(screen.getByText('Civic Dollar')).toBeInTheDocument()
    expect(screen.getByText('$1,250.00')).toBeInTheDocument()
    expect(screen.queryByText('MODULE')).not.toBeInTheDocument()
    expect(screen.queryByText(/05\s*\/\s*07/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /back to home/i }))
    expect(screen.getByRole('heading', { name: 'HOME' })).toBeInTheDocument()
  })

  it('keeps shell navigation outside canonical game state', async () => {
    const user = userEvent.setup()
    render(
      <GameProvider>
        <StateSnapshot />
        <Shell />
      </GameProvider>,
    )
    const before = stateSnapshotWithoutBookstoreCadenceTiming()
    await user.click(screen.getByRole('button', { name: /open wallet/i }))
    await user.click(screen.getByRole('button', { name: /back to home/i }))
    expect(stateSnapshotWithoutBookstoreCadenceTiming()).toEqual(before)
  })

  it('shows canonical runtime values in the System app', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open system/i }))
    expect(screen.getAllByText('198.51.100.23')).toHaveLength(2)
    expect(screen.getAllByText('18%')).toHaveLength(2)
    expect(screen.getAllByText('23%')).toHaveLength(2)
    expect(screen.getAllByText('ONLINE')).toHaveLength(3)
  })

  it('shows Device and Firmware diagnostics from canonical state', async () => {
    const base = createInitialGameState()
    const state = {
      ...base,
      player: {
        ...base.player,
        localDevice: {
          ...base.player.localDevice,
          displayName: 'test-device',
          firmware: {
            id: 'firmware-test-v7',
            name: 'TEST-OS',
            version: '7.4',
          },
        },
      },
    }
    const user = userEvent.setup()
    render(<GameProvider initialState={state}><Shell /></GameProvider>)

    await user.click(screen.getByRole('button', { name: /open system/i }))

    expect(screen.getByText('DEVICE').parentElement).toHaveTextContent('test-device')
    expect(screen.getByText('TYPE').parentElement).toHaveTextContent('NODE')
    expect(screen.getByText('MODEL').parentElement).toHaveTextContent('NODE 1')
    expect(screen.getByText('FIRMWARE').parentElement).toHaveTextContent('TEST-OS 7.4')
  })
})

describe('Terminal', () => {
  it('runs help', async () => {
    await command('help')
    expect(screen.getByText('AVAILABLE COMMANDS')).toBeInTheDocument()
  })

  it('runs ip', async () => {
    await command('ip')
    expect(screen.getByText('ADDRESS')).toBeInTheDocument()
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
    expect(screen.getByText('ADDRESS')).toBeInTheDocument()
    await user.type(input, 'clear{enter}')
    expect(screen.queryByText('ADDRESS')).not.toBeInTheDocument()
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
    await user.click(screen.getByText(/to begin/i))
    expect(input).not.toHaveFocus()
  })

  it('copies an exact target with local feedback without changing input or history', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const { user, input } = await openTerminal()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await user.type(input, 'scan 198.51.100.23{enter}')
    await user.type(input, 'scan home-net{enter}')
    input.blur()
    // SELF's own Scan output above already names this same address as home-net's other Member; the token under
    // test here is the one `scan home-net` itself just printed.
    const tokens = await screen.findAllByRole('button', { name: 'Copy target 198.51.100.47' })
    const token = tokens[tokens.length - 1]

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
