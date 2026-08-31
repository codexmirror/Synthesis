import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { inspectKnownTarget } from './inspect'
import { rememberInspect, rememberScan } from './discovery'
import { scanNetworkTarget } from './scan'
import { startRackUpdateExploitAttemptFromObservation, startRackUpdatePackageSubmission } from './rackUpdate'
import { advanceGameState } from './gameAdvancement'
import { interruptLocalNetworkConnectivity } from './networkConnectivity'
import { GATE_SSH_1_3_2_BUILD_ID, vulnerabilitiesForService } from './serviceImplementations'
import { FLIPPER_1_0_CANONICAL_INSTALLATION, FLIPPER_PRODUCT_ID, ROLLBACK_MODULE_1_0 } from './flipper'
import { FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID } from './softwareReleaseContent'
import type { FlipperInstallation, GameState, NetworkHost } from './types'

const REMOTE_SEGMENT = 'network-foreign-001'
const PHONE = 'host-phone-001'
const SRV_02 = 'host-lan-002'
const RACK_UPDATE_ENDPOINT = { targetDeviceId: SRV_02, serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443' }
const UPD_001_OBSERVATION = { ...RACK_UPDATE_ENDPOINT, vulnerabilityId: 'UPD-001' } as const

function host(state: GameState, id: string): NetworkHost {
  return state.world.network.hosts.find((candidate) => candidate.id === id)!
}

function advanceUntil(state: GameState, predicate: (state: GameState) => boolean, stepMs = 250, maxSteps = 200): GameState {
  let current = state
  for (let step = 0; step < maxSteps; step += 1) {
    if (predicate(current)) return current
    current = advanceGameState(current, stepMs)
  }
  if (!predicate(current)) throw new Error('advanceUntil exhausted its step budget without satisfying the predicate')
  return current
}

/** The same "reach srv-02's RackUpdate submission capability" setup `rackUpdate.test.ts` uses, reproduced here so this regression owns a fully self-contained chain from RackUpdate submission through the real boot boundary. */
function readyToSubmit(): GameState {
  let state = createInitialGameState()
  const targets = () => ({ localDevice: state.player.localDevice, network: state.world.network })
  state = { ...state, discovery: rememberScan(state.discovery, scanNetworkTarget(targets(), '203.0.113.42'), state.player.localDevice.id) }
  state = { ...state, discovery: rememberInspect(state.discovery, inspectKnownTarget(targets(), state.discovery, '203.0.113.42', 'enhanced'), state.player.localDevice.id) }
  state = { ...state, knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'UPD-001', observedLabel: 'Rollback protection not enforced', targetDeviceId: SRV_02, serviceId: 'service-rack-update-002' }] } }
  const remotePackage = state.world.network.hosts.find(({ id }) => id === 'host-lan-001')!.filesystem!.files.find(({ id }) => id === 'file-0003')!
  state = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: [...state.player.localDevice.filesystem.files, { ...remotePackage, id: 'file-local-gatessh', path: '/home/user/downloads/gatessh-1.3.2.pkg' }] } } } }
  const integrated: FlipperInstallation = {
    ...FLIPPER_1_0_CANONICAL_INSTALLATION,
    buildId: FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID,
    integratedModules: ['credential-access', 'rollback'],
    sizeBytes: FLIPPER_1_0_CANONICAL_INSTALLATION.sizeBytes + ROLLBACK_MODULE_1_0.sizeBytes,
  }
  state = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: [...state.player.localDevice.installedSoftware.filter((software) => software.id !== FLIPPER_PRODUCT_ID), integrated] } } }
  return state
}

function withPendingGateSsh132(): GameState {
  const started = startRackUpdateExploitAttemptFromObservation(readyToSubmit(), UPD_001_OBSERVATION)
  if (started.status !== 'started') throw new Error(started.status)
  const granted = advanceGameState(started.state, 20_000)
  const submitted = startRackUpdatePackageSubmission(granted, { ...RACK_UPDATE_ENDPOINT, localFileId: 'file-local-gatessh' })
  if (submitted.status !== 'started') throw new Error(submitted.status)
  return advanceGameState(submitted.state, 20_000)
}

describe('composition regression: RackUpdate submission through connectivity loss to real boot activation', () => {
  it('activates pending GateSSH 1.3.2 through independent Petra reconnect, independent srv-02 reboot, and the real boot boundary', () => {
    const pendingState = withPendingGateSsh132()
    expect(host(pendingState, SRV_02).pendingGateSshActivation).toMatchObject({ releaseId: 'gate-ssh-1.3.2' })
    const activeBeforeInterruption = host(pendingState, SRV_02).services!.find(({ id }) => id === 'service-ssh-002')!
    expect(activeBeforeInterruption.implementation.releaseId).toBe('gate-ssh-1.3.3')

    const interrupted = interruptLocalNetworkConnectivity(pendingState, REMOTE_SEGMENT)
    expect(host(interrupted, PHONE).operational.connectivity).toBe('DISCONNECTED')
    expect(host(interrupted, SRV_02).operational.connectivity).toBe('DISCONNECTED')

    // Petra independently reconnects without ever leaving RUNNING.
    const phoneRecovered = advanceUntil(interrupted, (s) => host(s, PHONE).operational.connectivity === 'CONNECTED')
    expect(host(phoneRecovered, PHONE).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })

    // srv-02 independently reboots through the real boot boundary.
    const rebooted = advanceUntil(phoneRecovered, (s) => host(s, SRV_02).operational.connectivity === 'CONNECTED')
    expect(host(rebooted, SRV_02).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })

    const activeAfterReboot = host(rebooted, SRV_02).services!.find(({ id }) => id === 'service-ssh-002')!
    expect(activeAfterReboot.implementation.releaseId).toBe('gate-ssh-1.3.2')
    expect(activeAfterReboot.implementation.buildId).toBe(GATE_SSH_1_3_2_BUILD_ID)
    expect(host(rebooted, SRV_02).installedSoftware!.find(({ id }) => id === 'gate-ssh')!.releaseId).toBe('gate-ssh-1.3.2')
    expect(host(rebooted, SRV_02).pendingGateSshActivation).toBeUndefined()
    // AUTH-017 derives naturally from active Service World Truth; it is never explicitly set.
    expect(vulnerabilitiesForService(activeAfterReboot)).toEqual([{ id: 'AUTH-017', label: 'Weak authentication configuration' }])
  })

  it('proves the identical srv-02 connectivity-loss/reboot path with no pending software: active GateSSH stays untouched', () => {
    const state = createInitialGameState()
    expect(host(state, SRV_02).pendingGateSshActivation).toBeUndefined()
    const interrupted = interruptLocalNetworkConnectivity(state, REMOTE_SEGMENT)
    const rebooted = advanceUntil(interrupted, (s) => host(s, SRV_02).operational.connectivity === 'CONNECTED')

    expect(host(rebooted, SRV_02).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    const managed = host(rebooted, SRV_02).services!.find(({ id }) => id === 'service-ssh-002')!
    expect(managed.implementation.releaseId).toBe('gate-ssh-1.3.3')
    expect(host(rebooted, SRV_02).installedSoftware!.find(({ id }) => id === 'gate-ssh')!.releaseId).toBe('gate-ssh-1.3.3')
  })
})
