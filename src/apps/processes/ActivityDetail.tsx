import type { MonitorActivity } from './activityMonitor'

/**
 * One activity's own runtime surface.
 *
 * This is where an activity stops being a line in a list and becomes something
 * the player can read and act on: what it is, what concrete subject it is
 * operating on, whether it is finite or continuous, what it currently holds,
 * what it produced, and which lifecycle controls its runtime legitimately
 * offers.
 *
 * It presents only the blocks the adapter derived for this activity, so the
 * runtime types stay meaningfully different: a finite operation states work
 * and resources, a continuous NODE Miner states production and payout and is
 * marked continuous rather than given a completion bar, and a FileTransfer
 * states transfer and route and claims no Process CPU or RAM.
 *
 * Every control here calls the canonical operation that owns it. Nothing on
 * this surface mutates state itself.
 */
export function ActivityDetail({ activity, deviceName, onBack, onCancel, onStop, onPayout, onRemove }: {
  activity: MonitorActivity
  deviceName: string
  onBack: () => void
  onCancel?: () => void
  onStop?: () => void
  onPayout?: () => void
  onRemove?: () => void
}) {
  const running = activity.status === 'running'
  return <div className="am-detail" data-category={activity.category} data-status={activity.status}>
    <div className="am-detail-bar">
      <button className="node-back" type="button" onClick={onBack} aria-label="Back to the runtime overview">
        <span aria-hidden="true">←</span> RUNTIME
      </button>
      <span className="am-detail-scope">LOCAL · {deviceName}</span>
    </div>

    <header className="am-detail-head">
      <span className="am-detail-kind">{activity.kindLabel}</span>
      {/*
        * Only running work carries a state marker. Ended work is told by its
        * placement and its own concrete outcome, not by a generic lifecycle
        * label the runtime does not represent.
        */}
      {running && <span className="am-detail-state"><i aria-hidden="true" />RUNNING</span>}
    </header>

    <div className="am-detail-subject">
      {activity.titleLabel && <span className="am-row-label">{activity.titleLabel}</span>}
      <strong>{activity.title}</strong>
      {activity.route && <span className="am-detail-route">{activity.route}</span>}
    </div>

    {activity.continuous
      ? <p className="am-detail-continuous">CONTINUOUS RUNTIME — no completion threshold</p>
      : activity.progressPercent !== undefined && <div className="am-detail-progress">
        <progress className="node-progress" max={100} value={activity.progressPercent} aria-hidden="true" />
        <span className="am-detail-progress-value">{activity.progressPercent}%</span>
      </div>}

    {activity.outcome && <p className="am-outcome" data-tone={activity.outcome.tone}>
      <strong>{activity.outcome.headline}</strong>
      {activity.outcome.details.map((detail, index) => <span key={index}>{detail}</span>)}
    </p>}

    {activity.sections.map((section) => <div className="am-detail-section" key={section.heading}>
      <div className="node-section"><span>{section.heading}</span></div>
      <dl className="node-facts">
        {section.facts.map((entry) => <div key={entry.label}>
          <dt>{entry.label}</dt>
          <dd>{entry.value}</dd>
        </div>)}
      </dl>
    </div>)}

    {(onCancel || onStop || onPayout || onRemove) && <div className="am-actions">
      {onPayout && <button className="node-action am-action" type="button" aria-label={`Payout ${activity.kindLabel}`} onClick={onPayout}>PAYOUT</button>}
      {onCancel && <button className="node-action am-action am-action--caution" type="button" aria-label={`Cancel active ${activity.kindLabel}`} onClick={onCancel}>CANCEL</button>}
      {onStop && <button className="node-action am-action am-action--caution" type="button" aria-label={`Stop ${activity.kindLabel}`} onClick={onStop}>STOP</button>}
      {onRemove && <button className="node-action am-action am-action--quiet" type="button" aria-label={`Remove recent ${activity.kindLabel} activity`} onClick={onRemove}>REMOVE</button>}
    </div>}
  </div>
}
