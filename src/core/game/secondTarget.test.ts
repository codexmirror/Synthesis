import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { scanNetworkTarget } from './scan'
import { rememberScan } from './discovery'
import { startServiceAnalysisFromObservation } from './serviceAnalysis'
import { advanceGameState } from './gameAdvancement'
import { BASIC_CREDENTIAL_TOOLKIT_ID, startCredentialAccessAttemptFromObservation } from './credentialAccess'
import { connectRemoteFromObservation, disconnectRemoteSession, resolveActiveRemoteTarget } from './remoteSession'
import { startRemoteFileDownload } from './fileTransfer'
import type { GameState } from './types'

/** Start a Download and advance simulation time well past its derived completion, mirroring the prior atomic-download test shape. */
function downloadRemoteFile(state: GameState, sourcePath: string) {
  const started = startRemoteFileDownload(state, sourcePath)
  if (started.status !== 'started') return { status: started.status, state: started.state } as const
  return { status: 'downloaded' as const, state: advanceGameState(started.state, 60_000), sourcePath: started.sourcePath, destinationPath: started.destinationPath }
}

/**
 * N=2 architecture proof: srv-01 (host-lan-001) and the second interactive
 * target srv-02 (host-lan-002) must resolve independently through every
 * existing shared gameplay operation, using only stable identity.
 *
 * srv-02 also proves that a discovered weakness does not guarantee access:
 * its SSH service owns the same real Weak Authentication vulnerability as
 * srv-01, but its authentication also requires a second factor the Basic
 * Credential Toolkit cannot satisfy, so the attempt still fails after the
 * weakness is known.
 */
interface TargetFixture {
  readonly id: string
  readonly ip: string
  readonly serviceId: string
  readonly vulnerabilityId: string
  readonly endpoint: string
  readonly filePath: string
  readonly fileContent: string
  readonly displayName: string
}

const TARGET_A: TargetFixture = {
  id: 'host-lan-001', ip: '198.51.100.47', serviceId: 'service-ssh-001', vulnerabilityId: 'vulnerability-ssh-001',
  endpoint: '198.51.100.47:22', filePath: '/srv/readme.txt', fileContent: 'Service workspace.', displayName: 'srv-01',
}
const TARGET_B: TargetFixture = {
  id: 'host-lan-002', ip: '198.51.100.53', serviceId: 'service-ssh-002', vulnerabilityId: 'vulnerability-ssh-002',
  endpoint: '198.51.100.53:22', filePath: '/srv/backup-manifest.txt', fileContent: 'Backup manifest for srv-02.', displayName: 'srv-02',
}

/** Walk the existing player-facing chain (scan -> discovery -> analysis -> credential access) against one target. */
function discoverAndCredentialAccess(state: GameState, target: TargetFixture): GameState {
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  let discovery = rememberScan(state.discovery, scanNetworkTarget(targets, 'home-net'), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, target.ip), state.player.localDevice.id)
  let current: GameState = { ...state, discovery }

  const analysis = startServiceAnalysisFromObservation(current, { endpoint: target.endpoint, targetDeviceId: target.id, serviceId: target.serviceId })
  if (analysis.status !== 'started') throw new Error(`analysis: ${analysis.status}`)
  current = advanceGameState(analysis.state, 20_000)

  const credential = startCredentialAccessAttemptFromObservation(current, {
    endpoint: target.endpoint, targetDeviceId: target.id, serviceId: target.serviceId,
    vulnerabilityId: target.vulnerabilityId, toolId: BASIC_CREDENTIAL_TOOLKIT_ID,
  })
  if (credential.status !== 'started') throw new Error(`credential access: ${credential.status}`)
  return advanceGameState(credential.state, 30_000)
}

function connectTo(state: GameState, target: TargetFixture): GameState {
  const result = connectRemoteFromObservation(state, { targetDeviceId: target.id, address: target.ip })
  if (result.status !== 'connected') throw new Error(`connect: ${result.status}`)
  return result.state
}

describe('Second interactive target (srv-02 / host-lan-002)', () => {
  it('discovers the same real weak-authentication vulnerability as srv-01, but the Basic Credential Toolkit still fails to establish access', () => {
    const afterAttempt = discoverAndCredentialAccess(createInitialGameState(), TARGET_B)

    expect(afterAttempt.discovery.devices.find((device) => device.id === TARGET_B.id)?.services.map((service) => service.id)).toEqual([TARGET_B.serviceId])
    expect(afterAttempt.knowledge.discoveredVulnerabilities).toEqual([
      { vulnerabilityId: TARGET_B.vulnerabilityId, observedLabel: 'Weak authentication configuration', targetDeviceId: TARGET_B.id, serviceId: TARGET_B.serviceId },
    ])

    expect(afterAttempt.deviceAccess.established).toEqual([])
    expect(afterAttempt.process.processes.at(-1)).toMatchObject({
      kind: 'credential_access', status: 'completed',
      result: { status: 'attempt_failed', message: 'Target no longer responds as expected.' },
    })

    const target = afterAttempt.world.network.hosts.find(({ id }) => id === TARGET_B.id)
    expect(target?.authenticationHistory?.records).toEqual([
      { id: 'auth-0001', serviceId: TARGET_B.serviceId, serviceName: 'SSH', sourceAddress: afterAttempt.player.localDevice.network.ip, result: 'FAILURE' },
    ])

    expect(connectRemoteFromObservation(afterAttempt, { targetDeviceId: TARGET_B.id, address: TARGET_B.ip }).status).toBe('access_required')
  })

  it('keeps Target A fully working, unweakened, alongside hardened Target B', () => {
    const withAccess = discoverAndCredentialAccess(createInitialGameState(), TARGET_A)
    const connected = connectTo(withAccess, TARGET_A)
    const active = resolveActiveRemoteTarget(connected)
    expect(active?.target.id).toBe(TARGET_A.id)
    expect(active?.target.displayName).toBe(TARGET_A.displayName)
    const downloaded = downloadRemoteFile(connected, TARGET_A.filePath)
    expect(downloaded.status).toBe('downloaded')
  })

  it('does not let Knowledge leak between A and B, and does not grant B DeviceAccess merely because A succeeded', () => {
    let state = createInitialGameState()
    state = discoverAndCredentialAccess(state, TARGET_A)
    state = discoverAndCredentialAccess(state, TARGET_B)

    expect(state.knowledge.discoveredVulnerabilities.some((known) => known.targetDeviceId === TARGET_A.id && known.vulnerabilityId === TARGET_B.vulnerabilityId)).toBe(false)
    expect(state.knowledge.discoveredVulnerabilities.some((known) => known.targetDeviceId === TARGET_B.id && known.vulnerabilityId === TARGET_A.vulnerabilityId)).toBe(false)

    expect(state.deviceAccess.established).toHaveLength(1)
    const accessA = state.deviceAccess.established.find((access) => access.targetDeviceId === TARGET_A.id)
    expect(accessA).toMatchObject({ targetDeviceId: TARGET_A.id, viaServiceId: TARGET_A.serviceId })
    expect(state.deviceAccess.established.some((access) => access.targetDeviceId === TARGET_B.id)).toBe(false)
  })

  it('rejects credential access and CONNECT to B using knowledge and access proven only against A', () => {
    const state = discoverAndCredentialAccess(createInitialGameState(), TARGET_A)
    const attempt = startCredentialAccessAttemptFromObservation(state, {
      endpoint: TARGET_B.endpoint, targetDeviceId: TARGET_B.id, serviceId: TARGET_B.serviceId,
      vulnerabilityId: TARGET_B.vulnerabilityId, toolId: BASIC_CREDENTIAL_TOOLKIT_ID,
    })
    expect(attempt.status).toBe('not_available')
    expect(connectRemoteFromObservation(state, { targetDeviceId: TARGET_B.id, address: TARGET_B.ip }).status).toBe('access_required')
  })

  it('resolves both targets correctly through shared operations regardless of canonical hosts[] array order', () => {
    let state = createInitialGameState()
    state = discoverAndCredentialAccess(state, TARGET_A)
    state = discoverAndCredentialAccess(state, TARGET_B)

    const reordered: GameState = { ...state, world: { network: { ...state.world.network, hosts: [...state.world.network.hosts].reverse() } } }
    expect(reordered.world.network.hosts[0].id).not.toBe(TARGET_A.id)
    expect(reordered.world.network.hosts[0].id).not.toBe(TARGET_B.id)

    const scanResultB = scanNetworkTarget({ localDevice: reordered.player.localDevice, network: reordered.world.network }, TARGET_B.ip)
    expect(scanResultB).toMatchObject({ status: 'device', targetId: TARGET_B.id })
    // B's hardened outcome is unaffected by hosts[] array order: still no DeviceAccess.
    expect(reordered.deviceAccess.established.some((access) => access.targetDeviceId === TARGET_B.id)).toBe(false)

    const connectedA = connectTo(reordered, TARGET_A)
    expect(resolveActiveRemoteTarget(connectedA)?.target.id).toBe(TARGET_A.id)
    const downloadedA = downloadRemoteFile(connectedA, TARGET_A.filePath)
    if (downloadedA.status !== 'downloaded') throw new Error('expected download from A')
    expect(downloadedA.state.player.localDevice.filesystem.files.find((file) => file.path === downloadedA.destinationPath)).toMatchObject({ content: TARGET_A.fileContent })

    const disconnected = disconnectRemoteSession(connectedA).state
    expect(disconnected.remoteSession.active).toBeNull()
  })

  it("changing B's presentation attributes (IP, display name) does not substitute for its stable identity, and does not grant the missing DeviceAccess", () => {
    let state = createInitialGameState()
    state = discoverAndCredentialAccess(state, TARGET_A)
    state = discoverAndCredentialAccess(state, TARGET_B)

    const renamed: GameState = {
      ...state,
      world: { network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === TARGET_B.id ? { ...host, ip: '192.0.2.200', displayName: 'renamed-server' } : host) } },
    }
    // Knowledge remains valid because it is keyed by stable identity, not by address or name.
    expect(renamed.knowledge.discoveredVulnerabilities.some((known) => known.targetDeviceId === TARGET_B.id && known.vulnerabilityId === TARGET_B.vulnerabilityId)).toBe(true)
    // B never established DeviceAccess in the first place, so renaming cannot substitute for it either.
    expect(connectRemoteFromObservation(renamed, { targetDeviceId: TARGET_B.id, address: '192.0.2.200' }).status).toBe('access_required')

    // A's DeviceAccess and identity remain intact and address-driven, independent of B's renaming.
    const connected = connectTo(renamed, TARGET_A)
    expect(resolveActiveRemoteTarget(connected)?.target.id).toBe(TARGET_A.id)
  })
})
