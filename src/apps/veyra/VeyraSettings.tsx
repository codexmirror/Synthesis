import type { NetworkHost } from '../../core/game/types'
import { VeyraIcon } from './VeyraIcon'

/** Which Settings surface is open. Presentation only; it never reaches `GameState`. */
export type VeyraSettingsDetail = 'this-device'

/**
 * Settings is a Firmware-owned system surface, not a Device model.
 *
 * It presents only facts the Device and its Firmware already own, in ordinary
 * human language. It owns none of them, and it deliberately presents nothing
 * else: there is no battery, storage, update, security, permission or telemetry
 * state, because the world represents none of it and inventing a plausible row
 * would be the whole failure this product is meant to avoid.
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

  return <section className="veyra-screen" aria-label="Settings">
    <h1 className="veyra-title">Settings</h1>
    <div className="veyra-card veyra-card--rows">
      <button className="veyra-row" type="button" onClick={() => onDetail('this-device')}>
        <span className="veyra-row__label">This Device</span>
        <VeyraIcon name="chevron" />
      </button>
    </div>
  </section>
}
