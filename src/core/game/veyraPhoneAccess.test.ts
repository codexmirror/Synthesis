import { describe, expect, it } from 'vitest'
import { canFormCredentialAccessAttempt, startCredentialAccessAttemptFromObservation } from './credentialAccess'
import { rememberScan } from './discovery'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { connectRemoteFromObservation, resolveActiveRemoteTarget } from './remoteSession'
import { scanFromDevice, scanNetworkTarget } from './scan'
import { startServiceAnalysis } from './serviceAnalysis'
import { VEYRA_OS_4_1_FIRMWARE_ID } from './firmwareIdentity'
import type { GameState } from './types'

const SRV_02 = 'host-lan-002'
const PHONE = 'host-phone-001'
const PHONE_ADDRESS = '10.42.0.61'
const observation = { endpoint: `${PHONE_ADDRESS}:22`, targetDeviceId: PHONE, serviceId: 'service-ssh-003', vulnerabilityId: 'AUTH-017' } as const

/**
 * The phone's own private segment (`network-foreign-001`) has no exposed
 * edge of its own: srv-02 — already compromised through Bookstore's public
 * Gateway edge — is the sole pivot into it. Fabricated directly here, like
 * every other precondition in this file, rather than re-simulating a
 * chance-based KeyProbe attack against srv-02.
 */
function pivotedThroughSrv02(state: GameState): GameState {
  return {
    ...state,
    deviceAccess: { ...state.deviceAccess, nextId: state.deviceAccess.nextId + 1, established: [...state.deviceAccess.established, {
      id: 'access-server', sourceDeviceId: state.player.localDevice.id,
      targetDeviceId: SRV_02, viaServiceId: 'service-ssh-002',
      viaServiceBuildId: 'build-gate-ssh-1.3.3-v0', viaVulnerabilityId: 'AUTH-031', privilege: 'USER' as const,
    }] },
  }
}

/**
 * The represented VEYRA phone is reachable through the game's existing
 * grammar and nothing else: once srv-02 is compromised, the player pivots a
 * Scan through it, finds the represented weakness, uses the tool they
 * already have, and connects. No phone-specific mechanic, operation or
 * shortcut exists, and this proves each step actually happens.
 */
describe('reaching the VEYRA phone through the existing access loop', () => {
  it('is not discovered by scanning SELF\'s Network', () => {
    const state = createInitialGameState()
    const targets = { localDevice: state.player.localDevice, network: state.world.network }
    const result = scanNetworkTarget(targets, 'home-net')

    expect(result.status).toBe('network'); if (result.status !== 'network') return
    expect(result.devices.map(({ targetId }) => targetId)).not.toContain(PHONE)
  })

  it('yields a way in only after pivoting a Scan through compromised srv-02 and real Endpoint Analysis of the exact GateSSH 1.3.2 surface, with zero named Vulnerability Knowledge, then establishes access and connects', () => {
    const base = createInitialGameState()

    // Before any observation the player knows nothing about this Device.
    expect(canFormCredentialAccessAttempt(base, observation)).toBe(false)

    const pivoted = pivotedThroughSrv02(base)
    // The player's own Device has no route into the phone's private segment at all.
    expect(scanFromDevice(pivoted, pivoted.player.localDevice.id, PHONE_ADDRESS)).toMatchObject({ status: 'no_response' })

    // Scanning sourced from the compromised srv-02 reveals it: srv-02 sits on the same private LocalNetwork.
    const scanned: GameState = { ...pivoted, discovery: rememberScan(pivoted.discovery, scanFromDevice(pivoted, SRV_02, PHONE_ADDRESS), SRV_02) }
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

    // Connect resolves through the same compromised srv-02 pivot: the player's own Device still has no direct route.
    const connected = connectRemoteFromObservation(attacked, { targetDeviceId: PHONE, address: PHONE_ADDRESS })
    expect(connected.status).toBe('connected')

    // The entered target resolves to the phone and to its own Firmware.
    const entered = resolveActiveRemoteTarget(connected.state)
    expect(entered?.target.id).toBe(PHONE)
    expect(entered?.target.firmware?.id).toBe(VEYRA_OS_4_1_FIRMWARE_ID)
  })

  it('requires the credential tool the player already owns, and no phone-specific one', () => {
    const pivoted = pivotedThroughSrv02(createInitialGameState())
    const scanned: GameState = { ...pivoted, discovery: rememberScan(pivoted.discovery, scanFromDevice(pivoted, SRV_02, PHONE_ADDRESS), SRV_02) }
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
