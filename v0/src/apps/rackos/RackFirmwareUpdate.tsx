import { deriveRackOsFirmwareUpdateProgress, resolveInstallingRackOsFirmwareRelease } from '../../core/game/rackOsFirmwareUpdate'
import type { DeviceFirmwareUpdateProgress, FirmwareState, FirmwareUpdatePhase } from '../../core/game/types'

/**
 * What each represented stage of a file-based RACK-OS installation is called
 * on this old maintenance console.
 *
 * `DOWNLOADING` is deliberately absent: this route never has one, because the
 * installer artifact is already on the Device's own filesystem before the
 * installation is admitted. A progress record somehow claiming that stage is
 * stated as the raw phase rather than given an invented label.
 */
const PHASE_LABEL: Readonly<Partial<Record<FirmwareUpdatePhase, string>>> = {
  PREPARING: 'PREPARING FIRMWARE IMAGE',
  INSTALLING: 'WRITING FIRMWARE',
  FINALIZING: 'FINALIZING INSTALLATION',
}

const PHASE_ORDER: readonly FirmwareUpdatePhase[] = ['PREPARING', 'INSTALLING', 'FINALIZING']

/**
 * The whole operated environment while this Device installs firmware.
 *
 * It is a maintenance console, not an application screen: the Device is not
 * running its normal environment, and the surface says so instead of dressing
 * the wait up. Every line here is read from the Device's own canonical update
 * state on every render — this component runs no timer, animates no invented
 * progress, and cannot advance, pause, cancel or complete the installation.
 * Leaving RACK-OS entirely and coming back simply shows wherever the real
 * installation has got to.
 *
 * There is deliberately no fabricated boot log, kernel output, hardware check,
 * signature verification, disk telemetry or console noise. The three stage
 * rows, the completion percentage, the Device and the two release identities
 * are the entire set of facts the world actually represents about this
 * installation, and nothing beyond them is claimed.
 */
export function RackFirmwareUpdateSurface({ progress, deviceName, currentFirmware }: {
  progress: DeviceFirmwareUpdateProgress
  deviceName: string
  currentFirmware: FirmwareState
}) {
  const release = resolveInstallingRackOsFirmwareRelease(progress)
  const completion = release ? Math.round(deriveRackOsFirmwareUpdateProgress(progress) * 100) : 0
  const currentIndex = PHASE_ORDER.indexOf(progress.phase)

  return <section className="rack-update" aria-label="Firmware installation">
    <div className="rack-update__banner">
      <span>RACK FIRMWARE UPDATE UTILITY</span>
      <span>DO NOT POWER OFF</span>
    </div>

    <dl className="rack-facts rack-facts--dense rack-update__facts">
      <div><dt>DEVICE</dt><dd>{deviceName}</dd></div>
      <div><dt>FROM</dt><dd>{currentFirmware.name} {currentFirmware.version}</dd></div>
      <div><dt>TO</dt><dd>{release ? `${release.firmware.name} ${release.firmware.version}` : 'UNRECOGNIZED RELEASE'}</dd></div>
    </dl>

    <ol className="rack-update__stages">
      {PHASE_ORDER.map((phase, index) => <li
        key={phase}
        className="rack-update__stage"
        data-state={index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'pending'}
      >
        <span className="rack-update__stage-mark" aria-hidden="true">{index < currentIndex ? '[X]' : index === currentIndex ? '[>]' : '[ ]'}</span>
        <span className="rack-update__stage-name">{PHASE_LABEL[phase] ?? phase}</span>
      </li>)}
    </ol>

    <div
      className="rack-update__track"
      role="progressbar"
      aria-label="Firmware installation progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={completion}
    >
      <span className="rack-update__fill" style={{ width: `${completion}%` }} />
    </div>
    <p className="rack-update__completion" role="status">{PHASE_LABEL[progress.phase] ?? progress.phase} · {completion}%</p>
    <p className="rack-update__note">THIS DEVICE WILL RESTART WHEN THE INSTALLATION COMPLETES.</p>
  </section>
}
