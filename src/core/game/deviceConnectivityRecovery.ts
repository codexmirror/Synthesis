import { runRealDeviceBootConsequences } from './deviceBootBoundary'
import type { GameState, NetworkHost } from './types'

/**
 * Concrete V1 phase durations for a Device's own represented recovery
 * cycle. Exact timing is deliberately this implementation's own decision —
 * `DEAUTH_NETWORK_DISRUPTION_V1.md` and `RACKUPDATE_PENDING_ACTIVATION_V1.md`
 * both explicitly leave reboot/reconnect timing unselected.
 */
const RECONNECT_DURATION_MS = 6_000
const SHUTDOWN_DURATION_MS = 4_000
const BOOT_DURATION_MS = 6_000

/**
 * Begin a Device's own configured recovery cycle the moment canonical
 * advancement observes it sitting disconnected with no cycle already
 * running. This is the only place a Device's `connectivityRecoveryBehavior`
 * is read: connectivity interruption itself never selects or invokes a
 * per-Device outcome (`networkConnectivity.ts`).
 *
 * A Device with no configured behavior is left disconnected — a future
 * Device/Firmware is free to react differently, or not at all, without this
 * function changing.
 */
function beginRecoveryIfNeeded(host: NetworkHost): NetworkHost {
  if (host.connectivityRecovery) return host
  if (host.operational.lifecycle !== 'RUNNING' || host.operational.connectivity !== 'DISCONNECTED') return host
  if (host.connectivityRecoveryBehavior === 'RECONNECT') {
    return { ...host, operational: { ...host.operational, connectivity: 'RECONNECTING' }, connectivityRecovery: { phase: 'RECONNECTING', elapsedMs: 0 } }
  }
  if (host.connectivityRecoveryBehavior === 'REBOOT_ON_DISCONNECT') {
    return { ...host, operational: { ...host.operational, lifecycle: 'SHUTTING_DOWN' }, connectivityRecovery: { phase: 'SHUTTING_DOWN', elapsedMs: 0 } }
  }
  return host
}

function replaceHost(state: GameState, hostId: string, next: NetworkHost): GameState {
  const hosts = state.world.network.hosts.map((host) => host.id === hostId ? next : host)
  return { ...state, world: { ...state.world, network: { ...state.world.network, hosts } } }
}

/**
 * Advance one Device's already-running recovery cycle by the elapsed step.
 * `RECONNECT` moves the Device straight back to `CONNECTED` without ever
 * touching lifecycle. `REBOOT_ON_DISCONNECT` crosses `SHUTTING_DOWN` into
 * `BOOTING`, and once `BOOTING` completes that is a real represented Device
 * boot: this is the one call site that reaches the boot boundary, and it
 * does so through `runRealDeviceBootConsequences` rather than invoking
 * GateSSH activation (or any other consequence) directly.
 */
function advanceOneHostRecovery(state: GameState, hostId: string, elapsedMs: number): GameState {
  const host = state.world.network.hosts.find((candidate) => candidate.id === hostId)
  const recovery = host?.connectivityRecovery
  if (!host || !recovery) return state
  const elapsed = recovery.elapsedMs + Math.max(0, elapsedMs)

  if (recovery.phase === 'RECONNECTING') {
    if (elapsed < RECONNECT_DURATION_MS) return replaceHost(state, hostId, { ...host, connectivityRecovery: { ...recovery, elapsedMs: elapsed } })
    const { connectivityRecovery: _done, ...recovered } = host
    return replaceHost(state, hostId, { ...recovered, operational: { ...host.operational, connectivity: 'CONNECTED' } })
  }

  if (recovery.phase === 'SHUTTING_DOWN') {
    if (elapsed < SHUTDOWN_DURATION_MS) return replaceHost(state, hostId, { ...host, connectivityRecovery: { ...recovery, elapsedMs: elapsed } })
    return replaceHost(state, hostId, { ...host, operational: { ...host.operational, lifecycle: 'BOOTING' }, connectivityRecovery: { phase: 'BOOTING', elapsedMs: elapsed - SHUTDOWN_DURATION_MS } })
  }

  // phase === 'BOOTING'
  if (elapsed < BOOT_DURATION_MS) return replaceHost(state, hostId, { ...host, connectivityRecovery: { ...recovery, elapsedMs: elapsed } })
  const { connectivityRecovery: _done, ...rebooted } = host
  const restarted = replaceHost(state, hostId, { ...rebooted, operational: { lifecycle: 'RUNNING', connectivity: 'CONNECTED' } })
  return runRealDeviceBootConsequences(restarted, hostId)
}

/**
 * Canonical advancement for every Device's own connectivity-recovery
 * reaction, called from `advanceGameState` alongside FileTransfer and
 * RackUpdate submission advancement. Device reactions emerge here from
 * changed connectivity truth alone — nothing in this module or
 * `networkConnectivity.ts` names Petra's Phone, srv-02, or any specific
 * cause of the connectivity loss it is reacting to.
 */
export function advanceDeviceConnectivityRecovery(state: GameState, elapsedMs: number): GameState {
  const started = state.world.network.hosts.map(beginRecoveryIfNeeded)
  let nextState = started.some((host, index) => host !== state.world.network.hosts[index])
    ? { ...state, world: { ...state.world, network: { ...state.world.network, hosts: started } } }
    : state

  for (const host of nextState.world.network.hosts) {
    if (host.connectivityRecovery) nextState = advanceOneHostRecovery(nextState, host.id, elapsedMs)
  }
  return nextState
}
