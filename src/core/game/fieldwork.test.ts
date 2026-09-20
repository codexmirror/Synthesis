import { describe, expect, it } from 'vitest'
import { createSandboxGameState, authenticateServiceKey, deliverRecovery, readServiceKey, runSentrySweep, SENTRY_RELEASE, correlateFieldworkAdvisory } from './fieldwork'
import { createFieldworkActions } from '../../app/fieldworkOperations'
import { advanceGameState } from './gameAdvancement'
import { startCredentialAccessAttemptFromObservation } from './credentialAccess'
import { connectRemoteFromObservation, disconnectRemoteSession, resolveActiveRemoteTarget } from './remoteSession'
import { startRemoteFileDownload, startMarketPackageDownload } from './fileTransfer'
import { installLocalSoftwarePackage } from './softwareInstallation'
import { purchaseMarketOffer } from './market'
import { startServiceAnalysisAtEndpoint } from './serviceAnalysis'
import { startRackUpdateExploitAttemptFromObservation, startRackUpdatePackageSubmission } from './rackUpdate'
import type { GameState, FilesystemFile } from './types'

function harness() {
  let state = createSandboxGameState()
  return { get state() { return state }, set state(next: GameState) { state = next }, actions: createFieldworkActions({ read: () => state, write: next => { state = next } }) }
}
function enterRelay() {
  const h = harness()
  expect(h.actions.surveyAddress('203.0.113.71').status).toBe('surveying')
  h.state = advanceGameState(h.state, 10_000)
  const attempt = startCredentialAccessAttemptFromObservation(h.state, { targetDeviceId: 'field-relay', serviceId: 'field-relay-ssh', endpoint: '203.0.113.71:22', vulnerabilityId: 'AUTH-017', providerId: 'credential-access-module' })
  expect(attempt.status).toBe('started')
  h.state = advanceGameState(attempt.state, 10_000)
  expect(h.state.deviceAccess.established.some(a => a.targetDeviceId === 'field-relay')).toBe(true)
  const connected = connectRemoteFromObservation(h.state, { targetDeviceId: 'field-relay', address: '203.0.113.71' })
  expect(connected.status).toBe('connected'); h.state = connected.state
  return h
}
function download(state: GameState, path: string) {
  const result = startRemoteFileDownload(state, path)
  expect(result.status).toBe('started')
  const completed = advanceGameState(result.state, 15_000)
  expect(completed.fileTransfer.active).toBeNull()
  return completed
}
function local(state: GameState, name: string) { return state.player.localDevice.filesystem.files.find(f => f.path.endsWith('/' + name))! }
function addLocal(state: GameState, file: FilesystemFile): GameState {
  const fs = state.player.localDevice.filesystem
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: fs.nextFileId + 1, files: [...fs.files, { ...file, id: `file-${fs.nextFileId}`, path: '/home/user/downloads/' + file.path.split('/').pop() }] } } } }
}

describe('Sandbox fieldwork loop', () => {
  it('advertises client requests without pre-discovering private machines or giving away the reconnaissance upgrade', () => {
    const state = createSandboxGameState()
    expect(state.fieldwork!.requests).toHaveLength(5)
    expect(state.discovery.devices.some(d => d.id.startsWith('field-'))).toBe(false)
    expect(state.player.localDevice.filesystem.files.some(f => f.kind === 'software_package' && f.releaseId === 'nodescan-1.2-standard')).toBe(false)
    expect(new Set(state.world.network.hosts.map(h => h.id)).size).toBe(state.world.network.hosts.length)
    for (const net of state.world.network.localNetworks.filter(n => n.id.startsWith('field-'))) expect(net.cidr).toMatch(/^10\.\d+\.0\.0\/24$/)
  })
  it('pays only for the recovered document, once, from finite escrow; the reward purchases real software', () => {
    const h = enterRelay(), request = h.state.fieldwork!.requests[0]
    expect(deliverRecovery(h.state, request.id, 'file-0001').status).toBe('file_mismatch')
    h.state = download(h.state, '/work/relay-dispatch-1.txt')
    const before = h.state, file = local(before, request.filename)
    const paid = deliverRecovery(before, request.id, file.id)
    expect(paid.status).toBe('paid'); h.state = paid.state
    expect(h.state.nodeWallet.balanceNodeUnits - before.nodeWallet.balanceNodeUnits).toBe(request.reward)
    expect(before.nodeEconomy.accounts.find(a => a.id === 'node-account-switchboard')!.balanceNodeUnits - h.state.nodeEconomy.accounts.find(a => a.id === 'node-account-switchboard')!.balanceNodeUnits).toBe(request.reward)
    expect(deliverRecovery(h.state, request.id, file.id)).toEqual({ status: 'already_delivered', state: h.state })
    const offer = h.state.market.offers.find(o => o.id === 'market-offer-rattler-1.0-v0')!
    const bought = purchaseMarketOffer(h.state, offer.id)
    expect(bought.status).toBe('purchased')
    const transfer = startMarketPackageDownload(bought.state, offer.id)
    expect(transfer.status).toBe('started')
    const acquired = advanceGameState(transfer.state, 15_000)
    expect(acquired.player.localDevice.filesystem.files.some(f => f.kind === 'software_package' && f.productId === 'product-rattler-v0')).toBe(true)
  })
  it('requires actual transfer and installation before the recovered scanner speeds later investigations', () => {
    const h = enterRelay()
    h.state = download(h.state, '/software/nodescan-1.2.pkg')
    const slow = startServiceAnalysisAtEndpoint(h.state, '203.0.113.72:22')
    const slowProcess = slow.state.process.processes.find(p => p.kind === 'service_analysis' && p.status === 'running')!
    expect(slowProcess).toHaveProperty('workRequired', 360)
    const installed = installLocalSoftwarePackage(h.state, local(h.state, 'nodescan-1.2.pkg').path)
    expect(installed.status).toBe('started')
    h.state = advanceGameState(installed.state, 15_000)
    expect(h.state.player.localDevice.installedSoftware.find(s => s.id === 'nodescan')?.version).toBe('1.2')
    const fast = startServiceAnalysisAtEndpoint(h.state, '203.0.113.72:22')
    expect(fast.state.process.processes.find(p => p.kind === 'service_analysis' && p.status === 'running')).toHaveProperty('workRequired', 120)
  })
  it('uses a stolen key against patched SSH without opening a Session or erasing remembered intelligence', () => {
    const h = enterRelay()
    h.state = download(h.state, '/work/atlas-maintenance.key')
    h.state = disconnectRemoteSession(h.state).state
    h.actions.surveyAddress('203.0.113.72'); h.state = advanceGameState(h.state, 10_000)
    const previous = h.state.discovery.devices.find(d => d.id === 'field-atlas')!
    const result = authenticateServiceKey(h.state, local(h.state, 'atlas-maintenance.key').id)
    expect(result.status).toBe('access_established'); h.state = result.state
    expect(h.state.remoteSession.active).toBeNull()
    expect(h.state.discovery.devices.find(d => d.id === 'field-atlas')?.services[0].inspect).toEqual(previous.services[0].inspect)
    h.state = connectRemoteFromObservation(h.state, { targetDeviceId: 'field-atlas', address: '203.0.113.72' }).state
    expect(resolveActiveRemoteTarget(h.state)?.target.displayName).toBe('atlas-ops')
    h.state = download(h.state, '/work/northline-maintenance.key')
    expect(readServiceKey(local(h.state, 'northline-maintenance.key'))?.targetId).toBe('field-northline')
  })
  it('rejects a real key when the target is offline or the service is closed', () => {
    const h = enterRelay(); h.state = download(h.state, '/work/atlas-maintenance.key')
    for (const change of [{ operational: { lifecycle: 'RUNNING' as const, connectivity: 'DISCONNECTED' as const } }, { services: h.state.world.network.hosts.find(x => x.id === 'field-atlas')!.services!.map(s => ({ ...s, open: false })) }]) {
      const offline = { ...h.state, world: { ...h.state.world, network: { ...h.state.world.network, hosts: h.state.world.network.hosts.map(host => host.id === 'field-atlas' ? { ...host, ...change } : host) } } }
      expect(authenticateServiceKey(offline, local(offline, 'atlas-maintenance.key').id).status).toBe('key_rejected')
    }
  })
  it('rotates used keys, closes old Access, preserves stolen copies, and updates only remote backup files', () => {
    const h = enterRelay(); h.state = download(h.state, '/work/atlas-maintenance.key')
    const key = local(h.state, 'atlas-maintenance.key')
    h.state = authenticateServiceKey(h.state, key.id).state
    const discovery = h.state.discovery
    const advanced = advanceGameState(h.state, 150_000)
    expect(advanced.deviceAccess.established.some(a => a.targetDeviceId === 'field-atlas')).toBe(false)
    expect(local(advanced, 'atlas-maintenance.key')).toEqual(key)
    expect(authenticateServiceKey(advanced, key.id).status).toBe('key_rejected')
    expect(advanced.discovery).toEqual(discovery)
    const fresh = advanced.world.network.hosts.find(h => h.id === 'field-relay')!.filesystem!.files.find(f => f.path.endsWith('atlas-maintenance-r1.key'))!
    expect(readServiceKey(fresh)?.secret).not.toBe(readServiceKey(key)?.secret)
    expect(advanced.fieldwork?.lastNotice).toContain('expired')
  })
  it('starts the security response after activity, giving late arrivals a full recovery window', () => {
    const h = harness()
    h.state = advanceGameState(h.state, 239_000)
    expect(h.state.world.network.hosts.find(x => x.id === 'field-relay')!.securityMaintenance!.remainingMs).toBe(240_000)
    h.actions.surveyAddress('203.0.113.71'); h.state = advanceGameState(h.state, 10_000)
    const attempted = startCredentialAccessAttemptFromObservation(h.state, { targetDeviceId: 'field-relay', serviceId: 'field-relay-ssh', endpoint: '203.0.113.71:22', vulnerabilityId: 'AUTH-017', providerId: 'credential-access-module' })
    h.state = advanceGameState(attempted.state, 10_000)
    expect(h.state.deviceAccess.established.some(a => a.targetDeviceId === 'field-relay')).toBe(true)
    expect(h.state.world.network.hosts.find(x => x.id === 'field-relay')!.securityMaintenance!.remainingMs).toBeGreaterThan(220_000)
    h.state = connectRemoteFromObservation(h.state, { targetDeviceId: 'field-relay', address: '203.0.113.71' }).state
    h.state = advanceGameState(h.state, 240_000)
    expect(h.state.remoteSession.active).toBeNull()
    expect(h.state.deviceAccess.established.some(a => a.targetDeviceId === 'field-relay')).toBe(false)
  })

  it('makes subsequent dispatches new physical documents, not repeat payment for the same loot', () => {
    const h = enterRelay(); h.state = download(h.state, '/work/relay-dispatch-1.txt')
    const old = local(h.state, 'relay-dispatch-1.txt')
    h.state = deliverRecovery(h.state, h.state.fieldwork!.requests[0].id, old.id).state
    h.state = advanceGameState(h.state, 180_000)
    const next = h.state.fieldwork!.requests.find(r => r.address === '203.0.113.71')!
    expect(next.filename).not.toBe('relay-dispatch-1.txt')
    expect(deliverRecovery(h.state, next.id, old.id).status).toBe('file_mismatch')
    expect(h.state.world.network.hosts.find(h => h.id === 'field-relay')!.filesystem!.files.some(f => f.path.endsWith('/' + next.filename))).toBe(true)
  })
  it('requires a recovered advisory and observed implementation before enabling a genuine RackUpdate reboot chain', () => {
    const h = harness()
    h.actions.surveyAddress('203.0.113.75'); h.state = advanceGameState(h.state, 15_000)
    expect(h.state.knowledge.discoveredVulnerabilities.some(k => k.vulnerabilityId === 'UPD-001')).toBe(false)
    const foundry = h.state.world.network.hosts.find(h => h.id === 'field-foundry')!
    for (const filename of ['rollback-1.0.mod', 'gatessh-1.3.2.pkg', 'rackupdate-advisory.txt']) {
      h.state = addLocal(h.state, foundry.filesystem!.files.find(f => f.path.endsWith('/' + filename))!)
    }
    h.state = correlateFieldworkAdvisory(h.state)
    expect(h.state.knowledge.discoveredVulnerabilities).toContainEqual(expect.objectContaining({ targetDeviceId: 'field-meridian', vulnerabilityId: 'UPD-001' }))
    const observed = { targetDeviceId: 'field-meridian', serviceId: 'field-meridian-update', endpoint: '203.0.113.75:8443' }
    const attack = startRackUpdateExploitAttemptFromObservation(h.state, { ...observed, vulnerabilityId: 'UPD-001' })
    expect(attack.status).toBe('started'); h.state = advanceGameState(attack.state, 20_000)
    expect(h.state.deviceAccess.established).toHaveLength(0)
    const submit = startRackUpdatePackageSubmission(h.state, { ...observed, localFileId: local(h.state, 'gatessh-1.3.2.pkg').id })
    expect(submit.status).toBe('started'); h.state = advanceGameState(submit.state, 15_000)
    const before = h.state.world.network.hosts.find(h => h.id === 'field-meridian')!
    expect(before.pendingGateSshActivation?.version).toBe('1.3.2')
    expect(before.services![0].implementation.version).toBe('1.3.3')
    h.state = advanceGameState(h.state, before.securityMaintenance!.remainingMs + 30_000)
    expect(h.state.world.network.hosts.find(h => h.id === 'field-meridian')!.services![0].implementation.version).toBe('1.3.2')
    expect(h.state.deviceAccess.established).toHaveLength(0)
    h.actions.surveyAddress('203.0.113.75'); h.state = advanceGameState(h.state, 10_000)
    const access = startCredentialAccessAttemptFromObservation(h.state, { targetDeviceId: 'field-meridian', serviceId: 'field-meridian-ssh', endpoint: '203.0.113.75:22', vulnerabilityId: 'AUTH-017', providerId: 'credential-access-module' })
    expect(access.status).toBe('started')
    h.state = advanceGameState(access.state, 10_000)
    expect(h.state.deviceAccess.established.some(a => a.targetDeviceId === 'field-meridian')).toBe(true)
  })

  it('runs the narrow Sentry cleanup only from the installed build and preserves package possession', () => {
    let state = createSandboxGameState()
    expect(runSentrySweep(state).status).toBe('software_unavailable')
    const pkg = state.world.network.hosts.find(h => h.id === 'field-northline')!.filesystem!.files.find(f => f.kind === 'software_package' && f.productId === 'sentry')!
    state = addLocal(state, pkg)
    state = advanceGameState(installLocalSoftwarePackage(state, local(state, 'sentry-1.0.pkg').path).state, 15_000)
    expect(state.player.localDevice.installedSoftware.some(s => s.buildId === SENTRY_RELEASE.buildId)).toBe(true)
    state = addLocal(state, { kind: 'executable', id: 'fixture-miner', path: '/tmp/miner.exec', programId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-node-miner-1.0-v0', name: 'NODE Miner', version: '1.0', sizeBytes: 10 })
    const swept = runSentrySweep(state)
    expect(swept.status).toBe('cleaned')
    expect(swept.state.player.localDevice.filesystem.files.some(f => f.kind === 'executable' && f.programId === 'node-miner')).toBe(false)
    expect(local(swept.state, 'sentry-1.0.pkg')).toBeDefined()
  })
})
