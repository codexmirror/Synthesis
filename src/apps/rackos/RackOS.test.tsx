import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { connectRemoteFromObservation } from '../../core/game/remoteSession'
import { installRemoteSoftwarePackage } from '../../core/game/softwareInstallation'
import { createInitialGameState } from '../../core/game/initialState'
import { Shell } from '../../shell/Shell'
import type { GameState, NetworkHost } from '../../core/game/types'
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
  const altered = { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, displayName: 'live-server', ip: '192.0.2.99', firmware: { id: 'firmware-test', name: 'STATE-OS', version: '7.4' }, filesystem: { nextFileId: 50, files: [{ kind: 'text' as const, id: 'file-fixture-text', path: '/srv/proof.txt', content: 'Foreign canonical proof.' }] } }, ...base.world.network.hosts.slice(1)] } }, deviceAccess: { nextId: 2, established: [{ id: 'access-test', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: 'service-http-001', privilege: 'USER' as const }] } }
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

  it('preserves the same Scan Device detail across CONNECT and DISCONNECT', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={discoveredAccessState()}><Shell /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'Open NodeScan' }))
    await user.click(screen.getByRole('button', { name: 'Open known area home-net' }))
    await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
    expect(screen.getByRole('button', { name: 'Copy 198.51.100.47' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /CONNECT/ }))
    await enterRemote(user)
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'DISCONNECT' }))
    expect(screen.getByRole('button', { name: 'Copy 198.51.100.47' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open SSH service' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'HOME' })).not.toBeInTheDocument()
    expect(screen.queryByText('KNOWN SPACE')).not.toBeInTheDocument()
  })

  it('enters, presents, and downloads from the second interactive target (host-lan-002) through its own stable identity', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const base = createInitialGameState()
    const access = { id: 'access-b', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-ssh-002', privilege: 'USER' as const }
    const authorized = { ...base, deviceAccess: { nextId: 2, established: [access] } }
    const connected = connectRemoteFromObservation(authorized, { targetDeviceId: access.targetDeviceId, address: '198.51.100.53' }).state
    render(<GameProvider initialState={connected}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('RACK-OS 1.0')
    expect(rackOs).toHaveTextContent('srv-02 · 198.51.100.53')
    const input = screen.getByLabelText('Remote command')
    await user.type(input, 'ip{enter}'); expect(rackOs).toHaveTextContent('198.51.100.53')
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
    const initial = connectedStateWithRemoteHome()
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
    expect(current.fileTransfer.active).toMatchObject({ destinationPath: '/srv/copied-welcome.txt' })
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
    await user.click(screen.getByRole('button', { name: 'Open known area home-net' }))
    await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
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
  const REMOTE_PACKAGE = '/opt/packages/nodescan-exp-1.1.pkg'

  /** srv-01 exactly as the world represents it, with an authorized Session already open. */
  function operatingState(alterHost?: (host: NetworkHost) => NetworkHost): GameState {
    const base = createInitialGameState()
    const host = alterHost ? alterHost(base.world.network.hosts[0]) : base.world.network.hosts[0]
    const authorized: GameState = {
      ...base,
      deviceAccess: { nextId: 2, established: [{ id: 'access-remote-install', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
      world: { ...base.world, network: { ...base.world.network, hosts: [host, ...base.world.network.hosts.slice(1)] } },
    }
    return connectRemoteFromObservation(authorized, { targetDeviceId: host.id, address: host.ip }).state
  }

  async function openRemotePackage(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR opt' }))
    await user.click(screen.getByRole('button', { name: 'DIR packages' }))
    await user.click(screen.getByRole('button', { name: 'FILE nodescan-exp-1.1.pkg' }))
  }

  function snapshot(): GameState { return JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState }

  it('presents the concrete package and its state on this Device, with local transfer kept secondary', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState()}><Shell /></GameProvider>)
    await enterRemote(user)
    await openRemotePackage(user)

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('SOFTWARE PACKAGE')
    expect(screen.getByRole('heading', { name: 'NodeScan' })).toBeInTheDocument()
    expect(rackOs).toHaveTextContent('1.1 Experimental')
    // Truthful represented artifact size, from the same canonical filesystem semantics local Files uses.
    expect(rackOs).toHaveTextContent('18.4 MB')
    expect(rackOs).toHaveTextContent('nodescan-1.1-experimental')
    expect(rackOs).toHaveTextContent('INSTALLABLE')
    expect(rackOs).toHaveTextContent('NOT INSTALLED')
    // Download still works, but the artifact's relationship to node-01 now follows the Device's own software state.
    expect(rackOs).toHaveTextContent('TRANSFER')
    expect(screen.getByRole('button', { name: 'DOWNLOAD' })).toBeEnabled()
    const order = rackOs.textContent ?? ''
    expect(order.indexOf('INSTALLABLE')).toBeLessThan(order.indexOf('TRANSFER'))
  })

  it('states the publisher a package actually claims', async () => {
    const publisherPackage = { kind: 'software_package' as const, id: 'file-remote-publisher', path: '/opt/packages/node-miner-1.0.pkg', productId: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev', sizeBytes: 3_400_000 }
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState((host) => ({ ...host, filesystem: { nextFileId: 90, files: [...host.filesystem!.files, publisherPackage] } }))}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR opt' }))
    await user.click(screen.getByRole('button', { name: 'DIR packages' }))
    await user.click(screen.getByRole('button', { name: 'FILE node-miner-1.0.pkg' }))
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('PUBLISHERnm-dev')
  })

  it('derives installed state from the target Device, not from the local inventory', async () => {
    const user = userEvent.setup()
    // node-01 runs NodeScan 1.0 Standard; srv-01 runs the very release this package represents.
    render(<GameProvider initialState={operatingState((host) => ({ ...host, installedSoftware: [{ id: 'nodescan', releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental' }] }))}><Shell /></GameProvider>)
    await enterRemote(user)
    await openRemotePackage(user)
    expect(screen.getByRole('button', { name: 'INSTALLED ✓' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
  })

  it('states another installed release of the same product as CURRENT while the package stays installable', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState((host) => ({ ...host, installedSoftware: [{ id: 'nodescan', releaseId: 'nodescan-1.0-standard', name: 'NodeScan', version: '1.0', channel: 'standard' }] }))}><Shell /></GameProvider>)
    await enterRemote(user)
    await openRemotePackage(user)
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('CURRENTNodeScan 1.0 Standard')
    expect(rackOs).toHaveTextContent('INSTALLABLE')
    expect(screen.getByRole('button', { name: 'INSTALL' })).toBeEnabled()
  })

  it('does not claim INSTALLABLE on a target that represents no software inventory', async () => {
    const user = userEvent.setup()
    // Otherwise fully operable: `installedSoftware: undefined` means this Device
    // represents no installable software state, which is not the same truth as an
    // inventory that happens to be empty.
    render(<GameProvider initialState={operatingState((host) => ({ ...host, installedSoftware: undefined }))}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await openRemotePackage(user)

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('STATUSNOT INSTALLABLE')
    expect(rackOs).toHaveTextContent('TARGET CANNOT INSTALL SOFTWARE')
    // No installed release exists to state, so no CURRENT row is invented.
    expect(rackOs).not.toHaveTextContent('CURRENT')
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
    // The canonical operation agrees, so the surface never disagreed with admission.
    expect(installRemoteSoftwarePackage(snapshot(), REMOTE_PACKAGE)).toMatchObject({ status: 'target_not_installable' })
    // The artifact's own facts and its transfer relationship remain truthful.
    expect(rackOs).toHaveTextContent('18.4 MB')
    expect(screen.getByRole('button', { name: 'DOWNLOAD' })).toBeEnabled()
  })

  it('offers no installation from an unrecognized package path', async () => {
    const unrecognized = { kind: 'software_package' as const, id: 'file-remote-unrecognized', path: '/opt/packages/nodescan-exp-1.1.pkd', productId: 'nodescan', releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 18_400_000 }
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState((host) => ({ ...host, filesystem: { nextFileId: 90, files: [...host.filesystem!.files, unrecognized] } }))}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR opt' }))
    await user.click(screen.getByRole('button', { name: 'DIR packages' }))
    await user.click(screen.getByRole('button', { name: 'FILE nodescan-exp-1.1.pkd' }))
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('UNRECOGNIZED')
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
  })

  it('opens and cancels the inline confirmation without touching GameState', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState()}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await openRemotePackage(user)
    const before = snapshot()

    await user.click(screen.getByRole('button', { name: 'INSTALL' }))
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    // The confirmation names the Device being operated and the exact remote package path.
    expect(rackOs).toHaveTextContent('INSTALL ON THIS DEVICE')
    expect(rackOs).toHaveTextContent('TARGETsrv-01')
    expect(rackOs).toHaveTextContent(`PACKAGE${REMOTE_PACKAGE}`)
    expect(rackOs).toHaveTextContent('CURRENTNOT INSTALLED')
    // It is presentation state only: no Process, no installed software, nothing.
    expect(snapshot()).toEqual(before)

    await user.click(screen.getByRole('button', { name: 'CANCEL' }))
    expect(rackOs).not.toHaveTextContent('INSTALL ON THIS DEVICE')
    expect(screen.getByRole('button', { name: 'INSTALL' })).toBeEnabled()
    expect(snapshot()).toEqual(before)
  })

  it('admits Device-owned work through the canonical operation and derives INSTALLING without remote telemetry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<GameProvider initialState={operatingState()}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await openRemotePackage(user)
    await user.click(screen.getByRole('button', { name: 'INSTALL' }))
    await user.click(screen.getByRole('button', { name: 'INSTALL' }))

    const admitted = snapshot()
    expect(admitted.process.processes).toEqual([expect.objectContaining({
      kind: 'software_installation', status: 'running', executorDeviceId: 'host-lan-001',
      productId: 'nodescan', releaseId: 'nodescan-1.1-experimental',
    })])
    // The Device that will own the software has not received it yet.
    expect(admitted.world.network.hosts[0].installedSoftware).toEqual([])
    expect(admitted.player.localDevice.installedSoftware.find(({ id }) => id === 'nodescan')?.releaseId).toBe('nodescan-1.0-standard')

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(screen.getByRole('button', { name: 'INSTALLING…' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
    expect(rackOs).not.toHaveTextContent('INSTALL ON THIS DEVICE')
    // No remote progress, resource or cancellation surface: this slice observes existence of the work only.
    expect(rackOs.querySelector('progress')).toBeNull()
    expect(rackOs.textContent).not.toMatch(/%|MiB|CPU|RAM/)
    expect(screen.queryByRole('button', { name: 'CANCEL' })).not.toBeInTheDocument()

    // srv-01 owns 160 compute at 12% baseline: 600 work completes in about 4.3 s of its own runtime.
    await act(async () => { vi.advanceTimersByTime(6_000) })
    expect(screen.getByRole('button', { name: 'INSTALLED ✓' })).toBeDisabled()
    const done = snapshot()
    expect(done.world.network.hosts[0].installedSoftware).toEqual([
      { id: 'nodescan', releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental' },
    ])
    expect(done.player.localDevice.installedSoftware.find(({ id }) => id === 'nodescan')?.releaseId).toBe('nodescan-1.0-standard')
    expect(done.world.network.hosts[0].filesystem!.files.some((file) => file.kind === 'executable')).toBe(false)
    expect(done.recentActivity.entries).toEqual([])
    expect(done.process.processes).toEqual([])
  })

  it('keeps installation running through DISCONNECT and derives current truth on a later Session', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<GameProvider initialState={discoveredAccessState()}><Shell /><StateSnapshot /></GameProvider>)

    /* DISCONNECT restores the preserved NodeScan Device context, so the second
       Session is established from the page the player was already on. */
    async function connectAndEnter() {
      const launcher = screen.queryByRole('button', { name: 'Open NodeScan' })
      if (launcher) {
        await user.click(launcher)
        await user.click(screen.getByRole('button', { name: 'Open known area home-net' }))
        await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
      }
      await user.click(screen.getByRole('button', { name: /CONNECT/ }))
      await enterRemote(user)
    }

    await connectAndEnter()
    await openRemotePackage(user)
    await user.click(screen.getByRole('button', { name: 'INSTALL' }))
    await user.click(screen.getByRole('button', { name: 'INSTALL' }))
    expect(screen.getByRole('button', { name: 'INSTALLING…' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'DISCONNECT' }))
    expect(screen.queryByLabelText('RACK-OS remote operating environment')).not.toBeInTheDocument()
    const disconnected = snapshot()
    expect(disconnected.remoteSession.active).toBeNull()
    // Observation ended; the Device's own work did not.
    expect(disconnected.process.processes).toEqual([expect.objectContaining({ status: 'running', executorDeviceId: 'host-lan-001' })])
    expect(disconnected.deviceAccess.established).toHaveLength(1)

    await act(async () => { vi.advanceTimersByTime(6_000) })
    expect(snapshot().world.network.hosts[0].installedSoftware).toHaveLength(1)

    await connectAndEnter()
    await openRemotePackage(user)
    expect(screen.getByRole('button', { name: 'INSTALLED ✓' })).toBeDisabled()
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('CURRENTNodeScan 1.1 Experimental')
  })

  it('adds no software management to RACK-OS System and no package commands to RACK-OS Terminal', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState((host) => ({ ...host, installedSoftware: [{ id: 'nodescan', releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental' }] }))}><Shell /></GameProvider>)
    await enterRemote(user)

    await user.click(screen.getByRole('button', { name: 'SYSTEM' }))
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('AUTHENTICATION HISTORY')
    expect(rackOs).not.toHaveTextContent('INSTALLED SOFTWARE')
    expect(screen.queryByRole('button', { name: /UNINSTALL|RESTORE/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'TERMINAL' }))
    const input = screen.getByLabelText('Remote command')
    await user.type(input, 'help{enter}')
    expect(rackOs).toHaveTextContent('help clear ip ls cat download upload disconnect')
    await user.type(input, `install ${REMOTE_PACKAGE}{enter}`)
    expect(rackOs).toHaveTextContent('COMMAND NOT FOUND')
  })
})
