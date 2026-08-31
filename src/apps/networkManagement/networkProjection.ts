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
 * Every Network the local Device currently holds explicit management
 * authority over, projected for read-only presentation. Derived from that
 * authority relationship alone — never from Network membership, DeviceAccess,
 * a RemoteSession, or NodeScan Discovery — so removing the authority removes
 * the Network from this projection entirely.
 *
 * NodeScan composes this beside its own remembered reconnaissance rather than
 * merging the two: authority legitimately supplies a managed Network's own
 * canonical facts (name, capacity, coarse member count, activity) and
 * deliberately never supplies member Device identity.
 */
export function selectManagedNetworks(state: GameState): readonly ManagedNetworkView[] {
  return resolveManagedNetworks(state, state.player.localDevice.id).map((network) => ({
    id: network.id,
    name: network.name,
    connectivity: network.transferCapacity,
    memberCount: network.memberDeviceIds.length,
    activity: network.activityHistory.records.map(projectActivityRecord),
  }))
}
