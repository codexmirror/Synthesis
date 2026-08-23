import './processes.css'
import { useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { formatTransferRate } from '../byteFormat'
import { ACTIVITY_FILTERS, deriveActivityMonitor, filterActivities, type ActivityFilterId, type MonitorActivity } from './activityMonitor'

const EMPTY_STATE: Record<ActivityFilterId, { headline: string; note: string }> = {
  all: { headline: 'SYSTEM IDLE', note: 'No operation or transfer is currently running.' },
  operations: { headline: 'NO RUNNING OPERATIONS', note: 'Service Analysis and Credential Access appear here while they run.' },
  transfers: { headline: 'NO ACTIVE TRANSFER', note: 'Completed transfers are not recorded.' },
}

export function Processes() {
  const state = useGameState()
  const { clearCompletedProcesses } = useGameActions()
  const [filter, setFilter] = useState<ActivityFilterId>('all')
  const { summary, activities } = deriveActivityMonitor(state)
  const visible = filterActivities(activities, filter)
  const running = visible.filter((activity) => activity.status === 'running')
  const completed = visible.filter((activity) => activity.status === 'completed')
  const empty = EMPTY_STATE[filter]

  return <section className="app-content activity-monitor" aria-label="Activity Monitor">
    <header className="am-head"><p className="eyebrow">ACTIVITY MONITOR</p></header>

    <div className="am-summary">
      <Stat label="CPU" value={`${Math.round(summary.cpuPercent)}%`} note={`${Math.round(summary.baselineCpuPercent)}% BASELINE`} percent={summary.cpuPercent} />
      <Stat label="RAM" value={`${summary.ramUsedMiB.toFixed(0)} / ${summary.ramCapacityMiB} MiB`} note={`${summary.ramAvailableMiB.toFixed(0)} MiB AVAILABLE`} percent={summary.ramPercent} />
      <Stat label="NET DOWN" value={formatTransferRate(summary.network.downloadBytesPerSecond)} note={`${formatTransferRate(summary.network.capacity.downloadBytesPerSecond)} CAPACITY`} percent={ratio(summary.network.downloadBytesPerSecond, summary.network.capacity.downloadBytesPerSecond)} />
      <Stat label="NET UP" value={formatTransferRate(summary.network.uploadBytesPerSecond)} note={`${formatTransferRate(summary.network.capacity.uploadBytesPerSecond)} CAPACITY`} percent={ratio(summary.network.uploadBytesPerSecond, summary.network.capacity.uploadBytesPerSecond)} />
      <div className="am-stat am-stat-count">
        <span className="am-stat-label">ACTIVE</span>
        <strong className="am-stat-value">{summary.activeCount}</strong>
        <span className="am-stat-note">{summary.activeCount === 1 ? 'ACTIVITY' : 'ACTIVITIES'}</span>
      </div>
    </div>

    <div className="am-filters" role="group" aria-label="Activity filter">
      {ACTIVITY_FILTERS.map(({ id, label, accessibleName }) => <button className="am-filter" type="button" key={id} aria-label={accessibleName} aria-pressed={filter === id} onClick={() => setFilter(id)}>
        <span>{label}</span><span className="am-filter-count">{filterActivities(activities, id).length}</span>
      </button>)}
    </div>

    <div className="am-section"><span>RUNNING</span><span className="am-section-count">{running.length}</span></div>
    {running.length > 0
      ? <div className="am-list">{running.map((activity) => <ActivityCard activity={activity} key={activity.id} />)}</div>
      : <div className="am-empty"><strong>{empty.headline}</strong><span>{empty.note}</span></div>}

    {completed.length > 0 && <>
      <div className="am-section am-section-quiet">
        <span>COMPLETED</span>
        <button className="am-clear" type="button" aria-label="Clear completed processes" onClick={() => { if (window.confirm('Clear completed process history?')) clearCompletedProcesses() }}>CLEAR</button>
      </div>
      <div className="am-list">{completed.map((activity) => <ActivityCard activity={activity} key={activity.id} />)}</div>
    </>}
  </section>
}

function Stat({ label, value, note, percent }: { label: string; value: string; note: string; percent: number }) {
  return <div className="am-stat">
    <span className="am-stat-label">{label}</span>
    <span className="am-stat-value">{value}</span>
    <span className="am-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /></span>
    <span className="am-stat-note">{note}</span>
  </div>
}

function ActivityCard({ activity }: { activity: MonitorActivity }) {
  return <article className="am-activity" data-category={activity.category} data-status={activity.status}>
    <div className="am-activity-head">
      <span className="am-kind">{activity.kindLabel}</span>
      <span className="am-state"><i aria-hidden="true" />{activity.status === 'running' ? 'RUNNING' : 'COMPLETED'}</span>
    </div>
    <div className="am-title">
      {activity.titleLabel && <span className="am-title-label">{activity.titleLabel}</span>}
      <strong>{activity.title}</strong>
      {activity.route && <span className="am-route">{activity.route}</span>}
    </div>
    <progress aria-hidden="true" max={100} value={activity.progressPercent} />
    <dl className="am-facts">{activity.facts.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {activity.details.length > 0 && <dl className="am-details">{activity.details.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
    {activity.outcome && <p className="am-outcome" data-tone={activity.outcome.tone}>
      <strong>{activity.outcome.headline}</strong>
      {activity.outcome.details.map((detail, index) => <span key={index}>{detail}</span>)}
    </p>}
  </article>
}

function ratio(value: number, capacity: number) { return capacity > 0 ? value / capacity * 100 : 0 }
