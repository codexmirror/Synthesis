import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import type { FilesystemFile, GameState } from '../../core/game/types'
import { Files } from './Files'
import { Terminal } from '../terminal/Terminal'
import { Processes } from '../processes/Processes'
import { connectRemoteFromObservation } from '../../core/game/remoteSession'

afterEach(() => vi.useRealTimers())

describe('Files', () => {
  it('uploads any selected local file through the active Session with an explicit editable destination', async () => {
    const base = createInitialGameState()
    const accessState = { ...base, deviceAccess: { nextId: 2, established: [{ id: 'access-upload', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' as const }] } }
    const connected = connectRemoteFromObservation(accessState, { targetDeviceId: 'host-lan-001', address: '198.51.100.47' }).state
    render(<GameProvider initialState={connected}><Files /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /downloads.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.pkg/ }))
    expect(screen.getByText('REMOTE TRANSFER')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.47')).toBeInTheDocument()
    const destination = screen.getByLabelText('Remote destination')
    expect(destination).toHaveValue('/home/user/node-miner-1.0.pkg')
    await user.clear(destination); await user.type(destination, '/home/user/custom.pkg')
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))
    expect(screen.getByRole('button', { name: 'UPLOAD IN PROGRESS' })).toBeDisabled()
  })
  it('navigates canonical directories and presents file kinds, sizes, and executable details without future actions', async () => {
    const state = createInitialGameState()
    const files = [
      { kind: 'text' as const, id: 'file-text', path: '/home/user/docs/café.txt', content: 'café 🚀' },
      { kind: 'software_package' as const, id: 'file-package', path: '/home/user/nodescan.pkg', releaseId: 'nodescan-1.1-experimental', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 18_400_000 },
      { kind: 'executable' as const, id: 'file-executable', path: '/home/user/tool.bin', programId: 'diagnostic-tool', releaseId: 'diagnostic-tool-2', name: 'Diagnostic Tool', version: '2.0', sizeBytes: 4_096 },
    ]
    render(<GameProvider initialState={{ ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 4, files } } } }}><Files /></GameProvider>)
    expect(screen.getByText('/home/user')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\.\.\/.*DIRECTORY/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nodescan\.pkg.*SOFTWARE PACKAGE.*18\.4 MB/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tool\.bin.*EXECUTABLE.*4\.1 KB/ })).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /docs.*DIRECTORY/ }))
    expect(screen.getByText('/home/user/docs')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /café\.txt.*TEXT.*10 B/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /\.\.\/.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /tool\.bin/ }))
    expect(screen.getByText('Diagnostic Tool (diagnostic-tool)')).toBeInTheDocument()
    expect(screen.getByText('diagnostic-tool-2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'RUN' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'UPLOAD' })).not.toBeInTheDocument()
  })

  it('presents one supplied canonical filesystem through both Files and Terminal', async () => {
    const state = createInitialGameState()
    const initialState = {
      ...state,
      player: {
        ...state.player,
        localDevice: {
          ...state.player.localDevice,
          filesystem: { nextFileId: 50, files: [{ kind: 'text' as const, id: 'file-fixture-text', path: '/home/user/proof.txt', content: 'line one\nline two\nline three' }] },
        },
      },
    }
    const { container } = render(<GameProvider initialState={initialState}><Files /><Terminal /></GameProvider>)
    expect(screen.getByText('/home/user')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /proof\.txt/ })).toBeInTheDocument()
    expect(screen.queryByText('welcome.txt')).not.toBeInTheDocument()
    expect(screen.queryByText('1 KB')).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /proof\.txt/ }))
    expect(container.querySelector('.file-content')).toHaveTextContent('line one\nline two\nline three', { normalizeWhitespace: false })
    expect(screen.getByRole('button', { name: 'Back to /home/user' })).toBeInTheDocument()

    const input = screen.getByLabelText('Command input')
    await user.type(input, 'ls /home/user{enter}')
    const terminal = within(screen.getByRole('region', { name: 'Terminal' }))
    expect(terminal.getByText('proof.txt')).toBeInTheDocument()
    await user.type(input, 'cat /home/user/proof.txt{enter}')
    expect(terminal.getByText('line one')).toBeInTheDocument()
    expect(terminal.getByText('line two')).toBeInTheDocument()
    expect(terminal.getByText('line three')).toBeInTheDocument()
  })

  it('installs a supported local package through canonical state and derives the installed presentation on reopen', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const state = createInitialGameState()
    const packageFile = { kind: 'software_package' as const, id: 'file-fixture-package', path: '/home/user/release.bin', releaseId: 'altered-release', productId: 'nodescan', name: 'Canonical Scanner', version: '4.2', channel: 'testing', sizeBytes: 1_000 }
    const initialState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 50, files: [packageFile] } } } }
    render(<GameProvider initialState={initialState}><Files /><Terminal /></GameProvider>)

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: /release\.bin/ }))
    expect(screen.getByText('SOFTWARE PACKAGE')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Canonical Scanner' })).toBeInTheDocument()
    expect(screen.getByText('4.2 Testing')).toBeInTheDocument()
    expect(screen.getByText('RELEASE')).toBeInTheDocument()
    expect(screen.getByText('altered-release')).toBeInTheDocument()
    expect(screen.getByText('CURRENT')).toBeInTheDocument()
    expect(screen.getByText('NodeScan 1.0 Standard')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'INSTALL' }))

    // INSTALL admits real Process work, not instantaneous installation truth: the package state visibly transitions through INSTALLING first.
    expect(screen.getByRole('button', { name: 'INSTALLING…' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(20_000) })

    expect(screen.queryByRole('button', { name: 'REMOVE' })).not.toBeInTheDocument()
    expect(screen.getAllByText('INSTALLED').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Back to /home/user' }))
    await user.click(screen.getByRole('button', { name: /release\.bin/ }))
    expect(screen.queryByRole('button', { name: 'REMOVE' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Command input'), 'cat /home/user/release.bin{enter}')
    expect(within(screen.getByRole('region', { name: 'Terminal' })).getByText('NOT A TEXT FILE')).toBeInTheDocument()
    expect(state.player.localDevice.installedSoftware[0]).toMatchObject({ name: 'NodeScan', version: '1.0', channel: 'standard' })
    expect(state.process.processes).toEqual([])
    vi.useRealTimers()
  })

  it('does not expose install for an unsupported represented package', async () => {
    const state = createInitialGameState()
    const file = { kind: 'software_package' as const, id: 'file-fixture-package', path: '/home/user/other.bin', releaseId: 'opaque', productId: 'other', name: 'Other', version: '1', channel: 'test', sizeBytes: 1_000 }
    render(<GameProvider initialState={{ ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 50, files: [file] } } } }}><Files /></GameProvider>)
    await userEvent.setup().click(screen.getByRole('button', { name: /other\.bin/ }))
    expect(screen.getByText('UNSUPPORTED PACKAGE')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
  })
})

describe('Files NODE Miner installation', () => {
  it('installs the starting local NODE Miner package into real installed software and a concrete executable, then RUN works through it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const state = createInitialGameState()
    render(<GameProvider initialState={state}><Files /><Processes /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: /downloads.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.pkg/ }))
    expect(screen.getByRole('heading', { name: 'NODE Miner' })).toBeInTheDocument()
    expect(screen.getByText('CURRENT')).toBeInTheDocument()
    expect(screen.getByText('NOT INSTALLED')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'INSTALL' }))
    expect(screen.getByRole('button', { name: 'INSTALLING…' })).toBeDisabled()

    await act(async () => { vi.advanceTimersByTime(20_000) })
    expect(screen.queryByRole('button', { name: 'REMOVE' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to /home/user/downloads' }))
    await user.click(screen.getByRole('button', { name: /\.\.\/.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /\.\.\/.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /\.\.\/.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /^usr.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /^local.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /^bin.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /^node-miner.*EXECUTABLE/ }))
    expect(screen.getByText('NODE Miner (node-miner)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'RUN' }))
    expect(within(document.querySelector('.files-app') as HTMLElement).getByText('RUNNING')).toBeInTheDocument()
    expect(within(screen.getByText('NODE MINER').closest('.am-activity') as HTMLElement).getByText('RUNNING')).toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('Files NODE Miner RUN', () => {
  const withMiner = (path = '/home/user/node-miner-1.0.bin') => {
    const state = createInitialGameState()
    const minerFile = { kind: 'executable' as const, id: 'file-fixture-miner', path, programId: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
    return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 50, files: [minerFile] } } } }
  }

  it('prefills the represented NODE Wallet address and RUN starts a real continuous Process, showing immediate feedback derived from canonical runtime', async () => {
    const state = withMiner()
    render(<GameProvider initialState={state}><Files /><Processes /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.bin/ }))
    expect(screen.getByText('NODE Miner (node-miner)')).toBeInTheDocument()
    const addressInput = screen.getByLabelText('NODE payout address') as HTMLInputElement
    expect(addressInput.value).toBe(state.nodeWallet.address)
    await user.click(screen.getByRole('button', { name: 'RUN' }))

    // Files itself must show immediate success feedback on the very first click, derived from canonical ProcessState.
    expect(within(document.querySelector('.files-app') as HTMLElement).getByText('RUNNING')).toBeInTheDocument()
    expect(screen.getByText(/PROCESS process-0001/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'RUN' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('NODE payout address')).not.toBeInTheDocument()

    const card = screen.getByText('NODE MINER').closest('.am-activity') as HTMLElement
    expect(within(card).getByText('RUNNING')).toBeInTheDocument()
  })

  it('never re-offers a normal RUN action while the same local Miner is already running, even across a different copy of the executable', async () => {
    const state = withMiner()
    const otherCopy = { kind: 'executable' as const, id: 'file-fixture-miner-2', path: '/home/user/node-miner-copy.bin', programId: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
    const withCopies = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: [...state.player.localDevice.filesystem.files, otherCopy] } } } }
    render(<GameProvider initialState={withCopies}><Files /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.bin/ }))
    await user.click(screen.getByRole('button', { name: 'RUN' }))
    expect(screen.getByText('RUNNING')).toBeInTheDocument()

    // Navigate to the other represented copy: the same canonical runtime truth applies there too.
    await user.click(screen.getByRole('button', { name: 'Back to /home/user' }))
    await user.click(screen.getByRole('button', { name: /node-miner-copy\.bin/ }))
    expect(screen.getByText('RUNNING')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'RUN' })).not.toBeInTheDocument()
  })

  it('does not offer RUN for an unsupported executable program', async () => {
    const state = createInitialGameState()
    const file = { kind: 'executable' as const, id: 'file-fixture-exe', path: '/home/user/tool.bin', programId: 'diagnostic-tool', releaseId: 'diagnostic-tool-2', name: 'Diagnostic Tool', version: '2.0', sizeBytes: 4_096 }
    render(<GameProvider initialState={{ ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 50, files: [file] } } } }}><Files /></GameProvider>)
    await userEvent.setup().click(screen.getByRole('button', { name: /tool\.bin/ }))
    expect(screen.getByText('UNSUPPORTED')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'RUN' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('NODE payout address')).not.toBeInTheDocument()
  })

  it('rejects RUN with an empty payout address and shows the admission failure', async () => {
    render(<GameProvider initialState={withMiner()}><Files /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.bin/ }))
    const addressInput = screen.getByLabelText('NODE payout address')
    await user.clear(addressInput)
    await user.click(screen.getByRole('button', { name: 'RUN' }))
    expect(screen.getByText('INVALID PAYOUT ADDRESS')).toBeInTheDocument()
  })

  it('returns to a runnable state once STOP elsewhere removes the canonical Process', async () => {
    const state = withMiner()
    render(<GameProvider initialState={state}><Files /><Processes /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.bin/ }))
    await user.click(screen.getByRole('button', { name: 'RUN' }))
    expect(within(document.querySelector('.files-app') as HTMLElement).getByText('RUNNING')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Stop NODE MINER' }))
    expect(within(document.querySelector('.files-app') as HTMLElement).queryByText('RUNNING')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'RUN' })).toBeInTheDocument()
    expect(screen.getByLabelText('NODE payout address')).toBeInTheDocument()
  })
})

describe('Files filesystem and software state', () => {
  const withFiles = (files: FilesystemFile[]) => {
    const state = createInitialGameState()
    return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 50, files } } } }
  }

  it('states an unresolved location rather than rendering nothing', () => {
    render(<GameProvider initialState={withFiles([{ kind: 'text', id: 'file-elsewhere', path: '/srv/other.txt', content: 'x' }])}><Files /></GameProvider>)
    expect(screen.getByText('DIRECTORY NOT FOUND')).toBeInTheDocument()
    expect(screen.getByText('UNRESOLVED')).toBeInTheDocument()
  })

  it('derives package listing state from the Device-owned installed software', () => {
    const experimental = { kind: 'software_package' as const, id: 'file-pkg', path: '/home/user/nodescan.pkg', releaseId: 'nodescan-1.1-experimental', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 1_000 }
    const state = withFiles([experimental])
    const { unmount } = render(<GameProvider initialState={state}><Files /></GameProvider>)
    expect(screen.getByText('INSTALLABLE')).toBeInTheDocument()
    unmount()

    const installed = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: [{ id: 'nodescan' as const, releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental' }] } } }
    render(<GameProvider initialState={installed}><Files /></GameProvider>)
    expect(screen.getByText('INSTALLED')).toBeInTheDocument()
    expect(screen.queryByText('INSTALLABLE')).not.toBeInTheDocument()
  })

  it('shows INSTALLING while a real installation Process runs and disables duplicate admission for that product', () => {
    const experimental = { kind: 'software_package' as const, id: 'file-pkg', path: '/home/user/nodescan.pkg', releaseId: 'nodescan-1.1-experimental', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 1_000 }
    const base = withFiles([experimental])
    const running: GameState = {
      ...base,
      process: { nextId: 2, processes: [
        { kind: 'software_installation', id: 'process-0001', label: 'SOFTWARE INSTALLATION', executorDeviceId: base.player.localDevice.id, status: 'running', workRequired: 600, workCompleted: 100, ramRequiredMiB: 256, productId: 'nodescan', releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental' },
      ] },
    }
    render(<GameProvider initialState={running}><Files /></GameProvider>)
    expect(screen.getByText('INSTALLING')).toBeInTheDocument()
    expect(screen.queryByText('INSTALLABLE')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nodescan\.pkg/ }))
  })

  it('presents an inbound transfer as pending runtime rather than as a filesystem entry', () => {
    const base = withFiles([{ kind: 'text', id: 'file-welcome', path: '/home/user/welcome.txt', content: 'hi' }])
    const state: GameState = {
      ...base,
      deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
      fileTransfer: { nextId: 2, active: {
        id: 'transfer-0001', accessId: 'access-0001', sourceDeviceId: 'host-lan-001', sourceFileId: 'file-0002',
        destinationDeviceId: base.player.localDevice.id, destinationPath: '/home/user/downloads/nodescan-exp-1.1.pkg',
        bytesTotal: 18_400_000, bytesTransferred: 13_800_000,
      } },
    }
    render(<GameProvider initialState={state}><Files /></GameProvider>)

    // Derived from canonical bytes, so a hardcoded percentage would fail here.
    expect(screen.getByText(/INCOMING · 13\.8 \/ 18\.4 MB · 75%/)).toBeInTheDocument()
    expect(screen.getByText('downloads/nodescan-exp-1.1.pkg')).toBeInTheDocument()
    // It is not an entry: not navigable, not counted, and explicitly unwritten.
    expect(screen.queryByRole('button', { name: /downloads\/nodescan/ })).not.toBeInTheDocument()
    expect(screen.getByText('1 ENTRY')).toBeInTheDocument()
    expect(screen.getByText(/not written to this filesystem until it completes/)).toBeInTheDocument()
  })

  it('shows no inbound transfer when none is represented', () => {
    render(<GameProvider initialState={withFiles([{ kind: 'text', id: 'file-welcome', path: '/home/user/welcome.txt', content: 'hi' }])}><Files /></GameProvider>)
    expect(screen.queryByText(/INCOMING/)).not.toBeInTheDocument()
  })
})

describe('Files software removal', () => {
  const withFiles = (files: FilesystemFile[]) => {
    const state = createInitialGameState()
    return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 50, files } } } }
  }
  const experimental = { kind: 'software_package' as const, id: 'file-pkg', path: '/home/user/nodescan.pkg', releaseId: 'nodescan-1.1-experimental', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 1_000 }

  it('represents the protected NodeScan 1.0 Standard baseline truthfully, with no destructive REMOVE action', async () => {
    const baseline = { kind: 'software_package' as const, id: 'file-baseline', path: '/home/user/nodescan-1.0.pkg', releaseId: 'nodescan-1.0-standard', productId: 'nodescan', name: 'NodeScan', version: '1.0', channel: 'standard', sizeBytes: 1_000 }
    render(<GameProvider initialState={withFiles([baseline])}><Files /></GameProvider>)
    await userEvent.setup().click(screen.getByRole('button', { name: /nodescan-1\.0\.pkg/ }))
    expect(screen.getByText('PROTECTED · SYSTEM BASELINE')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'REMOVE' })).not.toBeInTheDocument()
  })

  it('presents installed package status without exposing removal from Files', async () => {
    const base = withFiles([experimental])
    const installed = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: [{ id: 'nodescan' as const, releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental' }] } } }
    render(<GameProvider initialState={installed}><Files /></GameProvider>)
    await userEvent.setup().click(screen.getByRole('button', { name: /nodescan\.pkg/ }))
    expect(screen.getAllByText('INSTALLED').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'REMOVE' })).not.toBeInTheDocument()
  })

  it('prevents duplicate removal admission for the same product while REMOVING', () => {
    const base = withFiles([experimental])
    const running: GameState = {
      ...base,
      player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: [{ id: 'nodescan' as const, releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental' }] } },
      process: { nextId: 2, processes: [
        { kind: 'software_removal', id: 'process-0001', label: 'SOFTWARE REMOVAL', executorDeviceId: base.player.localDevice.id, status: 'running', workRequired: 400, workCompleted: 100, ramRequiredMiB: 128, productId: 'nodescan', releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental' },
      ] },
    }
    render(<GameProvider initialState={running}><Files /></GameProvider>)
    expect(screen.getByText('REMOVING')).toBeInTheDocument()
    expect(screen.queryByText('INSTALLED')).not.toBeInTheDocument()
  })
})
