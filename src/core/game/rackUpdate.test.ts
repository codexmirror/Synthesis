import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { inspectKnownTarget } from './inspect'
import { rememberInspect } from './discovery'
import { scanNetworkTarget } from './scan'
import { rememberScan } from './discovery'
import { submitRackUpdatePackageFromObservation } from './rackUpdate'
import { vulnerabilitiesForService } from './serviceImplementations'
import { startServiceAnalysisFromObservation } from './serviceAnalysis'
import { advanceGameState } from './gameAdvancement'
import { BASIC_CREDENTIAL_TOOLKIT_ID, startCredentialAccessAttemptFromObservation } from './credentialAccess'
import type { GameState, NetworkHost, NetworkService } from './types'

function ready() {
  let state = createInitialGameState()
  const targets = () => ({ localDevice: state.player.localDevice, network: state.world.network })
  state = { ...state, discovery: rememberScan(state.discovery, scanNetworkTarget(targets(), '203.0.113.42'), state.player.localDevice.id) }
  state = { ...state, discovery: rememberInspect(state.discovery, inspectKnownTarget(targets(), state.discovery, '203.0.113.42', 'enhanced'), state.player.localDevice.id) }
  const remotePackage = state.world.network.hosts.find(({ id }) => id === 'host-lan-001')!.filesystem!.files.find(({ id }) => id === 'file-0003')!
  state = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: [...state.player.localDevice.filesystem.files, { ...remotePackage, id: 'file-local-gatessh', path: '/home/user/downloads/gatessh-1.3.2.pkg' }] } } } }
  return state
}

describe('RackUpdate 1.0 public package submission', () => {
  it('atomically rolls the managed GateSSH release back without access, transfer, filesystem, or Discovery consequences', () => {
    const state = ready(); const before = state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    const result = submitRackUpdatePackageFromObservation(state, { targetDeviceId: before.id, serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh' })
    expect(result.status).toBe('applied')
    const after = result.state.world.network.hosts.find(({ id }) => id === before.id)!
    expect(after.services!.find(({ id }) => id === 'service-ssh-002')).toMatchObject({ id: 'service-ssh-002', port: 22, open: true, implementation: { releaseId: 'gate-ssh-1.3.2' } })
    expect(vulnerabilitiesForService(after.services!.find(({ id }) => id === 'service-ssh-002')!).map(({ id }) => id)).toEqual(['AUTH-017'])
    expect(after.filesystem).toEqual(before.filesystem); expect(result.state.fileTransfer).toEqual(state.fileTransfer)
    expect(result.state.deviceAccess).toEqual(state.deviceAccess); expect(result.state.discovery).toEqual(state.discovery)
    expect(result.state.player.localDevice.filesystem).toEqual(state.player.localDevice.filesystem)
  })

  it('requires stable observed service and file identities and rejects other packages without mutation', () => {
    const state = ready(); const base = { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443' }
    expect(submitRackUpdatePackageFromObservation(state, { ...base, localFileId: 'missing' })).toEqual({ status: 'package_unavailable', state })
    expect(submitRackUpdatePackageFromObservation(state, { ...base, serviceId: 'wrong', localFileId: 'file-local-gatessh' })).toEqual({ status: 'observation_required', state })
    expect(submitRackUpdatePackageFromObservation(state, { ...base, localFileId: 'file-0002' })).toEqual({ status: 'package_rejected', state })
  })

  it.each([
    ['wrong observed endpoint', (state: GameState) => state, { endpoint: '203.0.113.42:9443' }, 'observation_required'],
    ['stale endpoint after the current port changes', (state: GameState) => alterUpdate(state, (service) => ({ ...service, port: 9443 })), {}, 'service_unavailable'],
    ['offline target', (state: GameState) => alterTarget(state, (host) => ({ ...host, online: false })), {}, 'service_unavailable'],
    ['closed RackUpdate', (state: GameState) => alterUpdate(state, (service) => ({ ...service, open: false })), {}, 'service_unavailable'],
    ['changed RackUpdate', (state: GameState) => alterUpdate(state, (service) => ({ ...service, implementation: { ...service.implementation, releaseId: 'rack-update-1.1' } })), {}, 'service_unavailable'],
    ['managed GateSSH changed', (state: GameState) => alterSsh(state, (service) => ({ ...service, implementation: { ...service.implementation, releaseId: 'gate-ssh-1.4.0', version: '1.4.0' } })), {}, 'managed_service_unavailable'],
  ])('rejects %s when current truth no longer matches', (_name, arrange, input, status) => {
    const state = arrange(ready())
    const result = submitRackUpdatePackageFromObservation(state, { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh', ...input })
    expect(result).toEqual({ status, state })
  })

  it('composes rollback with existing observation, analysis, and credential access operations', () => {
    let state = ready()
    const srv02 = () => state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    const ssh = () => srv02().services!.find(({ id }) => id === 'service-ssh-002')!
    expect(ssh().implementation.releaseId).toBe('gate-ssh-1.3.3')
    expect(vulnerabilitiesForService(ssh())).toEqual([])
    expect(state.discovery.devices.find(({ id }) => id === srv02().id)!.services.find(({ id }) => id === ssh().id)!.inspect?.implementation.version).toBe('1.3.3')

    const updateAnalysis = startServiceAnalysisFromObservation(state, { endpoint: '203.0.113.42:8443', targetDeviceId: srv02().id, serviceId: 'service-rack-update-002' })
    expect(updateAnalysis.status).toBe('started'); state = advanceGameState(updateAnalysis.state, 20_000)
    expect(state.knowledge.discoveredVulnerabilities).toContainEqual(expect.objectContaining({ vulnerabilityId: 'UPD-001', targetDeviceId: srv02().id, serviceId: 'service-rack-update-002' }))
    // Knowledge explains the condition but is not protocol authority.
    state = { ...state, knowledge: { discoveredVulnerabilities: [] } }
    const submitted = submitRackUpdatePackageFromObservation(state, { targetDeviceId: srv02().id, serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh' })
    expect(submitted.status).toBe('applied'); state = submitted.state
    expect(state.deviceAccess.established).toEqual([]); expect(state.remoteSession.active).toBeNull()
    expect(ssh().implementation.releaseId).toBe('gate-ssh-1.3.2')
    expect(state.discovery.devices.find(({ id }) => id === srv02().id)!.services.find(({ id }) => id === ssh().id)!.inspect?.implementation.version).toBe('1.3.3')

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

function alterTarget(state: GameState, alter: (host: NetworkHost) => NetworkHost): GameState {
  return { ...state, world: { network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === 'host-lan-002' ? alter(host) : host) } } }
}
function alterService(state: GameState, id: string, alter: (service: NetworkService) => NetworkService): GameState {
  return alterTarget(state, (host) => ({ ...host, services: host.services!.map((service) => service.id === id ? alter(service) : service) }))
}
const alterUpdate = (state: GameState, alter: (service: NetworkService) => NetworkService) => alterService(state, 'service-rack-update-002', alter)
const alterSsh = (state: GameState, alter: (service: NetworkService) => NetworkService) => alterService(state, 'service-ssh-002', alter)
