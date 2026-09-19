import { describe, expect, it } from 'vitest'
import { canFormCredentialAccessAttempt, startCredentialAccessAttemptFromObservation } from './credentialAccess'
import { rememberScan } from './discovery'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { connectRemoteFromObservation, resolveActiveRemoteTarget } from './remoteSession'
import { scanFromDevice, scanNetworkTarget } from './scan'
import { startServiceAnalysisAtEndpoint } from './serviceAnalysis'
import { VEYRA_OS_4_1_FIRMWARE_ID } from './firmwareIdentity'
import type { GameState } from './types'

const PHONE = 'host-phone-001'
const PHONE_PRIVATE_ADDRESS = '10.42.0.61'
const BOOKSTORE_PUBLIC_EDGE = '203.0.113.42'
const PHONE_PUBLIC_ENDPOINT = `${BOOKSTORE_PUBLIC_EDGE}:2222`
const observation = { endpoint: PHONE_PUBLIC_ENDPOINT, targetDeviceId: PHONE, serviceId: 'service-ssh-003', vulnerabilityId: 'AUTH-017' } as const

/**
 * The exact endpoint Analysis later dials is never asserted as prior test
 * knowledge: this derives it from a real portless Scan of the public edge,
 * the same reconnaissance step Myra's lead (`docs/current/COMMUNICATION.md`)
 * points the player at, proving the causal chain from public-edge
 * observation through to the actionable endpoint rather than assuming it.
 */
function scannedPublicEdge(state: GameState = createInitialGameState()): { state: GameState; endpoint: string } {
  const publicScan = scanFromDevice(state, state.player.localDevice.id, BOOKSTORE_PUBLIC_EDGE)
  if (publicScan.status !== 'device') throw new Error(publicScan.status)
  const phoneExposure = publicScan.exposedBackends?.find(({ targetDeviceId }) => targetDeviceId === PHONE)
  if (!phoneExposure) throw new Error('expected the phone\'s GateSSH exposure in the public Scan observation')
  const discovery = rememberScan(state.discovery, publicScan, state.player.localDevice.id)
  return { state: { ...state, discovery }, endpoint: `${BOOKSTORE_PUBLIC_EDGE}:${phoneExposure.service.port}` }
}

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

  it('yields a way in only after a public-edge Scan surfaces the exposed endpoint and real Endpoint Analysis of the exact GateSSH 1.3.2 surface, with zero named Vulnerability Knowledge, then establishes access and connects', () => {
    const base = createInitialGameState()

    // Before any observation the player knows nothing about this Device.
    expect(canFormCredentialAccessAttempt(base, observation)).toBe(false)

    // The player's own Device has no route to the phone's private address at all — only its Gateway's own public edge.
    expect(scanFromDevice(base, base.player.localDevice.id, PHONE_PRIVATE_ADDRESS)).toMatchObject({ status: 'no_response' })

    // A portless Scan of the public edge Myra's lead names legitimately surfaces the forwarded endpoint
    // itself — this is where `PHONE_PUBLIC_ENDPOINT` actually comes from, not asserted prior knowledge.
    const { state: scanned, endpoint } = scannedPublicEdge(base)
    expect(endpoint).toBe(PHONE_PUBLIC_ENDPOINT)
    // The Scan alone remembers only that a Service is reachable there, keyed by the backend's stable
    // identity for later causal resolution — it is not yet itself a discovered private Device.
    const exposedOnly = scanned.discovery.devices.find(({ id }) => id === PHONE)
    expect(exposedOnly).toMatchObject({ address: BOOKSTORE_PUBLIC_EDGE, observedOnlyAsGatewayExposure: { gatewayDeviceId: 'router-foreign-001' } })
    expect(exposedOnly?.services.find(({ id }) => id === observation.serviceId)?.inspect).toBeUndefined()
    // A bare public-edge Scan is not itself actionable knowledge: no GhostKey offer without real Analysis.
    expect(canFormCredentialAccessAttempt(scanned, observation)).toBe(false)

    const analysis = startServiceAnalysisAtEndpoint(scanned, PHONE_PUBLIC_ENDPOINT)
    expect(analysis.status).toBe('started'); if (analysis.status !== 'started') return
    const analyzed = advanceGameState(analysis.state, 20_000)
    // Endpoint Analysis remembers implementation evidence only; it never creates named Vulnerability Knowledge.
    expect(analyzed.knowledge.discoveredVulnerabilities).toEqual([])
    // The Analysis reached through the public exposure remembers the phone by the endpoint the player
    // actually dialed, never its private backend address, and this genuine direct observation ends its
    // gateway-exposure-only standing: the phone is legitimately its own discovered Device now.
    const analyzedPhone = analyzed.discovery.devices.find(({ id }) => id === PHONE)
    expect(analyzedPhone).toMatchObject({ address: BOOKSTORE_PUBLIC_EDGE })
    expect(analyzedPhone?.observedOnlyAsGatewayExposure).toBeUndefined()

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
    const connected = connectRemoteFromObservation(attacked, { targetDeviceId: PHONE, address: BOOKSTORE_PUBLIC_EDGE })
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
