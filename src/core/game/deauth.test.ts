import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { advanceGameState } from './gameAdvancement'
import { DEAUTH_EXTENSION, findCompatibleDeauthExtension, startDeauthAttempt } from './deauth'
import { FLIPPER_1_0_CANONICAL_INSTALLATION } from './flipper'
import { GATE_SSH_1_3_2_BUILD_ID } from './serviceImplementations'
import type { GameState } from './types'

const NETWORK = 'network-foreign-001', SRV = 'host-lan-002', PHONE = 'host-phone-001'
function withFlipper(state = createInitialGameState()): GameState { return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: [...state.player.localDevice.installedSoftware, FLIPPER_1_0_CANONICAL_INSTALLATION] } } } }
function host(state: GameState, id: string) { return state.world.network.hosts.find((h) => h.id === id)! }
function run(state: GameState) { let next = state; for (let i = 0; i < 100 && (host(next, SRV).operational.connectivity !== 'CONNECTED' || next.process.processes.some((p) => p.kind === 'deauth' && p.status === 'running')); i++) next = advanceGameState(next, 1000); return next }

describe('DEAUTH Flipper Extension', () => {
  it('is a concrete artifact but supplies no capability without a compatible installed Flipper', () => {
    const state = createInitialGameState(); const file = state.player.localDevice.filesystem.files.find((f) => f.kind === 'deauth_extension')
    expect(file).toMatchObject({ ...DEAUTH_EXTENSION, kind: 'deauth_extension', path: '/home/user/extensions/deauth.ext' })
    expect(findCompatibleDeauthExtension(state.player.localDevice)).toBeUndefined()
    expect(startDeauthAttempt(state, { networkId: NETWORK, networkName: 'remote-segment-01', contextDeviceId: SRV }).status).toBe('provider_unavailable')
  })

  it('targets stable Network identity, uses finite work, and causally fails if its provider disappears', () => {
    const started = startDeauthAttempt(withFlipper(), { networkId: NETWORK, networkName: 'remote-segment-01', contextDeviceId: SRV })
    expect(started.status).toBe('started'); if (started.status !== 'started') return
    expect(started.state.process.processes.at(-1)).toMatchObject({ kind: 'deauth', targetNetworkId: NETWORK, contextDeviceId: SRV, status: 'running', workCompleted: 0 })
    const removed = { ...started.state, player: { ...started.state.player, localDevice: { ...started.state.player.localDevice, filesystem: { ...started.state.player.localDevice.filesystem, files: started.state.player.localDevice.filesystem.files.filter((f) => f.kind !== 'deauth_extension') } } } }
    const done = advanceGameState(removed, 100_000)
    expect(done.process.processes.at(-1)).toMatchObject({ result: { status: 'attempt_failed' } })
    expect(host(done, SRV).operational.connectivity).toBe('CONNECTED')
  })

  it('composes pending activation through independent Network interruption and Device recovery', () => {
    const base = withFlipper(); const pending = { id: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID, name: 'GateSSH', version: '1.3.2', channel: 'stable', publisher: 'rack-systems' } as const
    const prepared: GameState = { ...base, world: { ...base.world, network: { ...base.world.network, hosts: base.world.network.hosts.map((h) => h.id === SRV ? { ...h, pendingGateSshActivation: pending } : h) } } }
    const started = startDeauthAttempt(prepared, { networkId: NETWORK, networkName: 'remote-segment-01', contextDeviceId: SRV }); if (started.status !== 'started') throw Error(started.status)
    const interrupted = advanceGameState(started.state, 100_000)
    expect(interrupted.process.processes.find((p) => p.kind === 'deauth')).toMatchObject({ result: { status: 'connectivity_interrupted' } })
    const recovered = run(interrupted)
    expect(host(recovered, PHONE).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    expect(host(recovered, SRV).pendingGateSshActivation).toBeUndefined()
    expect(host(recovered, SRV).installedSoftware?.find((s) => s.id === 'gate-ssh')?.releaseId).toBe('gate-ssh-1.3.2')
    expect(recovered.deviceAccess.established).toEqual([]); expect(recovered.remoteSession.active).toBeNull(); expect(recovered.networkManagement.established).toHaveLength(1)
  })
})
