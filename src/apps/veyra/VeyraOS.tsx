import './veyra.css'
import { useEffect, useRef, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import type { ActiveRemoteTarget } from '../../core/game/remoteSession'
import { deriveVeyraHomeEntries, type VeyraAppId, type VeyraHomeEntry } from './veyraHome'
import { VeyraIcon } from './VeyraIcon'
import { VeyraCommunication } from './VeyraCommunication'
import { VeyraPinChallenge } from './VeyraPinChallenge'
import { VeyraSettings, type VeyraSettingsDetail } from './VeyraSettings'
import { VeyraWallet, type VeyraWalletDetail } from './VeyraWallet'
import { VeyraFirmwareInstall, VeyraFirmwareWelcome } from './VeyraFirmwareInstall'
import { deriveRattlerProcessForDevice } from '../../core/game/rattler'
import { resolveInstallingVeyraFirmwareRelease, type VeyraFirmwareRelease } from '../../core/game/veyraFirmwareUpdate'
import { selectVeyraReleasePresentation, type VeyraReleasePresentation } from './veyraRelease'

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
  | { readonly app: 'wallet-locked' }
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
  const { disconnectRemoteSession, verifyDevicePinForOperatedRemoteDevice } = useGameActions()
  const { target, session } = context
  const [location, setLocation] = useState<VeyraLocation>({ app: 'home' })
  const [requested, setRequested] = useState<VeyraLocation>()
  const entries = deriveVeyraHomeEntries(state, target)
  const rattler = deriveRattlerProcessForDevice(state, target.id)
  const [observedRattlerId, setObservedRattlerId] = useState<string>()
  const release = selectVeyraReleasePresentation(target.firmware)

  /*
   * A firmware installation is canonical Device state, so the phone presents
   * whatever the Device is really doing: while `firmwareUpdate` exists this
   * surface is the installation and nothing else, and it reappears exactly as
   * far along as the real installation has got if the player leaves the phone
   * and comes back. The one presentation-local piece is the finished release's
   * welcome screen below, which authorizes nothing and states only what the
   * Device already owns.
   */
  const installing = target.firmwareUpdate
  const installingRelease = installing ? resolveInstallingVeyraFirmwareRelease(installing) : undefined
  const [installed, setInstalled] = useState<VeyraFirmwareRelease>()
  const observedInstall = useRef<VeyraFirmwareRelease>()

  useEffect(() => {
    if (installingRelease) {
      observedInstall.current = installingRelease
      return
    }
    const finished = observedInstall.current
    observedInstall.current = undefined
    // Only a Device that actually owns the new release gets the new release's
    // welcome; presentation never announces an installation the world did not
    // complete.
    if (finished && target.firmware?.id === finished.firmware.id) setInstalled(finished)
  }, [installingRelease, target.firmware?.id])

  useEffect(() => {
    if (location.app === 'wallet-locked' && rattler?.status === 'running') setObservedRattlerId(rattler.id)
  }, [location.app, rattler?.id, rattler?.status])

  useEffect(() => {
    if (location.app !== 'wallet-locked' || observedRattlerId !== rattler?.id || rattler?.result?.status !== 'pin_found') return
    setObservedRattlerId(undefined)
    go({ app: 'wallet' })
  }, [location.app, observedRattlerId, rattler?.id, rattler?.result?.status])

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
    if (location.app === 'communication' || location.app === 'wallet-locked' || !location.detail) {
      go({ app: 'home' })
      return
    }
    go({ app: location.app })
  }

  /**
   * Opening Wallet while this Device's own `walletProtectionEnabled` is on
   * goes to the Device-PIN challenge instead of Wallet content. Successful
   * verification authorizes only this one opening: it is expressed purely as
   * `location` becoming `wallet`, so leaving Wallet to Home or any other
   * surface — which always changes `location` away from `wallet` — discards
   * that authorization exactly as naturally as losing the phone entirely
   * does. No unlocked flag is ever stored.
   */
  function openHomeEntry(app: VeyraAppId) {
    if (app === 'wallet' && target.security?.walletProtectionEnabled) {
      go({ app: 'wallet-locked' })
      return
    }
    go({ app })
  }

  const systemBusy = Boolean(installing) || Boolean(installed)

  return <section className="veyra" hidden={hidden} data-release={release} aria-label={`${target.firmware!.name} personal device environment`}>
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
      {installing && <VeyraFirmwareInstall progress={installing} release={installingRelease} />}
      {!installing && installed && <VeyraFirmwareWelcome release={installed} onContinue={() => { setInstalled(undefined); go({ app: 'home' }) }} />}
      {!systemBusy && location.app === 'home' && <VeyraHome entries={entries} onOpen={openHomeEntry} deviceName={target.displayName!} release={release} />}
      {!systemBusy && location.app === 'communication' && <VeyraCommunication />}
      {!systemBusy && location.app === 'wallet-locked' && <VeyraPinChallenge
        note="Enter this Device's PIN to open Wallet."
        verify={(pin) => verifyDevicePinForOperatedRemoteDevice(pin).status === 'verified'}
        onSuccess={() => go({ app: 'wallet' })}
        onCancel={() => go({ app: 'home' })}
        observedCandidate={rattler?.status === 'running' ? rattler.currentCandidate : undefined}
        observedAttemptNumber={rattler?.status === 'running' ? rattler.attemptsCompleted : undefined}
      />}
      {!systemBusy && location.app === 'wallet' && <VeyraWallet
        detail={location.detail}
        onDetail={(detail) => go(detail ? { app: 'wallet', detail } : { app: 'wallet' })}
        editingRecoveryReady={editingRecoveryReady}
        onEndEditing={onEndEditing}
      />}
      {!systemBusy && location.app === 'settings' && <VeyraSettings device={target} detail={location.detail} release={release} onDetail={(detail) => go(detail ? { app: 'settings', detail } : { app: 'settings' })} />}
    </main>

    {/*
      * VEYRA's own navigation, and only VEYRA's: BACK moves one level upward
      * inside the phone and HOME returns to its launcher. Neither leaves the
      * phone — returning to NODE-OS and ending the Session are the frame's
      * actions above, and they stay separate.
      */}
    {/* A phone installing its own operating system offers no navigation at all. */}
    {!systemBusy && <nav className="veyra-nav" aria-label="VEYRA navigation">
      {location.app === 'home'
        ? <span aria-hidden="true" />
        : <button className="veyra-nav__back" type="button" onClick={back}><VeyraIcon name="back" />Back</button>}
      <button className="veyra-nav__home" type="button" onClick={() => go({ app: 'home' })} disabled={location.app === 'home'} aria-current={location.app === 'home' ? 'page' : undefined}>
        <VeyraIcon name="home" />Home
      </button>
      <span aria-hidden="true" />
    </nav>}
  </section>
}

/**
 * The Home launcher: app icons and labels on the phone's own ground, in the
 * conventional composition a person already knows how to read.
 *
 * The grid is fixed at four columns and sized for touch, so the concrete entries
 * sit exactly where they would sit on a fuller phone. Empty cells stay empty.
 *
 * Which entries exist never depends on the release: 4.2 refines how Home is
 * presented and adds no application, because the newer firmware ships none.
 */
function VeyraHome({ entries, onOpen, deviceName, release }: {
  entries: readonly VeyraHomeEntry[]
  onOpen: (app: VeyraAppId) => void
  deviceName: string
  release: VeyraReleasePresentation
}) {
  return <section className="veyra-screen veyra-home" aria-label="Home">
    {/*
      * 4.2 gives Home a quiet header naming the phone itself. It is the
      * Device's own represented display name and nothing else: no greeting,
      * no time, no weather, no status and no invented state.
      */}
    {release === 'v4-2' && <header className="veyra-home__head"><h1 className="veyra-home__device">{deviceName}</h1></header>}
    <div className="veyra-launcher">
      {entries.map((entry) => <button className="veyra-app" key={entry.id} type="button" onClick={() => onOpen(entry.id)}>
        <span className="veyra-app__tile"><VeyraIcon name={entry.icon} /></span>
        <span className="veyra-app__label">{entry.label}</span>
      </button>)}
    </div>
  </section>
}
