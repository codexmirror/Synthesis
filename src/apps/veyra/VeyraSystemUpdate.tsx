import { useState } from 'react'
import { useGameActions } from '../../app/GameContext'
import { resolveAvailableVeyraFirmwareUpdate } from '../../core/game/veyraFirmwareUpdate'
import type { NetworkHost } from '../../core/game/types'
import { VeyraPinChallenge } from './VeyraPinChallenge'

/**
 * System Update: the phone's own firmware, and the one official newer release
 * VEYRA currently offers it.
 *
 * This is a system surface over Firmware, not an application, a package, a
 * download or a store. Nothing here is acquired, saved to the filesystem,
 * purchased or installed as Software: the release the Device installs comes
 * from VEYRA's own update path, and the only thing this screen can do is ask
 * the Device to install it after its owner proves the Device PIN.
 *
 * Availability is read from the Device's own current Firmware identity on
 * every render, so a phone that is already on the newest represented release
 * truthfully says so instead of offering an update that does not exist.
 * Opening, reading or leaving this screen changes no canonical state whatever;
 * only a correct PIN starts anything.
 */
export function VeyraSystemUpdate({ device }: { device: NetworkHost }) {
  const { startVeyraFirmwareUpdateForOperatedRemoteDevice } = useGameActions()
  const available = resolveAvailableVeyraFirmwareUpdate(device)
  const [installing, setInstalling] = useState(false)

  if (installing && available) {
    return <VeyraPinChallenge
      note={`Enter this Device's PIN to install ${available.firmware.name} ${available.firmware.version}.`}
      verify={(pin) => {
        const result = startVeyraFirmwareUpdateForOperatedRemoteDevice(pin)
        if (result.status === 'started') return true
        // A wrong PIN is stated by the challenge itself. Anything else is a
        // truthful refusal from the canonical operation, not a PIN failure.
        return result.status === 'invalid_pin' ? false : 'This update is no longer available.'
      }}
      onSuccess={() => setInstalling(false)}
      onCancel={() => setInstalling(false)}
    />
  }

  return <section className="veyra-screen" aria-label="System Update">
    <p className="veyra-eyebrow">Settings</p>
    <h1 className="veyra-title">System Update</h1>

    {available
      ? <>
        <article className="veyra-card veyra-release">
          <p className="veyra-release__badge">Update available</p>
          <p className="veyra-release__name">{available.firmware.name} {available.firmware.version}</p>
          <p className="veyra-release__headline">{available.headline}</p>
          <ul className="veyra-release__notes">
            {available.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
          </ul>
        </article>
        <p className="veyra-note">Installing requires this Device's PIN. Your phone stays on {device.firmware?.name} {device.firmware?.version} until the update finishes.</p>
        <button className="veyra-submit" type="button" onClick={() => setInstalling(true)}>Install {available.firmware.version}</button>
      </>
      : <>
        <article className="veyra-card veyra-release veyra-release--current">
          <p className="veyra-release__name">{device.firmware?.name} {device.firmware?.version}</p>
          <p className="veyra-release__headline">This phone is running the latest VEYRA OS release.</p>
        </article>
        <p className="veyra-note">VEYRA will offer the next release here when there is one.</p>
      </>}
  </section>
}
