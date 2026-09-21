import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState } from '../../app/GameContext'
import { connectRemoteFromObservation } from '../../core/game/remoteSession'
import { installRemoteSoftwarePackage } from '../../core/game/softwareInstallation'
import { createInitialGameState } from '../../core/game/initialState'
import { RACK_OS_1_1_BUSINESS_FIRMWARE_ID, RACK_OS_FIRMWARE_ID } from '../../core/game/firmwareIdentity'
import { RACK_OS_1_1_BUSINESS_RELEASE, RACK_OS_FIRMWARE_UPDATE_DURATION_MS } from '../../core/game/rackOsFirmwareUpdate'
import { Shell } from '../../shell/Shell'
import type { ExecutableFile, GameProcess, GameState, NetworkHost, NodeMinerProcess } from '../../core/game/types'
import { rememberScan } from '../../core/game/discovery'
import { scanNetworkTarget } from '../../core/game/scan'
import { Terminal } from '../terminal/Terminal'
import { withoutBookstoreBackgroundTiming } from '../../test/canonicalSnapshot'
import rackSource from './RackOS.tsx?raw'
import rackUpdateSource from './RackFirmwareUpdate.tsx?raw'
import rackCss from './rackos.css?raw'
import { executeBookstoreSale } from '../../core/game/bookstoreSale'
import { BOOKSTORE_BRANCH_ID } from '../../core/game/business'
import { BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, placeBookstoreRestockOrder, proposeBookstoreRestockOrder } from '../../core/game/bookstoreRestock'

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


/** srv-02, authorized and connected, with the exact represented firmware installer already on it. */
function srv02WithInstaller(firmwareId: string = RACK_OS_FIRMWARE_ID): GameState {
  const base = createInitialGameState()
  const installer = {
    kind: 'firmware_package' as const, id: 'file-firmware', path: INSTALLER_PATH,
    firmwareId: RACK_OS_1_1_BUSINESS_RELEASE.firmware.id, buildId: RACK_OS_1_1_BUSINESS_RELEASE.buildId,
    name: RACK_OS_1_1_BUSINESS_RELEASE.firmware.name, version: RACK_OS_1_1_BUSINESS_RELEASE.firmware.version,
    publisher: RACK_OS_1_1_BUSINESS_RELEASE.publisher, sizeBytes: RACK_OS_1_1_BUSINESS_RELEASE.installerSizeBytes,
  }
  const hosts = base.world.network.hosts.map((host) => host.id === 'host-lan-002'
    ? {
      ...host,
      firmware: firmwareId === RACK_OS_FIRMWARE_ID ? host.firmware : { ...RACK_OS_1_1_BUSINESS_RELEASE.firmware },
      filesystem: { nextFileId: host.filesystem!.nextFileId + 1, files: [...host.filesystem!.files, installer] },
    }
    : host)
  const access = { id: 'access-firmware', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-ssh-002', privilege: 'USER' as const }
  const authorized = { ...base, deviceAccess: { nextId: 2, established: [access] }, world: { ...base.world, network: { ...base.world.network, hosts } } }
  return connectRemoteFromObservation(authorized, { targetDeviceId: 'host-lan-002', address: '203.0.113.42' }).state
}

const INSTALLER_PATH = '/opt/rack-os-1.1-business.fwpkg'

/**
 * The exact stale-Session precondition the canonical `target_offline` refusal
 * defends against: a Remote Session that is still fully established, over a
 * target Device whose own operational truth has already become network-
 * unusable. Reachability advancement clears a Session like this on its next
 * tick; this fixture captures the state before that tick runs, so presentation
 * can be proven never to offer what the canonical operation would refuse in
 * that gap.
 */
function srv02WithInstallerOffline(): GameState {
  const online = srv02WithInstaller()
  return {
    ...online,
    world: { ...online.world, network: { ...online.world.network, hosts: online.world.network.hosts.map((host) =>
      host.id === 'host-lan-002' ? { ...host, operational: { lifecycle: 'RUNNING' as const, connectivity: 'DISCONNECTED' as const } } : host) } },
  }
}

/** srv-01 already on RACK-OS 1.1 Business: a compatible Device on home-net, which has no associated Business Branch at all. */
function srv01OnBusiness(): GameState {
  const base = createInitialGameState()
  const hosts = base.world.network.hosts.map((host) => host.id === 'host-lan-001'
    ? { ...host, firmware: { ...RACK_OS_1_1_BUSINESS_RELEASE.firmware } }
    : host)
  const access = { id: 'access-srv-01', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' as const }
  const authorized = { ...base, deviceAccess: { nextId: 2, established: [access] }, world: { ...base.world, network: { ...base.world.network, hosts } } }
  return connectRemoteFromObservation(authorized, { targetDeviceId: 'host-lan-001', address: '198.51.100.47' }).state
}

/**
 * ops-01 (`host-lan-003`), already reached: fresh `createInitialGameState()`
 * grants this Device no DeviceAccess or Remote Session of its own, so this
 * establishes both the same canonical way `srv01OnBusiness` above does for
 * srv-01 — a plain `DeviceAccess` record over its real GateSSH Service and
 * `connectRemoteFromObservation` — rather than through any Device-specific
 * shortcut. `host-lan-003` starts directly on RACK-OS 1.1 Business, so unlike
 * `srv02WithInstaller` this fixture performs no Firmware installation at all.
 */
function ops01Connected(): GameState {
  const base = createInitialGameState()
  // ops-01 sits on Bookstore's private segment, reachable only through its Gateway's own public edge.
  const access = { id: 'access-ops-01', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-003', viaServiceId: 'service-ssh-004', privilege: 'USER' as const }
  const authorized = { ...base, deviceAccess: { nextId: 2, established: [access] } }
  return connectRemoteFromObservation(authorized, { targetDeviceId: 'host-lan-003', address: '203.0.113.42' }).state
}

function ops01WithIncomingRestock(): GameState {
  let state = createInitialGameState()
  for (let index = 0; index < 7; index += 1) {
    const samples = [0, 0.999999]
    const sale = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => samples.shift() ?? 0)
    if (sale.status !== 'sold') throw new Error('expected fixture sale')
    state = sale.state
  }
  const restockProposal = proposeBookstoreRestockOrder(state, BOOKSTORE_BRANCH_ID, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, { caseCount: 1 })
  if (restockProposal.status !== 'proposed') throw new Error('expected fixture proposal')
  const order = placeBookstoreRestockOrder(state, BOOKSTORE_BRANCH_ID, { caseCount: 1 }, restockProposal.proposal)
  if (order.status !== 'ordered') throw new Error('expected fixture restock order')
  // ops-01 sits on Bookstore's private segment, reachable only through its Gateway's own public edge.
  const access = { id: 'access-ops-01', sourceDeviceId: order.state.player.localDevice.id, targetDeviceId: 'host-lan-003', viaServiceId: 'service-ssh-004', privilege: 'USER' as const }
  return connectRemoteFromObservation({ ...order.state, deviceAccess: { nextId: 2, established: [access] } }, { targetDeviceId: 'host-lan-003', address: '203.0.113.42' }).state
}

function ReconnectControl() {
  const actions = useGameActions()
  return <button onClick={() => actions.connectRemoteFromObservation({ targetDeviceId: 'host-lan-002', address: '203.0.113.42' })}>test reconnect</button>
}

/** The Applications home entries, in listed order, as a player reads them. */
function applicationNames() {
  return [...document.querySelectorAll('.rack-appitem__name')].map((name) => name.textContent)
}

/** Each application's own note line, in listed order (SYSTEM for a built-in, INSTALLED · <version> for real InstalledSoftware). */
function applicationNotes() {
  return [...document.querySelectorAll('.rack-appitem__note')].map((note) => note.textContent)
}

describe('RACK-OS firmware update from a target-owned installer artifact', () => {
  async function openInstallerArtifact(user: ReturnType<typeof userEvent.setup>) {
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: /DIR\s*opt/ }))
    await user.click(screen.getByRole('button', { name: /FILE\s*rack-os-1\.1-business\.fwpkg/ }))
  }

  it('launches a dedicated update utility from the artifact, and starts nothing until Install is confirmed', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={srv02WithInstaller()}><Shell /><StateSnapshot /></GameProvider>)
    await openInstallerArtifact(user)

    // Stage one: the artifact states what it is; its primary action only opens the utility.
    expect(screen.getByRole('heading', { name: 'RACK-OS 1.1 Business' })).toBeInTheDocument()
    expect(screen.getByText('FIRMWARE INSTALLER')).toBeInTheDocument()
    const beforeLaunch = withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState)
    await user.click(screen.getByRole('button', { name: 'OPEN INSTALLER' }))

    // Stage two: the utility states the Device, both releases, and the restart.
    const utility = screen.getByRole('region', { name: 'Firmware update utility' })
    expect(within(utility).getByText('CURRENT FIRMWARE').closest('div')).toHaveTextContent('RACK-OS 1.0')
    expect(within(utility).getByText('TARGET FIRMWARE').closest('div')).toHaveTextContent('RACK-OS 1.1 Business')
    expect(within(utility).getByText('STATUS').closest('div')).toHaveTextContent('INSTALLABLE')
    expect(utility).toHaveTextContent('THIS DEVICE WILL RESTART')
    // No internal identity is exposed as product UI.
    expect(utility.textContent).not.toContain('firmware-rack-os')
    expect(utility.textContent).not.toContain('host-lan-002')
    expect(withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? ''))).toEqual(beforeLaunch)

    // CANCEL changes nothing either.
    await user.click(screen.getByRole('button', { name: 'CANCEL' }))
    expect(withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? ''))).toEqual(beforeLaunch)
    expect(screen.queryByRole('region', { name: 'Firmware update utility' })).toBeNull()
  })

  it('states the real reason and offers no launch on a Device already running the release', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={srv02WithInstaller(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: /^FILES/ }))
    await user.click(screen.getByRole('button', { name: /DIR\s*opt/ }))
    await user.click(screen.getByRole('button', { name: /FILE\s*rack-os-1\.1-business\.fwpkg/ }))

    expect(screen.getByText('THIS DEVICE ALREADY RUNS THIS RELEASE')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'OPEN INSTALLER' })).toBeNull()
  })

  it('offers no launch on a stale Session whose target has already gone offline, and states the real reason', async () => {
    // The Remote Session is still fully represented here — only the target
    // Device's own operational truth has changed — the exact stale-Session gap
    // the canonical target_offline refusal defends against. That gap is a
    // pre-tick state: GameProvider's own 250ms canonical advancement interval
    // would otherwise clear it out from under this test the moment real wall
    // time lets 250ms elapse — which a slower full-suite CI run reliably does,
    // even though a fast isolated run may not. Rather than freezing every
    // timer in the environment (which stalls the RAF-driven editing-viewport
    // machinery this same Shell interaction depends on), only the exact
    // canonical-advancement interval is neutralized: every other real timer,
    // including requestAnimationFrame, keeps behaving exactly as it does
    // outside a test.
    const realSetInterval = window.setInterval.bind(window)
    const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout === 250) return 0 as unknown as ReturnType<typeof window.setInterval>
      return realSetInterval(handler as TimerHandler, timeout, ...args)
    })
    try {
      const user = userEvent.setup()
      const state = srv02WithInstallerOffline()
      expect(state.remoteSession.active).toEqual(srv02WithInstaller().remoteSession.active)
      render(<GameProvider initialState={state}><Shell /></GameProvider>)
      await enterRemote(user)
      await user.click(screen.getByRole('button', { name: /^FILES/ }))
      await user.click(screen.getByRole('button', { name: /DIR\s*opt/ }))
      await user.click(screen.getByRole('button', { name: /FILE\s*rack-os-1\.1-business\.fwpkg/ }))

      expect(screen.getByText('THIS DEVICE IS NOT CURRENTLY REACHABLE')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'OPEN INSTALLER' })).toBeNull()
    } finally {
      setIntervalSpy.mockRestore()
    }
  })

  it('replaces the whole environment with a truthful maintenance surface once installation starts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<GameProvider initialState={srv02WithInstaller()}><Shell /><StateSnapshot /></GameProvider>)
    await openInstallerArtifact(user)
    await user.click(screen.getByRole('button', { name: 'OPEN INSTALLER' }))
    await user.click(screen.getByRole('button', { name: 'INSTALL' }))

    // Canonical Device state changed; the Firmware has not.
    const started = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    const srv02 = started.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    expect(srv02.firmwareUpdate).toMatchObject({ releaseId: RACK_OS_1_1_BUSINESS_FIRMWARE_ID, phase: 'PREPARING' })
    expect(srv02.firmware?.id).toBe(RACK_OS_FIRMWARE_ID)

    // Terminal, Files and System are gone; the maintenance surface is the environment.
    const maintenance = screen.getByRole('region', { name: 'Firmware installation' })
    expect(screen.queryByRole('navigation', { name: /sections/ })).toBeNull()
    expect(screen.queryByLabelText('Remote command')).toBeNull()
    expect(maintenance).toHaveTextContent('RACK FIRMWARE UPDATE UTILITY')
    expect(within(maintenance).getByText('FROM').closest('div')).toHaveTextContent('RACK-OS 1.0')
    expect(within(maintenance).getByText('TO').closest('div')).toHaveTextContent('RACK-OS 1.1 Business')
    // No fabricated download stage for an artifact already on this Device.
    expect(maintenance.textContent).not.toMatch(/download/i)
    expect(maintenance.querySelector('.rack-update__stage-name')?.textContent).toBe('PREPARING FIRMWARE IMAGE')

    // Progress comes from canonical advancement, and leaving and returning shows the real state.
    await act(async () => { vi.advanceTimersByTime(10_000) })
    const midway = Number(screen.getByRole('progressbar', { name: 'Firmware installation progress' }).getAttribute('aria-valuenow'))
    expect(midway).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Return to NODE-OS without disconnecting' }))
    await act(async () => { vi.advanceTimersByTime(4_000) })
    await user.click(screen.getByRole('button', { name: /RETURN REMOTE/ }))
    const later = Number(screen.getByRole('progressbar', { name: 'Firmware installation progress' }).getAttribute('aria-valuenow'))
    expect(later).toBeGreaterThan(midway)
  })

  it('completes into RACK-OS 1.1 Business, really reboots, and presents the new release on reconnect', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const initial = srv02WithInstaller()
    render(<GameProvider initialState={initial}><Shell /><StateSnapshot /><ReconnectControl /></GameProvider>)
    await openInstallerArtifact(user)
    await user.click(screen.getByRole('button', { name: 'OPEN INSTALLER' }))
    await user.click(screen.getByRole('button', { name: 'INSTALL' }))

    await act(async () => { vi.advanceTimersByTime(RACK_OS_FIRMWARE_UPDATE_DURATION_MS + 1_000) })
    const rebooting = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    const shuttingDown = rebooting.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    expect(shuttingDown.firmware?.id).toBe(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)
    expect(shuttingDown.operational.lifecycle).not.toBe('RUNNING')
    // The Session ended through canonical reachability, and the player is back on NODE-OS.
    expect(rebooting.remoteSession.active).toBeNull()
    expect(screen.queryByLabelText(/remote operating environment/)).toBeNull()

    await act(async () => { vi.advanceTimersByTime(20_000) })
    const booted = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    const restarted = booted.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    expect(restarted.operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    // GateSSH and its DeviceAccess were never touched, so the same access still reaches it.
    expect(restarted.services).toEqual(initial.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.services)
    expect(restarted.installedSoftware).toEqual(initial.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.installedSoftware)
    expect(booted.deviceAccess.established).toEqual(initial.deviceAccess.established)

    await user.click(screen.getByRole('button', { name: 'test reconnect' }))
    await enterRemote(user)
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('RACK-OS 1.1 Business')
    expect(applicationNames()).toEqual(['TERMINAL', 'FILES', 'SYSTEM', 'BUSINESS'])
  })
})

describe('RACK-OS 1.1 Business and the update surface on a narrow viewport', () => {
  it('keeps the application launcher and its return path touch-safe', () => {
    // Rectangular, bordered rows with a comfortable touch target: the industrial
    // ancestry of RACK-OS, not a rounded consumer app grid.
    expect(rackCss).toMatch(/\.rack-appitem\s*{[^}]*min-height:\s*62px;/)
    expect(rackCss).toMatch(/\.rack-appitem\s*{[^}]*border:\s*1px solid/)
    expect(rackCss).not.toMatch(/\.rack-appitem\s*{[^}]*border-radius/)
    expect(rackCss).toMatch(/\.rack-appbar\s*{[^}]*min-height:\s*44px;/)
    expect(rackCss).toMatch(/\.rack-appbar__home\s*{[^}]*min-height:\s*44px;/)
    expect(rackCss).toMatch(/\.rack-appitem__name\s*{[^}]*overflow-wrap:\s*anywhere;/)
  })

  it('gives the maintenance environment its own full-height scrollable body', () => {
    // Two rows, not three: the maintenance environment has no section bar at all.
    expect(rackCss).toMatch(/\.rack-os--maintenance\s*{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\);/)
    expect(rackCss).toMatch(/\.rack-update\s*{[^}]*overflow:\s*auto;[^}]*overscroll-behavior-y:\s*contain;/)
  })

  it('renders the whole application launcher inside the narrowest represented viewport', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={srv02WithInstaller(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)}><Shell /></GameProvider>)
    await enterRemote(user)
    // Every application stays a single reachable control; nothing is hidden behind an overflow menu.
    expect(document.querySelectorAll('.rack-appitem')).toHaveLength(4)
    for (const item of document.querySelectorAll('.rack-appitem')) expect(item.tagName).toBe('BUTTON')
  })
})
