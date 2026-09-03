import {
  deriveVeyraFirmwareUpdateProgress,
  type VeyraFirmwareRelease,
} from '../../core/game/veyraFirmwareUpdate'
import type { DeviceFirmwareUpdateProgress, FirmwareUpdatePhase } from '../../core/game/types'

/** What each represented stage of the installation is called in ordinary product language. */
const PHASE_LABEL: Readonly<Record<FirmwareUpdatePhase, string>> = {
  DOWNLOADING: 'Downloading update',
  PREPARING: 'Preparing update',
  INSTALLING: 'Installing update',
  RESTARTING: 'Restarting',
}

/**
 * The system-installation surface: the whole phone while its firmware is being
 * replaced.
 *
 * It deliberately takes over everything — Home, applications, Settings and
 * VEYRA's own navigation are all gone for the duration — because that is what
 * a phone installing its operating system actually does. The stage and the
 * progress it states are read from the Device's own canonical update state on
 * every render; this component runs no timer, animates no fake progress, and
 * cannot advance, pause, cancel or complete the installation. Leaving the
 * phone entirely and coming back simply shows wherever the real installation
 * has got to.
 */
export function VeyraFirmwareInstall({ progress, release }: {
  progress: DeviceFirmwareUpdateProgress
  release: VeyraFirmwareRelease | undefined
}) {
  const restarting = progress.phase === 'RESTARTING'
  const completion = Math.round(deriveVeyraFirmwareUpdateProgress(progress) * 100)

  return <section className="veyra-screen veyra-install" aria-label="Installing system update" data-phase={progress.phase}>
    <p className="veyra-install__brand">VEYRA</p>
    <span className="veyra-install__mark" aria-hidden="true" data-restarting={restarting || undefined} />
    <h1 className="veyra-install__release">{release ? `${release.firmware.name} ${release.firmware.version}` : 'System update'}</h1>
    <p className="veyra-install__phase" role="status">{PHASE_LABEL[progress.phase]}</p>

    {restarting
      ? <p className="veyra-note veyra-install__note">Your phone is restarting to finish the update.</p>
      : <>
        <div
          className="veyra-install__track"
          role="progressbar"
          aria-label="Update progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completion}
        >
          <span className="veyra-install__fill" style={{ width: `${completion}%` }} />
        </div>
        <p className="veyra-install__completion">{completion}%</p>
        <p className="veyra-note veyra-install__note">Your phone will restart to finish the update.</p>
      </>}
  </section>
}

/**
 * The first screen of the newly installed release: a short, calm confirmation
 * of what the phone is now running, stated from the release it actually
 * installed. It authorizes nothing and changes nothing — dismissing it just
 * goes Home, where the whole surface is already the new release's own.
 */
export function VeyraFirmwareWelcome({ release, onContinue }: {
  release: VeyraFirmwareRelease
  onContinue: () => void
}) {
  return <section className="veyra-screen veyra-welcome" aria-label={`${release.firmware.name} ${release.firmware.version} installed`}>
    <p className="veyra-install__brand">VEYRA</p>
    <h1 className="veyra-welcome__release">{release.firmware.name}<span>{release.firmware.version}</span></h1>
    <p className="veyra-note veyra-welcome__headline">{release.headline}</p>
    <ul className="veyra-release__notes veyra-welcome__notes">
      {release.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
    </ul>
    <button className="veyra-submit" type="button" onClick={onContinue}>Continue</button>
  </section>
}
