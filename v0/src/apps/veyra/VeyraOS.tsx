import './veyra.css'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import type { ActiveRemoteTarget } from '../../core/game/remoteSession'
import { deriveVeyraHomeEntries, type VeyraAppId, type VeyraHomeEntry } from './veyraHome'
import { VeyraIcon } from './VeyraIcon'
import { VeyraCommunication } from './VeyraCommunication'
import { VeyraPinChallenge } from './VeyraPinChallenge'
import { VeyraSettings } from './VeyraSettings'
import { VeyraWallet } from './VeyraWallet'
import { VeyraBusiness } from './VeyraBusiness'
import { isVeyraParentOf, veyraLocationKey, veyraParentLocation, type VeyraLocation } from './veyraNavigation'
import { VeyraFirmwareInstall, VeyraFirmwareWelcome } from './VeyraFirmwareInstall'
import { deriveRattlerProcessForDevice } from '../../core/game/rattler'
import { resolveInstallingVeyraFirmwareRelease, type VeyraFirmwareRelease } from '../../core/game/veyraFirmwareUpdate'
import { selectVeyraReleasePresentation, type VeyraReleasePresentation } from './veyraRelease'

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
  /*
   * Opening an application never authorizes it for the rest of the Session.
   * Business is ordinary Device-owned software, so if that installation stops
   * being represented while the client is open, the phone simply no longer has
   * it: the surface falls back to Home the same way RACK-OS falls back to a
   * section its release can actually present. Nothing about the Company
   * Administration authority underneath is touched by that.
   */
  const current: VeyraLocation = location.app === 'business' && !entries.some(({ id }) => id === 'business')
    ? { app: 'home' }
    : location
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

  /*
   * Scrolling is VEYRA's own, and one region carries every surface, so where a
   * surface starts is a product decision rather than a leftover.
   *
   * Opening a surface starts it at its own top: the alternative is what the
   * phone did before, where a screen could open already scrolled past its own
   * title. Going back up to the surface the player came from restores where
   * they were in it, which is what makes opening several Books in succession
   * feel like browsing one list.
   *
   * Both are keyed on `veyraLocationKey`, so this is navigation only: an
   * advancing delivery, a completed sale, a firmware installation ticking on or
   * an appended Market Report re-renders the same surface and never moves the
   * player's position in it.
   */
  const viewport = useRef<HTMLElement>(null)
  const remembered = useRef(new Map<string, number>())
  const arrival = useRef(0)
  const currentKey = veyraLocationKey(current)

  useLayoutEffect(() => {
    const region = viewport.current
    const scrollTop = arrival.current
    arrival.current = 0
    if (region) region.scrollTop = scrollTop
  }, [currentKey])

  function go(next: VeyraLocation) {
    const from = current
    const fromKey = veyraLocationKey(from)
    if (isVeyraParentOf(next, from)) {
      // Upward: resume where the player was in the surface they came from.
      const nextKey = veyraLocationKey(next)
      arrival.current = remembered.current.get(nextKey) ?? 0
      remembered.current.delete(nextKey)
      remembered.current.delete(fromKey)
    } else if (isVeyraParentOf(from, next)) {
      // Downward into this surface's own child: the child starts at its top,
      // and where the player was here is worth coming back to.
      arrival.current = 0
      remembered.current.set(fromKey, viewport.current?.scrollTop ?? 0)
    } else {
      // Home, or any other jump: nothing is being browsed, so nothing is kept.
      arrival.current = 0
      remembered.current.clear()
    }
    onEndEditing()
    setRequested(next)
  }

  /** BACK is exactly one step up VEYRA's own hierarchy, wherever the player is. */
  function back() {
    const parent = veyraParentLocation(current)
    if (parent) go(parent)
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

    <main className="veyra-viewport" ref={viewport}>
      {installing && <VeyraFirmwareInstall progress={installing} release={installingRelease} />}
      {!installing && installed && <VeyraFirmwareWelcome release={installed} onContinue={() => { setInstalled(undefined); go({ app: 'home' }) }} />}
      {!systemBusy && current.app === 'home' && <VeyraHome entries={entries} onOpen={openHomeEntry} deviceName={target.displayName!} release={release} />}
      {!systemBusy && current.app === 'communication' && <VeyraCommunication />}
      {!systemBusy && current.app === 'wallet-locked' && <VeyraPinChallenge
        note="Enter this Device's PIN to open Wallet."
        verify={(pin) => verifyDevicePinForOperatedRemoteDevice(pin).status === 'verified'}
        onSuccess={() => go({ app: 'wallet' })}
        onCancel={() => go({ app: 'home' })}
        observedCandidate={rattler?.status === 'running' ? rattler.currentCandidate : undefined}
        observedAttemptNumber={rattler?.status === 'running' ? rattler.attemptsCompleted : undefined}
      />}
      {!systemBusy && current.app === 'wallet' && <VeyraWallet
        detail={current.detail}
        onDetail={(detail) => go(detail ? { app: 'wallet', detail } : { app: 'wallet' })}
        editingRecoveryReady={editingRecoveryReady}
        onEndEditing={onEndEditing}
      />}
      {!systemBusy && current.app === 'business' && <VeyraBusiness
        detail={current.detail}
        onDetail={(detail) => go(detail ? { app: 'business', detail } : { app: 'business' })}
      />}
      {!systemBusy && current.app === 'settings' && <VeyraSettings device={target} detail={current.detail} release={release} onDetail={(detail) => go(detail ? { app: 'settings', detail } : { app: 'settings' })} />}
    </main>

    {/*
      * VEYRA's own navigation, and only VEYRA's: BACK moves one level upward
      * inside the phone and HOME returns to its launcher. Neither leaves the
      * phone — returning to NODE-OS and ending the Session are the frame's
      * actions above, and they stay separate.
      */}
    {/* A phone installing its own operating system offers no navigation at all. */}
    {!systemBusy && <nav className="veyra-nav" aria-label="VEYRA navigation">
      {current.app === 'home'
        ? <span aria-hidden="true" />
        : <button className="veyra-nav__back" type="button" onClick={back}><VeyraIcon name="back" />Back</button>}
      <button className="veyra-nav__home" type="button" onClick={() => go({ app: 'home' })} disabled={current.app === 'home'} aria-current={current.app === 'home' ? 'page' : undefined}>
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
