import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { connectRemoteFromObservation } from '../../core/game/remoteSession'
import { installRemoteSoftwarePackage } from '../../core/game/softwareInstallation'
import { createInitialGameState } from '../../core/game/initialState'
import { RACK_OS_FIRMWARE_ID } from '../../core/game/firmwareIdentity'
import { Shell } from '../../shell/Shell'
import type { ExecutableFile, GameProcess, GameState, NetworkHost, NodeMinerProcess } from '../../core/game/types'
import { rememberScan } from '../../core/game/discovery'
import { scanNetworkTarget } from '../../core/game/scan'
import { Terminal } from '../terminal/Terminal'
import rackSource from './RackOS.tsx?raw'
import rackCss from './rackos.css?raw'

function StateSnapshot() { return <output data-testid="game-state">{JSON.stringify(useGameState())}</output> }

function discoveredAccessState(): GameState {
  const state = createInitialGameState()
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  let discovery = rememberScan(state.discovery, scanNetworkTarget(targets, state.player.localDevice.network.ip), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, 'home-net'), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, '198.51.100.47'), state.player.localDevice.id)
  return { ...state, discovery, deviceAccess: { nextId: 2, established: [{ id: 'access-roundtrip', sourceDeviceId: state.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] } }
}

function connectedState(): GameState {
  const base = createInitialGameState()
  const host = base.world.network.hosts[0]
  const altered = { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, displayName: 'live-server', ip: '192.0.2.99', firmware: { id: RACK_OS_FIRMWARE_ID, name: 'STATE-OS', version: '7.4' }, filesystem: { nextFileId: 50, files: [{ kind: 'text' as const, id: 'file-fixture-text', path: '/srv/proof.txt', content: 'Foreign canonical proof.' }] } }, ...base.world.network.hosts.slice(1)] } }, deviceAccess: { nextId: 2, established: [{ id: 'access-test', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: 'service-http-001', privilege: 'USER' as const }] } }
  const connected = connectRemoteFromObservation(altered, { targetDeviceId: host.id, address: '192.0.2.99' }).state
  return { ...connected, remoteSession: { ...connected.remoteSession, active: { ...connected.remoteSession.active!, connectedAddress: '198.51.100.47' } } }
}

/** `connectedState` plus a represented remote `/home/user` directory, so the
 *  remote-first Upload workflow can start from a non-root remote directory. */
function connectedStateWithRemoteHome(): GameState {
  const base = connectedState()
  const host = base.world.network.hosts[0]
  const files = [...host.filesystem!.files, { kind: 'text' as const, id: 'file-fixture-remote-home', path: '/home/user/notes.txt', content: 'Remote workspace notes.' }]
  return { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, filesystem: { nextFileId: 60, files } }, ...base.world.network.hosts.slice(1)] } } }
}

async function enterRemote(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^ENTER .+ →$/ }))
}

afterEach(() => vi.useRealTimers())

describe('RACK-OS', () => {
  it('owns editing scroll in its output and configures the remote command for mobile entry', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={connectedState()}><Shell /></GameProvider>)
    await enterRemote(user)

    const output = document.querySelector('.rack-output')
    expect(output).toHaveAttribute('data-editing-scroll-owner')
    expect(document.querySelectorAll('.rack-os [data-editing-scroll-owner]')).toHaveLength(1)
    expect(output).not.toBeNull()
    expect(output!.parentElement).toHaveClass('rack-terminal')

    expect(screen.getByLabelText('Remote command')).toHaveAttribute('autocapitalize', 'none')
    expect(screen.getByLabelText('Remote command')).toHaveAttribute('autocomplete', 'off')
    expect(screen.getByLabelText('Remote command')).toHaveAttribute('autocorrect', 'off')
    expect(screen.getByLabelText('Remote command')).toHaveAttribute('spellcheck', 'false')
    expect(screen.getByLabelText('Remote command')).toHaveAttribute('enterkeyhint', 'send')
    expect(screen.getByLabelText('Remote command')).not.toHaveAttribute('autofocus')
  })

  it('keeps the compact prompt while enforcing mobile input and output geometry', () => {
    expect(rackCss).toMatch(/\.rack-terminal label\s*{[^}]*font-size:\s*\.76rem;/)
    expect(rackCss).toMatch(/@media \(max-width: 700px\), \(max-width: 900px\) and \(pointer: coarse\)[\s\S]*?\.rack-terminal input\s*{\s*font-size:\s*16px;\s*}/)
    expect(rackCss).toMatch(/\.rack-output\s*{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;[^}]*overflow-x:\s*hidden;[^}]*overscroll-behavior-y:\s*contain;[^}]*touch-action:\s*pan-y pinch-zoom;[^}]*-webkit-overflow-scrolling:\s*touch;/)
  })

  it('keeps viewport correction logic out of the RACK boundary', () => {
    expect(rackSource + rackCss).not.toMatch(/visualViewport|window\.scrollTo|scrollIntoView/)
  })

  it('keeps its narrow header context actions touch-safe', () => {
    expect(rackCss).toMatch(/\.rack-header__actions\s*{[^}]*width:\s*100%;[^}]*flex-wrap:\s*wrap;/)
    expect(rackCss).toMatch(/\.rack-header button\s*{[^}]*min-height:\s*44px;/)
  })

  it('presents live canonical identity, authority, access path, and one filesystem through Files and Terminal', async () => {
    const user = userEvent.setup(); const initial = connectedState(); const discoveryBefore = initial.discovery; const knowledgeBefore = initial.knowledge
    render(<GameProvider initialState={initial}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    expect(screen.getByLabelText('STATE-OS remote operating environment')).toHaveTextContent('STATE-OS 7.4')
    expect(document.body).toHaveTextContent('live-server · 192.0.2.99')
    expect(document.querySelector('.node-workspace')).toHaveAttribute('hidden')
    const input = screen.getByLabelText('Remote command')
    await user.type(input, 'ip{enter}'); expect(document.body).toHaveTextContent('192.0.2.99')
    await user.type(input, 'ls /srv{enter}'); expect(document.body).toHaveTextContent('proof.txt')
    await user.type(input, 'cat /srv/proof.txt{enter}'); expect(document.body).toHaveTextContent('Foreign canonical proof.')
    const current = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(current.discovery).toEqual(discoveryBefore); expect(current.knowledge).toEqual(knowledgeBefore)
    await user.click(screen.getByRole('button', { name: 'FILES' })); await user.click(screen.getByRole('button', { name: 'DIR srv' })); await user.click(screen.getByRole('button', { name: 'FILE proof.txt' })); expect(document.body).toHaveTextContent('Foreign canonical proof.')
    await user.click(screen.getByRole('button', { name: 'SYSTEM' })); expect(document.body).toHaveTextContent('STATE-OS 7.4'); expect(document.body).toHaveTextContent('HTTP')
  })

  it('uses the shared disconnect operation and returns to preserved local presentation', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={connectedState()}><Shell /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'DISCONNECT' }))
    expect(screen.queryByLabelText('STATE-OS remote operating environment')).not.toBeInTheDocument()
    expect(document.querySelector('.node-workspace')).not.toHaveAttribute('hidden')
  })

  it('navigates and presents canonical package metadata while cat rejects the artifact', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const initial = connectedState()
    const host = initial.world.network.hosts[0]
    const packageFile = { kind: 'software_package' as const, id: 'file-fixture-package', path: '/opt/packages/scanner.release', releaseId: 'canonical-package', productId: 'nodescan', name: 'Altered NodeScan', version: '8.7', channel: 'nightly', sizeBytes: 1_000 }
    const state = { ...initial, world: { network: { ...initial.world.network, hosts: [{ ...host, filesystem: { nextFileId: 50, files: [packageFile] } }, ...initial.world.network.hosts.slice(1)] } } }
    render(<GameProvider initialState={state}><Shell /><StateSnapshot /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await enterRemote(user)

    await user.type(screen.getByLabelText('Remote command'), 'cat /opt/packages/scanner.release{enter}')
    expect(document.body).toHaveTextContent('NOT A TEXT FILE')
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR opt' }))
    await user.click(screen.getByRole('button', { name: 'DIR packages' }))
    await user.click(screen.getByRole('button', { name: 'FILE scanner.release' }))
    expect(document.body).toHaveTextContent('SOFTWARE PACKAGE')
    expect(screen.getByRole('heading', { name: 'Altered NodeScan' })).toBeInTheDocument()
    expect(document.body).toHaveTextContent('8.7 Nightly')
    expect(document.body).toHaveTextContent('RELEASE')
    expect(document.body).toHaveTextContent('canonical-package')
    expect(screen.getByRole('button', { name: 'DOWNLOAD' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /install|run/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'DOWNLOAD' }))
    expect(screen.getByRole('button', { name: 'DOWNLOAD STARTED' })).toBeDisabled()
    await act(async () => { vi.advanceTimersByTime(1_000) })
    expect(screen.getByRole('button', { name: 'DOWNLOADED ✓' })).toBeDisabled()
    expect(within(screen.getByLabelText('STATE-OS remote operating environment')).getByRole('status')).toHaveTextContent('LOCAL COPY/home/user/downloads/scanner.release')
    const current = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(current.player.localDevice.filesystem.files.at(-1)).toEqual({ ...packageFile, id: 'file-0003', path: '/home/user/downloads/scanner.release' })
    expect(current.player.localDevice.installedSoftware[0]).toMatchObject({ version: '1.0', channel: 'standard' })
    expect(current.process.processes).toEqual([])
    expect(current.fileTransfer.active).toBeNull()
    expect(screen.queryByRole('button', { name: /install|run/i })).not.toBeInTheDocument()
  })

  it('disconnects from the remote Terminal through canonical Session state', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={connectedState()}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await user.type(screen.getByLabelText('Remote command'), 'disconnect{enter}')
    expect(screen.queryByLabelText('STATE-OS remote operating environment')).not.toBeInTheDocument()
    expect((JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState).remoteSession.active).toBeNull()
  })

  it('downloads through the remote Terminal into canonical local Files', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<GameProvider initialState={connectedState()}><Shell /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await enterRemote(user)
    await user.type(screen.getByLabelText('Remote command'), 'download /srv/proof.txt{enter}')
    expect(document.body).toHaveTextContent('DOWNLOAD STARTED')
    expect(document.body).toHaveTextContent('/home/user/downloads/proof.txt')
    await act(async () => { vi.advanceTimersByTime(1_000) })
    await user.type(screen.getByLabelText('Remote command'), 'download /srv/proof.txt{enter}')
    expect(document.body).toHaveTextContent('DESTINATION ALREADY EXISTS')
    await user.type(screen.getByLabelText('Remote command'), 'disconnect{enter}')
    await user.click(screen.getByRole('button', { name: 'Open Files' }))
    await user.click(screen.getByRole('button', { name: /downloads/ }))
    await user.click(screen.getByRole('button', { name: /proof.txt/ }))
    expect(document.body).toHaveTextContent('Foreign canonical proof.')
  })

  it('uploads through the shared action with exact paths and reports syntax and admission results', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<GameProvider initialState={connectedState()}><Shell /><StateSnapshot /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime }); await enterRemote(user)
    const input = screen.getByLabelText('Remote command')
    await user.type(input, 'help{enter}'); expect(document.body).toHaveTextContent('upload')
    await user.type(input, 'upload /one{enter}'); expect(document.body).toHaveTextContent('USAGE: upload /absolute/local/file /absolute/remote/file')
    await user.type(input, 'upload /home/user/downloads/node-miner-1.0.pkg /home/user/custom.pkg{enter}')
    expect(document.body).toHaveTextContent('UPLOAD STARTED')
    const transfer = (JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState).fileTransfer.active!
    const source = createInitialGameState().player.localDevice.filesystem.files.find(({ path }) => path.endsWith('node-miner-1.0.pkg'))!
    expect(transfer).toMatchObject({ sourceDeviceId: 'device-local-v0', sourceFileId: source.id, destinationDeviceId: 'host-lan-001', destinationPath: '/home/user/custom.pkg' })
    await user.type(input, 'upload /home/user/downloads/node-miner-1.0.pkg /home/user/second.pkg{enter}')
    expect(document.body).toHaveTextContent('TRANSFER IN PROGRESS')
    await act(async () => { vi.advanceTimersByTime(4_000) })
    const completed = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    const remoteCopy = completed.world.network.hosts[0].filesystem!.files.find(({ path }) => path === '/home/user/custom.pkg')!
    expect(remoteCopy).toEqual({ ...source, id: remoteCopy.id, path: '/home/user/custom.pkg' })
    expect(remoteCopy.id).not.toBe(source.id)
    expect(completed.player.localDevice.filesystem.files).toContainEqual(source)
    expect(completed.player.localDevice.installedSoftware.some(({ id }) => id === 'node-miner')).toBe(false)
    expect(completed.process.processes).toEqual([])
  })

  it('derives graphical Download, successful, and reopened states from canonical local truth', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<GameProvider initialState={connectedState()}><Shell /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR srv' }))
    await user.click(screen.getByRole('button', { name: 'FILE proof.txt' }))
    expect(screen.getByRole('button', { name: 'DOWNLOAD' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'DOWNLOAD' }))
    expect(screen.getByRole('button', { name: 'DOWNLOAD STARTED' })).toBeDisabled()
    await act(async () => { vi.advanceTimersByTime(1_000) })
    expect(screen.getByRole('button', { name: 'DOWNLOADED ✓' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('LOCAL COPY/home/user/downloads/proof.txt')
    expect(screen.queryByRole('button', { name: 'DOWNLOAD' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← /srv' }))
    await user.click(screen.getByRole('button', { name: 'FILE proof.txt' }))
    expect(screen.getByRole('button', { name: 'DOWNLOADED ✓' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('/home/user/downloads/proof.txt')
    await user.click(screen.getByRole('button', { name: 'DISCONNECT' }))
    await user.click(screen.getByRole('button', { name: 'Open Files' }))
    await user.click(screen.getByRole('button', { name: /downloads/ }))
    expect(screen.getByRole('button', { name: /proof.txt/ })).toBeInTheDocument()
  })

  it('shows a truthful collision and no action for a different artifact at the destination', async () => {
    const initial = connectedState()
    const state = { ...initial, player: { ...initial.player, localDevice: { ...initial.player.localDevice, filesystem: { nextFileId: 50, files: [...initial.player.localDevice.filesystem.files, { kind: 'text' as const, id: 'file-fixture-text', path: '/home/user/downloads/proof.txt', content: 'Different artifact.' }] } } } }
    const user = userEvent.setup(); render(<GameProvider initialState={state}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR srv' }))
    await user.click(screen.getByRole('button', { name: 'FILE proof.txt' }))
    expect(screen.getByRole('status')).toHaveTextContent('LOCAL DESTINATION OCCUPIED')
    expect(screen.getByRole('status')).toHaveTextContent('/home/user/downloads/proof.txt')
    expect(screen.queryByRole('button', { name: /DOWNLOAD/ })).not.toBeInTheDocument()
  })

  it('derives an existing package copy by full canonical metadata, not its filename', async () => {
    const initial = connectedState(); const host = initial.world.network.hosts[0]
    const packageFile = { kind: 'software_package' as const, id: 'file-fixture-package', path: '/opt/weird.txt', releaseId: 'release-1', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 1_000 }
    const state = { ...initial, player: { ...initial.player, localDevice: { ...initial.player.localDevice, filesystem: { nextFileId: 50, files: [...initial.player.localDevice.filesystem.files, { ...packageFile, id: 'file-local-package', path: '/home/user/downloads/weird.txt' }] } } }, world: { network: { ...initial.world.network, hosts: [{ ...host, filesystem: { nextFileId: 50, files: [packageFile] } }, ...initial.world.network.hosts.slice(1)] } } }
    const user = userEvent.setup(); render(<GameProvider initialState={state}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' })); await user.click(screen.getByRole('button', { name: 'DIR opt' })); await user.click(screen.getByRole('button', { name: 'FILE weird.txt' }))
    expect(screen.getByRole('button', { name: 'DOWNLOADED ✓' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('/home/user/downloads/weird.txt')
  })

  it.each([
    ['a different release', { releaseId: 'release-2' }],
    ['changed metadata for the same release', { version: '9.9' }],
  ])('presents a package collision for %s', async (_description, changed) => {
    const initial = connectedState(); const host = initial.world.network.hosts[0]
    const packageFile = { kind: 'software_package' as const, id: 'file-fixture-package', path: '/opt/weird.txt', releaseId: 'release-1', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 1_000 }
    const localFile = { ...packageFile, ...changed, id: 'file-local-package', path: '/home/user/downloads/weird.txt' }
    const state = { ...initial, player: { ...initial.player, localDevice: { ...initial.player.localDevice, filesystem: { nextFileId: 50, files: [...initial.player.localDevice.filesystem.files, localFile] } } }, world: { network: { ...initial.world.network, hosts: [{ ...host, filesystem: { nextFileId: 50, files: [packageFile] } }, ...initial.world.network.hosts.slice(1)] } } }
    const user = userEvent.setup(); render(<GameProvider initialState={state}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' })); await user.click(screen.getByRole('button', { name: 'DIR opt' })); await user.click(screen.getByRole('button', { name: 'FILE weird.txt' }))
    expect(screen.getByRole('status')).toHaveTextContent('LOCAL DESTINATION OCCUPIED')
    expect(screen.queryByRole('button', { name: /DOWNLOAD/ })).not.toBeInTheDocument()
    expect(screen.queryByText('DOWNLOADED ✓')).not.toBeInTheDocument()
  })

  it('preserves the same NodeScan target across CONNECT and DISCONNECT', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={discoveredAccessState()}><Shell /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'Open NodeScan' }))
    await user.click(screen.getByRole('button', { name: 'Open target 198.51.100.47' }))
    expect(screen.getByRole('button', { name: 'Copy 198.51.100.47' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /CONNECT/ }))
    await enterRemote(user)
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'DISCONNECT' }))
    expect(screen.getByLabelText('Target status')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy 198.51.100.47' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'HOME' })).not.toBeInTheDocument()
    // Still on the same target, not returned to the target list.
    expect(screen.queryByRole('button', { name: 'Open target 198.51.100.47' })).not.toBeInTheDocument()
  })

  it('enters, presents, and downloads from the second interactive target (host-lan-002) through its own stable identity', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const base = createInitialGameState()
    const access = { id: 'access-b', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-ssh-002', privilege: 'USER' as const }
    const authorized = { ...base, deviceAccess: { nextId: 2, established: [access] } }
    const connected = connectRemoteFromObservation(authorized, { targetDeviceId: access.targetDeviceId, address: '203.0.113.42' }).state
    render(<GameProvider initialState={connected}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('RACK-OS 1.0')
    expect(rackOs).toHaveTextContent('srv-02 · 203.0.113.42')
    const input = screen.getByLabelText('Remote command')
    await user.type(input, 'ip{enter}'); expect(rackOs).toHaveTextContent('203.0.113.42')
    await user.type(input, 'ls /srv{enter}'); expect(rackOs).toHaveTextContent('backup-manifest.txt')
    await user.type(input, 'cat /srv/backup-manifest.txt{enter}')
    expect(rackOs).toHaveTextContent('Backup manifest for srv-02.')
    expect(rackOs).not.toHaveTextContent('Service workspace.')

    await user.type(input, 'download /srv/backup-manifest.txt{enter}')
    expect(rackOs).toHaveTextContent('DOWNLOAD STARTED')
    expect(rackOs).toHaveTextContent('/home/user/downloads/backup-manifest.txt')
    await act(async () => { vi.advanceTimersByTime(1_000) })
    const current = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(current.player.localDevice.filesystem.files.at(-1)).toMatchObject({ path: '/home/user/downloads/backup-manifest.txt', content: 'Backup manifest for srv-02.' })
    expect(current.fileTransfer.active).toBeNull()
  })

  it('presents the current target Device authentication history in SYSTEM without exposing internal Device or Service IDs', async () => {
    const user = userEvent.setup()
    const initial = connectedState()
    const host = initial.world.network.hosts[0]
    const withHistory = {
      ...initial,
      world: {
        network: {
          ...initial.world.network,
          hosts: [
            { ...host, authenticationHistory: { nextId: 3, records: [
              { id: 'auth-0001', serviceId: 'service-http-001', serviceName: 'HTTP', sourceAddress: '198.51.100.23', result: 'SUCCESS' as const },
              { id: 'auth-0002', serviceId: 'service-http-001', serviceName: 'HTTP', sourceAddress: '203.0.113.7', result: 'FAILURE' as const },
            ] } },
            ...initial.world.network.hosts.slice(1),
          ],
        },
      },
    }
    render(<GameProvider initialState={withHistory}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'SYSTEM' }))

    expect(document.body).toHaveTextContent('AUTHENTICATION HISTORY')
    expect(document.body).toHaveTextContent('SOURCE 198.51.100.23')
    expect(document.body).toHaveTextContent('SUCCESS')
    expect(document.body).toHaveTextContent('SOURCE 203.0.113.7')
    expect(document.body).toHaveTextContent('FAILURE')
    expect(document.body).not.toHaveTextContent(host.id)
    expect(document.body).not.toHaveTextContent('service-http-001')
  })

  it('presents a deliberate compact empty state when the target Device has no authentication history', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={connectedState()}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'SYSTEM' }))
    expect(document.body).toHaveTextContent('AUTHENTICATION HISTORY')
    expect(document.body).toHaveTextContent('NO AUTHENTICATION HISTORY')
  })

  it('offers UPLOAD from the remote directory itself and derives the destination from that directory and the chosen local file', async () => {
    const user = userEvent.setup()
    const initial = connectedStateWithRemoteHome()
    render(<GameProvider initialState={initial}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' }))

    // A: the directory view itself carries UPLOAD; no remote file is opened.
    expect(screen.getByRole('button', { name: 'UPLOAD' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '← /' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'DIR home' }))
    await user.click(screen.getByRole('button', { name: 'DIR user' }))
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))

    // B: the workflow opens inside RACK-OS; NODE-OS is never presented.
    const workflow = screen.getByLabelText('Upload to remote')
    expect(workflow).toHaveTextContent('/home/user')
    expect(screen.getByLabelText('STATE-OS remote operating environment')).not.toHaveAttribute('hidden')
    expect(document.querySelector('.node-workspace')).toHaveAttribute('hidden')

    // C + D + E: the picker reads the canonical LOCAL filesystem, navigates
    // local directories, and selects one concrete local file.
    const localFiles = initial.player.localDevice.filesystem.files
    expect(within(workflow).getByRole('button', { name: 'Select local file welcome.txt' })).toBeInTheDocument()
    expect(workflow).not.toHaveTextContent('proof.txt')
    await user.click(within(workflow).getByRole('button', { name: 'Open local directory downloads' }))
    expect(screen.getByLabelText('Upload to remote')).toHaveTextContent('/home/user/downloads')
    await user.click(screen.getByRole('button', { name: 'Select local file node-miner-1.0.pkg' }))

    // F: remote directory + local basename, visible and editable.
    const review = screen.getByLabelText('Upload to remote')
    // The editing surface owns its own scrolling, and remains the only owner,
    // so CANCEL/UPLOAD stay reachable under the software keyboard.
    expect(review).toHaveAttribute('data-editing-scroll-owner')
    expect(document.querySelectorAll('.rack-os [data-editing-scroll-owner]')).toHaveLength(1)
    expect(screen.getByLabelText('Remote destination path')).toHaveValue('/home/user/node-miner-1.0.pkg')
    expect(review).toHaveTextContent('/home/user/downloads/node-miner-1.0.pkg')
    expect(review).toHaveTextContent('3.4 MB')
    expect(review).toHaveTextContent('192.0.2.99')
    const source = localFiles.find(({ path }) => path === '/home/user/downloads/node-miner-1.0.pkg')!

    // G + H: exactly the edited destination is submitted, against the local
    // source, never the other way round.
    const destination = screen.getByLabelText('Remote destination path')
    await user.clear(destination)
    await user.type(destination, '/srv/custom-miner.pkg')
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))

    const current = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(current.fileTransfer.active).toMatchObject({
      sourceDeviceId: initial.player.localDevice.id, sourceFileId: source.id,
      destinationDeviceId: initial.world.network.hosts[0].id, destinationPath: '/srv/custom-miner.pkg',
    })
    // J + K: canonical FileTransfer only; no installation, no Process, and no
    // remote artifact before completion.
    expect(current.player.localDevice.installedSoftware).toEqual(initial.player.localDevice.installedSoftware)
    expect(current.process.processes).toEqual([])
    expect(current.world.network.hosts[0].filesystem!.files.some(({ path }) => path === '/srv/custom-miner.pkg')).toBe(false)
    expect(current.player.localDevice.filesystem.files).toContainEqual(source)

    // The player lands back in the remote directory they started from.
    expect(screen.getByRole('button', { name: 'FILE notes.txt' })).toBeInTheDocument()
    expect(within(screen.getByLabelText('STATE-OS remote operating environment')).getByRole('status')).toHaveTextContent('UPLOAD STARTED')
  })

  it('reports canonical Upload admission failures without touching the remote filesystem', async () => {
    const user = userEvent.setup()
    /* The represented local upload capacity is deliberately one byte per second,
       exactly as the single-transfer test below does it. `welcome.txt` is 33
       bytes, so at node-01's normal capacity the admitted transfer legitimately
       *completes* inside the first advancement tick that lands between the
       click and the assertion — which reads as a missing transfer rather than
       as the finished one it is. Slowing the represented route keeps the
       admitted transfer observably running instead of weakening the
       assertion. */
    const base = connectedStateWithRemoteHome()
    const initial: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, network: { ...base.player.localDevice.network, transferCapacity: { ...base.player.localDevice.network.transferCapacity, uploadBytesPerSecond: 1 } } } } }
    const remoteBefore = initial.world.network.hosts[0].filesystem
    render(<GameProvider initialState={initial}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))
    await user.click(screen.getByRole('button', { name: 'Select local file welcome.txt' }))

    const destination = screen.getByLabelText('Remote destination path')
    expect(destination).toHaveValue('/welcome.txt')
    await user.clear(destination)
    await user.type(destination, '/srv/proof.txt')
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))

    expect(within(screen.getByLabelText('STATE-OS remote operating environment')).getByRole('status')).toHaveTextContent('DESTINATION ALREADY EXISTS')
    let current = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(current.fileTransfer.active).toBeNull()
    expect(current.world.network.hosts[0].filesystem).toEqual(remoteBefore)

    // A second, valid destination goes through the same shared action.
    await user.clear(screen.getByLabelText('Remote destination path'))
    await user.type(screen.getByLabelText('Remote destination path'), '/srv/copied-welcome.txt')
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))
    current = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(current.fileTransfer.active).toMatchObject({ destinationPath: '/srv/copied-welcome.txt', sourceFileId: 'file-0001' })
    // Still an admission only: the destination artifact appears at completion, not now.
    expect(current.world.network.hosts[0].filesystem).toEqual(remoteBefore)
  })

  it('presents the canonical single-transfer rejection rather than queueing an Upload', async () => {
    const user = userEvent.setup()
    const initial = connectedStateWithRemoteHome()
    const slow: GameState = { ...initial, player: { ...initial.player, localDevice: { ...initial.player.localDevice, network: { ...initial.player.localDevice.network, transferCapacity: { ...initial.player.localDevice.network.transferCapacity, uploadBytesPerSecond: 1 } } } } }
    render(<GameProvider initialState={slow}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await user.type(screen.getByLabelText('Remote command'), 'upload /home/user/welcome.txt /srv/first.txt{enter}')
    expect(document.body).toHaveTextContent('UPLOAD STARTED')

    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))
    await user.click(screen.getByRole('button', { name: 'Select local file welcome.txt' }))
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))

    expect(within(screen.getByLabelText('STATE-OS remote operating environment')).getByRole('status')).toHaveTextContent('TRANSFER IN PROGRESS')
    const current = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(current.fileTransfer.active).toMatchObject({ destinationPath: '/srv/first.txt' })
  })

  it('reaches canonical FileTransfer from an established DeviceAccess through the remote-first workflow alone', async () => {
    const user = userEvent.setup()
    const initial = discoveredAccessState()
    render(<GameProvider initialState={initial}><Shell /><StateSnapshot /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'Open NodeScan' }))
    await user.click(screen.getByRole('button', { name: 'Open target 198.51.100.47' }))
    await user.click(screen.getByRole('button', { name: /CONNECT/ }))
    await enterRemote(user)

    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR srv' }))
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))
    await user.click(screen.getByRole('button', { name: 'Open local directory downloads' }))
    await user.click(screen.getByRole('button', { name: 'Select local file node-miner-1.0.pkg' }))
    expect(screen.getByLabelText('Remote destination path')).toHaveValue('/srv/node-miner-1.0.pkg')
    await user.click(screen.getByRole('button', { name: 'UPLOAD' }))

    const current = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    const source = initial.player.localDevice.filesystem.files.find(({ path }) => path === '/home/user/downloads/node-miner-1.0.pkg')!
    expect(current.fileTransfer.active).toMatchObject({
      sourceDeviceId: initial.player.localDevice.id, sourceFileId: source.id,
      destinationDeviceId: 'host-lan-001', destinationPath: '/srv/node-miner-1.0.pkg',
    })
    expect(current.process.processes).toEqual([])
    expect(current.player.localDevice.installedSoftware).toEqual(initial.player.localDevice.installedSoftware)
  })

  it('keeps the Upload workflow usable under the software keyboard on mobile', () => {
    // The destination field must not trigger Safari zoom, and the panel that
    // owns it must own its own scrolling so CANCEL/UPLOAD stay reachable while
    // that field is focused.
    expect(rackCss).toMatch(/@media \(max-width: 700px\), \(max-width: 900px\) and \(pointer: coarse\)[\s\S]*?\.rack-input\s*{\s*font-size:\s*16px;\s*}/)
    expect(rackCss).toMatch(/\.rack-panel\s*{[^}]*overflow:\s*auto;[^}]*overscroll-behavior-y:\s*contain;[^}]*touch-action:\s*pan-y pinch-zoom;/)
    expect(rackCss).toMatch(/\.rack-input\s*{[^}]*min-width:\s*0;[^}]*width:\s*100%;[^}]*min-height:\s*44px;/)
    expect(rackCss).toMatch(/\.rack-upload-entry\s*{[^}]*min-height:\s*44px;/)
    expect(rackCss).toMatch(/\.rack-secondary\s*{[^}]*min-height:\s*44px;/)
    // Long paths wrap inside the panel rather than widening the viewport.
    expect(rackCss).toMatch(/\.rack-file-meta\s*{[^}]*overflow-wrap:\s*anywhere;/)
  })

  it('keeps the existing NODE-OS Terminal bound to local address and filesystem during an active Session', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={connectedState()}><Terminal /></GameProvider>)
    const input = screen.getByLabelText('Command input')
    await user.type(input, 'ip{enter}cat /home/user/welcome.txt{enter}')
    expect(screen.getByText('198.51.100.23')).toBeInTheDocument()
    expect(screen.getByText('Welcome to your local filesystem.')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('Foreign canonical proof.')
  })
})

/**
 * Remote installation on the Device the player is currently operating. Every
 * state below is read out of canonical truth: srv-01's own installed-software
 * inventory and the installation Processes its own executor identity runs.
 */
describe('RACK-OS remote software installation', () => {
  function operatingState(alter?: (host: NetworkHost) => NetworkHost): GameState {
    const base = createInitialGameState(); const original = base.world.network.hosts[0]; const host = alter ? alter(original) : original
    return { ...base, deviceAccess: { nextId: 2, established: [{ id: 'access-ui-install', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: 'service-ssh-001', privilege: 'USER' }] }, remoteSession: { nextId: 2, active: { id: 'session-0001', accessId: 'access-ui-install', connectedAddress: host.ip } }, world: { ...base.world, network: { ...base.world.network, hosts: [host, ...base.world.network.hosts.slice(1)] } } }
  }
  async function openPackage(user: ReturnType<typeof userEvent.setup>, filename: string) {
    await enterRemote(user); await user.click(screen.getByRole('button', { name: 'FILES' })); await user.click(screen.getByRole('button', { name: 'DIR opt' })); await user.click(screen.getByRole('button', { name: 'DIR packages' })); await user.click(screen.getByRole('button', { name: `FILE ${filename}` }))
  }

  it('shows fresh GateSSH 1.3.2 as installed with its real current release and no INSTALL action', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={operatingState()}><Shell /></GameProvider>); await openPackage(user, 'gatessh-1.3.2.pkg')
    const rack = screen.getByLabelText('RACK-OS remote operating environment'); expect(rack).toHaveTextContent('STATUSINSTALLED'); expect(rack).toHaveTextContent('CURRENTGateSSH 1.3.2 Stable'); expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
  })

  it('shows another GateSSH release as installable with current 1.3.2', async () => {
    const newer = { kind: 'software_package' as const, id: 'gate-ui-new', path: '/opt/packages/gatessh-1.3.3.pkg', productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.3', name: 'GateSSH', version: '1.3.3', sizeBytes: 6_400_000 }
    const state = operatingState((host) => ({ ...host, filesystem: { ...host.filesystem!, files: [...host.filesystem!.files, newer] } })); const user = userEvent.setup(); render(<GameProvider initialState={state}><Shell /></GameProvider>); await openPackage(user, 'gatessh-1.3.3.pkg')
    const rack = screen.getByLabelText('RACK-OS remote operating environment'); expect(rack).toHaveTextContent('STATUSINSTALLABLE'); expect(rack).toHaveTextContent('CURRENTGateSSH 1.3.2 Stable'); expect(screen.getByRole('button', { name: 'INSTALL' })).toBeEnabled()
  })

  it('shows NodeScan as NODE-OS-only and exposes no INSTALL action', async () => {
    const state = operatingState(); const user = userEvent.setup(); render(<GameProvider initialState={state}><Shell /><StateSnapshot /></GameProvider>); await openPackage(user, 'nodescan-exp-1.1.pkg')
    const rack = screen.getByLabelText('RACK-OS remote operating environment'); expect(rack).toHaveTextContent('STATUSNOT COMPATIBLE'); expect(rack).toHaveTextContent('REQUIRESNODE-OS'); expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument(); expect(installRemoteSoftwarePackage(state, '/opt/packages/nodescan-exp-1.1.pkg')).toMatchObject({ status: 'incompatible_firmware' })
  })

  it('keeps NODE Miner installable on RACK-OS', async () => {
    const miner = { kind: 'software_package' as const, id: 'miner-ui', path: '/opt/packages/node-miner-1.0.pkg', productId: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', sizeBytes: 3_400_000 }
    const state = operatingState((host) => ({ ...host, filesystem: { ...host.filesystem!, files: [...host.filesystem!.files, miner] } })); const user = userEvent.setup(); render(<GameProvider initialState={state}><Shell /></GameProvider>); await openPackage(user, 'node-miner-1.0.pkg'); expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('STATUSINSTALLABLE'); expect(screen.getByRole('button', { name: 'INSTALL' })).toBeEnabled()
  })
})

describe('RACK-OS remote NODE Miner execution', () => {
  const REMOTE_EXECUTABLE = '/usr/local/bin/node-miner'

  function minerExecutable(path = REMOTE_EXECUTABLE): ExecutableFile {
    return { kind: 'executable', id: 'file-remote-miner', path, programId: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
  }

  function runningMiner(executorDeviceId: string, overrides: Partial<NodeMinerProcess> = {}): NodeMinerProcess {
    return {
      kind: 'node_miner', id: 'process-0007', label: 'NODE MINER', executorDeviceId, status: 'running', ramRequiredMiB: 512,
      programId: 'node-miner', releaseId: 'node-miner-1.0', payoutAddress: 'node-addr-canonical-remote', payoutSegment: 1,
      producedNodeUnits: 2_500_000, payoutNodeUnits: 1_340, developerFeeNodeUnits: 660,
      segmentPayoutNodeUnits: 1_340, segmentDeveloperFeeNodeUnits: 660, workRemainder: 0, ...overrides,
    }
  }

  /** An authorized Session over one represented host that already owns a supported NODE Miner executable. */
  function operatingState(hostIndex = 0, processes: readonly GameProcess[] = []): GameState {
    const base = createInitialGameState()
    const hosts = base.world.network.hosts
    const host = {
      ...hosts[hostIndex],
      filesystem: { nextFileId: 90, files: [...hosts[hostIndex].filesystem!.files, minerExecutable()] },
      installedSoftware: [{ id: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev' }],
    }
    const authorized: GameState = {
      ...base,
      process: { nextId: 20, processes },
      deviceAccess: { nextId: 2, established: [{ id: 'access-remote-run', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: `service-ssh-00${hostIndex + 1}`, privilege: 'USER' }] },
      world: { ...base.world, network: { ...base.world.network, hosts: hosts.map((candidate, index) => index === hostIndex ? host : candidate) } },
    }
    return connectRemoteFromObservation(authorized, { targetDeviceId: host.id, address: host.ip }).state
  }

  async function openRemoteExecutable(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR usr' }))
    await user.click(screen.getByRole('button', { name: 'DIR local' }))
    await user.click(screen.getByRole('button', { name: 'DIR bin' }))
    await user.click(screen.getByRole('button', { name: 'FILE node-miner' }))
  }

  function snapshot(): GameState { return JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState }

  it('admits the Miner onto the Device actually being operated, with the exact payout address entered', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState()}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await openRemoteExecutable(user)

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('EXECUTABLE')
    expect(rackOs).toHaveTextContent('node-miner-1.0')
    // Execution on this Device comes first; the artifact's relationship to node-01 stays secondary.
    const order = rackOs.textContent ?? ''
    expect(order.indexOf('RUN')).toBeLessThan(order.indexOf('TRANSFER'))
    expect(order.indexOf('TRANSFER')).toBeLessThan(order.indexOf('DOWNLOAD'))
    await user.click(screen.getByRole('button', { name: 'RUN' }))
    // The confirmation names the Device that will own the runtime and the exact artifact.
    expect(rackOs).toHaveTextContent('RUN ON THIS DEVICE')
    expect(rackOs).toHaveTextContent('EXECUTORsrv-01')
    expect(rackOs).toHaveTextContent(`PROGRAM${REMOTE_EXECUTABLE}`)

    const address = screen.getByLabelText('NODE payout address')
    await user.clear(address)
    await user.type(address, 'node-addr-operator-01')
    await user.click(screen.getByRole('button', { name: 'RUN' }))

    const admitted = snapshot()
    expect(admitted.process.processes).toEqual([expect.objectContaining({
      kind: 'node_miner', status: 'running', executorDeviceId: 'host-lan-001',
      programId: 'node-miner', releaseId: 'node-miner-1.0', payoutAddress: 'node-addr-operator-01',
    })])
    expect(rackOs).toHaveTextContent('RUNNING ON srv-01')
    expect(rackOs).toHaveTextContent('PROCESSprocess-0020')
    expect(rackOs).toHaveTextContent('PAYOUTnode-addr-operator-01')
    // Live payout retargeting is deliberately not a graphical convenience.
    expect(screen.queryByLabelText('NODE payout address')).not.toBeInTheDocument()
  })

  it('derives RUNNING, its Process and its payout address from canonical state alone', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState(0, [runningMiner('host-lan-001', { id: 'process-0042', payoutAddress: 'node-addr-altered-truth', producedNodeUnits: 3_450_000 })])}><Shell /></GameProvider>)
    await enterRemote(user)
    await openRemoteExecutable(user)

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('RUNNING ON srv-01')
    expect(rackOs).toHaveTextContent('PROCESSprocess-0042')
    expect(rackOs).toHaveTextContent('PAYOUTnode-addr-altered-truth')
    // Gross production keeps accumulating from srv-01's own runtime while this renders, so the assertion pins the altered canonical value it started from.
    expect(rackOs).toHaveTextContent('PRODUCED3.45')
    expect(screen.queryByRole('button', { name: 'RUN' })).not.toBeInTheDocument()
  })

  it('never presents the local Device Miner as this Device running one', async () => {
    const user = userEvent.setup()
    // node-01 is mining; srv-01 is not. The pane belongs to srv-01.
    render(<GameProvider initialState={operatingState(0, [runningMiner('device-local-v0', { id: 'process-0031' })])}><Shell /></GameProvider>)
    await enterRemote(user)
    await openRemoteExecutable(user)

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).not.toHaveTextContent('RUNNING ON')
    expect(rackOs).not.toHaveTextContent('process-0031')
    expect(screen.getByRole('button', { name: 'RUN' })).toBeEnabled()
  })

  it('operates the second represented server through its own stable identity', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState(1)}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await openRemoteExecutable(user)
    await user.click(screen.getByRole('button', { name: 'RUN' }))
    await user.click(screen.getByRole('button', { name: 'RUN' }))

    expect(snapshot().process.processes).toEqual([expect.objectContaining({ kind: 'node_miner', executorDeviceId: 'host-lan-002' })])
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('RUNNING ON srv-02')
  })

  it('offers no execution for an executable that is not the supported program', async () => {
    const user = userEvent.setup()
    const base = operatingState()
    const host = base.world.network.hosts[0]
    const unsupported = { ...minerExecutable('/usr/local/bin/other'), id: 'file-other', programId: 'other-program', releaseId: 'other-1.0', name: 'Other' }
    const state: GameState = { ...base, world: { ...base.world, network: { ...base.world.network, hosts: [{ ...host, filesystem: { nextFileId: 91, files: [...host.filesystem!.files, unsupported] } }, ...base.world.network.hosts.slice(1)] } } }
    render(<GameProvider initialState={state}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR usr' }))
    await user.click(screen.getByRole('button', { name: 'DIR local' }))
    await user.click(screen.getByRole('button', { name: 'DIR bin' }))
    await user.click(screen.getByRole('button', { name: 'FILE other' }))

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('UNSUPPORTED')
    expect(screen.queryByRole('button', { name: 'RUN' })).not.toBeInTheDocument()
  })

  it('stops only the operated Device Miner, leaving the local one running', async () => {
    const user = userEvent.setup()
    const processes = [runningMiner('host-lan-001', { id: 'process-0050' }), runningMiner('device-local-v0', { id: 'process-0051' })]
    render(<GameProvider initialState={operatingState(0, processes)}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await openRemoteExecutable(user)
    await user.click(screen.getByRole('button', { name: 'STOP' }))

    const stopped = snapshot()
    expect(stopped.process.processes).toEqual([expect.objectContaining({ id: 'process-0051', executorDeviceId: 'device-local-v0' })])
    expect(stopped.recentActivity.entries).toEqual([])
    expect(screen.getByRole('button', { name: 'RUN' })).toBeEnabled()
  })

  it('retargets payout live from the Terminal through the canonical operation, with no lifecycle change', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState(0, [runningMiner('host-lan-001', { id: 'process-0060' })])}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    const before = snapshot()

    await user.type(screen.getByLabelText('Remote command'), 'node-miner config payout node-addr-relay-77{enter}')
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('PAYOUT CONFIGURED')
    expect(rackOs).toHaveTextContent('process-0060')

    const after = snapshot()
    const miner = after.process.processes[0] as NodeMinerProcess
    expect(after.process.processes).toHaveLength(1)
    expect(after.process.nextId).toBe(before.process.nextId)
    expect(miner.id).toBe('process-0060')
    expect(miner.payoutAddress).toBe('node-addr-relay-77')
    // Real elapsed runtime may advance while the command is typed; retargeting
    // preserves rather than resets every accumulated economic counter.
    expect(miner.producedNodeUnits).toBeGreaterThanOrEqual((before.process.processes[0] as NodeMinerProcess).producedNodeUnits)
    expect(miner.payoutNodeUnits).toBeGreaterThanOrEqual((before.process.processes[0] as NodeMinerProcess).payoutNodeUnits)
    expect(miner.developerFeeNodeUnits).toBeGreaterThanOrEqual((before.process.processes[0] as NodeMinerProcess).developerFeeNodeUnits)
    expect(after.recentActivity.entries).toEqual([])
    expect(after.nodeWallet).toEqual(before.nodeWallet)

    // The executable surface observes the same running Process and now states its current address.
    await openRemoteExecutable(user)
    expect(rackOs).toHaveTextContent('PAYOUTnode-addr-relay-77')
    expect(rackOs).toHaveTextContent('PROCESSprocess-0060')
  })

  it('reports canonical retarget failures compactly without inventing a Miner', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState()}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    const input = screen.getByLabelText('Remote command')
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')

    await user.type(input, 'node-miner config payout node-addr-relay-77{enter}')
    expect(rackOs).toHaveTextContent('NOT RUNNING')
    await user.type(input, 'node-miner config payout{enter}')
    expect(rackOs).toHaveTextContent('Usage: node-miner config payout <address>')
    await user.type(input, 'node-miner status{enter}')
    expect(rackOs).toHaveTextContent('STATUS IDLE')
    expect(snapshot().process.processes).toEqual([])
  })

  it('derives the registered CLI from the operated Device installation and executable only', async () => {
    const user = userEvent.setup()
    const installed = operatingState()
    const remote = installed.world.network.hosts[0]
    const withoutRemoteInstallation: GameState = {
      ...installed,
      player: { ...installed.player, localDevice: { ...installed.player.localDevice, installedSoftware: [{ id: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0' }] } },
      world: { ...installed.world, network: { ...installed.world.network, hosts: [{ ...remote, installedSoftware: [] }, ...installed.world.network.hosts.slice(1)] } },
    }
    render(<GameProvider initialState={withoutRemoteInstallation}><Shell /></GameProvider>)
    await enterRemote(user)
    const input = screen.getByLabelText('Remote command')
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')

    await user.type(input, 'help{enter}')
    expect(rackOs).not.toHaveTextContent('node-miner')
    await user.type(input, 'miner payout node-addr-relay-77{enter}')
    await user.type(input, 'node-miner config payout node-addr-relay-77{enter}')
    expect(rackOs).toHaveTextContent('COMMAND NOT FOUND')

    // The copied supported artifact remains directly runnable through Files;
    // lacking InstalledSoftware removes only its registered Terminal CLI.
    await openRemoteExecutable(user)
    expect(screen.getByRole('button', { name: 'RUN' })).toBeEnabled()
  })

  it('advertises coherent node-miner help only with both remote software and artifact', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState()}><Shell /></GameProvider>)
    await enterRemote(user)
    const input = screen.getByLabelText('Remote command')
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')

    await user.type(input, 'help{enter}')
    expect(rackOs).toHaveTextContent('help clear ip ls cat download upload disconnect')
    expect(rackOs).toHaveTextContent('NODE MINER 1.0')
    expect(rackOs).toHaveTextContent('node-miner — Control NODE Miner on this Device')
    expect(rackOs).not.toHaveTextContent(' upload miner ')
    await user.type(input, 'node-miner{enter}')
    await user.type(input, 'node-miner help{enter}')
    expect(rackOs).toHaveTextContent('node-miner run --payout <address>')
    expect(rackOs).toHaveTextContent('node-miner status')
    expect(rackOs).toHaveTextContent('node-miner stop')
    expect(rackOs).toHaveTextContent('node-miner config payout <address>')
  })

  it('derives the Firmware Help heading from the operated target', async () => {
    const state = operatingState()
    const target = state.world.network.hosts[0]
    const altered: GameState = { ...state, world: { ...state.world, network: { ...state.world.network, hosts: [{ ...target, firmware: { id: RACK_OS_FIRMWARE_ID, name: 'VAULT-OS', version: '9.2' } }, ...state.world.network.hosts.slice(1)] } } }
    const user = userEvent.setup()
    render(<GameProvider initialState={altered}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.type(screen.getByLabelText('Remote command'), 'help{enter}')
    expect(screen.getByLabelText('VAULT-OS remote operating environment')).toHaveTextContent('VAULT-OS 9.2')
  })

  it('runs, reports, retargets, and stops the operated Device through the shared CLI', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState()}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    const input = screen.getByLabelText('Remote command')
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')

    await user.type(input, 'node-miner run --payout node-addr-remote-cli{enter}')
    expect(rackOs).toHaveTextContent('NODE MINER STARTED')
    const started = snapshot().process.processes.find((process) => process.kind === 'node_miner') as NodeMinerProcess
    expect(started.executorDeviceId).toBe('host-lan-001')

    await user.type(input, 'node-miner status{enter}')
    expect(rackOs).toHaveTextContent(`PROCESS ${started.id}`)
    expect(rackOs).toHaveTextContent('RAM 512 MiB')
    expect(rackOs).toHaveTextContent('ADDRESS node-addr-remote-cli')

    await user.type(input, 'node-miner config payout node-addr-retargeted{enter}')
    expect((snapshot().process.processes.find(({ id }) => id === started.id) as NodeMinerProcess).payoutAddress).toBe('node-addr-retargeted')
    await user.type(input, 'node-miner stop{enter}')
    expect(snapshot().process.processes).toHaveLength(0)
    expect(snapshot().recentActivity.entries).toHaveLength(0)
  })

  it('does not conjure the CLI from installed metadata after the remote executable is absent', async () => {
    const user = userEvent.setup()
    const installed = operatingState()
    const remote = installed.world.network.hosts[0]
    const withoutExecutable: GameState = {
      ...installed,
      world: { ...installed.world, network: { ...installed.world.network, hosts: [{
        ...remote,
        filesystem: { ...remote.filesystem!, files: remote.filesystem!.files.filter((file) => file.kind !== 'executable') },
      }, ...installed.world.network.hosts.slice(1)] } },
    }
    render(<GameProvider initialState={withoutExecutable}><Shell /></GameProvider>)
    await enterRemote(user)
    const input = screen.getByLabelText('Remote command')
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')

    await user.type(input, 'help{enter}')
    expect(rackOs).not.toHaveTextContent('node-miner')
    await user.type(input, 'node-miner config payout node-addr-relay-77{enter}')
    expect(rackOs).toHaveTextContent('COMMAND NOT FOUND')
  })
})
