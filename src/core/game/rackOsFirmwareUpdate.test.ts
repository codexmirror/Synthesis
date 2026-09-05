import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { connectRemoteFromObservation } from './remoteSession'
import { advanceGameState } from './gameAdvancement'
import { advanceDeviceFirmwareUpdates } from './deviceFirmwareUpdate'
import { RACK_OS_1_1_BUSINESS_FIRMWARE_ID, RACK_OS_FIRMWARE_ID, VEYRA_OS_4_1_FIRMWARE_ID, isRackOsFirmwareId } from './firmwareIdentity'
import {
  deriveRackOsFirmwareInstallability,
  deriveRackOsFirmwareUpdateProgress,
  RACK_OS_1_1_BUSINESS_RELEASE,
  RACK_OS_FIRMWARE_INSTALLER_FILENAME,
  RACK_OS_FIRMWARE_UPDATE_DURATION_MS,
  resolveInstallingRackOsFirmwareRelease,
  startRackOsFirmwareUpdateForOperatedRemoteDevice,
} from './rackOsFirmwareUpdate'
import { installLocalSoftwarePackage, installRemoteSoftwarePackage } from './softwareInstallation'
import { startRemoteFileUpload } from './fileTransfer'
import type { FirmwarePackageFile, GameState, NetworkHost } from './types'

const SRV_02_ID = 'host-lan-002'
const SRV_01_ID = 'host-lan-001'
const PHONE_ID = 'host-phone-001'
const INSTALLER_PATH = `/opt/firmware/${RACK_OS_FIRMWARE_INSTALLER_FILENAME}`

/** The exact represented installer artifact, as a completed Market download produces it. */
function installerArtifact(id: string, path = INSTALLER_PATH): FirmwarePackageFile {
  return {
    kind: 'firmware_package', id, path,
    firmwareId: RACK_OS_1_1_BUSINESS_RELEASE.firmware.id,
    buildId: RACK_OS_1_1_BUSINESS_RELEASE.buildId,
    name: RACK_OS_1_1_BUSINESS_RELEASE.firmware.name,
    version: RACK_OS_1_1_BUSINESS_RELEASE.firmware.version,
    publisher: RACK_OS_1_1_BUSINESS_RELEASE.publisher,
    sizeBytes: RACK_OS_1_1_BUSINESS_RELEASE.installerSizeBytes,
  }
}

function hostOf(state: GameState, id: string): NetworkHost {
  return state.world.network.hosts.find((host) => host.id === id)!
}

function withArtifactOn(state: GameState, deviceId: string, file = installerArtifact('file-firmware')): GameState {
  return {
    ...state,
    world: { ...state.world, network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === deviceId
      ? { ...host, filesystem: { nextFileId: host.filesystem!.nextFileId + 1, files: [...host.filesystem!.files, file] } }
      : host) } },
  }
}

/** An authorized, connected Session operating one represented server. */
function operating(deviceId: string, address: string, viaServiceId: string, base: GameState = createInitialGameState()): GameState {
  const access = { id: `access-${deviceId}`, sourceDeviceId: base.player.localDevice.id, targetDeviceId: deviceId, viaServiceId, privilege: 'USER' as const }
  const authorized = { ...base, deviceAccess: { nextId: 2, established: [access] } }
  const connected = connectRemoteFromObservation(authorized, { targetDeviceId: deviceId, address })
  if (connected.status !== 'connected') throw new Error(`expected a connected Session, got ${connected.status}`)
  return connected.state
}

function operatingSrv02(base?: GameState): GameState {
  return withArtifactOn(operating(SRV_02_ID, '203.0.113.42', 'service-ssh-002', base), SRV_02_ID)
}

function started(state: GameState): GameState {
  const result = startRackOsFirmwareUpdateForOperatedRemoteDevice(state, INSTALLER_PATH)
  if (result.status !== 'started') throw new Error(`expected started, got ${result.status}`)
  return result.state
}

describe('the represented RACK-OS releases', () => {
  it('keeps RACK-OS 1.0 as its own stable identity and adds 1.1 Business as a separate release', () => {
    expect(RACK_OS_FIRMWARE_ID).toBe('firmware-rack-os-v1')
    expect(RACK_OS_1_1_BUSINESS_FIRMWARE_ID).not.toBe(RACK_OS_FIRMWARE_ID)
    expect(RACK_OS_1_1_BUSINESS_RELEASE.firmware.id).toBe(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)
    // Player-facing presentation reads exactly "RACK-OS 1.1 Business".
    expect(`${RACK_OS_1_1_BUSINESS_RELEASE.firmware.name} ${RACK_OS_1_1_BUSINESS_RELEASE.firmware.version}`).toBe('RACK-OS 1.1 Business')
  })

  it('resolves both releases to the RACK-OS family from stable identity, never from a display name', () => {
    expect(isRackOsFirmwareId(RACK_OS_FIRMWARE_ID)).toBe(true)
    expect(isRackOsFirmwareId(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)).toBe(true)
    expect(isRackOsFirmwareId(VEYRA_OS_4_1_FIRMWARE_ID)).toBe(false)
    expect(isRackOsFirmwareId(undefined)).toBe(false)
  })

  it('starts both represented servers on RACK-OS 1.0, so the upgrade path is real gameplay', () => {
    const state = createInitialGameState()
    expect(hostOf(state, SRV_01_ID).firmware).toEqual({ id: RACK_OS_FIRMWARE_ID, name: 'RACK-OS', version: '1.0' })
    expect(hostOf(state, SRV_02_ID).firmware).toEqual({ id: RACK_OS_FIRMWARE_ID, name: 'RACK-OS', version: '1.0' })
    expect(state.world.network.hosts.every((host) => host.firmwareUpdate === undefined)).toBe(true)
  })
})

describe('the firmware installer artifact', () => {
  it('is an artifact rather than Firmware, InstalledSoftware or an installable package', () => {
    const state = operatingSrv02()
    const artifact = hostOf(state, SRV_02_ID).filesystem!.files.at(-1)!
    expect(artifact.kind).toBe('firmware_package')
    // Possessing the installer is not running the release it installs.
    expect(hostOf(state, SRV_02_ID).firmware?.id).toBe(RACK_OS_FIRMWARE_ID)
    expect(hostOf(state, SRV_02_ID).installedSoftware?.some(({ id }) => id.includes('rack-os'))).toBe(false)
    // No software installation path admits it, locally or remotely.
    expect(installRemoteSoftwarePackage(state, INSTALLER_PATH).status).toBe('not_software_package')
  })

  it('cannot be installed as software on the local NODE-OS Device', () => {
    const base = createInitialGameState()
    const local = base.player.localDevice
    const localCopy: GameState = { ...base, player: { ...base.player, localDevice: { ...local, filesystem: {
      nextFileId: local.filesystem.nextFileId + 1,
      files: [...local.filesystem.files, installerArtifact('file-local-firmware', '/home/user/downloads/rack-os-1.1-business.fwpkg')],
    } } } }
    expect(installLocalSoftwarePackage(localCopy, '/home/user/downloads/rack-os-1.1-business.fwpkg').status).toBe('not_software_package')
    expect(localCopy.player.localDevice.firmware.name).toBe('NODE-OS')
    expect(localCopy.player.localDevice.installedSoftware).toEqual(base.player.localDevice.installedSoftware)
  })

  it('keeps its firmware identity across an ordinary transfer while taking a new copy identity', () => {
    const base = createInitialGameState()
    const local = base.player.localDevice
    const withLocalCopy: GameState = { ...base, player: { ...base.player, localDevice: { ...local, filesystem: {
      nextFileId: local.filesystem.nextFileId + 1,
      files: [...local.filesystem.files, installerArtifact('file-local-firmware', '/home/user/downloads/rack-os-1.1-business.fwpkg')],
    } } } }
    const connected = operating(SRV_02_ID, '203.0.113.42', 'service-ssh-002', withLocalCopy)
    const upload = startRemoteFileUpload(connected, '/home/user/downloads/rack-os-1.1-business.fwpkg', INSTALLER_PATH)
    expect(upload.status).toBe('started')
    const delivered = advanceGameState(upload.state, 120_000)
    const copy = hostOf(delivered, SRV_02_ID).filesystem!.files.find(({ path }) => path === INSTALLER_PATH)!
    expect(copy).toMatchObject({
      kind: 'firmware_package',
      firmwareId: RACK_OS_1_1_BUSINESS_RELEASE.firmware.id,
      buildId: RACK_OS_1_1_BUSINESS_RELEASE.buildId,
    })
    expect(copy.id).not.toBe('file-local-firmware')
    // The source copy is still there; a transfer copies, it does not consume.
    expect(delivered.player.localDevice.filesystem.files.some(({ id }) => id === 'file-local-firmware')).toBe(true)
  })
})

describe('admitting a RACK-OS firmware installation', () => {
  it('resolves the target from the active Session rather than from a caller-supplied Device', () => {
    const noSession = withArtifactOn(createInitialGameState(), SRV_02_ID)
    expect(startRackOsFirmwareUpdateForOperatedRemoteDevice(noSession, INSTALLER_PATH).status).toBe('session_unavailable')
    // Operating srv-01 cannot reach srv-02's artifact, even by naming its path.
    const operatingSrv01 = withArtifactOn(operating(SRV_01_ID, '198.51.100.47', 'service-ssh-001'), SRV_02_ID)
    expect(startRackOsFirmwareUpdateForOperatedRemoteDevice(operatingSrv01, INSTALLER_PATH).status).toBe('artifact_not_found')
    expect(hostOf(operatingSrv01, SRV_02_ID).firmwareUpdate).toBeUndefined()
  })

  it('refuses anything that is not the exact represented firmware build, without mutating anything', () => {
    const base = operatingSrv02()
    expect(startRackOsFirmwareUpdateForOperatedRemoteDevice(base, '/srv/backup-manifest.txt').status).toBe('not_firmware_artifact')
    expect(startRackOsFirmwareUpdateForOperatedRemoteDevice(base, '/srv/nothing-here.fwpkg').status).toBe('artifact_not_found')

    // A file with the right extension and name but a different build is not this release.
    const wrongBuild = withArtifactOn(operating(SRV_02_ID, '203.0.113.42', 'service-ssh-002'), SRV_02_ID,
      { ...installerArtifact('file-wrong-build'), buildId: 'build-rack-os-1-1-business-counterfeit' })
    const refused = startRackOsFirmwareUpdateForOperatedRemoteDevice(wrongBuild, INSTALLER_PATH)
    expect(refused.status).toBe('unrecognized_artifact')
    expect(refused.state).toBe(wrongBuild)
  })

  it('fails closed on an incompatible Device and on one already running the release', () => {
    const phone = withArtifactOn(operating(PHONE_ID, '198.51.100.61', 'service-ssh-003'), PHONE_ID)
    const onPhone = startRackOsFirmwareUpdateForOperatedRemoteDevice(phone, INSTALLER_PATH)
    expect(onPhone.status).toBe('incompatible_device')
    expect(onPhone.state).toBe(phone)
    expect(hostOf(phone, PHONE_ID).firmware?.id).toBe(VEYRA_OS_4_1_FIRMWARE_ID)

    const alreadyOn11 = installed(operatingSrv02())
    const reconnected = operating(SRV_02_ID, '203.0.113.42', 'service-ssh-002', alreadyOn11)
    const again = startRackOsFirmwareUpdateForOperatedRemoteDevice(reconnected, INSTALLER_PATH)
    expect(again.status).toBe('already_installed')
    expect(again.state).toBe(reconnected)
  })

  it('refuses a second installation while one is already running', () => {
    const running = started(operatingSrv02())
    const again = startRackOsFirmwareUpdateForOperatedRemoteDevice(running, INSTALLER_PATH)
    expect(again.status).toBe('update_in_progress')
    expect(again.state).toBe(running)
  })

  it('states the same installability the admission enforces, for every case', () => {
    const artifact = installerArtifact('file-firmware')
    expect(deriveRackOsFirmwareInstallability(artifact, { firmware: { id: RACK_OS_FIRMWARE_ID, name: 'RACK-OS', version: '1.0' } })).toBe('installable')
    expect(deriveRackOsFirmwareInstallability(artifact, { firmware: RACK_OS_1_1_BUSINESS_RELEASE.firmware })).toBe('already_installed')
    expect(deriveRackOsFirmwareInstallability(artifact, { firmware: { id: VEYRA_OS_4_1_FIRMWARE_ID, name: 'VEYRA OS', version: '4.1' } })).toBe('incompatible_device')
    expect(deriveRackOsFirmwareInstallability({ ...artifact, buildId: 'other' }, { firmware: { id: RACK_OS_FIRMWARE_ID, name: 'RACK-OS', version: '1.0' } })).toBe('unrecognized_artifact')
  })

  it('changes only the operated Device firmware-update state, and never its Firmware immediately', () => {
    const before = operatingSrv02()
    const after = started(before)
    const target = hostOf(after, SRV_02_ID)
    expect(target.firmwareUpdate).toEqual({ releaseId: RACK_OS_1_1_BUSINESS_FIRMWARE_ID, phase: 'PREPARING', elapsedMs: 0 })
    expect(target.firmware).toEqual(hostOf(before, SRV_02_ID).firmware)
    expect(target.operational).toEqual(hostOf(before, SRV_02_ID).operational)
    expect(target.services).toEqual(hostOf(before, SRV_02_ID).services)
    expect(target.installedSoftware).toEqual(hostOf(before, SRV_02_ID).installedSoftware)
    expect(target.filesystem).toEqual(hostOf(before, SRV_02_ID).filesystem)
    // No other Device, and no Process, is touched by starting one Device's firmware update.
    expect(hostOf(after, SRV_01_ID)).toEqual(hostOf(before, SRV_01_ID))
    expect(hostOf(after, PHONE_ID)).toEqual(hostOf(before, PHONE_ID))
    expect(after.process).toEqual(before.process)
  })

  it('never fabricates a Downloading phase for an artifact already on the Device', () => {
    let state = started(operatingSrv02())
    const phases = new Set<string>([hostOf(state, SRV_02_ID).firmwareUpdate!.phase])
    for (let elapsed = 0; elapsed < RACK_OS_FIRMWARE_UPDATE_DURATION_MS; elapsed += 250) {
      state = advanceDeviceFirmwareUpdates(state, 250)
      const progress = hostOf(state, SRV_02_ID).firmwareUpdate
      if (progress) phases.add(progress.phase)
    }
    expect([...phases]).toEqual(['PREPARING', 'INSTALLING', 'FINALIZING'])
  })
})

describe('canonical advancement of the installation', () => {
  it('advances from canonical advancement alone, and reaches the same state from one large step or many small ones', () => {
    const base = started(operatingSrv02())
    const half = advanceDeviceFirmwareUpdates(base, RACK_OS_FIRMWARE_UPDATE_DURATION_MS / 2)
    expect(deriveRackOsFirmwareUpdateProgress(hostOf(half, SRV_02_ID).firmwareUpdate!)).toBeCloseTo(0.5, 2)

    const oneStep = advanceDeviceFirmwareUpdates(base, RACK_OS_FIRMWARE_UPDATE_DURATION_MS - 1_000)
    let manySteps = base
    for (let elapsed = 0; elapsed < RACK_OS_FIRMWARE_UPDATE_DURATION_MS - 1_000; elapsed += 100) manySteps = advanceDeviceFirmwareUpdates(manySteps, 100)
    expect(hostOf(manySteps, SRV_02_ID).firmwareUpdate).toEqual(hostOf(oneStep, SRV_02_ID).firmwareUpdate)
  })

  it('resolves the release being installed from represented truth, and drops an unrepresented one', () => {
    const running = hostOf(started(operatingSrv02()), SRV_02_ID).firmwareUpdate!
    expect(resolveInstallingRackOsFirmwareRelease(running)).toBe(RACK_OS_1_1_BUSINESS_RELEASE)
    expect(resolveInstallingRackOsFirmwareRelease({ ...running, releaseId: 'firmware-rack-os-v9-9' })).toBeUndefined()

    const connected = operatingSrv02()
    const incoherent = advanceDeviceFirmwareUpdates({
      ...connected,
      world: { ...connected.world, network: { ...connected.world.network, hosts: connected.world.network.hosts.map((host) =>
        host.id === SRV_02_ID ? { ...host, firmwareUpdate: { releaseId: 'firmware-rack-os-v9-9', phase: 'INSTALLING' as const, elapsedMs: 0 } } : host) } },
    }, 60_000)
    expect(hostOf(incoherent, SRV_02_ID).firmwareUpdate).toBeUndefined()
    expect(hostOf(incoherent, SRV_02_ID).firmware?.id).toBe(RACK_OS_FIRMWARE_ID)
  })

  it('keeps running with no Session observing it, and stays terminal once finished', () => {
    // The player disconnects the moment the installation starts. It belongs to the
    // Device, so it finishes anyway — no surface and no Session is keeping it alive.
    const abandoned: GameState = { ...started(operatingSrv02()), remoteSession: { nextId: 2, active: null } }
    let running = abandoned
    for (let elapsed = 0; elapsed <= RACK_OS_FIRMWARE_UPDATE_DURATION_MS + 20_000; elapsed += 500) running = advanceGameState(running, 500)
    expect(hostOf(running, SRV_02_ID).firmware).toEqual(RACK_OS_1_1_BUSINESS_RELEASE.firmware)
    expect(hostOf(running, SRV_02_ID).firmwareUpdate).toBeUndefined()

    let laterStill = running
    for (let elapsed = 0; elapsed < 60_000; elapsed += 500) laterStill = advanceGameState(laterStill, 500)
    expect(hostOf(laterStill, SRV_02_ID).firmware).toEqual(RACK_OS_1_1_BUSINESS_RELEASE.firmware)
    expect(hostOf(laterStill, SRV_02_ID).firmwareUpdate).toBeUndefined()
    expect(hostOf(laterStill, SRV_02_ID).services).toEqual(hostOf(running, SRV_02_ID).services)
  })
})

/** Runs one admitted installation to completion, including the real reboot it causes. */
function installed(state: GameState): GameState {
  let next = state.world.network.hosts.some((host) => host.firmwareUpdate) ? state : started(state)
  for (let elapsed = 0; elapsed <= RACK_OS_FIRMWARE_UPDATE_DURATION_MS + 20_000; elapsed += 500) next = advanceGameState(next, 500)
  return next
}

describe('what a completed RACK-OS installation actually changes', () => {
  const before = operatingSrv02()
  const after = installed(before)

  it('replaces the Device Firmware with the new stable release identity', () => {
    expect(hostOf(after, SRV_02_ID).firmware).toEqual({ id: RACK_OS_1_1_BUSINESS_FIRMWARE_ID, name: 'RACK-OS', version: '1.1 Business' })
    expect(hostOf(after, SRV_02_ID).firmwareUpdate).toBeUndefined()
  })

  it('enters the real Device reboot lifecycle rather than simulating one in presentation', () => {
    const midInstall = advanceGameState(started(before), RACK_OS_FIRMWARE_UPDATE_DURATION_MS + 500)
    expect(hostOf(midInstall, SRV_02_ID).operational).toEqual({ lifecycle: 'SHUTTING_DOWN', connectivity: 'DISCONNECTED' })
    expect(hostOf(midInstall, SRV_02_ID).connectivityRecovery?.phase).toBe('SHUTTING_DOWN')

    const booting = advanceGameState(midInstall, 5_000)
    expect(hostOf(booting, SRV_02_ID).operational.lifecycle).toBe('BOOTING')

    // And it really comes back through the ordinary recovery lifecycle.
    expect(hostOf(after, SRV_02_ID).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    expect(hostOf(after, SRV_02_ID).connectivityRecovery).toBeUndefined()
  })

  it('loses the Remote Session through canonical reachability rather than by deleting it', () => {
    // The update itself never touches the Session: only the Session owner does.
    const activationOnly = advanceDeviceFirmwareUpdates(started(before), RACK_OS_FIRMWARE_UPDATE_DURATION_MS)
    expect(hostOf(activationOnly, SRV_02_ID).firmware?.id).toBe(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)
    expect(activationOnly.remoteSession.active).not.toBeNull()

    expect(advanceGameState(started(before), RACK_OS_FIRMWARE_UPDATE_DURATION_MS).remoteSession.active).toBeNull()
    expect(after.remoteSession.active).toBeNull()
  })

  it('leaves GateSSH, AuthGuard, BranchOps, the filesystem, branch commerce and finance exactly as they were', () => {
    expect(hostOf(after, SRV_02_ID).services).toEqual(hostOf(before, SRV_02_ID).services)
    expect(hostOf(after, SRV_02_ID).installedSoftware).toEqual(hostOf(before, SRV_02_ID).installedSoftware)
    expect(hostOf(after, SRV_02_ID).filesystem).toEqual(hostOf(before, SRV_02_ID).filesystem)
    expect(hostOf(after, SRV_02_ID).hardware).toEqual(hostOf(before, SRV_02_ID).hardware)
    expect(after.bookstoreBranch).toEqual(before.bookstoreBranch)
    expect(after.dollarFinance).toEqual(before.dollarFinance)
    expect(after.nodeWallet).toEqual(before.nodeWallet)
    expect(after.world.network.localNetworks).toEqual(before.world.network.localNetworks)
    // Unrelated Devices are untouched by another Device installing firmware.
    expect(hostOf(after, PHONE_ID)).toEqual(hostOf(before, PHONE_ID))
    expect(hostOf(after, SRV_01_ID)).toEqual(hostOf(before, SRV_01_ID))
  })

  it('keeps established DeviceAccess valid, because the access Service build was never replaced', () => {
    expect(after.deviceAccess.established).toEqual(before.deviceAccess.established)
    const reconnected = connectRemoteFromObservation(after, { targetDeviceId: SRV_02_ID, address: '203.0.113.42' })
    expect(reconnected.status).toBe('connected')
    expect(hostOf(reconnected.state, SRV_02_ID).firmware?.id).toBe(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)
  })

  it('installs onto a compatible server that has no BranchOps relationship at all', () => {
    const srv01 = withArtifactOn(operating(SRV_01_ID, '198.51.100.47', 'service-ssh-001'), SRV_01_ID)
    const upgraded = installed(srv01)
    expect(hostOf(upgraded, SRV_01_ID).firmware?.id).toBe(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)
    expect(hostOf(upgraded, SRV_01_ID).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    expect(upgraded.bookstoreBranch.operationsDeviceId).toBe(SRV_02_ID)
    expect(hostOf(upgraded, SRV_01_ID).installedSoftware).toEqual(hostOf(srv01, SRV_01_ID).installedSoftware)
  })
})
