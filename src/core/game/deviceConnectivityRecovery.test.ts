import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { interruptLocalNetworkConnectivity } from './networkConnectivity'
import { advanceGameState } from './gameAdvancement'
import { GATE_SSH_1_3_2_BUILD_ID } from './serviceImplementations'
import type { GameState, NetworkHost } from './types'

const REMOTE_SEGMENT = 'network-foreign-001'
const HOME_NET = 'network-local-001'
const PHONE = 'host-phone-001'
const SRV_02 = 'host-lan-002'
const SRV_01 = 'host-lan-001'

function host(state: GameState, id: string): NetworkHost {
  return state.world.network.hosts.find((candidate) => candidate.id === id)!
}

/** Advance in small bounded steps until `predicate` holds, or fail loudly once the step budget is exhausted rather than looping forever. */
function advanceUntil(state: GameState, predicate: (state: GameState) => boolean, stepMs = 250, maxSteps = 200): GameState {
  let current = state
  for (let step = 0; step < maxSteps; step += 1) {
    if (predicate(current)) return current
    current = advanceGameState(current, stepMs)
  }
  if (!predicate(current)) throw new Error('advanceUntil exhausted its step budget without satisfying the predicate')
  return current
}

describe("Petra's Phone connectivity recovery (RECONNECT)", () => {
  it('reconnects without ever crossing a boot boundary: CONNECTED -> DISCONNECTED -> RECONNECTING -> CONNECTED, RUNNING throughout', () => {
    const interrupted = interruptLocalNetworkConnectivity(createInitialGameState(), REMOTE_SEGMENT)
    expect(host(interrupted, PHONE).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'DISCONNECTED' })

    const midCycle = advanceGameState(interrupted, 250)
    expect(host(midCycle, PHONE).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'RECONNECTING' })
    expect(host(midCycle, PHONE).connectivityRecovery?.phase).toBe('RECONNECTING')

    const recovered = advanceUntil(midCycle, (state) => host(state, PHONE).operational.connectivity === 'CONNECTED')
    expect(host(recovered, PHONE).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    expect(host(recovered, PHONE).connectivityRecovery).toBeUndefined()
  })

  it('lets a later new interruption begin a fresh cycle once the previous one has completed', () => {
    const state = createInitialGameState()
    const firstCycle = advanceUntil(interruptLocalNetworkConnectivity(state, REMOTE_SEGMENT), (s) => host(s, PHONE).operational.connectivity === 'CONNECTED')
    const secondInterruption = interruptLocalNetworkConnectivity(firstCycle, REMOTE_SEGMENT)
    expect(host(secondInterruption, PHONE).operational.connectivity).toBe('DISCONNECTED')
    const secondCycle = advanceUntil(secondInterruption, (s) => host(s, PHONE).operational.connectivity === 'CONNECTED')
    expect(host(secondCycle, PHONE).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
  })
})

describe('srv-02 connectivity recovery (REBOOT_ON_DISCONNECT)', () => {
  it('reboots through SHUTTING_DOWN -> BOOTING -> RUNNING+CONNECTED, staying disconnected throughout the reboot', () => {
    const interrupted = interruptLocalNetworkConnectivity(createInitialGameState(), REMOTE_SEGMENT)
    expect(host(interrupted, SRV_02).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'DISCONNECTED' })

    const shuttingDown = advanceGameState(interrupted, 250)
    expect(host(shuttingDown, SRV_02).operational).toEqual({ lifecycle: 'SHUTTING_DOWN', connectivity: 'DISCONNECTED' })

    const booting = advanceUntil(shuttingDown, (s) => host(s, SRV_02).operational.lifecycle === 'BOOTING')
    expect(host(booting, SRV_02).operational).toEqual({ lifecycle: 'BOOTING', connectivity: 'DISCONNECTED' })

    const rebooted = advanceUntil(booting, (s) => host(s, SRV_02).operational.connectivity === 'CONNECTED')
    expect(host(rebooted, SRV_02).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    expect(host(rebooted, SRV_02).connectivityRecovery).toBeUndefined()
  })

  it('reboots identically with no pending GateSSH: the real boot boundary leaves active GateSSH unchanged', () => {
    const interrupted = interruptLocalNetworkConnectivity(createInitialGameState(), REMOTE_SEGMENT)
    expect(host(interrupted, SRV_02).pendingGateSshActivation).toBeUndefined()
    const rebooted = advanceUntil(interrupted, (s) => host(s, SRV_02).operational.connectivity === 'CONNECTED')
    const managedSsh = rebooted.world.network.hosts.find(({ id }) => id === SRV_02)!.services!.find(({ id }) => id === 'service-ssh-002')!
    expect(managedSsh.implementation.releaseId).toBe('gate-ssh-1.3.3')
    expect(host(rebooted, SRV_02).installedSoftware!.find(({ id }) => id === 'gate-ssh')!.releaseId).toBe('gate-ssh-1.3.3')
  })

  it('reboots through the identical path and duration with pending GateSSH 1.3.2, and the boot boundary then activates it', () => {
    const base = createInitialGameState()
    const pending = { id: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID, name: 'GateSSH', version: '1.3.2', channel: 'stable', publisher: 'rack-systems' } as const
    const state: GameState = {
      ...base,
      world: { ...base.world, network: { ...base.world.network, hosts: base.world.network.hosts.map((h) => h.id === SRV_02 ? { ...h, pendingGateSshActivation: pending } : h) } },
    }

    const interrupted = interruptLocalNetworkConnectivity(state, REMOTE_SEGMENT)
    const rebooted = advanceUntil(interrupted, (s) => host(s, SRV_02).operational.connectivity === 'CONNECTED')
    expect(host(rebooted, SRV_02).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    expect(host(rebooted, SRV_02).pendingGateSshActivation).toBeUndefined()
    const managedSsh = rebooted.world.network.hosts.find(({ id }) => id === SRV_02)!.services!.find(({ id }) => id === 'service-ssh-002')!
    expect(managedSsh.implementation).toEqual({ productId: pending.id, releaseId: pending.releaseId, buildId: pending.buildId, name: pending.name, version: pending.version })
    expect(host(rebooted, SRV_02).installedSoftware!.find(({ id }) => id === 'gate-ssh')).toEqual(pending)
  })

  it('reboots whether or not pending GateSSH exists: the recovery cycle never inspects pending state', () => {
    const bare = createInitialGameState()
    const pending = { id: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID, name: 'GateSSH', version: '1.3.2', channel: 'stable', publisher: 'rack-systems' } as const
    const withPending: GameState = { ...bare, world: { ...bare.world, network: { ...bare.world.network, hosts: bare.world.network.hosts.map((h) => h.id === SRV_02 ? { ...h, pendingGateSshActivation: pending } : h) } } }

    const withoutPendingRebooted = advanceUntil(interruptLocalNetworkConnectivity(bare, REMOTE_SEGMENT), (s) => host(s, SRV_02).operational.connectivity === 'CONNECTED')
    const withPendingRebooted = advanceUntil(interruptLocalNetworkConnectivity(withPending, REMOTE_SEGMENT), (s) => host(s, SRV_02).operational.connectivity === 'CONNECTED')

    // Same reboot lifecycle in both cases; only the boot-boundary consequence (GateSSH activation) differs.
    expect(host(withoutPendingRebooted, SRV_02).operational).toEqual(host(withPendingRebooted, SRV_02).operational)
  })

  it('does not duplicate or restart a recovery cycle already in progress', () => {
    const interrupted = interruptLocalNetworkConnectivity(createInitialGameState(), REMOTE_SEGMENT)
    const midShutdown = advanceGameState(interrupted, 250)
    expect(host(midShutdown, SRV_02).operational.lifecycle).toBe('SHUTTING_DOWN')
    // A repeated interruption mid-cycle changes nothing: connectivity is already not CONNECTED.
    const reinterrupted = interruptLocalNetworkConnectivity(midShutdown, REMOTE_SEGMENT)
    expect(reinterrupted).toBe(midShutdown)
  })
})

describe('elapsed-time partition equivalence', () => {
  it('srv-02: one large elapsed step covering the complete shutdown+boot duration reaches RUNNING+CONNECTED in a single advanceGameState call', () => {
    const interrupted = interruptLocalNetworkConnectivity(createInitialGameState(), REMOTE_SEGMENT)
    // Exactly SHUTDOWN_DURATION_MS + BOOT_DURATION_MS: enough to cross both phase
    // boundaries and reach the real boot boundary without an extra scheduler tick.
    const rebootedInOneStep = advanceGameState(interrupted, 10_000)
    expect(host(rebootedInOneStep, SRV_02).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    expect(host(rebootedInOneStep, SRV_02).connectivityRecovery).toBeUndefined()
  })

  it('srv-02: reaches the identical final operational state whether delivered as one large step or many small ones', () => {
    const interrupted = interruptLocalNetworkConnectivity(createInitialGameState(), REMOTE_SEGMENT)
    const largeStep = advanceGameState(interrupted, 10_000)
    const smallSteps = advanceUntil(interrupted, (s) => host(s, SRV_02).operational.connectivity === 'CONNECTED', 100, 200)
    expect(host(largeStep, SRV_02).operational).toEqual(host(smallSteps, SRV_02).operational)
  })

  it('srv-02: crosses the real boot boundary exactly once regardless of step partitioning, activating identical pending GateSSH', () => {
    const pending = { id: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID, name: 'GateSSH', version: '1.3.2', channel: 'stable', publisher: 'rack-systems' } as const
    const base = createInitialGameState()
    const withPending: GameState = { ...base, world: { ...base.world, network: { ...base.world.network, hosts: base.world.network.hosts.map((h) => h.id === SRV_02 ? { ...h, pendingGateSshActivation: pending } : h) } } }
    const interrupted = interruptLocalNetworkConnectivity(withPending, REMOTE_SEGMENT)

    const largeStep = advanceGameState(interrupted, 10_000)
    const smallSteps = advanceUntil(interrupted, (s) => host(s, SRV_02).operational.connectivity === 'CONNECTED', 100, 200)

    for (const rebooted of [largeStep, smallSteps]) {
      expect(host(rebooted, SRV_02).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
      expect(host(rebooted, SRV_02).pendingGateSshActivation).toBeUndefined()
      const managedSsh = rebooted.world.network.hosts.find(({ id }) => id === SRV_02)!.services!.find(({ id }) => id === 'service-ssh-002')!
      expect(managedSsh.implementation.releaseId).toBe('gate-ssh-1.3.2')
      expect(host(rebooted, SRV_02).installedSoftware!.find(({ id }) => id === 'gate-ssh')!.releaseId).toBe('gate-ssh-1.3.2')
    }
  })

  it('srv-02: without pending GateSSH, active GateSSH remains unchanged under both large and partitioned steps', () => {
    const interrupted = interruptLocalNetworkConnectivity(createInitialGameState(), REMOTE_SEGMENT)
    const largeStep = advanceGameState(interrupted, 10_000)
    const smallSteps = advanceUntil(interrupted, (s) => host(s, SRV_02).operational.connectivity === 'CONNECTED', 100, 200)
    for (const rebooted of [largeStep, smallSteps]) {
      const managedSsh = rebooted.world.network.hosts.find(({ id }) => id === SRV_02)!.services!.find(({ id }) => id === 'service-ssh-002')!
      expect(managedSsh.implementation.releaseId).toBe('gate-ssh-1.3.3')
    }
  })

  it("Petra's Phone: reconnects coherently under both a single large step and many partitioned steps", () => {
    const interrupted = interruptLocalNetworkConnectivity(createInitialGameState(), REMOTE_SEGMENT)
    const largeStep = advanceGameState(interrupted, 6_000)
    const smallSteps = advanceUntil(interrupted, (s) => host(s, PHONE).operational.connectivity === 'CONNECTED', 100, 200)
    expect(host(largeStep, PHONE).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    expect(host(largeStep, PHONE).operational).toEqual(host(smallSteps, PHONE).operational)
  })
})

describe('a Device with no configured connectivity-recovery behavior', () => {
  it('stays disconnected rather than autonomously reacting', () => {
    const interrupted = interruptLocalNetworkConnectivity(createInitialGameState(), HOME_NET)
    expect(host(interrupted, SRV_01).connectivityRecoveryBehavior).toBeUndefined()
    let advanced = interrupted
    for (let step = 0; step < 40; step += 1) advanced = advanceGameState(advanced, 250)
    expect(host(advanced, SRV_01).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'DISCONNECTED' })
    expect(host(advanced, SRV_01).connectivityRecovery).toBeUndefined()
  })
})
