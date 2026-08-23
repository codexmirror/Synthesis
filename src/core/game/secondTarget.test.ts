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
  it('completes SCAN -> discovery -> analysis -> credential access -> DeviceAccess -> RemoteSession -> RACK-OS -> download against Target B alone', () => {
    const withAccess = discoverAndCredentialAccess(createInitialGameState(), TARGET_B)

    expect(withAccess.discovery.devices.find((device) => device.id === TARGET_B.id)?.services.map((service) => service.id)).toEqual([TARGET_B.serviceId])
    expect(withAccess.knowledge.discoveredVulnerabilities).toEqual([
      { vulnerabilityId: TARGET_B.vulnerabilityId, observedLabel: 'Weak authentication configuration', targetDeviceId: TARGET_B.id, serviceId: TARGET_B.serviceId },
    ])
    expect(withAccess.deviceAccess.established).toEqual([
      { id: 'access-0001', sourceDeviceId: withAccess.player.localDevice.id, targetDeviceId: TARGET_B.id, viaServiceId: TARGET_B.serviceId, privilege: 'USER' },
    ])

    const connected = connectTo(withAccess, TARGET_B)
    const active = resolveActiveRemoteTarget(connected)
    expect(active?.target.id).toBe(TARGET_B.id)
    expect(active?.target.displayName).toBe(TARGET_B.displayName)
    expect(active?.target.firmware).toEqual({ id: 'firmware-rack-os-v1', name: 'RACK-OS', version: '1.0' })

    const downloaded = downloadRemoteFile(connected, TARGET_B.filePath)
    expect(downloaded.status).toBe('downloaded')
    if (downloaded.status !== 'downloaded') throw new Error('expected download')
    expect(downloaded.destinationPath).toBe('/home/user/downloads/backup-manifest.txt')
    expect(downloaded.state.player.localDevice.filesystem.files.find((file) => file.path === downloaded.destinationPath)).toMatchObject({ kind: 'text', content: TARGET_B.fileContent })
  })

  it('keeps Target A fully working, unweakened, alongside Target B', () => {
    const withAccess = discoverAndCredentialAccess(createInitialGameState(), TARGET_A)
    const connected = connectTo(withAccess, TARGET_A)
    const active = resolveActiveRemoteTarget(connected)
    expect(active?.target.id).toBe(TARGET_A.id)
    expect(active?.target.displayName).toBe(TARGET_A.displayName)
    const downloaded = downloadRemoteFile(connected, TARGET_A.filePath)
    expect(downloaded.status).toBe('downloaded')
  })

  it('does not let Knowledge or DeviceAccess for A leak into B, or vice versa', () => {
    let state = createInitialGameState()
    state = discoverAndCredentialAccess(state, TARGET_A)
    state = discoverAndCredentialAccess(state, TARGET_B)

    expect(state.knowledge.discoveredVulnerabilities.some((known) => known.targetDeviceId === TARGET_A.id && known.vulnerabilityId === TARGET_B.vulnerabilityId)).toBe(false)
    expect(state.knowledge.discoveredVulnerabilities.some((known) => known.targetDeviceId === TARGET_B.id && known.vulnerabilityId === TARGET_A.vulnerabilityId)).toBe(false)

    expect(state.deviceAccess.established).toHaveLength(2)
    const accessA = state.deviceAccess.established.find((access) => access.targetDeviceId === TARGET_A.id)
    const accessB = state.deviceAccess.established.find((access) => access.targetDeviceId === TARGET_B.id)
    expect(accessA?.id).not.toBe(accessB?.id)
    expect(accessA?.viaServiceId).toBe(TARGET_A.serviceId)
    expect(accessB?.viaServiceId).toBe(TARGET_B.serviceId)
  })

  it('resolves RemoteSession to A and to B by stable identity, one at a time, never confusing the two', () => {
    let state = createInitialGameState()
    state = discoverAndCredentialAccess(state, TARGET_A)
    state = discoverAndCredentialAccess(state, TARGET_B)

    const connectedA = connectTo(state, TARGET_A)
    expect(resolveActiveRemoteTarget(connectedA)?.target.id).toBe(TARGET_A.id)
    expect(connectRemoteFromObservation(connectedA, { targetDeviceId: TARGET_B.id, address: TARGET_B.ip }).status).toBe('session_active')

    const disconnected = disconnectRemoteSession(connectedA).state
    const connectedB = connectTo(disconnected, TARGET_B)
    expect(resolveActiveRemoteTarget(connectedB)?.target.id).toBe(TARGET_B.id)
  })

  it("downloading from B copies B's selected artifact, never A's, and both concrete local copies persist together with distinct IDs", () => {
    let state = createInitialGameState()
    state = discoverAndCredentialAccess(state, TARGET_A)
    state = discoverAndCredentialAccess(state, TARGET_B)

    const connectedA = connectTo(state, TARGET_A)
    const downloadedA = downloadRemoteFile(connectedA, TARGET_A.filePath)
    if (downloadedA.status !== 'downloaded') throw new Error('expected download from A')

    // Continue from the state the successful download from A actually produced,
    // rather than re-deriving a disconnect from before the download happened.
    const disconnected = disconnectRemoteSession(downloadedA.state).state
    const connectedB = connectTo(disconnected, TARGET_B)
    const downloadedB = downloadRemoteFile(connectedB, TARGET_B.filePath)
    if (downloadedB.status !== 'downloaded') throw new Error('expected download from B')

    const finalFiles = downloadedB.state.player.localDevice.filesystem.files
    const copyFromA = finalFiles.find((file) => file.path === downloadedA.destinationPath)
    const copyFromB = finalFiles.find((file) => file.path === downloadedB.destinationPath)

    // Both concrete downloaded copies coexist in the final local filesystem.
    expect(copyFromA).toMatchObject({ content: TARGET_A.fileContent })
    expect(copyFromB).toMatchObject({ content: TARGET_B.fileContent })
    expect(copyFromA).not.toMatchObject({ content: TARGET_B.fileContent })
    expect(copyFromB).not.toMatchObject({ content: TARGET_A.fileContent })
    expect(copyFromA?.path).not.toBe(copyFromB?.path)

    // Their concrete local file-copy identities are distinct and were both allocated.
    expect(copyFromA?.id).toBeDefined()
    expect(copyFromB?.id).toBeDefined()
    expect(copyFromA?.id).not.toBe(copyFromB?.id)
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

    const connectedA = connectTo(reordered, TARGET_A)
    expect(resolveActiveRemoteTarget(connectedA)?.target.id).toBe(TARGET_A.id)
    const downloadedA = downloadRemoteFile(connectedA, TARGET_A.filePath)
    if (downloadedA.status !== 'downloaded') throw new Error('expected download from A')
    expect(downloadedA.state.player.localDevice.filesystem.files.find((file) => file.path === downloadedA.destinationPath)).toMatchObject({ content: TARGET_A.fileContent })

    const disconnected = disconnectRemoteSession(connectedA).state
    const connectedB = connectTo(disconnected, TARGET_B)
    expect(resolveActiveRemoteTarget(connectedB)?.target.id).toBe(TARGET_B.id)
    const downloadedB = downloadRemoteFile(connectedB, TARGET_B.filePath)
    if (downloadedB.status !== 'downloaded') throw new Error('expected download from B')
    expect(downloadedB.state.player.localDevice.filesystem.files.find((file) => file.path === downloadedB.destinationPath)).toMatchObject({ content: TARGET_B.fileContent })
  })

  it("changing B's presentation attributes (IP, display name) does not substitute for its stable identity", () => {
    let state = createInitialGameState()
    state = discoverAndCredentialAccess(state, TARGET_A)
    state = discoverAndCredentialAccess(state, TARGET_B)

    const renamed: GameState = {
      ...state,
      world: { network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === TARGET_B.id ? { ...host, ip: '192.0.2.200', displayName: 'renamed-server' } : host) } },
    }
    // Connecting with the old address no longer matches current presentation truth.
    expect(connectRemoteFromObservation(renamed, { targetDeviceId: TARGET_B.id, address: TARGET_B.ip }).status).toBe('target_not_available')
    // DeviceAccess and Knowledge remain valid because they are keyed by stable identity, not by address or name.
    expect(renamed.deviceAccess.established.some((access) => access.targetDeviceId === TARGET_B.id)).toBe(true)
    const connected = connectRemoteFromObservation(renamed, { targetDeviceId: TARGET_B.id, address: '192.0.2.200' }).state
    expect(resolveActiveRemoteTarget(connected)?.target.id).toBe(TARGET_B.id)
    expect(resolveActiveRemoteTarget(connected)?.target.displayName).toBe('renamed-server')
  })
})
