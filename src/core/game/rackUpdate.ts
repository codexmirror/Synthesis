import type { GameState } from './types'
import {
  GATE_SSH_1_3_2_RELEASE_ID,
  GATE_SSH_1_3_3_RELEASE_ID,
  GATE_SSH_PRODUCT_ID,
  RACK_UPDATE_1_0_RELEASE_ID,
  RACK_UPDATE_PRODUCT_ID,
} from './serviceImplementations'

export interface RackUpdateObservation {
  readonly targetDeviceId: string
  readonly serviceId: string
  readonly endpoint: string
  readonly localFileId: string
}

export type SubmitRackUpdatePackageResult =
  | { readonly status: 'applied'; readonly state: GameState }
  | { readonly status: 'observation_required' | 'service_unavailable' | 'package_unavailable' | 'package_rejected' | 'managed_service_unavailable'; readonly state: GameState }

/**
 * Invoke RackUpdate 1.0's one represented public protocol. This is neither a
 * filesystem Upload nor access: a successful request changes only the
 * implementation release of the GateSSH Service managed by the target.
 */
export function submitRackUpdatePackageFromObservation(state: GameState, input: RackUpdateObservation): SubmitRackUpdatePackageResult {
  const observedDevice = state.discovery.devices.find(({ id }) => id === input.targetDeviceId)
  const observedService = observedDevice?.services.find(({ id, endpoint, inspect }) =>
    id === input.serviceId && endpoint === input.endpoint && inspect?.interface === 'Package submission')
  if (!observedService) return { status: 'observation_required', state }

  const localFile = state.player.localDevice.filesystem.files.find(({ id }) => id === input.localFileId)
  if (!localFile) return { status: 'package_unavailable', state }

  const targetIndex = state.world.network.hosts.findIndex(({ id }) => id === input.targetDeviceId)
  const target = state.world.network.hosts[targetIndex]
  const update = target?.services?.find(({ id }) => id === input.serviceId)
  if (!target || !target.online || !update || !update.open || `${target.ip}:${update.port}` !== input.endpoint
    || update.implementation.productId !== RACK_UPDATE_PRODUCT_ID || update.implementation.releaseId !== RACK_UPDATE_1_0_RELEASE_ID) {
    return { status: 'service_unavailable', state }
  }
  if (localFile.kind !== 'software_package' || localFile.productId !== GATE_SSH_PRODUCT_ID
    || localFile.releaseId !== GATE_SSH_1_3_2_RELEASE_ID) return { status: 'package_rejected', state }

  const managed = target.services?.find(({ implementation }) => implementation.productId === GATE_SSH_PRODUCT_ID)
  if (!managed || managed.implementation.releaseId !== GATE_SSH_1_3_3_RELEASE_ID) return { status: 'managed_service_unavailable', state }

  const services = target.services!.map((service) => service.id === managed.id
    ? { ...service, implementation: { productId: GATE_SSH_PRODUCT_ID, releaseId: GATE_SSH_1_3_2_RELEASE_ID, name: 'GateSSH', version: '1.3.2' } }
    : service)
  const hosts = state.world.network.hosts.map((host, index) => index === targetIndex ? { ...host, services } : host)
  return { status: 'applied', state: { ...state, world: { network: { ...state.world.network, hosts } } } }
}
