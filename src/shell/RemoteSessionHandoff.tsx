import type { ActiveRemoteTarget } from '../core/game/remoteSession'

interface RemoteSessionHandoffProps {
  readonly context: ActiveRemoteTarget
  readonly ready: boolean
  readonly onEnter: () => void
  readonly onDisconnect: () => void
}

export function RemoteSessionHandoff({ context, ready, onEnter, onDisconnect }: RemoteSessionHandoffProps) {
  const { session, target, access, service } = context

  return (
    <main className="remote-handoff" aria-label="Remote session handoff">
      <header className="remote-handoff__header">
        <span>NODE-OS</span>
        <strong>REMOTE SESSION</strong>
      </header>
      <section className="remote-handoff__panel">
        <p className="remote-handoff__status">SESSION ESTABLISHED</p>
        <dl>
          <div><dt>TARGET</dt><dd>{target.displayName}</dd></div>
          <div><dt>ADDRESS</dt><dd>{session.connectedAddress}</dd></div>
          <div><dt>SERVICE</dt><dd>{service.name} / {service.protocol} {service.port}</dd></div>
          <div><dt>AUTHORITY</dt><dd>{access.privilege}</dd></div>
          <div><dt>REMOTE ENVIRONMENT</dt><dd>{target.firmware?.name} {target.firmware?.version}</dd></div>
          <div><dt>SESSION</dt><dd>{session.id}</dd></div>
        </dl>
        {!ready && <p className="remote-handoff__release" role="status">RELEASING LOCAL INPUT</p>}
        <div className="remote-handoff__actions">
          <button type="button" className="remote-handoff__enter" disabled={!ready} onClick={onEnter}>
            ENTER {target.firmware?.name} →
          </button>
          <button type="button" className="remote-handoff__disconnect" onClick={onDisconnect}>DISCONNECT</button>
        </div>
      </section>
    </main>
  )
}
