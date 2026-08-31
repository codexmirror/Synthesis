import type { GameState, NetworkHost } from './types'

/**
 * The smallest neutral canonical operation that can interrupt the
 * connectivity of a represented `LocalNetwork`: it resolves affected Devices
 * from canonical Network membership alone and mutates only their
 * connectivity truth.
 *
 * It knows nothing about which Devices those are, why the Network lost
 * connectivity, or what any Device does in reaction — Petra's Phone, srv-02,
 * VEYRA OS, RACK-OS, reboot, and GateSSH are all outside this function's
 * vocabulary. What a Device does next is that Device's own represented
 * recovery behavior, resolved independently during canonical advancement
 * (`deviceConnectivityRecovery.ts`).
 *
 * This is a transient V1 interruption, not a persistent Network-outage
 * framework: it stores no outage record and no duration, it only flips
 * currently-`CONNECTED` members to `DISCONNECTED`. A Device already
 * `DISCONNECTED` or `RECONNECTING` is left untouched, so calling this
 * repeatedly while a Device is mid-recovery never duplicates or restarts its
 * cycle.
 */
export function interruptLocalNetworkConnectivity(state: GameState, networkId: string): GameState {
  const network = state.world.network.localNetworks.find(({ id }) => id === networkId)
  if (!network) return state
  const memberIds = network.memberDeviceIds

  let nextState = state
  const local = state.player.localDevice
  if (memberIds.includes(local.id) && local.operational.connectivity === 'CONNECTED') {
    nextState = { ...nextState, player: { ...nextState.player, localDevice: { ...local, operational: { ...local.operational, connectivity: 'DISCONNECTED' } } } }
  }

  const hosts = nextState.world.network.hosts.map((host): NetworkHost =>
    memberIds.includes(host.id) && host.operational.connectivity === 'CONNECTED'
      ? { ...host, operational: { ...host.operational, connectivity: 'DISCONNECTED' } }
      : host)
  const hostsChanged = hosts.some((host, index) => host !== nextState.world.network.hosts[index])
  if (!hostsChanged) return nextState
  return { ...nextState, world: { ...nextState.world, network: { ...nextState.world.network, hosts } } }
}
