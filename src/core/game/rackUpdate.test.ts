import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { inspectKnownTarget } from './inspect'
import { rememberInspect } from './discovery'
import { scanNetworkTarget } from './scan'
import { rememberScan } from './discovery'
import {
  ROLLBACK_EXPLOIT_TOOLKIT_ID,
  cancelRackUpdatePackageSubmission,
  canFormRackUpdateExploitAttempt,
  startRackUpdateExploitAttemptFromObservation,
  startRackUpdatePackageSubmission,
} from './rackUpdate'
import { vulnerabilitiesForService } from './serviceImplementations'
import { startServiceAnalysisFromObservation } from './serviceAnalysis'
import { advanceGameState } from './gameAdvancement'
import { BASIC_CREDENTIAL_TOOLKIT_ID, startCredentialAccessAttemptFromObservation } from './credentialAccess'
import { ROLLBACK_EXPLOIT_TOOLKIT_1_0 } from './softwareReleaseContent'
import type { GameState, NetworkHost, NetworkService } from './types'

const RACK_UPDATE_ENDPOINT = { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443' }
const UPD_001_OBSERVATION = { ...RACK_UPDATE_ENDPOINT, vulnerabilityId: 'UPD-001', toolId: ROLLBACK_EXPLOIT_TOOLKIT_ID } as const

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

/** V1 has no represented acquisition path for the Rollback Exploit Toolkit; fixtures that need it install it explicitly rather than relying on default Current Truth. */
function withRollbackExploitToolkit(state: GameState): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: [...state.player.localDevice.installedSoftware, { id: ROLLBACK_EXPLOIT_TOOLKIT_1_0.productId, releaseId: ROLLBACK_EXPLOIT_TOOLKIT_1_0.releaseId, name: ROLLBACK_EXPLOIT_TOOLKIT_1_0.name, version: ROLLBACK_EXPLOIT_TOOLKIT_1_0.version } ] } } }
}

function ready(): GameState {
  return withRollbackExploitToolkit(withLocalGateSsh132(withUpd001Knowledge(observed())))
}

function alterTarget(state: GameState, alter: (host: NetworkHost) => NetworkHost): GameState {
  return { ...state, world: { network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === 'host-lan-002' ? alter(host) : host) } } }
}
function alterService(state: GameState, id: string, alter: (service: NetworkService) => NetworkService): GameState {
  return alterTarget(state, (host) => ({ ...host, services: host.services!.map((service) => service.id === id ? alter(service) : service) }))
}
const alterUpdate = (state: GameState, alter: (service: NetworkService) => NetworkService) => alterService(state, 'service-rack-update-002', alter)
const alterSsh = (state: GameState, alter: (service: NetworkService) => NetworkService) => alterService(state, 'service-ssh-002', alter)

function withoutTool(state: GameState): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== 'rollback-exploit-toolkit') } } }
}

function grantSubmissionAccess(state: GameState) {
  const started = startRackUpdateExploitAttemptFromObservation(state, UPD_001_OBSERVATION)
  if (started.status !== 'started') throw new Error(started.status)
  return advanceGameState(started.state, 20_000)
}

describe('RackUpdate ATTACK: finite exploit work granting only narrow submission capability', () => {
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
    // Nothing applied yet: the managed Service implementation, filesystem, and Discovery are all untouched at admission.
    const after = result.state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.services!.find(({ id }) => id === 'service-ssh-002')!
    expect(after).toEqual(before)
    expect(result.state.discovery).toEqual(state.discovery)
  })

  it('rejects a second concurrent submission while one is already active', () => {
    const state = grantSubmissionAccess(ready())
    const first = startRackUpdatePackageSubmission(state, { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh' })
    if (first.status !== 'started') throw new Error(first.status)
    const second = startRackUpdatePackageSubmission(first.state, { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh' })
    expect(second).toEqual({ status: 'submission_in_progress', state: first.state })
  })

  it('supports the general direction of applying a compatible newer release, not only an older one', () => {
    // The mechanism is not hardcoded to exactly 1.3.2 replacing exactly 1.3.3: any recognized
    // GateSSH release differing from the currently managed one is a valid submission.
    const state = grantSubmissionAccess(withRollbackExploitToolkit(withUpd001Knowledge(observed())))
    const remotePackage = state.world.network.hosts.find(({ id }) => id === 'host-lan-001')!.filesystem!.files.find(({ id }) => id === 'file-0003')!
    const newerPackage = { ...remotePackage, id: 'file-local-newer', path: '/home/user/downloads/gatessh-1.4.0.pkg', releaseId: 'gate-ssh-1.4.0', version: '1.4.0' }
    const withNewerPackage = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: [...state.player.localDevice.filesystem.files, newerPackage] } } } }
    const started = startRackUpdatePackageSubmission(withNewerPackage, { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-newer' })
    expect(started.status).toBe('started')
    if (started.status !== 'started') throw new Error(started.status)
    const done = advanceGameState(started.state, 20_000)
    const managed = done.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.services!.find(({ id }) => id === 'service-ssh-002')!
    expect(managed.implementation).toEqual({ productId: 'gate-ssh', releaseId: 'gate-ssh-1.4.0', name: 'GateSSH', version: '1.4.0' })
  })

  function submit(state: GameState) {
    const started = startRackUpdatePackageSubmission(state, { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh' })
    if (started.status !== 'started') throw new Error(started.status)
    return started.state
  }

  it('progresses over elapsed time and completes with the release applied exactly once', () => {
    let state = submit(grantSubmissionAccess(ready()))
    const submissionId = state.rackUpdate.submission.active!.id
    // node-01 (home-net) -> srv-02 (remote-segment-01) is the represented cross-Network route: min(1 MiB/s upload, 16 MiB/s home-net, 8 MiB/s remote-segment-01, 1 MiB/s srv-02 download) = 1 MiB/s.
    state = advanceGameState(state, 1000)
    expect(state.rackUpdate.submission.active).toMatchObject({ id: submissionId, bytesTransferred: 1_048_576 })
    const managedMidway = state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.services!.find(({ id }) => id === 'service-ssh-002')!
    expect(managedMidway.implementation.releaseId).toBe('gate-ssh-1.3.3')

    state = advanceGameState(state, 20_000)
    expect(state.rackUpdate.submission.active).toBeNull()
    const managed = state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.services!.find(({ id }) => id === 'service-ssh-002')!
    expect(managed.implementation).toEqual({ productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', name: 'GateSSH', version: '1.3.2' })
    expect(vulnerabilitiesForService(managed).map(({ id }) => id)).toEqual(['AUTH-017'])
    // No access, session, or filesystem consequence anywhere.
    expect(state.deviceAccess.established).toEqual([])
    expect(state.remoteSession.active).toBeNull()
    expect(state.player.localDevice.filesystem.files.some(({ id }) => id === 'file-local-gatessh')).toBe(true)
    expect(state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.filesystem).toEqual(grantSubmissionAccess(ready()).world.network.hosts.find(({ id }) => id === 'host-lan-002')!.filesystem)
  })

  it('refreshes only the remembered implementation fingerprint the successful submission itself established', () => {
    let state = submit(grantSubmissionAccess(ready()))
    const beforeInterface = state.discovery.devices.find(({ id }) => id === 'host-lan-002')!.services.find(({ id }) => id === 'service-rack-update-002')!.inspect
    state = advanceGameState(state, 20_000)
    const device = state.discovery.devices.find(({ id }) => id === 'host-lan-002')!
    expect(device.services.find(({ id }) => id === 'service-ssh-002')!.inspect?.implementation).toEqual({ name: 'GateSSH', version: '1.3.2' })
    // Unrelated remembered evidence is untouched.
    expect(device.services.find(({ id }) => id === 'service-rack-update-002')!.inspect).toEqual(beforeInterface)
    expect(device.inspect?.enhanced).toEqual(grantSubmissionAccess(ready()).discovery.devices.find(({ id }) => id === 'host-lan-002')!.inspect?.enhanced)
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
    ['wrong observed endpoint', (state: GameState) => state, { endpoint: '203.0.113.42:9443' }, 'observation_required'],
    ['stale endpoint after the current port changes', (state: GameState) => alterUpdate(state, (service) => ({ ...service, port: 9443 })), {}, 'service_unavailable'],
    ['offline target', (state: GameState) => alterTarget(state, (host) => ({ ...host, online: false })), {}, 'service_unavailable'],
    ['closed RackUpdate', (state: GameState) => alterUpdate(state, (service) => ({ ...service, open: false })), {}, 'service_unavailable'],
    ['changed RackUpdate', (state: GameState) => alterUpdate(state, (service) => ({ ...service, implementation: { ...service.implementation, releaseId: 'rack-update-1.1' } })), {}, 'service_unavailable'],
    ['already-applied release', (state: GameState) => alterSsh(state, (service) => ({ ...service, implementation: { ...service.implementation, releaseId: 'gate-ssh-1.3.2', version: '1.3.2' } })), {}, 'package_incompatible'],
  ])('rejects %s when current truth no longer matches, without mutating state', (_name, arrange, input, status) => {
    const granted = grantSubmissionAccess(ready())
    const state = arrange(granted)
    const result = startRackUpdatePackageSubmission(state, { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh', ...input })
    expect(result).toEqual({ status, state })
  })

  it('composes the whole flow with existing observation, analysis, and Credential Access operations, reaching AUTH-017 applicability', () => {
    let state = ready()
    const srv02 = () => state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    const ssh = () => srv02().services!.find(({ id }) => id === 'service-ssh-002')!
    expect(ssh().implementation.releaseId).toBe('gate-ssh-1.3.3')
    expect(vulnerabilitiesForService(ssh())).toEqual([])

    const updateAnalysis = startServiceAnalysisFromObservation(state, { endpoint: '203.0.113.42:8443', targetDeviceId: srv02().id, serviceId: 'service-rack-update-002' })
    expect(updateAnalysis.status).toBe('started'); state = advanceGameState(updateAnalysis.state, 20_000)
    expect(state.knowledge.discoveredVulnerabilities).toContainEqual(expect.objectContaining({ vulnerabilityId: 'UPD-001', targetDeviceId: srv02().id, serviceId: 'service-rack-update-002' }))

    const attacked = startRackUpdateExploitAttemptFromObservation(state, { endpoint: '203.0.113.42:8443', targetDeviceId: srv02().id, serviceId: 'service-rack-update-002', vulnerabilityId: 'UPD-001', toolId: ROLLBACK_EXPLOIT_TOOLKIT_ID })
    expect(attacked.status).toBe('started'); state = advanceGameState(attacked.state, 20_000)
    expect(state.rackUpdate.access.established).toHaveLength(1)

    state = withLocalGateSsh132(state)
    const submitted = startRackUpdatePackageSubmission(state, { targetDeviceId: srv02().id, serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh' })
    expect(submitted.status).toBe('started'); state = advanceGameState(submitted.state, 20_000)
    expect(state.deviceAccess.established).toEqual([]); expect(state.remoteSession.active).toBeNull()
    expect(ssh().implementation.releaseId).toBe('gate-ssh-1.3.2')

    const targets = { localDevice: state.player.localDevice, network: state.world.network }
    state = { ...state, discovery: rememberInspect(state.discovery, inspectKnownTarget(targets, state.discovery, '203.0.113.42', 'enhanced'), state.player.localDevice.id) }
    expect(state.discovery.devices.find(({ id }) => id === srv02().id)!.services.find(({ id }) => id === ssh().id)!.inspect?.implementation.version).toBe('1.3.2')
    const sshAnalysis = startServiceAnalysisFromObservation(state, { endpoint: '203.0.113.42:22', targetDeviceId: srv02().id, serviceId: ssh().id })
    expect(sshAnalysis.status).toBe('started'); state = advanceGameState(sshAnalysis.state, 20_000)
    expect(state.knowledge.discoveredVulnerabilities).toContainEqual(expect.objectContaining({ vulnerabilityId: 'AUTH-017', targetDeviceId: srv02().id, serviceId: ssh().id }))
    const access = startCredentialAccessAttemptFromObservation(state, { endpoint: '203.0.113.42:22', targetDeviceId: srv02().id, serviceId: ssh().id, vulnerabilityId: 'AUTH-017', toolId: BASIC_CREDENTIAL_TOOLKIT_ID })
    expect(access.status).toBe('started'); state = advanceGameState(access.state, 30_000)
    expect(state.deviceAccess.established).toContainEqual(expect.objectContaining({ targetDeviceId: srv02().id, viaServiceId: ssh().id, privilege: 'USER' }))
  })
})
