import { describe, expect, it } from 'vitest'
import { canFormCredentialAccessAttempt, startCredentialAccessAttemptFromObservation } from './credentialAccess'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { connectRemoteFromObservation, resolveActiveRemoteTarget } from './remoteSession'
import { scanFromDevice, scanNetworkTarget } from './scan'
import { startServiceAnalysisAtEndpoint } from './serviceAnalysis'
import { VEYRA_OS_4_1_FIRMWARE_ID } from './firmwareIdentity'
import type { GameState } from './types'

const PHONE = 'host-phone-001'
const PHONE_PRIVATE_ADDRESS = '10.42.0.61'
const PHONE_PUBLIC_ENDPOINT = '203.0.113.42:2222'
const observation = { endpoint: PHONE_PUBLIC_ENDPOINT, targetDeviceId: PHONE, serviceId: 'service-ssh-003', vulnerabilityId: 'AUTH-017' } as const

/**
 * The represented VEYRA phone is reachable through the game's existing
 * grammar and nothing else: it sits on Bookstore's own private segment, but
 * its Gateway forwards its GateSSH surface out to its own public edge, just
 * like srv-02's — the player analyzes that exposed endpoint from their own
 * Device, finds the represented weakness, uses the tool they already have,
 * and connects. No phone-specific mechanic, operation, or shortcut exists,
 * and this proves each step actually happens.
 */
describe('reaching the VEYRA phone through the existing access loop', () => {
  it('is not discovered by scanning SELF\'s Network', () => {
    const state = createInitialGameState()
    const targets = { localDevice: state.player.localDevice, network: state.world.network }
    const result = scanNetworkTarget(targets, 'home-net')

    expect(result.status).toBe('network'); if (result.status !== 'network') return
    expect(result.devices.map(({ targetId }) => targetId)).not.toContain(PHONE)
  })

  it('yields a way in only after real Endpoint Analysis of the exact GateSSH 1.3.2 surface reached through the Gateway\'s own public edge, with zero named Vulnerability Knowledge, then establishes access and connects', () => {
    const base = createInitialGameState()

    // Before any observation the player knows nothing about this Device.
    expect(canFormCredentialAccessAttempt(base, observation)).toBe(false)

    // The player's own Device has no route to the phone's private address at all — only its Gateway's own public edge.
    expect(scanFromDevice(base, base.player.localDevice.id, PHONE_PRIVATE_ADDRESS)).toMatchObject({ status: 'no_response' })

    const analysis = startServiceAnalysisAtEndpoint(base, PHONE_PUBLIC_ENDPOINT)
    expect(analysis.status).toBe('started'); if (analysis.status !== 'started') return
    const analyzed = advanceGameState(analysis.state, 20_000)
    // Endpoint Analysis remembers implementation evidence only; it never creates named Vulnerability Knowledge.
    expect(analyzed.knowledge.discoveredVulnerabilities).toEqual([])
    // The Analysis reached through the public exposure remembers the phone by the endpoint the player
    // actually dialed, never its private backend address.
    expect(analyzed.discovery.devices.find(({ id }) => id === PHONE)).toMatchObject({ address: '203.0.113.42' })

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

    // Connect resolves through the same public Gateway edge the Analysis and Access were formed through.
    const connected = connectRemoteFromObservation(attacked, { targetDeviceId: PHONE, address: '203.0.113.42' })
    expect(connected.status).toBe('connected')

    // The entered target resolves to the phone and to its own Firmware.
    const entered = resolveActiveRemoteTarget(connected.state)
    expect(entered?.target.id).toBe(PHONE)
    expect(entered?.target.firmware?.id).toBe(VEYRA_OS_4_1_FIRMWARE_ID)
  })

  it('requires the credential tool the player already owns, and no phone-specific one', () => {
    const base = createInitialGameState()
    const analysis = startServiceAnalysisAtEndpoint(base, PHONE_PUBLIC_ENDPOINT)
    if (analysis.status !== 'started') throw new Error(analysis.status)
    const analyzed = advanceGameState(analysis.state, 20_000)

    const withoutTool: GameState = { ...analyzed, player: { ...analyzed.player, localDevice: { ...analyzed.player.localDevice, installedSoftware: analyzed.player.localDevice.installedSoftware.filter(({ id }) => id !== 'flipper'), filesystem: { ...analyzed.player.localDevice.filesystem, files: analyzed.player.localDevice.filesystem.files.filter((file) => file.kind !== 'software_module' || file.moduleId !== 'credential-access') } } } }
    expect(canFormCredentialAccessAttempt(withoutTool, observation)).toBe(false)
    // Removing the tool removes the offer without touching Discovery or Knowledge.
    expect(withoutTool.knowledge).toEqual(analyzed.knowledge)
    expect(withoutTool.discovery).toEqual(analyzed.discovery)
  })
})
