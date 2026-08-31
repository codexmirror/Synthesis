import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { inspectKnownTarget } from './inspect'
import { rememberInspect } from './discovery'
import { scanNetworkTarget } from './scan'
import { rememberScan } from './discovery'
import {
  cancelRackUpdatePackageSubmission,
  canFormRackUpdateExploitAttempt,
  startRackUpdateExploitAttemptFromObservation,
  startRackUpdatePackageSubmission,
} from './rackUpdate'
import { GATE_SSH_1_3_2_BUILD_ID, vulnerabilitiesForService } from './serviceImplementations'
import { startServiceAnalysisFromObservation } from './serviceAnalysis'
import { advanceGameState } from './gameAdvancement'
import { FLIPPER_1_0_CANONICAL_INSTALLATION, FLIPPER_PRODUCT_ID, ROLLBACK_MODULE_1_0 } from './flipper'
import { FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID } from './softwareReleaseContent'
import type { FlipperInstallation } from './types'
import type { GameState, NetworkHost, NetworkService } from './types'

const RACK_UPDATE_ENDPOINT = { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443' }
const UPD_001_OBSERVATION = { ...RACK_UPDATE_ENDPOINT, vulnerabilityId: 'UPD-001' } as const

function observed(): GameState {
  let state = createInitialGameState()
  const targets = () => ({ localDevice: state.player.localDevice, network: state.world.network })
  state = { ...state, discovery: rememberScan(state.discovery, scanNetworkTarget(targets(), '203.0.113.42'), state.player.localDevice.id) }
  state = { ...state, discovery: rememberInspect(state.discovery, inspectKnownTarget(targets(), state.discovery, '203.0.113.42', 'enhanced'), state.player.localDevice.id) }
  return state
}

function withUpd001Knowledge(state: GameState): GameState {
  return { ...state, knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'UPD-001', observedLabel: 'Rollback protection not enforced', targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002' }] } }
}

function withLocalGateSsh132(state: GameState): GameState {
  const remotePackage = state.world.network.hosts.find(({ id }) => id === 'host-lan-001')!.filesystem!.files.find(({ id }) => id === 'file-0003')!
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: [...state.player.localDevice.filesystem.files, { ...remotePackage, id: 'file-local-gatessh', path: '/home/user/downloads/gatessh-1.3.2.pkg' }] } } } }
}

/**
 * The Rollback Module is not integrated by default (the Market is its
 * represented acquisition path, and integration is real represented work), so
 * fixtures that need `UPD-001` support state the concrete Flipper build that
 * has it rather than relying on default Current Truth. The integration
 * mechanic itself is proven in `flipper.test.ts`.
 */
function withRollbackModuleIntegrated(state: GameState): GameState {
  const integrated: FlipperInstallation = {
    ...FLIPPER_1_0_CANONICAL_INSTALLATION,
    buildId: FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID,
    integratedModules: ['credential-access', 'rollback'],
    sizeBytes: FLIPPER_1_0_CANONICAL_INSTALLATION.sizeBytes + ROLLBACK_MODULE_1_0.sizeBytes,
  }
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: [...state.player.localDevice.installedSoftware.filter((software) => software.id !== FLIPPER_PRODUCT_ID), integrated] } } }
}

function ready(): GameState {
  return withRollbackModuleIntegrated(withLocalGateSsh132(withUpd001Knowledge(observed())))
}

function withStandaloneRollback(state: GameState): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice,
    installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== FLIPPER_PRODUCT_ID),
    filesystem: { ...state.player.localDevice.filesystem, files: [...state.player.localDevice.filesystem.files, { kind: 'software_module', id: 'file-rollback-module', path: '/home/user/modules/rollback.mod', ...ROLLBACK_MODULE_1_0 }] },
  } } }
}

function alterTarget(state: GameState, alter: (host: NetworkHost) => NetworkHost): GameState {
  return { ...state, world: { network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === 'host-lan-002' ? alter(host) : host) } } }
}
function alterService(state: GameState, id: string, alter: (service: NetworkService) => NetworkService): GameState {
  return alterTarget(state, (host) => ({ ...host, services: host.services!.map((service) => service.id === id ? alter(service) : service) }))
}
const alterUpdate = (state: GameState, alter: (service: NetworkService) => NetworkService) => alterService(state, 'service-rack-update-002', alter)
const alterSsh = (state: GameState, alter: (service: NetworkService) => NetworkService) => alterService(state, 'service-ssh-002', alter)

/** The default Flipper build: Credential Access integrated, Rollback not. */
function withoutTool(state: GameState): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.filter((software) => software.id !== FLIPPER_PRODUCT_ID) } } }
}

function grantSubmissionAccess(state: GameState) {
  const started = startRackUpdateExploitAttemptFromObservation(state, UPD_001_OBSERVATION)
  if (started.status !== 'started') throw new Error(started.status)
  return advanceGameState(started.state, 20_000)
}

describe('RackUpdate ATTACK: finite exploit work granting only narrow submission capability', () => {
  it('admits the exact standalone Rollback Module without Flipper and snapshots truthful provenance', () => {
    const state = withStandaloneRollback(withLocalGateSsh132(withUpd001Knowledge(observed())))
    expect(canFormRackUpdateExploitAttempt(state, UPD_001_OBSERVATION)).toBe(true)
    const started = startRackUpdateExploitAttemptFromObservation(state, UPD_001_OBSERVATION)
    expect(started.status).toBe('started')
    if (started.status === 'started') expect(started.state.process.processes.find(({ id }) => id === started.processId)).toMatchObject({ kind: 'rack_update_exploit', toolId: 'rollback-module', moduleId: 'rollback' })
  })

  it('rejects a standalone Rollback Module with an unsupported concrete build', () => {
    const state = withStandaloneRollback(withUpd001Knowledge(observed()))
    const unsupported = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: state.player.localDevice.filesystem.files.map((file) => file.id === 'file-rollback-module' && file.kind === 'software_module' ? { ...file, buildId: 'unsupported-build' } : file) } } } }
    expect(canFormRackUpdateExploitAttempt(unsupported, UPD_001_OBSERVATION)).toBe(false)
  })

  it('forms an attack opportunity only with earned Knowledge and the supporting installed tool', () => {
    const state = ready()
    expect(canFormRackUpdateExploitAttempt(state, UPD_001_OBSERVATION)).toBe(true)
    expect(canFormRackUpdateExploitAttempt(withoutTool(state), UPD_001_OBSERVATION)).toBe(false)
    expect(canFormRackUpdateExploitAttempt({ ...state, knowledge: { discoveredVulnerabilities: [] } }, UPD_001_OBSERVATION)).toBe(false)
  })

  it('never starts without the represented tool, leaving Knowledge untouched', () => {
    const state = withoutTool(ready())
    const result = startRackUpdateExploitAttemptFromObservation(state, UPD_001_OBSERVATION)
    expect(result).toEqual({ status: 'not_available', state })
  })

  it('is finite represented work rather than an immediate mutation', () => {
    const state = ready()
    const started = startRackUpdateExploitAttemptFromObservation(state, UPD_001_OBSERVATION)
    expect(started.status).toBe('started')
    if (started.status !== 'started') throw new Error(started.status)
    const process = started.state.process.processes.find(({ id }) => id === started.processId)!
    expect(process).toMatchObject({ kind: 'rack_update_exploit', status: 'running', targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002' })
    // No immediate consequence: no submission capability yet, no DeviceAccess, no RemoteSession.
    expect(started.state.rackUpdate.access.established).toEqual([])
    expect(started.state.deviceAccess.established).toEqual([])
    expect(started.state.remoteSession.active).toBeNull()
  })

  it('grants only the narrow submission relationship on success, never DeviceAccess or a RemoteSession', () => {
    const state = grantSubmissionAccess(ready())
    expect(state.rackUpdate.access.established).toEqual([
      { id: 'rack-update-access-0001', sourceDeviceId: 'device-local-v0', targetDeviceId: 'host-lan-002', viaServiceId: 'service-rack-update-002' },
    ])
    expect(state.deviceAccess.established).toEqual([])
    expect(state.remoteSession.active).toBeNull()
    const process = state.process.processes.find(({ kind }) => kind === 'rack_update_exploit')!
    expect(process).toMatchObject({ status: 'completed', result: { status: 'submission_enabled', accessId: 'rack-update-access-0001' } })
  })

  it('rejects a repeated attempt once submission is already enabled, without granting a duplicate', () => {
    const state = grantSubmissionAccess(ready())
    const result = startRackUpdateExploitAttemptFromObservation(state, UPD_001_OBSERVATION)
    expect(result).toEqual({ status: 'submission_enabled', state })
  })

  it('re-validates current world truth at completion and fails without granting anything if RackUpdate changed underneath', () => {
    const state = ready()
    const started = startRackUpdateExploitAttemptFromObservation(state, UPD_001_OBSERVATION)
    if (started.status !== 'started') throw new Error(started.status)
    const changed = alterUpdate(started.state, (service) => ({ ...service, open: false }))
    const done = advanceGameState(changed, 20_000)
    const process = done.process.processes.find(({ kind }) => kind === 'rack_update_exploit')!
    expect(process).toMatchObject({ status: 'completed', result: { status: 'attempt_failed', message: 'Exploit attempt failed.' } })
    expect(done.rackUpdate.access.established).toEqual([])
  })

  it('offers no attack opportunity once submission is already enabled', () => {
    const state = grantSubmissionAccess(ready())
    expect(canFormRackUpdateExploitAttempt(state, UPD_001_OBSERVATION)).toBe(false)
  })
})

describe('RackUpdate package submission: represented upload work, not an instant mutation', () => {
  it('requires the narrow submission capability a successful exploit granted', () => {
    const state = ready()
    const result = startRackUpdatePackageSubmission(state, { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh' })
    expect(result).toEqual({ status: 'access_required', state })
  })

  it('requires stable observed service identity and rejects an incompatible package without starting anything', () => {
    const state = grantSubmissionAccess(ready())
    const base = { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443' }
    expect(startRackUpdatePackageSubmission(state, { ...base, localFileId: 'missing' })).toEqual({ status: 'package_unavailable', state })
    expect(startRackUpdatePackageSubmission(state, { ...base, serviceId: 'wrong', localFileId: 'file-local-gatessh' })).toEqual({ status: 'observation_required', state })
    expect(startRackUpdatePackageSubmission(state, { ...base, localFileId: 'file-0002' })).toEqual({ status: 'package_incompatible', state })
    expect(state.rackUpdate.submission.active).toBeNull()
  })

  it('admits finite upload work carrying the package bytes, not an instant mutation', () => {
    const state = grantSubmissionAccess(ready())
    const before = state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.services!.find(({ id }) => id === 'service-ssh-002')!
    const result = startRackUpdatePackageSubmission(state, { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh' })
    expect(result.status).toBe('started')
    if (result.status !== 'started') throw new Error(result.status)
    expect(result.state.rackUpdate.submission.active).toMatchObject({ id: result.submissionId, sourceFileId: 'file-local-gatessh', targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', bytesTransferred: 0, bytesTotal: 6_400_000 })
    // Nothing accepted yet: active software, the managed Service, pending state, filesystem, and Discovery are untouched at admission.
    const after = result.state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.services!.find(({ id }) => id === 'service-ssh-002')!
    expect(after).toEqual(before)
    expect(result.state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.pendingGateSshActivation).toBeUndefined()
    expect(result.state.discovery).toEqual(state.discovery)
  })

  it('rejects a second concurrent submission while one is already active', () => {
    const state = grantSubmissionAccess(ready())
    const first = startRackUpdatePackageSubmission(state, { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh' })
    if (first.status !== 'started') throw new Error(first.status)
    const second = startRackUpdatePackageSubmission(first.state, { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh' })
    expect(second).toEqual({ status: 'submission_in_progress', state: first.state })
  })

  it('admits a same-release GateSSH package when its concrete build differs from the running build', () => {
    const state = grantSubmissionAccess(ready())
    const changed = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: {
      ...state.player.localDevice.filesystem,
      files: state.player.localDevice.filesystem.files.map((file) => file.id === 'file-local-gatessh' && file.kind === 'software_package'
        ? { ...file, releaseId: 'gate-ssh-1.3.3', buildId: 'build-gate-ssh-synthetic-alternate', version: '1.3.3' }
        : file),
    } } } }
    expect(startRackUpdatePackageSubmission(changed, { ...RACK_UPDATE_ENDPOINT, localFileId: 'file-local-gatessh' })).toMatchObject({ status: 'started' })
  })

  it('supports accepting a compatible newer release as pending, not only an older one', () => {
    // The mechanism is not hardcoded to exactly 1.3.2 replacing exactly 1.3.3: any recognized
    // GateSSH release differing from the currently managed one is a valid submission.
    const state = grantSubmissionAccess(withRollbackModuleIntegrated(withUpd001Knowledge(observed())))
    const remotePackage = state.world.network.hosts.find(({ id }) => id === 'host-lan-001')!.filesystem!.files.find(({ id }) => id === 'file-0003')!
    if (remotePackage.kind !== 'software_package') throw new Error('expected GateSSH package fixture')
    const newerPackage = { ...remotePackage, id: 'file-local-newer', path: '/home/user/downloads/gatessh-1.4.0.pkg', releaseId: 'gate-ssh-1.4.0', version: '1.4.0' }
    const withNewerPackage = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: [...state.player.localDevice.filesystem.files, newerPackage] } } } }
    const started = startRackUpdatePackageSubmission(withNewerPackage, { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-newer' })
    expect(started.status).toBe('started')
    if (started.status !== 'started') throw new Error(started.status)
    const done = advanceGameState(started.state, 20_000)
    const target = done.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    expect(target.pendingGateSshActivation).toMatchObject({ id: 'gate-ssh', releaseId: 'gate-ssh-1.4.0', buildId: newerPackage.buildId, name: 'GateSSH', version: '1.4.0' })
    expect(target.services!.find(({ id }) => id === 'service-ssh-002')!.implementation.releaseId).toBe('gate-ssh-1.3.3')
  })

  function submit(state: GameState) {
    const started = startRackUpdatePackageSubmission(state, { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh' })
    if (started.status !== 'started') throw new Error(started.status)
    return started.state
  }

  it('progresses over elapsed time and completes with exact pending software while active truth remains unchanged', () => {
    let state = submit(grantSubmissionAccess(ready()))
    const submissionId = state.rackUpdate.submission.active!.id
    // node-01 (home-net) -> srv-02 (remote-segment-01) is the represented cross-Network route: min(1 MiB/s upload, 16 MiB/s home-net, 8 MiB/s remote-segment-01, 1 MiB/s srv-02 download) = 1 MiB/s.
    state = advanceGameState(state, 1000)
    expect(state.rackUpdate.submission.active).toMatchObject({ id: submissionId, bytesTransferred: 1_048_576 })
    const managedMidway = state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.services!.find(({ id }) => id === 'service-ssh-002')!
    expect(managedMidway.implementation.releaseId).toBe('gate-ssh-1.3.3')
    expect(state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.installedSoftware!.find(({ id }) => id === 'gate-ssh')!.releaseId).toBe('gate-ssh-1.3.3')

    state = advanceGameState(state, 20_000)
    expect(state.rackUpdate.submission.active).toBeNull()
    const target = state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    const managed = target.services!.find(({ id }) => id === 'service-ssh-002')!
    expect(target.pendingGateSshActivation).toEqual({ id: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID, name: 'GateSSH', version: '1.3.2', channel: 'stable', publisher: 'rack-systems' })
    expect(managed.implementation).toMatchObject({ releaseId: 'gate-ssh-1.3.3', version: '1.3.3' })
    expect(target.installedSoftware!.find(({ id }) => id === 'gate-ssh')).toMatchObject({ releaseId: 'gate-ssh-1.3.3', version: '1.3.3' })
    expect(vulnerabilitiesForService(managed)).toEqual([])
    expect(state.rackUpdate.submission.outcome).toEqual({ targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', result: 'package_accepted_reboot_required' })
    // No access, session, or filesystem consequence anywhere.
    expect(state.deviceAccess.established).toEqual([])
    expect(state.remoteSession.active).toBeNull()
    expect(state.player.localDevice.filesystem.files.some(({ id }) => id === 'file-local-gatessh')).toBe(true)
    expect(state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.filesystem).toEqual(grantSubmissionAccess(ready()).world.network.hosts.find(({ id }) => id === 'host-lan-002')!.filesystem)
  })

  it('does not rewrite remembered implementation evidence to the pending release', () => {
    let state = submit(grantSubmissionAccess(ready()))
    const beforeInterface = state.discovery.devices.find(({ id }) => id === 'host-lan-002')!.services.find(({ id }) => id === 'service-rack-update-002')!.inspect
    state = advanceGameState(state, 20_000)
    const device = state.discovery.devices.find(({ id }) => id === 'host-lan-002')!
    expect(device.services.find(({ id }) => id === 'service-ssh-002')!.inspect?.implementation).toEqual({ name: 'GateSSH', version: '1.3.3' })
    // Unrelated remembered evidence is untouched.
    expect(device.services.find(({ id }) => id === 'service-rack-update-002')!.inspect).toEqual(beforeInterface)
    expect(device.inspect?.enhanced).toEqual(grantSubmissionAccess(ready()).discovery.devices.find(({ id }) => id === 'host-lan-002')!.inspect?.enhanced)
  })

  it('rejects a second submission rather than replacing accepted pending software', () => {
    const completed = advanceGameState(submit(grantSubmissionAccess(ready())), 20_000)
    const pending = completed.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.pendingGateSshActivation
    const second = startRackUpdatePackageSubmission(completed, { ...RACK_UPDATE_ENDPOINT, localFileId: 'file-local-gatessh' })
    expect(second).toEqual({ status: 'activation_pending', state: completed })
    expect(second.state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.pendingGateSshActivation).toEqual(pending)
  })

  it('generates terminal Network Activity evidence exactly once, never per tick', () => {
    let state = submit(grantSubmissionAccess(ready()))
    state = advanceGameState(state, 5_000)
    const homeNet = () => state.world.network.localNetworks.find(({ id }) => id === 'network-local-001')
    const foreignNet = () => state.world.network.localNetworks.find(({ id }) => id === 'network-foreign-001')
    expect(homeNet()?.activityHistory.records).toEqual([])
    expect(foreignNet()?.activityHistory.records).toEqual([])

    state = advanceGameState(state, 20_000)
    expect(homeNet()?.activityHistory.records).toEqual([expect.objectContaining({ kind: 'package_submission', perspective: 'outbound', result: 'COMPLETED', bytesTransferred: 6_400_000, sourceDeviceId: 'device-local-v0', destinationDeviceId: 'host-lan-002' })])
    expect(foreignNet()?.activityHistory.records).toEqual([expect.objectContaining({ kind: 'package_submission', perspective: 'inbound', result: 'COMPLETED', bytesTransferred: 6_400_000 })])

    // Advancing further after completion never appends a second record.
    state = advanceGameState(state, 20_000)
    expect(homeNet()?.activityHistory.records).toHaveLength(1)
    expect(foreignNet()?.activityHistory.records).toHaveLength(1)
  })

  it('cancellation applies no part of the package and records the real interrupted progress', () => {
    let state = submit(grantSubmissionAccess(ready()))
    state = advanceGameState(state, 1000)
    const submissionId = state.rackUpdate.submission.active!.id
    const bytesAtCancel = state.rackUpdate.submission.active!.bytesTransferred
    const result = cancelRackUpdatePackageSubmission(state, submissionId)
    expect(result.status).toBe('cancelled')
    expect(result.state.rackUpdate.submission.active).toBeNull()
    const managed = result.state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.services!.find(({ id }) => id === 'service-ssh-002')!
    expect(managed.implementation.releaseId).toBe('gate-ssh-1.3.3')
    const homeNet = result.state.world.network.localNetworks.find(({ id }) => id === 'network-local-001')
    expect(homeNet?.activityHistory.records).toEqual([expect.objectContaining({ result: 'CANCELLED', bytesTransferred: bytesAtCancel })])
  })

  it('a cancelled active submission is a no-op for an unknown or stale ID', () => {
    const state = submit(grantSubmissionAccess(ready()))
    expect(cancelRackUpdatePackageSubmission(state, 'unknown')).toEqual({ status: 'not_found', state })
  })

  it('interruption from a lost route applies no part of the package', () => {
    let state = submit(grantSubmissionAccess(ready()))
    state = advanceGameState(state, 1000)
    const offline = alterTarget(state, (host) => ({ ...host, online: false }))
    const interrupted = advanceGameState(offline, 1000)
    expect(interrupted.rackUpdate.submission.active).toBeNull()
    const managed = interrupted.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.services!.find(({ id }) => id === 'service-ssh-002')!
    expect(managed.implementation.releaseId).toBe('gate-ssh-1.3.3')
    const homeNet = interrupted.world.network.localNetworks.find(({ id }) => id === 'network-local-001')
    expect(homeNet?.activityHistory.records).toEqual([expect.objectContaining({ result: 'INTERRUPTED' })])
  })

  it.each([
    ['managed GateSSH Service', (state: GameState) => alterTarget(state, (host) => ({ ...host, services: host.services!.filter(({ id }) => id !== 'service-ssh-002') }))],
    ['GateSSH InstalledSoftware', (state: GameState) => alterTarget(state, (host) => ({ ...host, installedSoftware: host.installedSoftware!.filter(({ id }) => id !== 'gate-ssh') }))],
  ])('interrupts when required %s disappears, applies neither remaining half, and never records COMPLETED', (_name, removeRequiredState) => {
    let state = submit(grantSubmissionAccess(ready()))
    state = advanceGameState(state, 1000)
    const interrupted = advanceGameState(removeRequiredState(state), 20_000)

    expect(interrupted.rackUpdate.submission.active).toBeNull()
    const target = interrupted.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    expect(target.services?.find(({ id }) => id === 'service-ssh-002')?.implementation.releaseId).not.toBe('gate-ssh-1.3.2')
    expect(target.installedSoftware?.find(({ id }) => id === 'gate-ssh')?.releaseId).not.toBe('gate-ssh-1.3.2')
    const evidence = interrupted.world.network.localNetworks.flatMap(({ activityHistory }) => activityHistory.records)
    expect(evidence).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'package_submission', result: 'INTERRUPTED' })]))
    expect(evidence).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'package_submission', result: 'COMPLETED' })]))
  })

  it.each([
    ['managed GateSSH Service', (state: GameState) => alterTarget(state, (host) => ({ ...host, services: host.services!.filter(({ id }) => id !== 'service-ssh-002') }))],
    ['GateSSH InstalledSoftware', (state: GameState) => alterTarget(state, (host) => ({ ...host, installedSoftware: host.installedSoftware!.filter(({ id }) => id !== 'gate-ssh') }))],
  ])('refuses admission when required %s is already absent', (_name, removeRequiredState) => {
    const granted = grantSubmissionAccess(ready())
    const state = removeRequiredState(granted)
    expect(startRackUpdatePackageSubmission(state, { ...RACK_UPDATE_ENDPOINT, localFileId: 'file-local-gatessh' })).toEqual({ status: 'service_unavailable', state })
  })

  it.each([
    ['wrong observed endpoint', (state: GameState) => state, { endpoint: '203.0.113.42:9443' }, 'observation_required'],
    ['stale endpoint after the current port changes', (state: GameState) => alterUpdate(state, (service) => ({ ...service, port: 9443 })), {}, 'service_unavailable'],
    ['offline target', (state: GameState) => alterTarget(state, (host) => ({ ...host, online: false })), {}, 'service_unavailable'],
    ['closed RackUpdate', (state: GameState) => alterUpdate(state, (service) => ({ ...service, open: false })), {}, 'service_unavailable'],
    ['changed RackUpdate', (state: GameState) => alterUpdate(state, (service) => ({ ...service, implementation: { ...service.implementation, releaseId: 'rack-update-1.1' } })), {}, 'service_unavailable'],
    ['already-applied build', (state: GameState) => alterSsh(state, (service) => ({ ...service, implementation: { ...service.implementation, releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID, version: '1.3.2' } })), {}, 'package_incompatible'],
  ])('rejects %s when current truth no longer matches, without mutating state', (_name, arrange, input, status) => {
    const granted = grantSubmissionAccess(ready())
    const state = arrange(granted)
    const result = startRackUpdatePackageSubmission(state, { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh', ...input })
    expect(result).toEqual({ status, state })
  })

  it('composes the whole flow only through pending acceptance, without making AUTH-017 applicable', () => {
    let state = ready()
    const srv02 = () => state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    const ssh = () => srv02().services!.find(({ id }) => id === 'service-ssh-002')!
    expect(ssh().implementation.releaseId).toBe('gate-ssh-1.3.3')
    expect(vulnerabilitiesForService(ssh())).toEqual([])

    const updateAnalysis = startServiceAnalysisFromObservation(state, { endpoint: '203.0.113.42:8443', targetDeviceId: srv02().id, serviceId: 'service-rack-update-002' })
    expect(updateAnalysis.status).toBe('started'); state = advanceGameState(updateAnalysis.state, 20_000)
    expect(state.knowledge.discoveredVulnerabilities).toContainEqual(expect.objectContaining({ vulnerabilityId: 'UPD-001', targetDeviceId: srv02().id, serviceId: 'service-rack-update-002' }))

    const attacked = startRackUpdateExploitAttemptFromObservation(state, { endpoint: '203.0.113.42:8443', targetDeviceId: srv02().id, serviceId: 'service-rack-update-002', vulnerabilityId: 'UPD-001' })
    expect(attacked.status).toBe('started'); state = advanceGameState(attacked.state, 20_000)
    expect(state.rackUpdate.access.established).toHaveLength(1)

    state = withLocalGateSsh132(state)
    const submitted = startRackUpdatePackageSubmission(state, { targetDeviceId: srv02().id, serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh' })
    expect(submitted.status).toBe('started'); state = advanceGameState(submitted.state, 20_000)
    expect(state.deviceAccess.established).toEqual([]); expect(state.remoteSession.active).toBeNull()
    expect(srv02().pendingGateSshActivation).toMatchObject({ releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID, version: '1.3.2' })
    expect(ssh().implementation.releaseId).toBe('gate-ssh-1.3.3')
    expect(srv02().installedSoftware!.find(({ id }) => id === 'gate-ssh')!.releaseId).toBe('gate-ssh-1.3.3')
    expect(vulnerabilitiesForService(ssh())).toEqual([])
    expect(state.knowledge.discoveredVulnerabilities).not.toContainEqual(expect.objectContaining({ vulnerabilityId: 'AUTH-017', targetDeviceId: srv02().id, serviceId: ssh().id }))
  })
})
