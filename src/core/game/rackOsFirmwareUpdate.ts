import { RACK_OS_1_1_BUSINESS_FIRMWARE_ID, RACK_OS_FIRMWARE_ID } from './firmwareIdentity'
import { getFilesystemFile } from './filesystem'
import { isDeviceNetworkUsable } from './deviceOperationalState'
import { resolveActiveRemoteTarget } from './remoteSession'
import type {
  DeviceFirmwareUpdateProgress, FirmwarePackageFile, FirmwareState, FirmwareUpdatePhase, FirmwareUpdateStepResult,
  FilesystemFile, GameState, NetworkHost,
} from './types'

/**
 * The one newer RACK-OS release the world currently represents.
 *
 * Unlike VEYRA OS 4.2, this release is not delivered by the Device's own
 * closed update path: it is distributed as a concrete firmware installer
 * artifact the player acquires, transfers, and runs from the target Device's
 * own filesystem. `buildId` is therefore load-bearing — it is the exact
 * represented build an artifact must carry before any installation is
 * admitted, and it is never inferred from a filename or a display version.
 *
 * `publisher` is this release's own stated provenance, authored here rather
 * than inherited from any sibling product that happens to share the name.
 *
 * This constant and the single `RACK-OS 1.0 -> this` step below are the whole
 * represented RACK-OS update route. There is deliberately no firmware
 * registry, edition family, release channel, version-ordering rule, signing or
 * trust model, downgrade path, or firmware catalogue (A16).
 */
export const RACK_OS_1_1_BUSINESS_BUILD_ID = 'build-rack-os-1-1-business-v0'

export interface RackOsFirmwareRelease {
  readonly firmware: FirmwareState
  /** Stable identity of the one concrete build of this release the world represents. */
  readonly buildId: string
  readonly publisher: string
  readonly headline: string
  readonly highlights: readonly string[]
  /** The represented byte size of this release's installer artifact. */
  readonly installerSizeBytes: number
}

export const RACK_OS_1_1_BUSINESS_RELEASE: RackOsFirmwareRelease = {
  firmware: { id: RACK_OS_1_1_BUSINESS_FIRMWARE_ID, name: 'RACK-OS', version: '1.1 Business' },
  buildId: RACK_OS_1_1_BUSINESS_BUILD_ID,
  publisher: 'rack-systems',
  headline: 'Adds a graphical application layer for business deployments.',
  highlights: [
    'Applications home replaces the fixed operating tabs.',
    'Terminal, Files and System become applications rather than sections.',
    'Compatible installed business software is presented as an application.',
    'Installed software, services and stored data are left as they are.',
  ],
  installerSizeBytes: 24_000_000,
}

/** The filename extension a RACK-OS firmware installer artifact actually uses. */
export const RACK_OS_FIRMWARE_INSTALLER_FILENAME = 'rack-os-1.1-business.fwpkg'

/**
 * How long each represented stage of one file-based RACK-OS installation
 * takes. Exact timing is this implementation's own decision, like the Device
 * recovery phase durations it sits beside.
 *
 * There is deliberately no `DOWNLOADING` stage: the installer artifact is
 * already on the Device's own filesystem before installation is admitted, so
 * claiming a download would be a fabricated status line.
 */
export const RACK_OS_FIRMWARE_UPDATE_PHASE_DURATIONS_MS: Readonly<Record<'PREPARING' | 'INSTALLING' | 'FINALIZING', number>> = {
  PREPARING: 4_000,
  INSTALLING: 12_000,
  FINALIZING: 4_000,
}

const PHASE_SEQUENCE: readonly FirmwareUpdatePhase[] = ['PREPARING', 'INSTALLING', 'FINALIZING']

export const RACK_OS_FIRMWARE_UPDATE_DURATION_MS = PHASE_SEQUENCE
  .reduce((total, phase) => total + phaseDurationMs(phase), 0)

function phaseDurationMs(phase: FirmwareUpdatePhase): number {
  return phase === 'DOWNLOADING' ? 0 : RACK_OS_FIRMWARE_UPDATE_PHASE_DURATIONS_MS[phase]
}

/**
 * How far one running installation has actually got, as a 0..1 fraction of the
 * whole represented install. Derived from canonical phase and elapsed time so
 * a progress indicator states real progress rather than animating a browser
 * timer of its own.
 */
export function deriveRackOsFirmwareUpdateProgress(progress: DeviceFirmwareUpdateProgress): number {
  const index = PHASE_SEQUENCE.indexOf(progress.phase)
  if (index < 0) return 0
  const before = PHASE_SEQUENCE.slice(0, index).reduce((total, phase) => total + phaseDurationMs(phase), 0)
  const inside = Math.min(Math.max(0, progress.elapsedMs), phaseDurationMs(progress.phase))
  return Math.min(1, (before + inside) / RACK_OS_FIRMWARE_UPDATE_DURATION_MS)
}

/**
 * Which represented release a running installation is installing. One concrete
 * lookup over the one represented release, so a surface presenting an install
 * states the release actually being installed instead of assuming one.
 */
export function resolveInstallingRackOsFirmwareRelease(progress: DeviceFirmwareUpdateProgress): RackOsFirmwareRelease | undefined {
  return progress.releaseId === RACK_OS_1_1_BUSINESS_RELEASE.firmware.id ? RACK_OS_1_1_BUSINESS_RELEASE : undefined
}

/** Whether a filesystem artifact is a firmware installer at all; kind alone, never the filename. */
export function isFirmwarePackageArtifact(file: FilesystemFile): file is FirmwarePackageFile {
  return file.kind === 'firmware_package'
}

/**
 * Whether this exact artifact carries the exact represented RACK-OS 1.1
 * Business build. Recognition is stable firmware and build identity only: a
 * file named `.fwpkg` proves nothing, and a renamed artifact stays exactly
 * what it is.
 */
export function isRackOsFirmwareArtifact(file: FirmwarePackageFile): boolean {
  return file.firmwareId === RACK_OS_1_1_BUSINESS_RELEASE.firmware.id && file.buildId === RACK_OS_1_1_BUSINESS_RELEASE.buildId
}

export type RackOsFirmwareInstallability =
  | 'installable'
  | 'unrecognized_artifact'
  | 'incompatible_device'
  | 'already_installed'
  | 'update_in_progress'

/**
 * Whether this exact artifact could install on this exact Device right now,
 * derived fresh from represented truth on every read and stored nowhere.
 *
 * Shared by the canonical admission below and by the update utility that
 * presents it, so the surface can never claim an installation the operation
 * would refuse. Compatibility is stable Firmware identity: the only Device
 * this release installs onto is one currently running RACK-OS 1.0.
 */
export function deriveRackOsFirmwareInstallability(
  file: FirmwarePackageFile,
  device: { readonly firmware?: FirmwareState; readonly firmwareUpdate?: DeviceFirmwareUpdateProgress },
): RackOsFirmwareInstallability {
  if (!isRackOsFirmwareArtifact(file)) return 'unrecognized_artifact'
  if (device.firmwareUpdate) return 'update_in_progress'
  if (device.firmware?.id === RACK_OS_1_1_BUSINESS_RELEASE.firmware.id) return 'already_installed'
  if (device.firmware?.id !== RACK_OS_FIRMWARE_ID) return 'incompatible_device'
  return 'installable'
}

/**
 * The status the two RACK-OS firmware presentation surfaces (the artifact
 * pane and the update utility) actually show, composing installability with
 * the same reachability precondition the canonical operation itself checks.
 *
 * `deriveRackOsFirmwareInstallability` alone answers a narrower question —
 * stable Firmware/build compatibility — and stays that way; `target_offline`
 * is not a compatibility fact about the artifact or the release, it is the
 * Device's own current operational truth, exactly what
 * `startRackOsFirmwareUpdateForOperatedRemoteDevice` refuses on before it ever
 * inspects the artifact. This derivation checks reachability first, in that
 * same order, so presentation can never offer an installation the canonical
 * operation would refuse merely because a stale Remote Session has not yet
 * been cleared.
 */
export type RackOsFirmwarePresentationStatus = 'target_offline' | RackOsFirmwareInstallability

export function deriveRackOsFirmwarePresentationStatus(
  file: FirmwarePackageFile,
  device: { readonly firmware?: FirmwareState; readonly firmwareUpdate?: DeviceFirmwareUpdateProgress; readonly operational: NetworkHost['operational'] },
): RackOsFirmwarePresentationStatus {
  if (!isDeviceNetworkUsable(device.operational)) return 'target_offline'
  return deriveRackOsFirmwareInstallability(file, device)
}

export type StartRackOsFirmwareUpdateResult =
  | { readonly status: 'started'; readonly state: GameState }
  | {
    readonly status:
      | 'session_unavailable' | 'target_offline' | 'invalid_path' | 'artifact_not_found' | 'artifact_not_file' | 'not_firmware_artifact'
      | Exclude<RackOsFirmwareInstallability, 'installable'>
    readonly state: GameState
  }

/**
 * Starts the operated Device's own RACK-OS firmware installation from an
 * installer artifact that Device already holds.
 *
 * It deliberately accepts no Device target: the acting Device is resolved from
 * the active Remote Session, exactly as remote software installation and the
 * VEYRA firmware update already do, so no caller can name a Device and no
 * presentation component can point an installation at somebody else's server.
 * The artifact is then resolved from *that* Device's own filesystem by path —
 * the local Device's copy is never installable onto a remote one.
 *
 * Authority is the currently represented operating authority of the Session's
 * DeviceAccess, exactly as remote package installation uses it; V1 represents
 * no finer RACK-OS administrator model and none is invented here.
 *
 * `resolveActiveRemoteTarget` resolves identity only — it does not itself
 * verify reachability, and other callers rely on that separation — so this
 * operation checks the target's current canonical operational usability
 * itself, exactly as `installRemoteSoftwarePackage` already does, immediately
 * after resolving the target and before touching its filesystem. A Session
 * that has not yet been cleared by the next canonical reachability pass must
 * not be able to admit new firmware work against a target that has already
 * gone offline.
 *
 * Every refusal leaves canonical state completely untouched, and a successful
 * start changes exactly one thing: the operated Device's own firmware-update
 * progress. Its Firmware, Services, installed software, filesystem and
 * operational state are all unchanged until the installation actually
 * completes.
 */
export function startRackOsFirmwareUpdateForOperatedRemoteDevice(state: GameState, artifactPath: string): StartRackOsFirmwareUpdateResult {
  const remote = resolveActiveRemoteTarget(state)
  if (!remote) return { status: 'session_unavailable', state }
  if (!isDeviceNetworkUsable(remote.target.operational)) return { status: 'target_offline', state }

  const resolved = getFilesystemFile(remote.target.filesystem!, artifactPath)
  if (resolved.status === 'invalid_path') return { status: 'invalid_path', state }
  if (resolved.status === 'not_found') return { status: 'artifact_not_found', state }
  if (resolved.status === 'not_file') return { status: 'artifact_not_file', state }
  if (!isFirmwarePackageArtifact(resolved.file)) return { status: 'not_firmware_artifact', state }

  const installability = deriveRackOsFirmwareInstallability(resolved.file, remote.target)
  if (installability !== 'installable') return { status: installability, state }

  const started: DeviceFirmwareUpdateProgress = { releaseId: RACK_OS_1_1_BUSINESS_RELEASE.firmware.id, phase: 'PREPARING', elapsedMs: 0 }
  return { status: 'started', state: replaceHost(state, { ...remote.target, firmwareUpdate: started }) }
}

function replaceHost(state: GameState, next: NetworkHost): GameState {
  const hosts = state.world.network.hosts.map((host) => host.id === next.id ? next : host)
  return { ...state, world: { ...state.world, network: { ...state.world.network, hosts } } }
}

/**
 * Applies a finished RACK-OS firmware installation to the Device that
 * installed it.
 *
 * The Device's canonical Firmware becomes the new release's own stable
 * identity — the older release is replaced, never rewritten — and the Device
 * then enters its existing real reboot lifecycle. Nothing else is touched, and
 * that absence is the point: in this server architecture GateSSH is
 * `InstalledSoftware` and a separately managed Service implementation, not
 * firmware-bundled as it is on VEYRA's phone, so this release cannot silently
 * update or replace it. AuthGuard, other installed software, filesystem
 * contents, Civic Dollar state, hardware and Network membership are equally
 * untouched — and because a Business Branch's technical-site relationship is
 * an explicit reference to a LocalNetwork rather than to this Device, this
 * update changes no Business Branch, Company, sale, or settlement
 * configuration either: installing RACK-OS Business creates no Business state
 * of its own.
 *
 * Because the access Service build is unchanged, established `DeviceAccess`
 * survives the update; the interactive Remote Session ends only because the
 * rebooting Device stops being reachable, which the canonical Session owner
 * observes on its own.
 */
function applyRackOsFirmwareRelease(state: GameState, host: NetworkHost): GameState {
  const { firmwareUpdate: _finished, ...updated } = host
  return replaceHost(state, {
    ...updated,
    firmware: { ...RACK_OS_1_1_BUSINESS_RELEASE.firmware },
    operational: { lifecycle: 'SHUTTING_DOWN', connectivity: 'DISCONNECTED' },
    connectivityRecovery: { phase: 'SHUTTING_DOWN', elapsedMs: 0 },
  })
}

/**
 * Advance one running RACK-OS installation by an elapsed step.
 *
 * Elapsed time is consumed coherently across stage boundaries, exactly as
 * Device connectivity recovery and the VEYRA installation consume it: one
 * large step produces the same final outcome an equivalent sequence of small
 * steps would. The installation therefore progresses whether or not anybody is
 * looking at the operated Device's screen, and completing the final
 * `FINALIZING` stage is what activates the release.
 */
export function stepRackOsFirmwareUpdate(state: GameState, host: NetworkHost, progress: DeviceFirmwareUpdateProgress, elapsedMs: number): FirmwareUpdateStepResult {
  let phaseIndex = Math.max(0, PHASE_SEQUENCE.indexOf(progress.phase))
  let elapsed = progress.elapsedMs + Math.max(0, elapsedMs)
  while (phaseIndex < PHASE_SEQUENCE.length && elapsed >= phaseDurationMs(PHASE_SEQUENCE[phaseIndex])) {
    elapsed -= phaseDurationMs(PHASE_SEQUENCE[phaseIndex])
    phaseIndex += 1
  }
  if (phaseIndex >= PHASE_SEQUENCE.length) {
    return { state: applyRackOsFirmwareRelease(state, host), recoveryRemainderMs: elapsed }
  }
  return { state: replaceHost(state, { ...host, firmwareUpdate: { ...progress, phase: PHASE_SEQUENCE[phaseIndex], elapsedMs: elapsed } }) }
}
