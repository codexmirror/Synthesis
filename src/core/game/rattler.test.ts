import { describe, expect, it } from 'vitest'
import { advanceGameState } from './gameAdvancement'
import { advanceFileTransfer, startMarketPackageDownload, startRemoteFileUpload } from './fileTransfer'
import { getFilesystemFile } from './filesystem'
import { createInitialGameState } from './initialState'
import { connectRemoteFromObservation } from './remoteSession'
import { createRattlerPayload, deployRattler, deriveRattlerPayloadPath, RATTLER_INSTALLED_EXECUTABLE_PATH, RATTLER_PROGRAM_ID, rattlerCandidateAt } from './rattler'
import { installLocalSoftwarePackage } from './softwareInstallation'
import { purchaseMarketOffer } from './market'
import { RATTLER_1_0 } from './softwareReleaseContent'
import type { ExecutableFile, GameState, SoftwarePackageFile } from './types'

const knownAddress = '198.51.100.47'
const targetDeviceId = 'host-lan-001'

function installRattler(base = createInitialGameState()): GameState {
  const packageFile: SoftwarePackageFile = {
    kind: 'software_package', id: 'file-rattler-package', path: '/home/user/downloads/rattler-1.0.pkg',
    productId: RATTLER_1_0.productId, releaseId: RATTLER_1_0.releaseId, buildId: RATTLER_1_0.buildId,
    name: RATTLER_1_0.name, version: RATTLER_1_0.version, channel: RATTLER_1_0.channel,
    publisher: RATTLER_1_0.publisher, sizeBytes: 2_800_000,
  }
  const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, packageFile] } } } }
  const started = installLocalSoftwarePackage(state, packageFile.path)
  if (started.status !== 'started') throw new Error(started.status)
  return advanceGameState(started.state, 20_000)
}

function withKnownTarget(state = installRattler()): GameState {
  return { ...state, discovery: { ...state.discovery, devices: [{ id: targetDeviceId, address: knownAddress, scope: 'lan', servicesObserved: false, services: [] }] } }
}

describe('RATTLER 1.0', () => {
  function deployedPhone(pin = '7042') {
    const installed = installRattler()
    const base = { ...installed, process: { ...installed.process, processes: [] } }
    const phone = base.world.network.hosts.find(({ id }) => id === 'host-phone-001')!
    const payload = { kind: 'rattler_payload' as const, id: 'file-phone-payload', path: '/tmp/rattler.rpl', sizeBytes: 65_536,
      rattlerReleaseId: RATTLER_1_0.releaseId, rattlerBuildId: RATTLER_1_0.buildId, targetDeviceId: phone.id, targetAddressSnapshot: phone.ip }
    const withPayload: GameState = { ...base, world: { ...base.world, network: { ...base.world.network, hosts: base.world.network.hosts.map((host) => host.id === phone.id
      ? { ...host, security: { ...host.security!, devicePin: pin }, filesystem: { ...host.filesystem!, files: [...host.filesystem!.files, payload] } } : host) } },
      deviceAccess: { nextId: 2, established: [{ id: 'access-phone', sourceDeviceId: base.player.localDevice.id, targetDeviceId: phone.id, viaServiceId: 'service-ssh-003', privilege: 'USER' }] } }
    return connectRemoteFromObservation(withPayload, { targetDeviceId: phone.id, address: phone.ip }).state
  }

  it('uses the full 10,000 deterministic ascending candidates 0000..9999 with Petra at attempt 7043', () => {
    const candidates = Array.from({ length: 10_000 }, (_, index) => rattlerCandidateAt(index))
    expect(new Set(candidates).size).toBe(10_000)
    expect(candidates[0]).toBe('0000')
    expect(candidates[9_999]).toBe('9999')
    expect(candidates.indexOf('7042') + 1).toBe(7_043)
    expect(rattlerCandidateAt(10_000)).toBeUndefined()
  })

  it('requires represented session authority and the concrete payload, and refuses a duplicate', () => {
    const admitted = deployedPhone()
    const disconnected: GameState = { ...admitted, remoteSession: { ...admitted.remoteSession, active: null } }
    expect(deployRattler(disconnected)).toEqual({ status: 'session_unavailable', state: disconnected })
    const noPayload = { ...admitted, world: { ...admitted.world, network: { ...admitted.world.network, hosts: admitted.world.network.hosts.map((host) => host.id === 'host-phone-001' ? { ...host, filesystem: { ...host.filesystem!, files: [] } } : host) } } }
    expect(deployRattler(noPayload)).toEqual({ status: 'payload_unavailable', state: noPayload })
    const started = deployRattler(admitted)
    if (started.status !== 'started') throw new Error(started.status)
    expect(started.state.process.processes).toHaveLength(1)
    expect(deployRattler(started.state)).toEqual({ status: 'already_running', state: started.state })
  })

  it('tests actual candidates at 625/min, learns Petra PIN once, and remains terminal', () => {
    const started = deployRattler(deployedPhone())
    if (started.status !== 'started') throw new Error(started.status)
    const before = started.state
    const running = advanceGameState(before, 672_000)
    expect(running.process.processes[0]).toMatchObject({ kind: 'rattler_pin_search', status: 'running', attemptsCompleted: 7000, currentCandidate: '6999' })
    const succeeded = advanceGameState(running, 4_128)
    expect(succeeded.process.processes[0]).toMatchObject({ status: 'completed', attemptsCompleted: 7043, currentCandidate: '7042', result: { status: 'pin_found', pin: '7042' } })
    expect(succeeded.knowledge.knownDevicePins).toEqual([{ deviceId: 'host-phone-001', pin: '7042' }])
    expect(succeeded.world).toEqual(before.world)
    expect(succeeded.deviceAccess).toEqual(before.deviceAccess)
    expect(succeeded.remoteSession).toEqual(before.remoteSession)
    expect(advanceGameState(succeeded, 999_999).knowledge.knownDevicePins).toEqual(succeeded.knowledge.knownDevicePins)
  })

  it('exhausts the full 10,000-candidate search in exactly 16 minutes without knowledge when the actual PIN is unreachable, and interrupts when its exact payload copy disappears', () => {
    // A 5-digit PIN is never generated by the 4-digit `0000`..`9999` search: this exercises exhaustion, which never occurs for an ordinary 4-digit Device PIN since the full search space always reaches it.
    const outside = deployRattler(deployedPhone('10000'))
    if (outside.status !== 'started') throw new Error(outside.status)
    const exhausted = advanceGameState(outside.state, 960_000)
    expect(exhausted.process.processes[0]).toMatchObject({ status: 'completed', attemptsCompleted: 10_000, currentCandidate: '9999', result: { status: 'search_exhausted' } })
    expect(exhausted.knowledge.knownDevicePins).toEqual([])

    const active = deployRattler(deployedPhone())
    if (active.status !== 'started') throw new Error(active.status)
    const removed = { ...active.state, world: { ...active.state.world, network: { ...active.state.world.network, hosts: active.state.world.network.hosts.map((host) => host.id === 'host-phone-001' ? { ...host, filesystem: { ...host.filesystem!, files: [] } } : host) } } }
    expect(advanceGameState(removed, 500).process.processes[0]).toMatchObject({ status: 'completed', attemptsCompleted: 0, result: { status: 'payload_interrupted' } })
  })
  it('uses Market purchase and elapsed download to create the exact ordinary package', () => {
    const base = createInitialGameState()
    const funded = { ...base, nodeWallet: { ...base.nodeWallet, balanceNodeUnits: 10_000 } }
    const purchased = purchaseMarketOffer(funded, 'market-offer-rattler-1.0-v0')
    if (purchased.status !== 'purchased') throw new Error(purchased.status)
    const started = startMarketPackageDownload(purchased.state, 'market-offer-rattler-1.0-v0')
    if (started.status !== 'started') throw new Error(started.status)
    expect(getFilesystemFile(started.state.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
    const completed = advanceFileTransfer(started.state, 60_000)
    expect(getFilesystemFile(completed.player.localDevice.filesystem, '/home/user/downloads/rattler-1.0.pkg')).toMatchObject({
      status: 'ok', file: { kind: 'software_package', productId: RATTLER_1_0.productId, releaseId: RATTLER_1_0.releaseId, buildId: RATTLER_1_0.buildId, publisher: 'NULL//WORKS' },
    })
  })

  it('ordinary installation atomically creates exact InstalledSoftware and executable', () => {
    const installed = installRattler()
    expect(installed.player.localDevice.installedSoftware).toContainEqual(expect.objectContaining({
      id: RATTLER_1_0.productId, releaseId: RATTLER_1_0.releaseId, buildId: RATTLER_1_0.buildId,
      name: RATTLER_1_0.name, version: RATTLER_1_0.version, channel: RATTLER_1_0.channel, publisher: RATTLER_1_0.publisher,
    }))
    expect(getFilesystemFile(installed.player.localDevice.filesystem, RATTLER_INSTALLED_EXECUTABLE_PATH)).toMatchObject({
      status: 'ok', file: { kind: 'executable', programId: RATTLER_PROGRAM_ID, releaseId: RATTLER_1_0.releaseId, buildId: RATTLER_1_0.buildId },
    })
  })

  it('refuses atomically when the executable is missing or its release/build is wrong', () => {
    const valid = withKnownTarget()
    const before = valid.player.localDevice.filesystem
    for (const replacement of [undefined, { releaseId: 'stale-release' }, { buildId: 'wrong-build' }]) {
      const files = valid.player.localDevice.filesystem.files.flatMap((file) => file.path !== RATTLER_INSTALLED_EXECUTABLE_PATH ? [file]
        : replacement ? [{ ...file, ...replacement } as ExecutableFile] : [])
      const state = { ...valid, player: { ...valid.player, localDevice: { ...valid.player.localDevice, filesystem: { ...before, files } } } }
      const result = createRattlerPayload(state, knownAddress)
      expect(result).toEqual({ status: 'executable_unavailable', state })
      expect(result.state.player.localDevice.filesystem.files).toEqual(files)
    }
  })

  it('resolves only remembered Discovery and binds stable Device identity with an address snapshot', () => {
    const hidden = installRattler()
    expect(hidden.world.network.hosts.some(({ ip }) => ip === knownAddress)).toBe(true)
    expect(createRattlerPayload(hidden, knownAddress)).toEqual({ status: 'unknown_target', state: hidden })

    const known = withKnownTarget(hidden)
    const result = createRattlerPayload(known, knownAddress)
    if (result.status !== 'created') throw new Error(result.status)
    expect(result.file).toMatchObject({
      kind: 'rattler_payload', path: deriveRattlerPayloadPath(targetDeviceId), rattlerReleaseId: RATTLER_1_0.releaseId,
      rattlerBuildId: RATTLER_1_0.buildId, targetDeviceId, targetAddressSnapshot: knownAddress,
    })
    expect(createRattlerPayload(result.state, knownAddress)).toEqual({ status: 'destination_exists', state: result.state })
  })

  it('uploads as an ordinary copy while preserving metadata and causing no unrelated canonical mutation', () => {
    const created = createRattlerPayload(withKnownTarget(), knownAddress)
    if (created.status !== 'created') throw new Error(created.status)
    const access = { id: 'access-rattler-upload', sourceDeviceId: created.state.player.localDevice.id, targetDeviceId, viaServiceId: 'service-ssh-001', privilege: 'USER' as const }
    const authorized = { ...created.state, deviceAccess: { ...created.state.deviceAccess, established: [access] } }
    const connected = connectRemoteFromObservation(authorized, { targetDeviceId, address: knownAddress }).state
    const before = { process: connected.process, knowledge: connected.knowledge, discovery: connected.discovery, access: connected.deviceAccess, security: connected.world.network.hosts[0].security }
    const started = startRemoteFileUpload(connected, created.file.path, '/tmp/rattler-deploy.rpl')
    if (started.status !== 'started') throw new Error(started.status)
    const completed = advanceFileTransfer(started.state, 60_000)
    const copied = getFilesystemFile(completed.world.network.hosts[0].filesystem!, '/tmp/rattler-deploy.rpl')
    expect(copied).toMatchObject({ status: 'ok', file: { ...created.file, id: expect.not.stringMatching(created.file.id), path: '/tmp/rattler-deploy.rpl' } })
    expect(completed.process).toBe(before.process)
    expect(completed.knowledge).toBe(before.knowledge)
    expect(completed.discovery).toBe(before.discovery)
    expect(completed.deviceAccess).toBe(before.access)
    expect(completed.world.network.hosts[0].security).toBe(before.security)
  })
})
