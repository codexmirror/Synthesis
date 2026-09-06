import './processes.css'
import { useEffect, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { formatTransferRate } from '../byteFormat'
import { ActivityDetail } from './ActivityDetail'
import { ACTIVITY_FILTERS, countRunning, deriveActivityMonitor, filterActivities, findActivity, type ActivityFilterId, type LoadSegment, type MonitorActivity, type MonitorNetworkUsage, type MonitorSummary } from './activityMonitor'

/**
 * The NODE-OS Activity Monitor: the local Device's runtime command center.
 *
 * It is two surfaces rather than one wall of telemetry. The overview answers
 * what this Device is doing right now — how loaded it is, which work is
 * causing that load, and what has recently ended — at a density that stays
 * scannable while several activities run at once. Selecting one activity
 * opens its own detail surface, which presents the concrete runtime facts
 * that activity's canonical state actually supports.
 *
 * It observes the local Device only. Work executing on another Device is that
 * Device's runtime, and no cross-Device process-observation surface is
 * currently represented.
 *
 * The application owns presentation state only: the active filter, the
 * selected activity, and whether CLEAR is currently asking its question.
 * Every fact rendered is derived from canonical state on each render, and
 * every lifecycle control calls the canonical operation that owns it.
 */

const EMPTY_STATE: Record<ActivityFilterId, { headline: string; note: string }> = {
  all: { headline: 'SYSTEM IDLE', note: 'No operation or transfer is currently running.' },
  operations: { headline: 'NO RUNNING OPERATIONS', note: 'Service Analysis, Credential Access, and Software Installation appear here while they run.' },
  transfers: { headline: 'NO ACTIVE TRANSFER', note: 'No transfer is currently running.' },
}

export function Processes() {
  const state = useGameState()
  const actions = useGameActions()
  const [filter, setFilter] = useState<ActivityFilterId>('all')
  /** The activity whose detail surface is open. Presentation only. */
  const [selectedKey, setSelectedKey] = useState<string>()
  /** Whether CLEAR is awaiting its confirmation. Presentation only. */
  const [confirmingClear, setConfirmingClear] = useState(false)

  const { summary, activities } = deriveActivityMonitor(state)
  const selected = findActivity(activities, selectedKey)
  // An activity the player is inspecting can end and then be removed —
  // by REMOVE here, or by an eviction elsewhere. Returning to the overview
  // is the honest response: there is no longer anything to inspect.
  const vanished = selectedKey !== undefined && selected === undefined
  useEffect(() => { if (vanished) setSelectedKey(undefined) }, [vanished])

  const visible = filterActivities(activities, filter)
  const running = visible.filter((activity) => activity.status === 'running')
  const recent = visible.filter((activity) => activity.status === 'recent')
  const empty = EMPTY_STATE[filter]
  // Nothing left to clear ends the question, so a later list never opens
  // already asking it.
  useEffect(() => { if (recent.length === 0) setConfirmingClear(false) }, [recent.length])

  if (selected) {
    return <section className="app-content activity-monitor" aria-label="Activity Monitor">
      <ActivityDetail
        activity={selected}
        deviceName={state.player.localDevice.displayName}
        onBack={() => setSelectedKey(undefined)}
        onCancel={selected.status !== 'running' ? undefined : selected.category === 'transfer' ? () => actions.cancelFileTransfer(selected.id) : selected.cancellable ? () => actions.cancelLocalProcess(selected.id) : undefined}
        onStop={selected.stoppable ? () => actions.stopNodeMiner(selected.id) : undefined}
        onPayout={selected.stoppable ? () => actions.payoutLocalNodeMiner() : undefined}
        onRemove={selected.status === 'recent' ? () => actions.removeRecentActivity(selected.id) : undefined}
      />
    </section>
  }

  return <section className="app-content activity-monitor" aria-label="Activity Monitor">
    <header className="node-masthead">
      <span className="node-masthead-subject">ACTIVITY MONITOR</span>
      <span className="node-masthead-meta">LOCAL · {state.player.localDevice.displayName}</span>
    </header>

    <DeviceLoad summary={summary} />

    <div className="am-filters" role="group" aria-label="Activity filter">
      {ACTIVITY_FILTERS.map(({ id, label, accessibleName }) => <button className="am-filter" type="button" key={id} aria-label={accessibleName} aria-pressed={filter === id} onClick={() => setFilter(id)}>
        <span>{label}</span><span className="am-filter-count">{countRunning(activities, id)}</span>
      </button>)}
    </div>

    <div className="node-section"><span>RUNNING</span><span className="am-section-count">{running.length}</span></div>
    {running.length > 0
      ? <div className="am-list">{running.map((activity) => <ActivityRow activity={activity} key={activity.key} onOpen={() => setSelectedKey(activity.key)} />)}</div>
      : <div className="node-empty"><strong>{empty.headline}</strong><span>{empty.note}</span></div>}

    {recent.length > 0 && <>
      <div className="node-section am-section-quiet">
        <span>RECENT ACTIVITY</span>
        {/*
          * Clearing the list is confirmed inside the Firmware surface rather
          * than by a browser dialog, which on a phone is an operating-system
          * sheet naming the page. The question is asked where the control is.
          */}
        {confirmingClear
          ? <span className="am-clear-confirm" role="group" aria-label="Clear recent activity?">
            <span className="am-clear-question">CLEAR ALL?</span>
            <button className="am-clear am-clear--confirm" type="button" onClick={() => { actions.clearRecentActivity(); setConfirmingClear(false) }}>CLEAR</button>
            <button className="am-clear" type="button" onClick={() => setConfirmingClear(false)}>KEEP</button>
          </span>
          : <button className="am-clear" type="button" aria-label="Clear recent activity" onClick={() => setConfirmingClear(true)}>CLEAR</button>}
      </div>
      <div className="am-list">{recent.map((activity) => <ActivityRow activity={activity} key={activity.key} onOpen={() => setSelectedKey(activity.key)} />)}</div>
    </>}
  </section>
}

/**
 * Device load, stated as the work causing it.
 *
 * Each rail is composed of the executor's own baseline plus one segment per
 * running Process — its canonical CPU allocation, its reserved RAM — so
 * pressure reads as something the player started rather than as a free-standing
 * gauge. A FileTransfer contributes to neither rail, because it holds no
 * Process CPU or RAM; the network rails are its own, and they are presented
 * against this Device's represented transfer capacity in both directions.
 */
function DeviceLoad({ summary }: { summary: MonitorSummary }) {
  const { cpu, ram, network } = summary
  const processCount = cpu.segments.length
  return <div className="am-load" role="group" aria-label="Device load">
    <div className="am-meter">
      <span className="am-meter-label">CPU</span>
      <strong className="am-meter-value">{Math.round(cpu.totalPercent)}%</strong>
      <LoadRail baselinePercent={cpu.baselinePercent} segments={cpu.segments} description={`CPU ${Math.round(cpu.totalPercent)}% of capacity`} />
      <span className="am-meter-note">{Math.round(cpu.baselinePercent)}% BASELINE · {processCount === 0 ? 'NO PROCESS LOAD' : `${processCount} ${processCount === 1 ? 'PROCESS' : 'PROCESSES'}`}</span>
    </div>

    <div className="am-meter">
      <span className="am-meter-label">RAM</span>
      <strong className="am-meter-value">{ram.usedMiB.toFixed(0)} / {ram.capacityMiB} MiB</strong>
      <LoadRail baselinePercent={ram.baselinePercent} segments={ram.segments} description={`RAM ${Math.round(ram.totalPercent)}% of capacity`} />
      <span className="am-meter-note">{ram.availableMiB.toFixed(0)} MiB AVAILABLE</span>
    </div>

    <NetworkMeter network={network} />
  </div>
}

/**
 * Baseline plus one segment per running Process, in the executor's own share of
 * capacity. The accessible name names the contributors in the same order the
 * rail stacks them, so the composition is available without reading the bar.
 */
function LoadRail({ baselinePercent, segments, description }: { baselinePercent: number; segments: readonly LoadSegment[]; description: string }) {
  const composition = [`${Math.round(baselinePercent)}% baseline`, ...segments.map((segment) => `${segment.label} ${Math.round(segment.percent)}%`)]
  return <span className="am-rail am-rail--stacked" role="img" aria-label={`${description}: ${composition.join(', ')}`}>
    <i className="am-rail-baseline" style={{ width: `${clamp(baselinePercent)}%` }} />
    {segments.map((segment) => <i className="am-rail-segment" key={segment.id} style={{ width: `${clamp(segment.percent)}%` }} />)}
  </span>
}

/**
 * The one active transfer's direction leads; both represented directions keep
 * their own rail, because this Device's capacity is represented in both and a
 * transfer only ever uses one of them.
 */
function NetworkMeter({ network }: { network: MonitorNetworkUsage }) {
  const active = network.activeDirection
  const activeRate = active === 'upload' ? network.uploadBytesPerSecond : network.downloadBytesPerSecond
  return <div className="am-meter am-meter--network">
    <span className="am-meter-label">NETWORK</span>
    <strong className="am-meter-value">{active ? `${formatTransferRate(activeRate)} ${active.toUpperCase()}` : 'NO TRANSFER'}</strong>
    <div className="am-net">
      <NetworkRail label="DOWN" bytesPerSecond={network.downloadBytesPerSecond} capacityBytesPerSecond={network.capacity.downloadBytesPerSecond} />
      <NetworkRail label="UP" bytesPerSecond={network.uploadBytesPerSecond} capacityBytesPerSecond={network.capacity.uploadBytesPerSecond} />
    </div>
  </div>
}

function NetworkRail({ label, bytesPerSecond, capacityBytesPerSecond }: { label: string; bytesPerSecond: number; capacityBytesPerSecond: number }) {
  return <span className="am-net-row">
    <span className="am-net-label">{label}</span>
    <span className="am-rail" aria-hidden="true"><i style={{ width: `${clamp(capacityBytesPerSecond > 0 ? bytesPerSecond / capacityBytesPerSecond * 100 : 0)}%` }} /></span>
    <span className="am-net-value">{formatTransferRate(bytesPerSecond)} / {formatTransferRate(capacityBytesPerSecond)}</span>
  </span>
}

/**
 * One activity in the overview, and the way into its detail surface.
 *
 * The row carries what identifies the activity and the one number its runtime
 * leads with. Lifecycle controls are deliberately not here: they belong to the
 * surface where the player can see what they are acting on, which keeps a list
 * of several running activities scannable instead of a row of competing
 * buttons.
 */
function ActivityRow({ activity, onOpen }: { activity: MonitorActivity; onOpen: () => void }) {
  return <button
    className="am-row"
    type="button"
    data-category={activity.category}
    data-status={activity.status}
    aria-label={`Inspect ${activity.kindLabel} ${activity.title}`}
    onClick={onOpen}
  >
    <span className="am-row-head">
      <span className="am-row-kind">{activity.kindLabel}</span>
      {activity.status === 'recent' && activity.outcome
        ? <span className="am-row-outcome" data-tone={activity.outcome.tone}>{activity.outcome.headline}</span>
        : activity.metric && <span className="am-row-metric">{activity.metric.value}</span>}
    </span>

    <span className="am-row-subject">
      {activity.titleLabel && <span className="am-row-label">{activity.titleLabel}</span>}
      <strong className="am-row-title">{activity.title}</strong>
    </span>
    {activity.route && <span className="am-row-route">{activity.route}</span>}

    {activity.summary.length > 0 && <span className="am-row-summary">
      {activity.summary.map((part) => <span key={part}>{part}</span>)}
    </span>}

    {activity.continuous
      ? <span className="am-row-continuous">CONTINUOUS</span>
      : activity.progressPercent !== undefined && <progress className="node-progress am-row-rail" max={100} value={activity.progressPercent} aria-hidden="true" />}

    <span className="node-row-arrow am-row-arrow" aria-hidden="true">→</span>
  </button>
}

function clamp(percent: number) { return Math.min(100, Math.max(0, percent)) }
