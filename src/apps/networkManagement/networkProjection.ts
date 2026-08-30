import { resolveManagedNetworks } from '../../core/game/networkManagement'
import type { GameState, NetworkActivityPerspective, NetworkActivityRecord } from '../../core/game/types'

export interface ManagedNetworkActivityRecordView {
  readonly id: string
  readonly kind: NetworkActivityRecord['kind']
  readonly perspective: NetworkActivityPerspective
  readonly sourceAddress: string
  readonly destinationAddress: string
  /** Present only for a connection-attempt record. */
  readonly serviceName?: string
  /** Present only for a FileTransfer or package-submission record. */
  readonly bytesTransferred?: number
  readonly result: 'SUCCESS' | 'FAILURE' | 'COMPLETED' | 'CANCELLED' | 'INTERRUPTED'
}

export interface ManagedNetworkView {
  readonly id: string
  readonly name: string
  /** Represented maximum external connectivity capability; not current throughput or usage. */
  readonly connectivity: { readonly uploadBytesPerSecond: number; readonly downloadBytesPerSecond: number }
  /** A coarse count only; V1 deliberately never enumerates member identity here. */
  readonly memberCount: number
  /** The Network's own canonical activity evidence, oldest first, projected without internal Device or Service IDs. */
  readonly activity: readonly ManagedNetworkActivityRecordView[]
}

function projectActivityRecord(record: NetworkActivityRecord): ManagedNetworkActivityRecordView {
  return {
    id: record.id,
    kind: record.kind,
    perspective: record.perspective,
    sourceAddress: record.sourceAddress,
    destinationAddress: record.kind === 'connection_attempt' ? record.targetAddress : record.destinationAddress,
    serviceName: record.kind === 'connection_attempt' ? record.serviceName : undefined,
    bytesTransferred: record.kind === 'connection_attempt' ? undefined : record.bytesTransferred,
    result: record.result,
  }
}

/**
 * The one Network the local Device currently holds explicit management
 * authority over, projected for read-only presentation. Returns `null` when
 * no such authority is currently held — including when it has been removed
 * — rather than falling back to Network membership or any other truth.
 *
 * V1 presents at most the first authorized Network directly, matching the
 * product's one seeded relationship, rather than a navigation framework
 * across several: `resolveManagedNetworks` already resolves the full set,
 * so a later multi-Network surface would build on that rather than on a
 * changed resolver.
 */
export function selectManagedNetwork(state: GameState): ManagedNetworkView | null {
  const [network] = resolveManagedNetworks(state, state.player.localDevice.id)
  if (!network) return null
  return {
    id: network.id,
    name: network.name,
    connectivity: network.transferCapacity,
    memberCount: network.memberDeviceIds.length,
    activity: network.activityHistory.records.map(projectActivityRecord),
  }
}
