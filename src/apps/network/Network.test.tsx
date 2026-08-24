import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as GameContext from '../../app/GameContext'
import { GameProvider, useGameActions, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { appRegistry } from '../../shell/appRegistry'
import { startServiceAnalysisAtEndpoint, startServiceAnalysisFromObservation } from '../../core/game/serviceAnalysis'
import { advanceGameState } from '../../core/game/gameAdvancement'
import { scanNetworkTarget } from '../../core/game/scan'
import { rememberScan } from '../../core/game/discovery'
import type { GameState } from '../../core/game/types'
import { Network } from './Network'

const scanTargetSpy = vi.hoisted(() => vi.fn())
vi.mock('../../core/game/scan', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/game/scan')>()
  return { ...actual, scanNetworkTarget: (...args: Parameters<typeof actual.scanNetworkTarget>) => { scanTargetSpy(...args); return actual.scanNetworkTarget(...args) } }
})


function discoveredState(): GameState {
  let state = createInitialGameState()
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  let discovery = rememberScan(state.discovery, scanNetworkTarget(targets, state.player.localDevice.network.ip), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, 'home-net'), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, '198.51.100.47'), state.player.localDevice.id)
  return { ...state, discovery }
}
function withDiscovery(state: GameState): GameState { return { ...state, discovery: discoveredState().discovery } }
function withNodeScan11(state: GameState): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.map((software) => software.id === 'nodescan' ? { ...software, releaseId: 'nodescan-1.1-experimental', version: '1.1', channel: 'experimental' } : software) } } }
}

async function openLanDevice() {
  const user = userEvent.setup()
  render(<GameProvider initialState={discoveredState()}><Network /></GameProvider>)
  await user.click(await screen.findByRole('button', { name: 'Open known area home-net' }))
  await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
  return user
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

function StateSnapshot() { return <output data-testid="game-state">{JSON.stringify(useGameState())}</output> }
function ClearCompleted() { const actions = useGameActions(); return <button onClick={actions.clearRecentActivity}>Clear test history</button> }

async function navigateToServices(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Open known area home-net' }))
  await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

describe('Scan workspace', () => {
  it('connects and disconnects a remembered Device through canonical session state', async () => {
    const known = discoveredState()
    const state = { ...known, deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: known.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' as const }] } }
    const user = userEvent.setup()
    render(<GameProvider initialState={state}><Network /><StateSnapshot /></GameProvider>)
    await navigateToServices(user)
    await user.click(screen.getByRole('button', { name: /CONNECT/ }))
    expect(screen.getByText('REMOTE SESSION')).toBeInTheDocument()
    expect(screen.getByLabelText('Remote session active')).toHaveTextContent('ACTIVE')
    expect(screen.getByLabelText('Remote session active')).toHaveTextContent('USER')
    expect(screen.getByRole('button', { name: 'DISCONNECT' })).toBeInTheDocument()
    expect((JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState).remoteSession.active).toMatchObject({ accessId: 'access-0001' })
    await user.click(screen.getByRole('button', { name: 'DISCONNECT' }))
    const disconnected = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(disconnected.remoteSession.active).toBeNull()
    expect(disconnected.deviceAccess.established).toEqual(state.deviceAccess.established)
    expect(screen.getAllByText('USER ACCESS')).not.toHaveLength(0)
  })

  it('presents access provenance on its Service and returns to Device without connecting', async () => {
    const known = discoveredState()
    const established = [{ id: 'access-altered', sourceDeviceId: known.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' as const }]
    const state = { ...known, deviceAccess: { nextId: 9, established } }
    const user = userEvent.setup()
    render(<GameProvider initialState={state}><Network /><StateSnapshot /></GameProvider>)
    await navigateToServices(user)
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    expect(screen.getByText('ACCESS PATH')).toBeInTheDocument()
    expect(screen.getByText(/ESTABLISHED VIA THIS SERVICE/).closest('p')).toHaveTextContent('USER · ESTABLISHED VIA THIS SERVICE')
    await user.click(screen.getByRole('button', { name: 'VIEW DEVICE' }))
    expect(screen.getByLabelText('Device access available')).toHaveTextContent('USER ACCESS')
    expect(screen.getByRole('button', { name: /CONNECT/ })).toBeInTheDocument()
    const navigated = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(navigated.deviceAccess.established).toEqual(established)
    expect(navigated.remoteSession.active).toBeNull()
  })

  it('does not present access provenance or VIEW DEVICE before access exists', async () => {
    const user = await openLanDevice()
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    expect(screen.queryByText('ACCESS PATH')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'VIEW DEVICE' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument()
  })

  it('keeps CONNECT visible from remembered access and presents only coarse unavailable feedback', async () => {
    const known = discoveredState()
    const host = known.world.network.hosts[0]
    const state = {
      ...known,
      deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: known.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' as const }] },
      world: { network: { ...known.world.network, hosts: [{ ...host, online: false }, ...known.world.network.hosts.slice(1)] } },
    }
    const user = userEvent.setup()
    render(<GameProvider initialState={state}><Network /></GameProvider>)
    await navigateToServices(user)
    const connect = screen.getByRole('button', { name: /CONNECT/ })
    expect(connect).toBeEnabled()
    await user.click(connect)
    expect(screen.getByRole('status')).toHaveTextContent('TARGET NOT AVAILABLE')
    expect(document.body).not.toHaveTextContent(/offline|service closed|stale address/i)
  })
  it('offers known credential access without hidden-world leakage and starts it through the application boundary', async () => {
    let known = discoveredState()
    const analysis = startServiceAnalysisFromObservation(known, { endpoint: '198.51.100.47:22', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001' })
    if (analysis.status !== 'started') throw Error(analysis.status)
    known = advanceGameState(analysis.state, 20_000)
    const host = known.world.network.hosts[0]
    known = { ...known, world: { network: { ...known.world.network, hosts: [{ ...host, services: host.services!.map((service) => service.id === 'service-ssh-001' ? { ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.4.0', name: 'GateSSH', version: '1.4.0' } } : service) }, ...known.world.network.hosts.slice(1)] } } }
    const user = userEvent.setup()
    render(<GameProvider initialState={known}><Network /><StateSnapshot /></GameProvider>)
    await navigateToServices(user)
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    expect(screen.getByRole('button', { name: 'Start credential access attempt' })).toHaveTextContent('Basic Credential Toolkit · Outcome unknown')
    await user.click(screen.getByRole('button', { name: 'Start credential access attempt' }))
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(state.process.processes.at(-1)).toMatchObject({ kind: 'credential_access', status: 'running', startedEndpoint: '198.51.100.47:22' })
    expect(state.deviceAccess.established).toEqual([])
    expect(screen.getByLabelText('Credential access running')).toBeInTheDocument()
  })

  it('preserves the network registry identity while presenting NodeScan', () => {
    expect(appRegistry.network.label).toBe('NodeScan')
    expect(Object.entries(appRegistry).map(([id, app]) => [id, app.label])).toEqual([
      ['terminal', 'Terminal'], ['network', 'NodeScan'], ['processes', 'Processes'],
      ['files', 'Files'], ['wallet', 'Wallet'], ['notes', 'Notes'], ['system', 'System'],
    ])
  })

  it('opens on a truthful Known Space atlas without leaking undiscovered details', async () => {
    render(<GameProvider><Network /></GameProvider>)
    expect(screen.getByText('Known and observed network space')).toBeInTheDocument()
    expect(screen.getByText('KNOWN SPACE')).toBeInTheDocument()
    expect(screen.getByText('NODESCAN')).toBeInTheDocument()
    expect(screen.getByText('SELF')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.23')).toBeInTheDocument()
    expect(screen.queryByText('home-net')).not.toBeInTheDocument()
    expect(scanTargetSpy).not.toHaveBeenCalled()
  })

  it('derives product metadata from canonical software and reports an absent installation', () => {
    const base = createInitialGameState()
    const altered: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: base.player.localDevice.installedSoftware.map((software) => software.id === 'nodescan' ? { ...software, version: '2.4', channel: 'preview' } : software) } } }
    const view = render(<GameProvider initialState={altered}><Network /></GameProvider>)
    expect(screen.getByText('2.4 PREVIEW')).toBeInTheDocument()
    view.unmount()
    const absent: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: base.player.localDevice.installedSoftware.filter(({ id }) => id !== 'nodescan') } } }
    render(<GameProvider initialState={absent}><Network /></GameProvider>)
    expect(screen.getByText('NOT INSTALLED')).toBeInTheDocument()
    expect(screen.queryByText('KNOWN SPACE')).not.toBeInTheDocument()
    expect(screen.queryByText(base.world.network.localNetworks[0].name)).not.toBeInTheDocument()
  })

  it('discovers the local hierarchy from shared observations', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={discoveredState()}><Network /></GameProvider>)
    expect(await screen.findByText('home-net')).toBeInTheDocument()
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Open known area home-net' }))
    expect(screen.getByText('3 known devices')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.23')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.47')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.53')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
    expect(screen.getByRole('button', { name: 'Open SSH service' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open HTTP service' })).toBeInTheDocument()
    expect(screen.getByText('1 known')).toBeInTheDocument()
    expect(screen.getByText('NETWORK')).toBeInTheDocument()
    expect(screen.getAllByText('home-net')).not.toHaveLength(0)
    expect(screen.getByText('22 / TCP')).toBeInTheDocument()
    expect(screen.getByText('80 / TCP')).toBeInTheDocument()
    expect(screen.queryByText('ENDPOINT')).not.toBeInTheDocument()
    expect(screen.queryByText('KNOWLEDGE')).not.toBeInTheDocument()
    expect(screen.getAllByText('Not analyzed')).toHaveLength(2)
    expect(document.body.textContent).not.toMatch(/service-ssh-001|host-lan-001|AUTH-017/)
  })

  it('inspects remembered objects through the shared action and browsing does not observe again', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withNodeScan11(discoveredState())}><Network /><StateSnapshot /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: 'Open known area home-net' }))
    expect(screen.queryByText('SELF CONNECTED')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'INSPECT NETWORK' }))
    expect(screen.getByText('SELF CONNECTED')).toBeInTheDocument()
    expect(screen.getByText('YES')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
    expect(screen.queryByText('TYPE')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'INSPECT DEVICE' }))
    expect(screen.getByText('TYPE')).toBeInTheDocument()
    expect(screen.getByText('SERVER')).toBeInTheDocument()
    expect(screen.getByText('ONLINE')).toBeInTheDocument()
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-001')?.services).toHaveLength(2)
    expect(state.knowledge.discoveredVulnerabilities).toEqual([])
  })

  it('presents NodeScan 1.1 Experimental enhanced evidence through the same INSPECT DEVICE action', async () => {
    const user = userEvent.setup()
    const state = discoveredState()
    const withNodeScan11 = {
      ...state,
      player: {
        ...state.player,
        localDevice: {
          ...state.player.localDevice,
          installedSoftware: state.player.localDevice.installedSoftware.map((software) =>
            software.id === 'nodescan' ? { ...software, releaseId: 'nodescan-1.1-experimental', version: '1.1', channel: 'experimental' } : software),
        },
      },
    }
    render(<GameProvider initialState={withNodeScan11}><Network /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: 'Open known area home-net' }))
    await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
    await user.click(screen.getByRole('button', { name: 'INSPECT DEVICE' }))
    expect(screen.getByText('FIRMWARE')).toBeInTheDocument()
    expect(screen.getByText('RACK-OS 1.0')).toBeInTheDocument()
    expect(screen.getByText('COMPUTE')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('GateSSH 1.3.2')).toBeInTheDocument()
    expect(screen.getByText('Authentication: Credential')).toBeInTheDocument()
    expect(screen.getByText('Basic HTTP 1.0')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/secondFactorRequired|AUTH-017/)
  })

  it('renders stored Service fingerprints rather than changed hidden World Truth', async () => {
    const base = discoveredState()
    const observed = {
      ...base,
      discovery: {
        ...base.discovery,
        devices: base.discovery.devices.map((device) => device.id === 'host-lan-001' ? {
          ...device,
          services: device.services.map((service) => service.id === 'service-ssh-001' ? {
            ...service, inspect: { implementation: { name: 'GateSSH', version: '1.3.2' }, authentication: 'Credential' as const },
          } : service),
        } : device),
      },
      world: {
        network: {
          ...base.world.network,
          hosts: base.world.network.hosts.map((host) => host.id === 'host-lan-001' ? {
            ...host,
            services: host.services?.map((service) => service.id === 'service-ssh-001' ? {
              ...service, implementation: { ...service.implementation, releaseId: 'gate-ssh-1.4.0', version: '1.4.0' }, credentialAccess: { privilege: 'USER' as const, secondFactorRequired: true },
            } : service),
          } : host),
        },
      },
    }
    const user = userEvent.setup()
    render(<GameProvider initialState={observed}><Network /></GameProvider>)
    await navigateToServices(user)
    expect(screen.getByText('GateSSH 1.3.2')).toBeInTheDocument()
    expect(screen.getByText('Authentication: Credential')).toBeInTheDocument()
    expect(screen.queryByText(/1\.4\.0|Additional Verification/)).not.toBeInTheDocument()
  })

  it('presents a fingerprinted Service with second-factor authentication in a structured card rather than one crowded row', async () => {
    const base = discoveredState()
    const observed = {
      ...base,
      discovery: {
        ...base.discovery,
        devices: base.discovery.devices.map((device) => device.id === 'host-lan-001' ? {
          ...device,
          services: device.services.map((service) => service.id === 'service-ssh-001' ? {
            ...service, inspect: { implementation: { name: 'GateSSH', version: '1.3.2' }, authentication: 'Credential + Additional Verification' as const },
          } : service),
        } : device),
      },
    }
    const user = userEvent.setup()
    render(<GameProvider initialState={observed}><Network /></GameProvider>)
    await navigateToServices(user)
    const serviceButton = screen.getByRole('button', { name: 'Open SSH service' })
    const mainRow = serviceButton.querySelector('.service-row-main')
    expect(mainRow?.textContent).not.toMatch(/GateSSH|Authentication/)
    const fingerprint = serviceButton.querySelector('.service-row-fingerprint')
    expect(fingerprint).not.toBeNull()
    expect(fingerprint?.textContent).toContain('GateSSH 1.3.2')
    expect(screen.getByText('Authentication: Credential + Additional Verification')).toBeInTheDocument()
    expect(serviceButton.querySelector('.service-row-secondary')?.textContent).toContain('Not analyzed')
  })

  it('offers no Inspect action for NodeScan 1.0 Standard while preserving Scan', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={discoveredState()}><Network /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: 'Open known area home-net' }))
    await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
    expect(screen.queryByRole('button', { name: /INSPECT/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Scan device 198.51.100.47' })).toBeInTheDocument()
    expect(screen.queryByText('FIRMWARE')).not.toBeInTheDocument()
    expect(screen.queryByText('COMPUTE')).not.toBeInTheDocument()
  })

  it('opens a Known Space area without scanning', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={discoveredState()}><Network /></GameProvider>)
    scanTargetSpy.mockClear()
    await user.click(await screen.findByRole('button', { name: 'Open known area home-net' }))
    expect(scanTargetSpy).not.toHaveBeenCalled()
  })

  it('executes graphical Scan through the application operation without reading World', async () => {
    const base = createInitialGameState()
    const stateWithoutReadableWorld = Object.defineProperty({ ...base, discovery: discoveredState().discovery }, 'world', {
      get: () => { throw new Error('Scan UI read hidden World') },
    }) as GameState
    const scanTarget = vi.fn(async (input: string) => input === base.player.localDevice.network.ip
      ? { status: 'device' as const, targetId: base.player.localDevice.id, address: input, scope: 'self' as const, networks: [{ id: 'network-home-v0', name: 'home-net' }], services: [] }
      : { status: 'network' as const, networkId: 'network-home-v0', networkName: input, devices: [] })
    vi.spyOn(GameContext, 'useGameState').mockReturnValue(stateWithoutReadableWorld)
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue({
      scanTarget,
      inspectTarget: vi.fn(),
      startServiceAnalysis: vi.fn(),
      startServiceAnalysisAtEndpoint: vi.fn(),
      startServiceAnalysisFromObservation: vi.fn(),
      startCredentialAccessAttemptFromObservation: vi.fn(),
      connectRemoteFromObservation: vi.fn(), disconnectRemoteSession: vi.fn(), startRemoteFileDownload: vi.fn(), installLocalSoftwarePackage: vi.fn(), removeInstalledSoftware: vi.fn(), clearRecentActivity: vi.fn(), removeRecentActivity: vi.fn(), cancelFileTransfer: vi.fn(), runNodeMiner: vi.fn(), stopNodeMiner: vi.fn(),
    })

    const user = userEvent.setup()
    render(<Network />)
    expect(scanTarget).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Open known area home-net' }))
    expect(scanTarget).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Scan network home-net' }))
    expect(scanTarget).toHaveBeenCalledOnce()
    expect(scanTarget).toHaveBeenCalledWith('home-net')
    await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
    expect(screen.getByText('1 known')).toBeInTheDocument()
    expect(screen.getAllByText('home-net')).not.toHaveLength(0)
    expect(document.body).not.toHaveTextContent(/network-local-001|host-lan-001/)
  })

  it('ignores an older rescan result after a newer device observation resolves', async () => {
    const state = createInitialGameState()
    const targets = { localDevice: state.player.localDevice, network: state.world.network }
    const oldNetwork = deferred<ReturnType<typeof scanNetworkTarget>>()
    const newerDevice = deferred<ReturnType<typeof scanNetworkTarget>>()
    let delayNetwork = false
    const scanTarget = vi.fn(async (input: string) => {
      if (delayNetwork && input === 'home-net') return oldNetwork.promise
      if (input === '198.51.100.47') return newerDevice.promise
      return scanNetworkTarget(targets, input)
    })
    vi.spyOn(GameContext, 'useGameState').mockReturnValue(withDiscovery(state))
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue({ scanTarget, inspectTarget: vi.fn(), startServiceAnalysis: vi.fn(), startServiceAnalysisAtEndpoint: vi.fn(), startServiceAnalysisFromObservation: vi.fn(), startCredentialAccessAttemptFromObservation: vi.fn(), connectRemoteFromObservation: vi.fn(), disconnectRemoteSession: vi.fn(), startRemoteFileDownload: vi.fn(), installLocalSoftwarePackage: vi.fn(), removeInstalledSoftware: vi.fn(), clearRecentActivity: vi.fn(), removeRecentActivity: vi.fn(), cancelFileTransfer: vi.fn(), runNodeMiner: vi.fn(), stopNodeMiner: vi.fn() })
    const user = userEvent.setup()
    render(<Network />)
    await user.click(await screen.findByRole('button', { name: 'Open known area home-net' }))
    delayNetwork = true
    await user.click(screen.getByRole('button', { name: 'Scan network home-net' }))
    await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
    await act(async () => newerDevice.resolve(scanNetworkTarget(targets, '198.51.100.47')))
    expect(await screen.findByRole('button', { name: 'Open SSH service' })).toBeInTheDocument()
    await act(async () => oldNetwork.resolve({ status: 'network', networkId: 'network-home-v0', networkName: 'home-net', devices: [] }))
    expect(screen.getByRole('button', { name: 'Open SSH service' })).toBeInTheDocument()
  })

  it('invalidates a pending device observation when navigating Back', async () => {
    const state = createInitialGameState()
    const targets = { localDevice: state.player.localDevice, network: state.world.network }
    const device = deferred<ReturnType<typeof scanNetworkTarget>>()
    const scanTarget = vi.fn(async (input: string) => input === '198.51.100.47' ? device.promise : scanNetworkTarget(targets, input))
    vi.spyOn(GameContext, 'useGameState').mockReturnValue(withDiscovery(state))
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue({ scanTarget, inspectTarget: vi.fn(), startServiceAnalysis: vi.fn(), startServiceAnalysisAtEndpoint: vi.fn(), startServiceAnalysisFromObservation: vi.fn(), startCredentialAccessAttemptFromObservation: vi.fn(), connectRemoteFromObservation: vi.fn(), disconnectRemoteSession: vi.fn(), startRemoteFileDownload: vi.fn(), installLocalSoftwarePackage: vi.fn(), removeInstalledSoftware: vi.fn(), clearRecentActivity: vi.fn(), removeRecentActivity: vi.fn(), cancelFileTransfer: vi.fn(), runNodeMiner: vi.fn(), stopNodeMiner: vi.fn() })
    const user = userEvent.setup()
    render(<Network />)
    await user.click(await screen.findByRole('button', { name: 'Open known area home-net' }))
    await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
    await user.click(screen.getByRole('button', { name: 'Scan device 198.51.100.47' }))
    await user.click(screen.getByRole('button', { name: '← home-net' }))
    await user.click(screen.getByRole('button', { name: '← Known Space' }))
    await act(async () => device.resolve(scanNetworkTarget(targets, '198.51.100.47')))
    expect(screen.getByRole('heading', { name: 'KNOWN SPACE' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open SSH service' })).not.toBeInTheDocument()
  })

  it('deduplicates rapid requests for the same pending device', async () => {
    const state = createInitialGameState()
    const targets = { localDevice: state.player.localDevice, network: state.world.network }
    const device = deferred<ReturnType<typeof scanNetworkTarget>>()
    const scanTarget = vi.fn(async (input: string) => input === '198.51.100.47' ? device.promise : scanNetworkTarget(targets, input))
    vi.spyOn(GameContext, 'useGameState').mockReturnValue(withDiscovery(state))
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue({ scanTarget, inspectTarget: vi.fn(), startServiceAnalysis: vi.fn(), startServiceAnalysisAtEndpoint: vi.fn(), startServiceAnalysisFromObservation: vi.fn(), startCredentialAccessAttemptFromObservation: vi.fn(), connectRemoteFromObservation: vi.fn(), disconnectRemoteSession: vi.fn(), startRemoteFileDownload: vi.fn(), installLocalSoftwarePackage: vi.fn(), removeInstalledSoftware: vi.fn(), clearRecentActivity: vi.fn(), removeRecentActivity: vi.fn(), cancelFileTransfer: vi.fn(), runNodeMiner: vi.fn(), stopNodeMiner: vi.fn() })
    const user = userEvent.setup()
    render(<Network />)
    await user.click(await screen.findByRole('button', { name: 'Open known area home-net' }))
    scanTarget.mockClear()
    await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
    const scanDevice = screen.getByRole('button', { name: 'Scan device 198.51.100.47' })
    fireEvent.click(scanDevice)
    fireEvent.click(scanDevice)
    expect(scanTarget).toHaveBeenCalledOnce()
    await act(async () => device.resolve(scanNetworkTarget(targets, '198.51.100.47')))
  })

  it('copies device addresses and complete endpoints', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const user = await openLanDevice()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await user.click(screen.getByRole('button', { name: 'Copy 198.51.100.47' }))
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    await user.click(screen.getByRole('button', { name: 'Copy 198.51.100.47:22' }))
    expect(writeText).toHaveBeenNthCalledWith(1, '198.51.100.47')
    expect(writeText).toHaveBeenNthCalledWith(2, '198.51.100.47:22')
  })

  it('navigates locally from Service to Device to Network to Known Space', async () => {
    const user = await openLanDevice()
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    expect(screen.getByRole('heading', { name: 'SSH' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← 198.51.100.47' }))
    expect(screen.getByText('2 known services')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← home-net' }))
    expect(screen.getByText('3 known devices')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← Known Space' }))
    expect(await screen.findByRole('button', { name: 'Open known area home-net' })).toBeInTheDocument()
  })

  it('starts concrete analyses and presents canonical running state', async () => {
    const user = await openLanDevice()
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    const analyze = screen.getByRole('button', { name: 'Analyze' })
    await user.click(analyze)
    expect(screen.getByText('ANALYSIS RUNNING')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Analyze' })).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    await waitFor(() => expect(Number(screen.getByRole('progressbar').getAttribute('value'))).toBeGreaterThan(0), { timeout: 1500 })
  })

  it('binds Analyze to the observed endpoint and never silently retargets a stale card', async () => {
    let canonical = createInitialGameState()
    const endpointAction = vi.fn((observed: { endpoint: string; targetDeviceId: string; serviceId: string }) => {
      const result = startServiceAnalysisFromObservation(canonical, observed)
      if (result.status === 'started') canonical = result.state
      return result
    })
    vi.spyOn(GameContext, 'useGameState').mockImplementation(() => withDiscovery(canonical))
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue({
      inspectTarget: vi.fn(), scanTarget: async (input) => scanNetworkTarget({ localDevice: canonical.player.localDevice, network: canonical.world.network }, input), startServiceAnalysis: vi.fn(), startServiceAnalysisAtEndpoint: vi.fn(), startServiceAnalysisFromObservation: endpointAction, startCredentialAccessAttemptFromObservation: vi.fn(), connectRemoteFromObservation: vi.fn(), disconnectRemoteSession: vi.fn(), startRemoteFileDownload: vi.fn(), installLocalSoftwarePackage: vi.fn(), removeInstalledSoftware: vi.fn(), clearRecentActivity: vi.fn(), removeRecentActivity: vi.fn(), cancelFileTransfer: vi.fn(), runNodeMiner: vi.fn(), stopNodeMiner: vi.fn(),
    })
    const user = userEvent.setup(); const view = render(<Network />)
    await navigateToServices(user)
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    const host = canonical.world.network.hosts[0]
    const movedServices = host.services?.map((service) => service.id === 'service-ssh-001' ? { ...service, port: 2222 } : service) ?? []
    canonical = {
      ...canonical,
      world: { network: { ...canonical.world.network, hosts: [{ ...host, services: [...movedServices, { id: 'service-replacement', name: 'REPLACEMENT', port: 22, protocol: 'TCP', open: true, implementation: { productId: 'replacement', releaseId: 'replacement-1.0', name: 'Replacement', version: '1.0' } }] }, ...canonical.world.network.hosts.slice(1)] } },
      process: { nextId: 3, processes: [
        { kind: 'service_analysis', id: 'process-0001', label: 'SERVICE ANALYSIS', executorDeviceId: 'device-local-v0', status: 'running', workRequired: 1000, workCompleted: 400, ramRequiredMiB: 768, targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', startedEndpoint: '198.51.100.47:2222' },
        { kind: 'service_analysis', id: 'process-0002', label: 'SERVICE ANALYSIS', executorDeviceId: 'device-local-v0', status: 'completed', workRequired: 1000, workCompleted: 1000, ramRequiredMiB: 768, targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', startedEndpoint: '198.51.100.47:2222', result: { status: 'weaknesses_detected', vulnerabilities: [] } },
      ] },
      knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'known-ssh', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', observedLabel: 'Historical SSH weakness' }] },
    }
    view.rerender(<Network />)
    expect(screen.queryByText('ANALYSIS RUNNING')).not.toBeInTheDocument()
    expect(screen.queryByText('LAST ANALYSIS')).not.toBeInTheDocument()
    expect(screen.getByText('Historical SSH weakness')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Analyze' }))
    expect(endpointAction).toHaveBeenCalledWith({ endpoint: '198.51.100.47:22', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001' })
    expect(canonical.process.processes).toHaveLength(2)
    expect(screen.getByText('ENDPOINT NOT AVAILABLE')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.47:22')).toBeInTheDocument()
    expect(screen.queryByText('198.51.100.47:2222')).not.toBeInTheDocument()
  })

  it('runs SSH and HTTP concurrently through canonical Process state', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={discoveredState()}><Network /><StateSnapshot /></GameProvider>)
    await navigateToServices(user)
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    await user.click(screen.getByRole('button', { name: 'Analyze' }))
    await user.click(screen.getByRole('button', { name: '← 198.51.100.47' }))
    expect(screen.getByText(/ANALYSIS RUNNING/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open HTTP service' }))
    await user.click(screen.getByRole('button', { name: 'Analyze' }))
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(state.process.processes).toMatchObject([{ status: 'running', serviceId: 'service-ssh-001' }, { status: 'running', serviceId: 'service-http-001' }])
  })

  it('presents the empty Finding state before analysis produces a result', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={discoveredState()}><Network /><StateSnapshot /></GameProvider>)
    await navigateToServices(user)
    await user.click(screen.getByRole('button', { name: 'Open HTTP service' }))
    expect(screen.getByText('No known weakness recorded')).toBeInTheDocument()
    expect(screen.queryByText('No weakness detected')).not.toBeInTheDocument()
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(state.knowledge.discoveredVulnerabilities.filter(({ serviceId }) => serviceId === 'service-http-001')).toEqual([])
  })

  it('presents positive SSH Knowledge and precise historical HTTP completion', async () => {
    const base = createInitialGameState()
    const ssh = startServiceAnalysisAtEndpoint(base, '198.51.100.47:22'); if (ssh.status !== 'started') throw Error(ssh.status)
    const http = startServiceAnalysisAtEndpoint(ssh.state, '198.51.100.47:80'); if (http.status !== 'started') throw Error(http.status)
    const completed = advanceGameState(http.state, 30_000)
    const user = userEvent.setup()
    render(<GameProvider initialState={withDiscovery(completed)}><Network /><StateSnapshot /></GameProvider>)
    await navigateToServices(user)
    expect(screen.getByText('Weakness known')).toBeInTheDocument()
    expect(screen.getByText('Analysis complete')).toBeInTheDocument()
    expect(screen.queryByText('Weak authentication configuration')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    expect(screen.getByText('Weak authentication configuration')).toBeInTheDocument()
    expect(screen.queryByText('LAST ANALYSIS')).not.toBeInTheDocument()
    expect(screen.queryByText('Weakness detected')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyze again' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← 198.51.100.47' }))
    await user.click(screen.getByRole('button', { name: 'Open HTTP service' }))
    expect(screen.getByText('No weakness detected')).toBeInTheDocument()
    expect(screen.queryByText('No known weakness recorded')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\bSAFE\b|\bSECURE\b/)
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(state.knowledge.discoveredVulnerabilities.filter(({ serviceId }) => serviceId === 'service-http-001')).toEqual([])
    expect(screen.getByRole('button', { name: 'Analyze again' })).toBeInTheDocument()
  })

  it('retains a Finding alongside a later non-redundant no-weakness result', async () => {
    const first = startServiceAnalysisAtEndpoint(createInitialGameState(), '198.51.100.47:22'); if (first.status !== 'started') throw Error(first.status)
    const learned = advanceGameState(first.state, 20_000)
    const host = learned.world.network.hosts[0]
    const changed = { ...learned, world: { network: { ...learned.world.network, hosts: [{ ...host, services: host.services?.map((service) => service.id === 'service-ssh-001' ? { ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.4.0', name: 'GateSSH', version: '1.4.0' } } : service) }, ...learned.world.network.hosts.slice(1)] } } }
    const second = startServiceAnalysisAtEndpoint(changed, '198.51.100.47:22'); if (second.status !== 'started') throw Error(second.status)
    const completed = advanceGameState(second.state, 20_000)
    const user = userEvent.setup()
    render(<GameProvider initialState={withDiscovery(completed)}><Network /></GameProvider>)
    await navigateToServices(user)
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    expect(screen.getByText('Weak authentication configuration')).toBeInTheDocument()
    expect(screen.getByText('No weakness detected')).toBeInTheDocument()
    expect(screen.queryByText('LAST ANALYSIS')).not.toBeInTheDocument()
    expect(screen.queryByText('Weakness detected')).not.toBeInTheDocument()
  })

  it('clears completed history without clearing Knowledge and permits monotonic re-analysis', async () => {
    const started = startServiceAnalysisAtEndpoint(createInitialGameState(), '198.51.100.47:22'); if (started.status !== 'started') throw Error(started.status)
    const completed = advanceGameState(started.state, 20_000)
    const user = userEvent.setup()
    render(<GameProvider initialState={withDiscovery(completed)}><Network /><ClearCompleted /><StateSnapshot /></GameProvider>)
    await navigateToServices(user)
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    expect(screen.getByText('Weak authentication configuration')).toBeInTheDocument()
    expect(screen.queryByText('Weakness detected')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear test history' }))
    expect(screen.queryByText('Weakness detected')).not.toBeInTheDocument()
    expect(screen.getByText('Weak authentication configuration')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Analyze' }))
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(state.process.processes[0]).toMatchObject({ id: 'process-0002', status: 'running', serviceId: 'service-ssh-001' })
  })

  it('uses retained Knowledge even if current vulnerability truth has changed', async () => {
    const base = createInitialGameState()
    const host = base.world.network.hosts.find((candidate) => candidate.ip === '198.51.100.47')!
    const ssh = host.services![0]
    const state = {
      ...base,
      world: { network: { ...base.world.network, hosts: base.world.network.hosts.map((candidate) => candidate.id === host.id ? { ...candidate, services: candidate.services?.map((service) => service.id === ssh.id ? { ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.4.0', name: 'GateSSH', version: '1.4.0' } } : service) } : candidate) } },
      knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'historical', targetDeviceId: host.id, serviceId: ssh.id, observedLabel: 'Weak authentication configuration' }] },
    }
    const user = userEvent.setup()
    render(<GameProvider initialState={withDiscovery(state)}><Network /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: 'Open known area home-net' }))
    await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
    expect(screen.getByText('Weakness known')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    expect(screen.getByText('Weak authentication configuration')).toBeInTheDocument()
  })

  it('reports canonical memory contention locally', async () => {
    const state = createInitialGameState()
    const constrained = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, hardware: { ...state.player.localDevice.hardware, ram: { ...state.player.localDevice.hardware.ram, capacityMiB: 700 } } } } }
    const user = userEvent.setup()
    render(<GameProvider initialState={withDiscovery(constrained)}><Network /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: 'Open known area home-net' }))
    await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))
    expect(screen.getByText(/INSUFFICIENT MEMORY/)).toBeInTheDocument()
  })

  it('does not display stale start feedback beside canonical running state', async () => {
    const base = createInitialGameState()
    let canonical: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, hardware: { ...base.player.localDevice.hardware, ram: { ...base.player.localDevice.hardware.ram, capacityMiB: 700 } } } } }
    const endpointAction = vi.fn((observed: { endpoint: string; targetDeviceId: string; serviceId: string }) => startServiceAnalysisFromObservation(canonical, observed))
    vi.spyOn(GameContext, 'useGameState').mockImplementation(() => withDiscovery(canonical))
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue({ inspectTarget: vi.fn(), scanTarget: async (input) => scanNetworkTarget({ localDevice: canonical.player.localDevice, network: canonical.world.network }, input), startServiceAnalysis: vi.fn(), startServiceAnalysisAtEndpoint: vi.fn(), startServiceAnalysisFromObservation: endpointAction, startCredentialAccessAttemptFromObservation: vi.fn(), connectRemoteFromObservation: vi.fn(), disconnectRemoteSession: vi.fn(), startRemoteFileDownload: vi.fn(), installLocalSoftwarePackage: vi.fn(), removeInstalledSoftware: vi.fn(), clearRecentActivity: vi.fn(), removeRecentActivity: vi.fn(), cancelFileTransfer: vi.fn(), runNodeMiner: vi.fn(), stopNodeMiner: vi.fn() })
    const user = userEvent.setup(); const view = render(<Network />)
    await navigateToServices(user)
    await user.click(screen.getByRole('button', { name: 'Open SSH service' }))
    await user.click(screen.getByRole('button', { name: 'Analyze' }))
    expect(screen.getByText(/INSUFFICIENT MEMORY/)).toBeInTheDocument()
    const running = startServiceAnalysisAtEndpoint(base, '198.51.100.47:22'); if (running.status !== 'started') throw Error(running.status)
    canonical = running.state; view.rerender(<Network />)
    expect(screen.getByText('ANALYSIS RUNNING')).toBeInTheDocument()
    expect(screen.queryByText(/INSUFFICIENT MEMORY/)).not.toBeInTheDocument()
  })
})
