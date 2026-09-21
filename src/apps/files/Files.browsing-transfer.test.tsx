import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import type { DeauthExtensionFile, FilesystemFile, GameState } from '../../core/game/types'
import { Files } from './Files'
import { Terminal } from '../terminal/Terminal'
import { Processes } from '../processes/Processes'
import { connectRemoteFromObservation } from '../../core/game/remoteSession'
import { CREDENTIAL_ACCESS_MODULE_1_0, ROLLBACK_MODULE_1_0, FLIPPER_1_0_CANONICAL_INSTALLATION, FLIPPER_INSTALLED_EXECUTABLE_PATH } from '../../core/game/flipper'
import { RATTLER_PROGRAM_ID, RATTLER_INSTALLED_EXECUTABLE_PATH } from '../../core/game/rattler'
import { RATTLER_1_0 } from '../../core/game/softwareReleaseContent'
import { RACK_OS_1_1_BUSINESS_RELEASE } from '../../core/game/rackOsFirmwareUpdate'

afterEach(() => vi.useRealTimers())

function SessionControls() {
  const actions = useGameActions()
  return <><button onClick={() => actions.disconnectRemoteSession()}>test disconnect</button><button onClick={() => actions.connectRemoteFromObservation({ targetDeviceId: 'host-lan-002', address: '203.0.113.42' })}>test connect B</button></>
}

/** Reads canonical state directly so a test can prove that presentation alone changed nothing. */
function StateProbe() {
  const state = useGameState()
  return <span data-testid="game-state">{JSON.stringify({
    processes: state.process.processes.map(({ id, kind }) => `${id}:${kind}`),
    software: state.player.localDevice.installedSoftware.map(({ id, releaseId }) => `${id}:${releaseId}`),
    files: state.player.localDevice.filesystem.files.map(({ path }) => path),
  })}</span>
}

function probe(): { processes: string[]; software: string[]; files: string[] } {
  return JSON.parse(screen.getByTestId('game-state').textContent ?? '')
}

function uploadState() {
  const base = createInitialGameState()
  const accessA = { id: 'access-files-upload-a', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' as const }
  const accessB = { id: 'access-files-upload-b', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-ssh-002', privilege: 'USER' as const }
  const connected = connectRemoteFromObservation({ ...base, deviceAccess: { nextId: 3, established: [accessA, accessB] } }, { targetDeviceId: accessA.targetDeviceId, address: '198.51.100.47' }).state
  return { ...connected, remoteSession: { ...connected.remoteSession, active: { ...connected.remoteSession.active!, connectedAddress: '203.0.113.77' } } }
}

describe('Files browsing and transfer', () => {
  const withFiles = (files: FilesystemFile[]) => {
    const state = createInitialGameState()
    return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 50, files } } } }
  }

  it('marks every entry that opens a further surface, not only directories', async () => {
    /*
     * A file entry opens its own surface with a back control exactly as a
     * directory does, so it carries the same arrow. Only directories were
     * marked, which left the listing saying that a file row did nothing.
     * `../` keeps its own upward glyph rather than a forward arrow.
     */
    const state = createInitialGameState()
    const files = [{ kind: 'text' as const, id: 'file-text', path: '/home/user/docs/note.txt', content: 'hi' }]
    const { container } = render(<GameProvider initialState={{ ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 2, files } } } }}><Files /></GameProvider>)

    const arrowed = (name: RegExp) => !!screen.getByRole('button', { name }).querySelector('.node-row-arrow')
    expect(arrowed(/docs.*DIRECTORY/)).toBe(true)
    expect(arrowed(/\.\.\/.*DIRECTORY/)).toBe(false)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /docs.*DIRECTORY/ }))
    expect(arrowed(/note\.txt.*TEXT/)).toBe(true)

    // And the arrow is decoration: it never becomes part of a row's name.
    await user.click(screen.getByRole('button', { name: /note\.txt.*TEXT/ }))
    expect(screen.getByRole('heading', { name: 'note.txt' })).toBeInTheDocument()
    expect(container.querySelector('.node-back')).toBeInTheDocument()
  })

  it('navigates canonical directories and presents file kinds, sizes, and executable details without future actions', async () => {
    const state = createInitialGameState()
    const files = [
      { kind: 'text' as const, id: 'file-text', path: '/home/user/docs/café.txt', content: 'café 🚀' },
      { kind: 'software_package' as const, id: 'file-package', path: '/home/user/nodescan.pkg', releaseId: 'nodescan-1.1-experimental', buildId: 'build-fixture-v0', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 18_400_000 },
      { kind: 'executable' as const, id: 'file-executable', path: '/home/user/tool.bin', programId: 'diagnostic-tool', releaseId: 'diagnostic-tool-2', buildId: 'build-fixture-v0', name: 'Diagnostic Tool', version: '2.0', sizeBytes: 4_096 },
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
    expect(screen.getByRole('heading', { name: 'Diagnostic Tool' })).toBeInTheDocument()
    expect(screen.getByText('UNSUPPORTED')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'RUN' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'UPLOAD' })).not.toBeInTheDocument()

    // Program identity is still available, just behind FILE INFORMATION rather than dominating the primary surface.
    await user.click(screen.getByRole('button', { name: /FILE INFORMATION/ }))
    expect(screen.getByText('diagnostic-tool')).toBeInTheDocument()
    expect(screen.getByText('diagnostic-tool-2')).toBeInTheDocument()
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

  it('offers generic Upload only with a usable Session and submits the editable destination unchanged', async () => {
    render(<GameProvider initialState={uploadState()}><Files /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /downloads.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.pkg/ }))
    expect(screen.getByText('203.0.113.77')).toBeInTheDocument()
    const destination = screen.getByLabelText('Remote destination')
    expect(destination).toHaveValue('/home/user/node-miner-1.0.pkg')
    await user.clear(destination); await user.type(destination, '/srv/exact-custom.pkg')
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))
    expect(screen.getByRole('button', { name: 'UPLOAD IN PROGRESS' })).toBeDisabled()
    expect(screen.queryByLabelText('Remote destination')).not.toBeInTheDocument()
    expect(screen.getByText('/srv/exact-custom.pkg')).toBeInTheDocument()
  })

  it('keeps the canonical custom Upload destination after leaving and reopening the source file', async () => {
    render(<GameProvider initialState={uploadState()}><Files /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /downloads.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.pkg/ }))
    const destination = screen.getByLabelText('Remote destination')
    await user.clear(destination); await user.type(destination, '/srv/custom-miner.pkg')
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))
    await user.click(screen.getByRole('button', { name: 'Back to /home/user/downloads' }))
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.pkg/ }))

    expect(screen.getByRole('button', { name: 'UPLOAD IN PROGRESS' })).toBeDisabled()
    expect(screen.getByText('/srv/custom-miner.pkg')).toBeInTheDocument()
    expect(screen.queryByText('/home/user/node-miner-1.0.pkg')).not.toBeInTheDocument()
  })

  it('keeps Upload in progress after disconnect without fabricating a Session or new admission action', async () => {
    render(<GameProvider initialState={uploadState()}><Files /><SessionControls /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /downloads.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.pkg/ }))
    const destination = screen.getByLabelText('Remote destination')
    await user.clear(destination); await user.type(destination, '/srv/custom-miner.pkg')
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))
    await user.click(screen.getByRole('button', { name: 'test disconnect' }))
    await user.click(screen.getByRole('button', { name: 'Back to /home/user/downloads' }))
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.pkg/ }))

    expect(screen.getByText('REMOTE TRANSFER')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'UPLOAD IN PROGRESS' })).toBeDisabled()
    expect(screen.getByText('/srv/custom-miner.pkg')).toBeInTheDocument()
    expect(screen.queryByText('SESSION')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'UPLOAD' })).not.toBeInTheDocument()
  })

  it('does not label an Upload to server A with a later unrelated server B Session', async () => {
    render(<GameProvider initialState={uploadState()}><Files /><SessionControls /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /downloads.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.pkg/ }))
    const destination = screen.getByLabelText('Remote destination')
    await user.clear(destination); await user.type(destination, '/srv/server-a.pkg')
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))
    await user.click(screen.getByRole('button', { name: 'test disconnect' }))
    await user.click(screen.getByRole('button', { name: 'test connect B' }))
    await user.click(screen.getByRole('button', { name: 'Back to /home/user/downloads' }))
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.pkg/ }))

    expect(screen.getByRole('button', { name: 'UPLOAD IN PROGRESS' })).toBeDisabled()
    expect(screen.getByText('/srv/server-a.pkg')).toBeInTheDocument()
    expect(screen.queryByText('203.0.113.42')).not.toBeInTheDocument()
    expect(screen.queryByText('SESSION')).not.toBeInTheDocument()
  })

  it('presents an inbound transfer as pending runtime rather than as a filesystem entry', () => {
    const base = withFiles([{ kind: 'text', id: 'file-welcome', path: '/home/user/welcome.txt', content: 'hi' }])
    const state: GameState = {
      ...base,
      deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
      fileTransfer: { nextId: 2, active: {
        id: 'transfer-0001', origin: 'device_access', accessId: 'access-0001', sourceDeviceId: 'host-lan-001', sourceFileId: 'file-0002',
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
