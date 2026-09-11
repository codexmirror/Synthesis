import { describe, expect, it } from 'vitest'
import { canFormCredentialAccessAttempt, startCredentialAccessAttemptFromObservation } from './credentialAccess'
import { rememberScan } from './discovery'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { connectRemoteFromObservation, resolveActiveRemoteTarget } from './remoteSession'
import { scanNetworkTarget } from './scan'
import { startServiceAnalysis } from './serviceAnalysis'
import { VEYRA_OS_4_1_FIRMWARE_ID } from './firmwareIdentity'
import type { GameState } from './types'

const PHONE = 'host-phone-001'
const PHONE_ADDRESS = '198.51.100.61'
const observation = { endpoint: `${PHONE_ADDRESS}:22`, targetDeviceId: PHONE, serviceId: 'service-ssh-003', vulnerabilityId: 'AUTH-017' } as const

/**
 * The represented VEYRA phone is reachable through the game's existing
 * grammar and nothing else: the player scans, finds the represented weakness,
 * uses the tool they already have, and connects. No phone-specific mechanic,
 * operation or shortcut exists, and this proves each step actually happens.
 */
describe('reaching the VEYRA phone through the existing access loop', () => {
  it('is not discovered by scanning SELF\'s Network', () => {
    const state = createInitialGameState()
    const targets = { localDevice: state.player.localDevice, network: state.world.network }
    const result = scanNetworkTarget(targets, 'home-net')

    expect(result.status).toBe('network'); if (result.status !== 'network') return
    expect(result.devices.map(({ targetId }) => targetId)).not.toContain(PHONE)
  })

  it('yields a way in only after real Scan and Endpoint Analysis of the exact GateSSH 1.3.2 surface, with zero named Vulnerability Knowledge, then establishes access and connects', () => {
    const base = createInitialGameState()
    const targets = { localDevice: base.player.localDevice, network: base.world.network }

    // Before any observation the player knows nothing about this Device.
    expect(canFormCredentialAccessAttempt(base, observation)).toBe(false)

    const scanned: GameState = { ...base, discovery: rememberScan(base.discovery, scanNetworkTarget(targets, PHONE_ADDRESS), base.player.localDevice.id) }
    expect(scanned.discovery.devices).toContainEqual(expect.objectContaining({ id: PHONE, address: PHONE_ADDRESS, scope: 'remote' }))
    // A remembered Service alone, with no Endpoint Analysis yet, is not a formed route.
    expect(canFormCredentialAccessAttempt(scanned, observation)).toBe(false)

    const analysis = startServiceAnalysis(scanned, PHONE, observation.serviceId)
    expect(analysis.status).toBe('started'); if (analysis.status !== 'started') return
    const analyzed = advanceGameState(analysis.state, 20_000)
    // Endpoint Analysis remembers implementation evidence only; it never creates named Vulnerability Knowledge.
    expect(analyzed.knowledge.discoveredVulnerabilities).toEqual([])

    // GhostKey forms directly from the legitimately remembered GateSSH 1.3.2 fingerprint and the owned
    // GhostKey artifact/capability alone: zero named Vulnerability Knowledge is required.
    expect(canFormCredentialAccessAttempt(analyzed, observation)).toBe(true)

    const attempt = startCredentialAccessAttemptFromObservation(analyzed, observation)
    expect(attempt.status).toBe('started'); if (attempt.status !== 'started') return
    // Deterministic while the surface remains valid: the specialized module never rolls a chance.
    const attacked = advanceGameState(attempt.state, 40_000)
    expect(attacked.knowledge.discoveredVulnerabilities).toEqual([])
    const access = attacked.deviceAccess.established.find(({ targetDeviceId }) => targetDeviceId === PHONE)
    expect(access).toMatchObject({ sourceDeviceId: base.player.localDevice.id, viaServiceId: observation.serviceId, privilege: 'USER' })

    const connected = connectRemoteFromObservation(attacked, { targetDeviceId: PHONE, address: PHONE_ADDRESS })
    expect(connected.status).toBe('connected')

    // The entered target resolves to the phone and to its own Firmware.
    const entered = resolveActiveRemoteTarget(connected.state)
    expect(entered?.target.id).toBe(PHONE)
    expect(entered?.target.firmware?.id).toBe(VEYRA_OS_4_1_FIRMWARE_ID)
  })

  it('requires the credential tool the player already owns, and no phone-specific one', () => {
    const base = createInitialGameState()
    const targets = { localDevice: base.player.localDevice, network: base.world.network }
    const scanned: GameState = { ...base, discovery: rememberScan(base.discovery, scanNetworkTarget(targets, PHONE_ADDRESS), base.player.localDevice.id) }
    const analysis = startServiceAnalysis(scanned, PHONE, observation.serviceId)
    if (analysis.status !== 'started') throw new Error(analysis.status)
    const analyzed = advanceGameState(analysis.state, 20_000)

    const withoutTool: GameState = { ...analyzed, player: { ...analyzed.player, localDevice: { ...analyzed.player.localDevice, installedSoftware: analyzed.player.localDevice.installedSoftware.filter(({ id }) => id !== 'flipper'), filesystem: { ...analyzed.player.localDevice.filesystem, files: analyzed.player.localDevice.filesystem.files.filter((file) => file.kind !== 'software_module' || file.moduleId !== 'credential-access') } } } }
    expect(canFormCredentialAccessAttempt(withoutTool, observation)).toBe(false)
    // Removing the tool removes the offer without touching Discovery or Knowledge.
    expect(withoutTool.knowledge).toEqual(analyzed.knowledge)
    expect(withoutTool.discovery).toEqual(analyzed.discovery)
  })
})
