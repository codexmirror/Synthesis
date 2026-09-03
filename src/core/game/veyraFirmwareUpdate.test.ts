import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { connectRemoteFromObservation } from './remoteSession'
import { advanceGameState } from './gameAdvancement'
import { vulnerabilitiesForService } from './serviceImplementations'
import { resolveCompletedCredentialAccess } from './credentialAccess'
import { VEYRA_OS_4_1_FIRMWARE_ID, VEYRA_OS_4_2_FIRMWARE_ID } from './firmwareIdentity'
import {
  advanceVeyraFirmwareUpdates,
  deriveVeyraFirmwareUpdateProgress,
  resolveAvailableVeyraFirmwareUpdate,
  startVeyraFirmwareUpdateForOperatedRemoteDevice,
  VEYRA_FIRMWARE_UPDATE_DURATION_MS,
  VEYRA_OS_4_2_RELEASE,
} from './veyraFirmwareUpdate'
import type { CredentialAccessProcess, GameState, NetworkHost } from './types'

const PHONE_ID = 'host-phone-001'
const PHONE_PIN = '7042'
const SRV_02_ID = 'host-lan-002'

/** An entered-Session world for the represented VEYRA phone, reached the way the game reaches it. */
function phoneConnectedState(state = createInitialGameState()): GameState {
  const accessed: GameState = {
    ...state,
    deviceAccess: { nextId: 2, established: [{
      id: 'access-phone', sourceDeviceId: state.player.localDevice.id,
      targetDeviceId: PHONE_ID, viaServiceId: 'service-ssh-003', privilege: 'USER',
    }] },
  }
  return connectRemoteFromObservation(accessed, { targetDeviceId: PHONE_ID, address: '198.51.100.61' }).state
}

const phoneOf = (state: GameState): NetworkHost => state.world.network.hosts.find(({ id }) => id === PHONE_ID)!
const phoneSsh = (state: GameState) => phoneOf(state).services!.find(({ id }) => id === 'service-ssh-003')!

/** Runs the whole represented installation the way the game does: canonical advancement only. */
function installFully(state: GameState, stepMs = 500): GameState {
  let next = state
  for (let elapsed = 0; elapsed <= VEYRA_FIRMWARE_UPDATE_DURATION_MS + stepMs; elapsed += stepMs) next = advanceGameState(next, stepMs)
  return next
}

describe('available VEYRA firmware release', () => {
  it('offers exactly one concrete newer release to the phone on VEYRA OS 4.1', () => {
    const phone = phoneOf(createInitialGameState())
    expect(phone.firmware?.id).toBe(VEYRA_OS_4_1_FIRMWARE_ID)
    expect(resolveAvailableVeyraFirmwareUpdate(phone)).toBe(VEYRA_OS_4_2_RELEASE)
    expect(VEYRA_OS_4_2_RELEASE.firmware).toEqual({ id: VEYRA_OS_4_2_FIRMWARE_ID, name: 'VEYRA OS', version: '4.2' })
  })

  it('offers nothing to a Device already on the newer release, or to another Firmware family', () => {
    const state = createInitialGameState()
    expect(resolveAvailableVeyraFirmwareUpdate({ firmware: VEYRA_OS_4_2_RELEASE.firmware })).toBeUndefined()
    expect(resolveAvailableVeyraFirmwareUpdate(state.world.network.hosts.find(({ id }) => id === SRV_02_ID)!)).toBeUndefined()
    expect(resolveAvailableVeyraFirmwareUpdate({ firmware: undefined })).toBeUndefined()
  })

  it('resolves availability from stable Firmware identity, never the mutable display version', () => {
    const renamed = { firmware: { id: VEYRA_OS_4_1_FIRMWARE_ID, name: 'Phone System', version: '9.9' } }
    expect(resolveAvailableVeyraFirmwareUpdate(renamed)).toBe(VEYRA_OS_4_2_RELEASE)
  })
})

describe('starting a firmware update', () => {
  it('requires the operated Device’s own correct PIN', () => {
    const before = phoneConnectedState()
    const started = startVeyraFirmwareUpdateForOperatedRemoteDevice(before, PHONE_PIN)
    expect(started.status).toBe('started')
    expect(phoneOf(started.state).firmwareUpdate).toEqual({ releaseId: VEYRA_OS_4_2_FIRMWARE_ID, phase: 'DOWNLOADING', elapsedMs: 0 })
  })

  it('changes no firmware state at all on a wrong PIN', () => {
    const before = phoneConnectedState()
    const refused = startVeyraFirmwareUpdateForOperatedRemoteDevice(before, '0000')
    expect(refused.status).toBe('invalid_pin')
    expect(refused.state).toBe(before)
    expect(phoneOf(refused.state).firmwareUpdate).toBeUndefined()
    expect(phoneOf(refused.state).firmware?.id).toBe(VEYRA_OS_4_1_FIRMWARE_ID)
  })

  it('grants no authority from an established Remote Session by itself', () => {
    // The Session is real and the phone is being operated; without the Device's
    // own PIN nothing about its firmware changes.
    const connected = phoneConnectedState()
    expect(connected.remoteSession.active).not.toBeNull()
    expect(startVeyraFirmwareUpdateForOperatedRemoteDevice(connected, '1234').status).toBe('invalid_pin')
    expect(phoneOf(connected).firmwareUpdate).toBeUndefined()
  })

  it('refuses without an active Remote Session, so no caller can name a Device', () => {
    const state = createInitialGameState()
    const refused = startVeyraFirmwareUpdateForOperatedRemoteDevice(state, PHONE_PIN)
    expect(refused.status).toBe('session_unavailable')
    expect(refused.state).toBe(state)
  })

  it('refuses a second update while one is already installing', () => {
    const running = startVeyraFirmwareUpdateForOperatedRemoteDevice(phoneConnectedState(), PHONE_PIN).state
    const again = startVeyraFirmwareUpdateForOperatedRemoteDevice(running, PHONE_PIN)
    expect(again.status).toBe('update_in_progress')
    expect(again.state).toBe(running)
  })

  it('refuses once the Device already owns the newest represented release', () => {
    const installed = installFully(startVeyraFirmwareUpdateForOperatedRemoteDevice(phoneConnectedState(), PHONE_PIN).state)
    const again = startVeyraFirmwareUpdateForOperatedRemoteDevice(installed, PHONE_PIN)
    expect(again.status).toBe('update_unavailable')
    expect(phoneOf(again.state).firmware?.id).toBe(VEYRA_OS_4_2_FIRMWARE_ID)
    expect(phoneOf(again.state).firmwareUpdate).toBeUndefined()
  })
})

describe('the represented installation', () => {
  it('progresses through its represented stages on canonical advancement alone', () => {
    let state = startVeyraFirmwareUpdateForOperatedRemoteDevice(phoneConnectedState(), PHONE_PIN).state
    const phases: string[] = []
    for (let step = 0; step < 12; step += 1) {
      state = advanceGameState(state, 2_000)
      const progress = phoneOf(state).firmwareUpdate
      if (progress && phases[phases.length - 1] !== progress.phase) phases.push(progress.phase)
    }
    expect(phases).toEqual(['DOWNLOADING', 'PREPARING', 'INSTALLING', 'FINALIZING'])
  })

  it('never moves the Device’s operational lifecycle/connectivity or ends the active Remote Session, at any stage', () => {
    // This hardening pass deliberately does not implement a real Device
    // reboot: the installation must not silently invalidate the Session or
    // touch operational truth a real boot boundary would own.
    const before = phoneConnectedState()
    let state = startVeyraFirmwareUpdateForOperatedRemoteDevice(before, PHONE_PIN).state
    for (let step = 0; step < 12; step += 1) {
      state = advanceGameState(state, 2_000)
      expect(phoneOf(state).operational).toEqual(phoneOf(before).operational)
      expect(state.remoteSession.active).toEqual(before.remoteSession.active)
    }
    // Completion crosses no boot boundary either.
    expect(phoneOf(state).firmwareUpdate).toBeUndefined()
    expect(phoneOf(state).operational).toEqual(phoneOf(before).operational)
    expect(state.remoteSession.active).toEqual(before.remoteSession.active)
  })

  it('is not finished, and has not changed the Firmware, part way through', () => {
    const started = startVeyraFirmwareUpdateForOperatedRemoteDevice(phoneConnectedState(), PHONE_PIN).state
    const midway = advanceVeyraFirmwareUpdates(started, VEYRA_FIRMWARE_UPDATE_DURATION_MS / 2)
    expect(phoneOf(midway).firmwareUpdate).toBeDefined()
    expect(phoneOf(midway).firmware?.id).toBe(VEYRA_OS_4_1_FIRMWARE_ID)
    expect(phoneSsh(midway).implementation.releaseId).toBe('gate-ssh-1.3.2')
    expect(deriveVeyraFirmwareUpdateProgress(phoneOf(midway).firmwareUpdate!)).toBeCloseTo(0.5, 2)
  })

  it('reaches the identical outcome whether elapsed time arrives in one step or many', () => {
    const started = startVeyraFirmwareUpdateForOperatedRemoteDevice(phoneConnectedState(), PHONE_PIN).state
    const oneStep = advanceVeyraFirmwareUpdates(started, VEYRA_FIRMWARE_UPDATE_DURATION_MS)
    let manySteps = started
    for (let elapsed = 0; elapsed < VEYRA_FIRMWARE_UPDATE_DURATION_MS; elapsed += 100) manySteps = advanceVeyraFirmwareUpdates(manySteps, 100)
    expect(phoneOf(oneStep).firmware).toEqual(phoneOf(manySteps).firmware)
    expect(phoneOf(oneStep).firmwareUpdate).toBeUndefined()
    expect(phoneOf(manySteps).firmwareUpdate).toBeUndefined()
  })

  it('advances without any operating surface presenting it, and is terminal once finished', () => {
    const started = startVeyraFirmwareUpdateForOperatedRemoteDevice(phoneConnectedState(), PHONE_PIN).state
    const installed = installFully(started)
    const laterStill = installFully(installed)
    expect(phoneOf(laterStill).firmware).toEqual(VEYRA_OS_4_2_RELEASE.firmware)
    expect(phoneOf(laterStill).firmwareUpdate).toBeUndefined()
    expect(phoneOf(laterStill).services).toEqual(phoneOf(installed).services)
  })

  it('drops an installation naming a release the world does not represent, without installing anything', () => {
    const connected = phoneConnectedState()
    const incoherent = advanceVeyraFirmwareUpdates({
      ...connected,
      world: { ...connected.world, network: { ...connected.world.network, hosts: connected.world.network.hosts.map((host) =>
        host.id === PHONE_ID ? { ...host, firmwareUpdate: { releaseId: 'firmware-veyra-os-v9-9', phase: 'INSTALLING' as const, elapsedMs: 0 } } : host) } },
    }, 60_000)
    expect(phoneOf(incoherent).firmwareUpdate).toBeUndefined()
    expect(phoneOf(incoherent).firmware?.id).toBe(VEYRA_OS_4_1_FIRMWARE_ID)
  })
})

describe('what the completed release actually changes', () => {
  const installed = () => installFully(startVeyraFirmwareUpdateForOperatedRemoteDevice(phoneConnectedState(), PHONE_PIN).state)

  it('replaces the Device’s canonical Firmware with the new stable release identity', () => {
    const before = phoneConnectedState()
    const after = installed()
    expect(phoneOf(before).firmware).toEqual({ id: VEYRA_OS_4_1_FIRMWARE_ID, name: 'VEYRA OS', version: '4.1' })
    expect(phoneOf(after).firmware).toEqual({ id: VEYRA_OS_4_2_FIRMWARE_ID, name: 'VEYRA OS', version: '4.2' })
  })

  it('moves the phone’s firmware-owned SSH implementation to the represented GateSSH 1.3.3', () => {
    const after = installed()
    expect(phoneSsh(after).implementation).toEqual({
      productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.3', buildId: 'build-gate-ssh-1.3.3-v0', name: 'GateSSH', version: '1.3.3',
    })
    // Service identity, port, openness and credential access are the Service's
    // own truth and are not re-authored by a firmware release.
    expect(phoneSsh(after).id).toBe('service-ssh-003')
    expect(phoneSsh(after).port).toBe(22)
    expect(phoneSsh(after).credentialAccess).toEqual({ privilege: 'USER' })
  })

  it('lets the resulting weakness follow the real implementation with no update-specific rule', () => {
    const before = phoneConnectedState()
    expect(vulnerabilitiesForService(phoneSsh(before)).map(({ id }) => id)).toEqual(['AUTH-017'])
    expect(vulnerabilitiesForService(phoneSsh(installed())).map(({ id }) => id)).toEqual(['AUTH-031'])
  })

  it('keeps firmware-owned GateSSH out of the phone’s InstalledSoftware inventory', () => {
    const after = installed()
    expect(phoneOf(after).installedSoftware).toEqual([])
    expect(phoneOf(after).pendingGateSshActivation).toBeUndefined()
    expect(phoneOf(after).filesystem?.files).toEqual([])
  })

  it('leaves Device security, Wallet protection, Knowledge and Dollar state untouched', () => {
    const before = phoneConnectedState()
    const after = installed()
    expect(phoneOf(after).security).toEqual({ devicePin: PHONE_PIN, walletProtectionEnabled: false })
    expect(after.knowledge).toEqual(before.knowledge)
    expect(after.dollarFinance).toEqual(before.dollarFinance)
    expect(after.deviceAccess).toEqual(before.deviceAccess)
    expect(phoneOf(after).operational).toEqual(phoneOf(before).operational)
  })

  it('lets an existing Credential Access attempt observe the resulting real surface', () => {
    // No update-specific rule exists anywhere in Credential Access: the same
    // resolution simply reads the Service implementation the phone now runs.
    const after = installed()
    const attempt = (vulnerabilityId: string): CredentialAccessProcess => ({
      kind: 'credential_access', id: 'process-0001', label: 'CREDENTIAL ACCESS', status: 'completed',
      executorDeviceId: after.player.localDevice.id, ramRequiredMiB: 896, workRequired: 1, workCompleted: 1,
      targetDeviceId: PHONE_ID, serviceId: 'service-ssh-003', startedEndpoint: '198.51.100.61:22',
      vulnerabilityId, toolId: 'keyprobe',
    })

    // The weakness the phone had before the update is simply not there now.
    const stale = resolveCompletedCredentialAccess(after, attempt('AUTH-017'), () => 0)
    expect(stale.process.result?.status).toBe('attempt_failed')
    expect(stale.deviceAccess.established).toEqual(after.deviceAccess.established)

    // The weakness GateSSH 1.3.3 really derives is exploitable at its own
    // represented profile, with no AuthGuard on this phone to blunt it.
    const current = resolveCompletedCredentialAccess(after, attempt('AUTH-031'), () => 0.4)
    expect(current.process.result?.status).toBe('access_established')
    expect(current.process.authGuardProtectionObserved).toBeUndefined()
  })

  it('changes nothing on any other represented Device', () => {
    const before = phoneConnectedState()
    const after = installed()
    for (const id of ['host-lan-001', SRV_02_ID, 'host-training-002']) {
      expect(after.world.network.hosts.find((host) => host.id === id)).toEqual(before.world.network.hosts.find((host) => host.id === id))
    }
  })
})
