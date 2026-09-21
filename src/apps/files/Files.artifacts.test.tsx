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

describe('Files specialized artifact presentation', () => {
  it('presents a RACK-OS firmware installer as the artifact it is, and offers no installation on node-01', async () => {
    const base = createInitialGameState()
    const installer: FilesystemFile = {
      kind: 'firmware_package', id: 'file-firmware', path: '/home/user/downloads/rack-os-1.1-business.fwpkg',
      firmwareId: RACK_OS_1_1_BUSINESS_RELEASE.firmware.id, buildId: RACK_OS_1_1_BUSINESS_RELEASE.buildId,
      name: RACK_OS_1_1_BUSINESS_RELEASE.firmware.name, version: RACK_OS_1_1_BUSINESS_RELEASE.firmware.version,
      publisher: RACK_OS_1_1_BUSINESS_RELEASE.publisher, sizeBytes: RACK_OS_1_1_BUSINESS_RELEASE.installerSizeBytes,
    }
    const state: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice,
      filesystem: { nextFileId: 2, files: [installer] },
    } } }
    render(<GameProvider initialState={state}><Files /><StateProbe /></GameProvider>)
    const user = userEvent.setup()
    const before = probe()
    await user.click(screen.getByRole('button', { name: /downloads.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /rack-os-1\.1-business\.fwpkg.*FIRMWARE INSTALLER/ }))

    expect(screen.getByRole('heading', { name: 'RACK-OS 1.1 Business' })).toBeInTheDocument()
    expect(screen.getByText('FIRMWARE INSTALLER · 24 MB')).toBeInTheDocument()
    // NODE-OS states its own firmware and refuses: there is no install action anywhere.
    expect(screen.getByText('INSTALLATION').closest('.node-section')).toHaveTextContent('NOT ON THIS DEVICE')
    expect(within(screen.getByText('THIS DEVICE').closest('div')!).getByText('NODE-OS 1.0')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'INSTALL' })).toBeNull()
    expect(screen.getByText(/Transfer this installer to a compatible RACK-OS server/)).toBeInTheDocument()
    expect(probe()).toEqual(before)
  })

  it.each([
    ['GhostKey', 'Credential Access', CREDENTIAL_ACCESS_MODULE_1_0],
    ['Rollback Module', 'UPD-001', ROLLBACK_MODULE_1_0],
  ])('presents %s as standalone-usable while keeping optional host integration separate', async (name, capability, module) => {
    const base = createInitialGameState()
    const state: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice,
      installedSoftware: base.player.localDevice.installedSoftware.filter(({ id }) => id !== 'flipper'),
      filesystem: { nextFileId: 2, files: [{ kind: 'software_module', id: 'file-module', path: '/home/user/modules/offensive.mod', ...module }] },
    } } }
    render(<GameProvider initialState={state}><Files /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /modules.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /offensive\.mod.*SOFTWARE MODULE/ }))

    expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    expect(screen.queryByText('STATUS')).not.toBeInTheDocument()
    expect(screen.getByText('INTEGRATION').parentElement).toHaveTextContent('HOST NOT INSTALLED')
    expect(screen.getByText(new RegExp(`Supplies ${capability} standalone`))).toBeInTheDocument()
    expect(screen.getByText(/Flipper is an optional integration host/)).toBeInTheDocument()

    // Deeper technical facts stay behind MODULE INFORMATION rather than dominating the primary surface.
    expect(screen.queryByText('STANDALONE USE')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /MODULE INFORMATION/ }))
    expect(screen.getByText('STANDALONE USE').parentElement).toHaveTextContent('AVAILABLE')
    expect(screen.getByText('OPTIONAL HOST').parentElement).toHaveTextContent('flipper')
    expect(screen.getByText('TECHNIQUE').parentElement).toHaveTextContent(capability)
  })

  it('names a fresh GhostKey artifact GhostKey, states Credential Access, and never reveals AUTH-017 merely by opening or possessing it', async () => {
    const base = createInitialGameState()
    const state: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice,
      installedSoftware: base.player.localDevice.installedSoftware.filter(({ id }) => id !== 'flipper'),
      filesystem: { nextFileId: 2, files: [{ kind: 'software_module', id: 'file-module', path: '/home/user/modules/offensive.mod', ...CREDENTIAL_ACCESS_MODULE_1_0 }] },
    } } }
    render(<GameProvider initialState={state}><Files /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /modules.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /offensive\.mod.*SOFTWARE MODULE/ }))

    expect(screen.getByRole('heading', { name: 'GhostKey' })).toBeInTheDocument()
    expect(screen.getByText(/Supplies Credential Access standalone/)).toBeInTheDocument()
    expect(screen.queryByText(/AUTH-017/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /MODULE INFORMATION/ }))
    expect(screen.getByText('TECHNIQUE').parentElement).toHaveTextContent('Credential Access')
    expect(screen.queryByText(/AUTH-017/)).not.toBeInTheDocument()
  })

})

describe('Files deauth.ext extension', () => {
  async function openDeauthExtension(initialState = createInitialGameState()) {
    render(<GameProvider initialState={initialState}><Files /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /downloads.*DIRECTORY/ }))
    expect(screen.getByRole('button', { name: /deauth\.ext.*FLIPPER EXTENSION/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /deauth\.ext/ }))
    return user
  }

  it('states NOT AVAILABLE truthfully rather than an invented integration state when Flipper is not installed', async () => {
    const user = await openDeauthExtension()
    expect(screen.getByRole('heading', { name: 'deauth.ext' })).toBeInTheDocument()
    // It has no integration mechanic of its own: only availability, never INTEGRATION.
    expect(screen.queryByText('INTEGRATION')).not.toBeInTheDocument()
    expect(screen.getByText('AVAILABILITY').parentElement).toHaveTextContent('NOT AVAILABLE')
    expect(screen.getByText(/Requires Flipper to be installed/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /EXTENSION INFORMATION/ }))
    expect(screen.getByText('HOST').parentElement).toHaveTextContent('NOT INSTALLED')
    expect(screen.getByText('COMPATIBILITY').parentElement).toHaveTextContent('Flipper 1.0')
  })

  it('states AVAILABLE once a compatible installed Flipper coexists with the extension', async () => {
    const base = createInitialGameState()
    const state: GameState = { ...base, player: { ...base.player, localDevice: {
      ...base.player.localDevice,
      installedSoftware: [...base.player.localDevice.installedSoftware, FLIPPER_1_0_CANONICAL_INSTALLATION],
    } } }
    await openDeauthExtension(state)
    const status = screen.getByText('AVAILABILITY').parentElement as HTMLElement
    expect(within(status).getByText('AVAILABLE')).toBeInTheDocument()
    expect(screen.getByText(/DEAUTH is available from Flipper NETWORK/)).toBeInTheDocument()
  })

  it('presents AVAILABLE for the viewed copy regardless of filesystem order, when a second equivalent copy exists at another path', async () => {
    const base = createInitialGameState()
    const seeded = base.player.localDevice.filesystem.files.find((file): file is DeauthExtensionFile => file.kind === 'deauth_extension')!
    // A second concrete copy, appended after the seeded one, so a first-match
    // lookup over filesystem order would resolve to the seeded copy alone.
    const secondCopy: DeauthExtensionFile = { ...seeded, id: 'file-deauth-second-copy', path: '/home/user/extensions/deauth-second-copy.ext' }
    const state: GameState = { ...base, player: { ...base.player, localDevice: {
      ...base.player.localDevice,
      installedSoftware: [...base.player.localDevice.installedSoftware, FLIPPER_1_0_CANONICAL_INSTALLATION],
      filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, secondCopy] },
    } } }

    // Opening the seeded (first-in-array) copy shows AVAILABLE.
    const userA = await openDeauthExtension(state)
    expect(within(screen.getByText('AVAILABILITY').parentElement as HTMLElement).getByText('AVAILABLE')).toBeInTheDocument()

    // Opening the second (later-in-array) copy must show the same truthful AVAILABLE state,
    // not NOT AVAILABLE merely because it is not the first match `findCompatibleDeauthExtension` would return.
    await userA.click(screen.getByRole('button', { name: 'Back to /home/user/downloads' }))
    await userA.click(screen.getByRole('button', { name: /\.\.\/.*DIRECTORY/ }))
    await userA.click(screen.getByRole('button', { name: /extensions.*DIRECTORY/ }))
    await userA.click(screen.getByRole('button', { name: /deauth-second-copy\.ext.*FLIPPER EXTENSION/ }))
    expect(within(screen.getByText('AVAILABILITY').parentElement as HTMLElement).getByText('AVAILABLE')).toBeInTheDocument()
  })

  it('keeps NOT AVAILABLE truthful for an incompatible/unsupported extension artifact even when a compatible Flipper is installed', async () => {
    const base = createInitialGameState()
    const seeded = base.player.localDevice.filesystem.files.find((file): file is DeauthExtensionFile => file.kind === 'deauth_extension')!
    const foreignBuild: DeauthExtensionFile = { ...seeded, id: 'file-deauth-foreign', path: '/home/user/extensions/deauth-foreign.ext', buildId: 'build-deauth-extension-9.9-foreign' }
    const state: GameState = { ...base, player: { ...base.player, localDevice: {
      ...base.player.localDevice,
      installedSoftware: [...base.player.localDevice.installedSoftware, FLIPPER_1_0_CANONICAL_INSTALLATION],
      filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, foreignBuild] },
    } } }
    render(<GameProvider initialState={state}><Files /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /extensions.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /deauth-foreign\.ext/ }))
    expect(within(screen.getByText('AVAILABILITY').parentElement as HTMLElement).getByText('NOT AVAILABLE')).toBeInTheDocument()
  })
})

describe('Files RATTLER payload', () => {
  it('presents target/payload facts as an artifact, keeping opaque release/build identity out of the primary surface', async () => {
    const base = createInitialGameState()
    const payload = { kind: 'rattler_payload' as const, id: 'file-payload', path: '/home/user/apps/rattler/payloads/payload-host-lan-001.rpl', sizeBytes: 6_400, rattlerReleaseId: RATTLER_1_0.releaseId, rattlerBuildId: RATTLER_1_0.buildId, targetDeviceId: 'host-lan-001', targetAddressSnapshot: '203.0.113.10' }
    const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, payload] } } } }
    render(<GameProvider initialState={state}><Files /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^apps.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /^rattler.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /^payloads.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /payload-host-lan-001\.rpl.*RATTLER PAYLOAD/ }))

    expect(screen.getByText('TARGET BOUND')).toBeInTheDocument()
    expect(screen.getByText('ADDRESS').parentElement).toHaveTextContent('203.0.113.10')
    expect(screen.getByText('DEVICE').parentElement).toHaveTextContent('host-lan-001')
    expect(screen.queryByRole('button', { name: 'DEPLOY' })).not.toBeInTheDocument()
    expect(screen.queryByText(RATTLER_1_0.releaseId)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /FILE INFORMATION/ }))
    expect(screen.getByText(RATTLER_1_0.releaseId)).toBeInTheDocument()
    expect(screen.getByText(RATTLER_1_0.buildId)).toBeInTheDocument()
  })
})

describe('Files application executable OPEN', () => {
  it('opens Flipper as a launcher, with no RELEASE INFORMATION or application UI duplicated into Files', async () => {
    const base = createInitialGameState()
    const flipperExe = { kind: 'executable' as const, id: 'file-flipper', path: FLIPPER_INSTALLED_EXECUTABLE_PATH, programId: 'flipper', releaseId: FLIPPER_1_0_CANONICAL_INSTALLATION.releaseId, buildId: FLIPPER_1_0_CANONICAL_INSTALLATION.buildId, name: 'Flipper', version: '1.0', sizeBytes: FLIPPER_1_0_CANONICAL_INSTALLATION.sizeBytes }
    const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, flipperExe] } } } }
    const openApp = vi.fn()
    render(<GameProvider initialState={state}><Files openApp={openApp} /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^apps.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /^flipper.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /flipper.*EXECUTABLE/ }))

    expect(screen.getByRole('heading', { name: 'Flipper' })).toBeInTheDocument()
    expect(screen.queryByText('RELEASE INFORMATION')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'RUN' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'OPEN' }))
    expect(openApp).toHaveBeenCalledWith('flipper')
  })

  it('opens RATTLER as a launcher the same way', async () => {
    const base = createInitialGameState()
    const rattlerExe = { kind: 'executable' as const, id: 'file-rattler', path: RATTLER_INSTALLED_EXECUTABLE_PATH, programId: RATTLER_PROGRAM_ID, releaseId: RATTLER_1_0.releaseId, buildId: RATTLER_1_0.buildId, name: 'RATTLER', version: '1.0', sizeBytes: 2_400_000 }
    const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, rattlerExe] } } } }
    const openApp = vi.fn()
    render(<GameProvider initialState={state}><Files openApp={openApp} /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^apps.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /^rattler.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /^rattler.*EXECUTABLE/ }))

    expect(screen.getByRole('heading', { name: 'RATTLER' })).toBeInTheDocument()
    expect(screen.queryByText('RELEASE INFORMATION')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'OPEN' }))
    expect(openApp).toHaveBeenCalledWith('rattler')
  })

  it('does not offer OPEN when no launcher is wired in, without falling back to UNSUPPORTED', async () => {
    const base = createInitialGameState()
    const flipperExe = { kind: 'executable' as const, id: 'file-flipper', path: FLIPPER_INSTALLED_EXECUTABLE_PATH, programId: 'flipper', releaseId: FLIPPER_1_0_CANONICAL_INSTALLATION.releaseId, buildId: FLIPPER_1_0_CANONICAL_INSTALLATION.buildId, name: 'Flipper', version: '1.0', sizeBytes: FLIPPER_1_0_CANONICAL_INSTALLATION.sizeBytes }
    const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, flipperExe] } } } }
    render(<GameProvider initialState={state}><Files /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^apps.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /^flipper.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /flipper.*EXECUTABLE/ }))
    expect(screen.queryByRole('button', { name: 'OPEN' })).not.toBeInTheDocument()
    expect(screen.queryByText('UNSUPPORTED')).not.toBeInTheDocument()
  })
})
