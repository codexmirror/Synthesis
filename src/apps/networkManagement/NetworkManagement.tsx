import { useGameState } from '../../app/GameContext'
import { formatBytes, formatTransferRate } from '../byteFormat'
import { selectManagedNetwork, type ManagedNetworkActivityRecordView } from './networkProjection'

/**
 * Network is legitimate administration over the player's own represented
 * Network World Truth, under an explicit management-authority relationship —
 * distinct from NodeScan's remembered reconnaissance. It is read-only: V1
 * establishes Networks as real administrable infrastructure before later
 * work adds reachability, firewalls, upgrades, or foreign Network
 * administration.
 *
 * A fresh game seeds exactly one authorized Network (`home-net`), so this
 * presents it directly rather than a navigation framework across several.
 */
const ACTIVITY_KIND_LABEL: Record<ManagedNetworkActivityRecordView['kind'], string> = {
  connection_attempt: 'CONNECTION ATTEMPT',
  file_transfer: 'FILE TRANSFER',
  package_submission: 'PACKAGE SUBMISSION',
}

const POSITIVE_RESULT = new Set<ManagedNetworkActivityRecordView['result']>(['SUCCESS', 'COMPLETED'])

export function NetworkManagement() {
  const state = useGameState()
  const network = selectManagedNetwork(state)

  if (!network) return <section className="app-content network-management-app" aria-label="Network">
    <header className="node-masthead"><span className="node-masthead-subject">Network</span><span className="node-masthead-meta">NO AUTHORITY</span></header>
    <div className="node-empty"><strong>NO MANAGED NETWORK</strong><span>This Device does not currently hold management authority over any Network.</span></div>
  </section>

  return <section className="app-content network-management-app" aria-label="Network">
    <header className="node-masthead"><span className="node-masthead-subject">{network.name}</span><span className="node-masthead-meta">MANAGED NETWORK</span></header>

    <div className="node-section"><span>CONNECTIVITY</span></div>
    <dl className="node-facts">
      <div><dt>UPLOAD</dt><dd>{formatTransferRate(network.connectivity.uploadBytesPerSecond)}</dd></div>
      <div><dt>DOWNLOAD</dt><dd>{formatTransferRate(network.connectivity.downloadBytesPerSecond)}</dd></div>
    </dl>

    <div className="node-section"><span>MEMBERSHIP</span></div>
    <dl className="node-facts">
      <div><dt>MEMBERS</dt><dd>{network.memberCount}</dd></div>
    </dl>

    <div className="node-section"><span>ACTIVITY</span><span>{network.activity.length}</span></div>
    {network.activity.length === 0
      ? <div className="node-empty"><strong>NO ACTIVITY</strong><span>No activity has been observed on this Network yet.</span></div>
      : <div className="node-list">{network.activity.map((record) => <ActivityRow key={record.id} record={record} />)}</div>}
  </section>
}

function ActivityRow({ record }: { record: ManagedNetworkActivityRecordView }) {
  const detail = [
    `${record.sourceAddress} → ${record.destinationAddress}`,
    record.serviceName,
    record.bytesTransferred !== undefined ? formatBytes(record.bytesTransferred) : undefined,
  ].filter(Boolean).join(' · ')
  return <div className="node-row">
    <span className="node-row-copy">
      <strong>{ACTIVITY_KIND_LABEL[record.kind]}</strong>
      <small>{detail}</small>
    </span>
    <span className={POSITIVE_RESULT.has(record.result) ? 'node-chip' : 'node-chip node-chip--quiet'}>{record.result}</span>
  </div>
}
