import { useState } from 'react'
import { useGameActions } from '../../app/GameContext'
import type { NetworkHost } from '../../core/game/types'
import { VeyraIcon } from './VeyraIcon'
import { VeyraPinChallenge } from './VeyraPinChallenge'

/** Which Settings surface is open. Presentation only; it never reaches `GameState`. */
export type VeyraSettingsDetail = 'this-device' | 'security'

/**
 * Settings is a Firmware-owned system surface, not a Device model.
 *
 * It presents only facts the Device and its Firmware already own, in ordinary
 * human language. It owns none of them beyond Security's own persistent
 * setting below, and it deliberately presents nothing else: there is no
 * battery, storage, update, permission or telemetry state, because the world
 * represents none of it and inventing a plausible row would be the whole
 * failure this product is meant to avoid.
 *
 * There is no Connection entry either. This phone represents no owner-facing
 * connection state worth showing, and the player's Remote Session is emphatically
 * not it: a Session makes this surface operable without ever becoming something
 * the phone's owner would see.
 */
export function VeyraSettings({ device, detail, onDetail }: {
  device: NetworkHost
  detail?: VeyraSettingsDetail
  onDetail: (detail?: VeyraSettingsDetail) => void
}) {
  if (detail === 'this-device') {
    return <section className="veyra-screen" aria-label="This Device">
      <p className="veyra-eyebrow">Settings</p>
      <h1 className="veyra-title">This Device</h1>
      <dl className="veyra-stack">
        <div className="veyra-stack__entry">
          <dt>Name</dt>
          <dd>{device.displayName}</dd>
        </div>
        {device.firmware && <div className="veyra-stack__entry">
          <dt>System</dt>
          <dd>{device.firmware.name} {device.firmware.version}</dd>
        </div>}
      </dl>
    </section>
  }

  if (detail === 'security') return <VeyraSecurity device={device} />

  return <section className="veyra-screen" aria-label="Settings">
    <h1 className="veyra-title">Settings</h1>
    <div className="veyra-card veyra-card--rows">
      <button className="veyra-row" type="button" onClick={() => onDetail('this-device')}>
        <span className="veyra-row__label">This Device</span>
        <VeyraIcon name="chevron" />
      </button>
      <button className="veyra-row" type="button" onClick={() => onDetail('security')}>
        <span className="veyra-row__label">Security</span>
        <VeyraIcon name="chevron" />
      </button>
    </div>
  </section>
}

/**
 * Security presents exactly one concrete Device-owned setting: whether
 * opening Wallet requires this Device's own PIN (enforced by VeyraOS at
 * Wallet-open time, `src/apps/veyra/VeyraOS.tsx`). Changing it in either
 * direction is gated on this Device's own secret PIN through the same
 * `VeyraPinChallenge` Wallet-open uses.
 *
 * The PIN is never read, stored, or displayed by this surface — it is only
 * submitted for verification by the canonical operation, which reports
 * success or failure and nothing more. A Remote Session makes this screen
 * reachable; it grants no authority to change what it shows.
 */
function VeyraSecurity({ device }: { device: NetworkHost }) {
  const { changeWalletProtectionForOperatedRemoteDevice } = useGameActions()
  const walletProtectionEnabled = device.security?.walletProtectionEnabled ?? false
  const [challenge, setChallenge] = useState<{ requestedEnabled: boolean }>()
  const [notice, setNotice] = useState<string>()

  function requestChange(requestedEnabled: boolean) {
    setNotice(undefined)
    setChallenge({ requestedEnabled })
  }

  if (challenge) {
    return <VeyraPinChallenge
      note={`Enter this Device's PIN to turn Wallet protection ${challenge.requestedEnabled ? 'on' : 'off'}.`}
      verify={(pin) => changeWalletProtectionForOperatedRemoteDevice(pin, challenge.requestedEnabled).status === 'changed'}
      onSuccess={() => {
        setNotice(challenge.requestedEnabled ? 'Wallet protection is on.' : 'Wallet protection is off.')
        setChallenge(undefined)
      }}
      onCancel={() => setChallenge(undefined)}
    />
  }

  return <section className="veyra-screen" aria-label="Security">
    <p className="veyra-eyebrow">Settings</p>
    <h1 className="veyra-title">Security</h1>
    {notice && <p className="veyra-notice" role="status">{notice}</p>}
    <div className="veyra-card veyra-card--rows">
      <div className="veyra-row veyra-row--static">
        <span className="veyra-row__copy">
          <strong>Wallet protection</strong>
          <small>Require Device PIN to open Wallet</small>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={walletProtectionEnabled}
          aria-label="Require Device PIN to open Wallet"
          className="veyra-toggle"
          data-state={walletProtectionEnabled ? 'on' : 'off'}
          onClick={() => requestChange(!walletProtectionEnabled)}
        >
          <span className="veyra-toggle__knob" />
        </button>
      </div>
    </div>
  </section>
}
