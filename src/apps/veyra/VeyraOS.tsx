import './veyra.css'
import { useEffect, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import type { ActiveRemoteTarget } from '../../core/game/remoteSession'
import { deriveVeyraHomeEntries, type VeyraAppId, type VeyraHomeEntry } from './veyraHome'
import { VeyraIcon } from './VeyraIcon'
import { VeyraCommunication } from './VeyraCommunication'
import { VeyraSettings, type VeyraSettingsDetail } from './VeyraSettings'
import { VeyraWallet, type VeyraWalletDetail } from './VeyraWallet'

/**
 * Where the player is inside the phone. The grammar is exactly two levels:
 *
 * ```text
 * HOME -> application / system-surface root -> optional detail
 * ```
 *
 * It is Presentation state held by this component and never reaches
 * `GameState`: a launcher position is not world truth.
 */
type VeyraLocation =
  | { readonly app: 'home' }
  | { readonly app: 'communication' }
  | { readonly app: 'wallet'; readonly detail?: VeyraWalletDetail }
  | { readonly app: 'settings'; readonly detail?: VeyraSettingsDetail }

/**
 * VEYRA OS: the ordinary consumer phone environment of a foreign Device the
 * player is operating.
 *
 * It is a Firmware presentation layer over that Device's represented truth. It
 * owns no canonical state, and it may interpret represented facts but never
 * manufacture them. Communication presents Petra's represented Company Chat.
 *
 * `editingRecoveryReady` and `onEndEditing` are the Shell's editing lifecycle,
 * passed in. VEYRA reads no viewport and keeps no keyboard state of its own; it
 * only expresses that moving between surfaces ends the current editing
 * interaction and waits for the Shell to report recovered editing geometry —
 * the same boundary RACK-OS and the local/remote context switch already use.
 */
export function VeyraOS({ context, hidden, onReturnLocal, editingRecoveryReady, onEndEditing }: {
  context: ActiveRemoteTarget
  hidden: boolean
  onReturnLocal(): void
  editingRecoveryReady: boolean
  onEndEditing(): void
}) {
  const state = useGameState()
  const { disconnectRemoteSession } = useGameActions()
  const { target, session } = context
  const [location, setLocation] = useState<VeyraLocation>({ app: 'home' })
  const [requested, setRequested] = useState<VeyraLocation>()
  const entries = deriveVeyraHomeEntries(state, target)

  useEffect(() => {
    if (requested === undefined || !editingRecoveryReady) return
    setLocation(requested)
    setRequested(undefined)
  }, [requested, editingRecoveryReady])

  function go(next: VeyraLocation) {
    onEndEditing()
    setRequested(next)
  }

  function back() {
    if (location.app === 'home') return
    if (location.app === 'communication' || !location.detail) {
      go({ app: 'home' })
      return
    }
    go({ app: location.app })
  }

  return <section className="veyra" hidden={hidden} aria-label={`${target.firmware!.name} personal device environment`}>
    {/*
      * The Shell's operating-context control, deliberately drawn as the
      * technical frame around the phone rather than as part of it. Nothing
      * inside VEYRA presents the Session, the access route or the player's
      * privilege as the phone's own state; this band is where that context
      * lives, and its two actions stay meaningfully different — the first only
      * changes which environment is presented, the second ends the Session.
      */}
    <header className="veyra-frame">
      <span className="veyra-frame__context">REMOTE SESSION · {session.connectedAddress}</span>
      <div className="veyra-frame__actions">
        <button type="button" className="veyra-frame__return" onClick={onReturnLocal} aria-label="Return to NODE-OS without disconnecting"><span aria-hidden="true">←</span> NODE-OS</button>
        <button type="button" className="veyra-frame__disconnect" onClick={() => disconnectRemoteSession()}>DISCONNECT</button>
      </div>
    </header>

    <main className="veyra-viewport">
      {location.app === 'home' && <VeyraHome entries={entries} onOpen={(app) => go({ app })} />}
      {location.app === 'communication' && <VeyraCommunication />}
      {location.app === 'wallet' && <VeyraWallet
        detail={location.detail}
        onDetail={(detail) => go(detail ? { app: 'wallet', detail } : { app: 'wallet' })}
        editingRecoveryReady={editingRecoveryReady}
        onEndEditing={onEndEditing}
      />}
      {location.app === 'settings' && <VeyraSettings device={target} detail={location.detail} onDetail={(detail) => go(detail ? { app: 'settings', detail } : { app: 'settings' })} />}
    </main>

    {/*
      * VEYRA's own navigation, and only VEYRA's: BACK moves one level upward
      * inside the phone and HOME returns to its launcher. Neither leaves the
      * phone — returning to NODE-OS and ending the Session are the frame's
      * actions above, and they stay separate.
      */}
    <nav className="veyra-nav" aria-label="VEYRA navigation">
      {location.app === 'home'
        ? <span aria-hidden="true" />
        : <button className="veyra-nav__back" type="button" onClick={back}><VeyraIcon name="back" />Back</button>}
      <button className="veyra-nav__home" type="button" onClick={() => go({ app: 'home' })} disabled={location.app === 'home'} aria-current={location.app === 'home' ? 'page' : undefined}>
        <VeyraIcon name="home" />Home
      </button>
      <span aria-hidden="true" />
    </nav>
  </section>
}

/**
 * The Home launcher: app icons and labels on the phone's own ground, in the
 * conventional composition a person already knows how to read.
 *
 * The grid is fixed at four columns and sized for touch, so the concrete entries
 * sit exactly where they would sit on a fuller phone. Empty cells stay empty.
 */
function VeyraHome({ entries, onOpen }: { entries: readonly VeyraHomeEntry[]; onOpen: (app: VeyraAppId) => void }) {
  return <section className="veyra-screen veyra-home" aria-label="Home">
    <div className="veyra-launcher">
      {entries.map((entry) => <button className="veyra-app" key={entry.id} type="button" onClick={() => onOpen(entry.id)}>
        <span className="veyra-app__tile"><VeyraIcon name={entry.icon} /></span>
        <span className="veyra-app__label">{entry.label}</span>
      </button>)}
    </div>
  </section>
}
