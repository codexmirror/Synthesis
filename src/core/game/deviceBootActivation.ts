import { GATE_SSH_PRODUCT_ID } from './serviceImplementations'
import type { GameState } from './types'

/**
 * Applies the software consequence of an already-established real Device boot.
 * This operation neither causes nor models that boot. If the Device cannot
 * coherently replace both active GateSSH owners, it preserves all state,
 * including the pending identity, for a later valid boot boundary.
 */
export function activatePendingGateSshAtDeviceBoot(state: GameState, deviceId: string): GameState {
  const targetIndex = state.world.network.hosts.findIndex(({ id }) => id === deviceId)
  const target = state.world.network.hosts[targetIndex]
  const pending = target?.pendingGateSshActivation
  if (!target || !pending || pending.id !== GATE_SSH_PRODUCT_ID || !target.installedSoftware || !target.services) return state

  const installedIndexes = target.installedSoftware.flatMap((software, index) => software.id === GATE_SSH_PRODUCT_ID ? [index] : [])
  const serviceIndexes = target.services.flatMap((service, index) => service.implementation.productId === GATE_SSH_PRODUCT_ID ? [index] : [])
  if (installedIndexes.length !== 1 || serviceIndexes.length !== 1) return state

  const installedSoftware = target.installedSoftware.map((software, index) => index === installedIndexes[0] ? pending : software)
  const services = target.services.map((service, index) => index === serviceIndexes[0] ? {
    ...service,
    implementation: {
      productId: pending.id,
      releaseId: pending.releaseId,
      buildId: pending.buildId,
      name: pending.name,
      version: pending.version,
    },
  } : service)
  const { pendingGateSshActivation: _consumed, ...activatedTarget } = target
  const hosts = state.world.network.hosts.map((host, index) => index === targetIndex
    ? { ...activatedTarget, installedSoftware, services }
    : host)
  const outcome = state.rackUpdate.submission.outcome?.targetDeviceId === deviceId
    ? null
    : state.rackUpdate.submission.outcome

  return {
    ...state,
    world: { ...state.world, network: { ...state.world.network, hosts } },
    ...(outcome === state.rackUpdate.submission.outcome ? {} : {
      rackUpdate: { ...state.rackUpdate, submission: { ...state.rackUpdate.submission, outcome } },
    }),
  }
}
