import { VEYRA_OS_4_1_FIRMWARE_ID, VEYRA_OS_4_2_FIRMWARE_ID } from './firmwareIdentity'
import { verifyDevicePinForOperatedRemoteDevice } from './deviceSecurity'
import { resolveActiveRemoteTarget } from './remoteSession'
import { GATE_SSH_1_3_3_BUILD_ID, GATE_SSH_1_3_3_RELEASE_ID, GATE_SSH_PRODUCT_ID } from './serviceImplementations'
import type { DeviceFirmwareUpdateProgress, FirmwareState, FirmwareUpdatePhase, GameState, NetworkHost, NetworkService } from './types'

/**
 * One concrete official VEYRA OS release, exactly as VEYRA publishes it.
 *
 * A Firmware release is closed Device-owned firmware, not InstalledSoftware,
 * not a Market offering, not a software package and not a filesystem artifact:
 * it has no `sizeBytes`, no publisher metadata, no distribution endpoint and no
 * acquisition step, because the player never obtains it — the Device installs
 * it from VEYRA's own update path.
 *
 * `bundledSshImplementation` is the concrete SSH implementation this firmware
 * release actually ships. It is the Service implementation the Device runs
 * after installing, i.e. Device-owned World Truth (A07), and deliberately not
 * an `InstalledSoftware` entry: on this phone GateSSH is firmware, not
 * something its owner installed.
 */
export interface VeyraFirmwareRelease {
  readonly firmware: FirmwareState
  readonly headline: string
  readonly highlights: readonly string[]
  readonly bundledSshImplementation: NetworkService['implementation']
}

/**
 * The one newer VEYRA OS release the world currently represents.
 *
 * This constant, and the single `VEYRA OS 4.1 -> this` step below, are the
 * entire represented "official update source". There is deliberately no update
 * server, firmware catalogue, release registry, channel model, OTA protocol or
 * version-ordering rule (A16): a future release adds one more constant and one
 * more concrete step.
 */
export const VEYRA_OS_4_2_RELEASE: VeyraFirmwareRelease = {
  firmware: { id: VEYRA_OS_4_2_FIRMWARE_ID, name: 'VEYRA OS', version: '4.2' },
  headline: 'A more refined VEYRA, and an updated secure shell service.',
  highlights: [
    'Refreshed system presentation, with clearer hierarchy and calmer typography across Home and Settings.',
    'Updated secure shell service to GateSSH 1.3.3.',
    'Your Device PIN, Wallet protection and signed-in account are unchanged.',
  ],
  bundledSshImplementation: {
    productId: GATE_SSH_PRODUCT_ID,
    releaseId: GATE_SSH_1_3_3_RELEASE_ID,
    buildId: GATE_SSH_1_3_3_BUILD_ID,
    name: 'GateSSH',
    version: '1.3.3',
  },
}

/**
 * Which official newer release, if any, VEYRA currently offers a Device.
 *
 * Availability is derived from the Device's own current Firmware identity on
 * every read rather than stored anywhere: a Device already running 4.2 is
 * simply up to date, and a Device running some other Firmware is offered
 * nothing at all. Stable identity decides, never the mutable display version.
 */
export function resolveAvailableVeyraFirmwareUpdate(device: Pick<NetworkHost, 'firmware'>): VeyraFirmwareRelease | undefined {
  return device.firmware?.id === VEYRA_OS_4_1_FIRMWARE_ID ? VEYRA_OS_4_2_RELEASE : undefined
}

/**
 * How long each represented stage of one firmware installation takes. Exact
 * timing is this implementation's own decision, like the Device recovery
 * phase durations it sits beside.
 */
/**
 * Which represented release a running installation is installing. One concrete
 * lookup over the one represented release, so a surface presenting an install
 * states the release actually being installed instead of assuming one.
 */
export function resolveInstallingVeyraFirmwareRelease(progress: DeviceFirmwareUpdateProgress): VeyraFirmwareRelease | undefined {
  return progress.releaseId === VEYRA_OS_4_2_RELEASE.firmware.id ? VEYRA_OS_4_2_RELEASE : undefined
}

export const VEYRA_FIRMWARE_UPDATE_PHASE_DURATIONS_MS: Readonly<Record<FirmwareUpdatePhase, number>> = {
  DOWNLOADING: 7_000,
  PREPARING: 3_000,
  INSTALLING: 8_000,
  RESTARTING: 4_000,
}

const PHASE_SEQUENCE: readonly FirmwareUpdatePhase[] = ['DOWNLOADING', 'PREPARING', 'INSTALLING', 'RESTARTING']

export const VEYRA_FIRMWARE_UPDATE_DURATION_MS = PHASE_SEQUENCE
  .reduce((total, phase) => total + VEYRA_FIRMWARE_UPDATE_PHASE_DURATIONS_MS[phase], 0)

/**
 * How far one running installation has actually got, as a 0..1 fraction of the
 * whole represented install. It is derived from canonical phase and elapsed
 * time so a progress indicator states real progress rather than animating a
 * browser timer of its own.
 */
export function deriveVeyraFirmwareUpdateProgress(progress: DeviceFirmwareUpdateProgress): number {
  const completedPhases = PHASE_SEQUENCE.slice(0, PHASE_SEQUENCE.indexOf(progress.phase))
  const before = completedPhases.reduce((total, phase) => total + VEYRA_FIRMWARE_UPDATE_PHASE_DURATIONS_MS[phase], 0)
  const inside = Math.min(Math.max(0, progress.elapsedMs), VEYRA_FIRMWARE_UPDATE_PHASE_DURATIONS_MS[progress.phase])
  return Math.min(1, (before + inside) / VEYRA_FIRMWARE_UPDATE_DURATION_MS)
}

export type StartVeyraFirmwareUpdateResult =
  | { readonly status: 'started'; readonly state: GameState }
  | { readonly status: 'invalid_pin' | 'device_not_found' | 'session_unavailable' | 'update_unavailable' | 'update_in_progress'; readonly state: GameState }

/**
 * Starts the operated Device's own firmware update, gated exclusively on that
 * Device's own secret PIN.
 *
 * It deliberately accepts no target: the acting Device is resolved from the
 * active Remote Session, exactly as the remote Dollar transfer and the Wallet
 * protection change already do, so no caller can name a Device and no Session
 * can be pointed at somebody else's phone. The Session decides only *which*
 * Device acts and grants no firmware authority of its own — reaching VEYRA
 * through DeviceAccess is never enough, and a wrong PIN changes nothing at
 * all. The canonical PIN is never returned or otherwise present in the result.
 */
export function startVeyraFirmwareUpdateForOperatedRemoteDevice(state: GameState, pin: string): StartVeyraFirmwareUpdateResult {
  const remote = resolveActiveRemoteTarget(state)
  if (!remote) return { status: 'session_unavailable', state }

  const verification = verifyDevicePinForOperatedRemoteDevice(state, pin)
  if (verification.status !== 'verified') return { status: verification.status, state }

  const target = remote.target
  if (target.firmwareUpdate) return { status: 'update_in_progress', state }
  const release = resolveAvailableVeyraFirmwareUpdate(target)
  if (!release) return { status: 'update_unavailable', state }

  const started: DeviceFirmwareUpdateProgress = { releaseId: release.firmware.id, phase: 'DOWNLOADING', elapsedMs: 0 }
  return { status: 'started', state: replaceHost(state, { ...target, firmwareUpdate: started }) }
}

function replaceHost(state: GameState, next: NetworkHost): GameState {
  const hosts = state.world.network.hosts.map((host) => host.id === next.id ? next : host)
  return { ...state, world: { ...state.world, network: { ...state.world.network, hosts } } }
}

/**
 * Applies a finished firmware installation to the Device that installed it.
 *
 * The Device's canonical Firmware becomes the new release's own stable
 * identity — the older release is replaced, never rewritten — and the firmware
 * this release ships replaces the implementation of the Device's own SSH
 * Service. That Service implementation stays Device-owned World Truth: nothing
 * here touches `installedSoftware`, so firmware-owned GateSSH never becomes
 * something the phone's owner installed. Every weakness, fingerprint and
 * exploit consequence then follows from that changed implementation on its
 * own, with no update-specific special case anywhere.
 *
 * A Device whose SSH implementation is not exactly one GateSSH Service is left
 * with its Services untouched rather than guessing which one the firmware
 * meant; the Firmware transition itself still completes, because that is what
 * was installed.
 */
function applyVeyraFirmwareRelease(host: NetworkHost, release: VeyraFirmwareRelease): NetworkHost {
  const { firmwareUpdate: _finished, ...updated } = host
  const gateSshServices = (host.services ?? []).filter((service) => service.implementation.productId === GATE_SSH_PRODUCT_ID)
  const services = gateSshServices.length === 1 && host.services
    ? host.services.map((service) => service.id === gateSshServices[0].id
      ? { ...service, implementation: { ...release.bundledSshImplementation } }
      : service)
    : host.services
  return { ...updated, firmware: { ...release.firmware }, ...(services ? { services } : {}) }
}

/**
 * Canonical advancement for every running firmware installation, called from
 * `advanceGameState` alongside the other represented Device transitions.
 *
 * Elapsed time is consumed coherently across stage boundaries, exactly as
 * Device connectivity recovery consumes it: one large step produces the same
 * final outcome an equivalent sequence of small steps would, rather than
 * needing an extra tick per stage. The installation therefore progresses
 * whether or not anybody is looking at the phone's Settings screen, and
 * completing the final `RESTARTING` stage — the update's own represented
 * restart of the operating surface, not a Device reboot — is what applies the
 * new release.
 *
 * An installation naming a release the world does not represent is dropped
 * without applying anything, so an incoherent update can never install
 * something that does not exist.
 */
export function advanceVeyraFirmwareUpdates(state: GameState, elapsedMs: number): GameState {
  const step = Math.max(0, elapsedMs)
  let nextState = state
  for (const host of state.world.network.hosts) {
    const progress = host.firmwareUpdate
    if (!progress) continue
    if (progress.releaseId !== VEYRA_OS_4_2_RELEASE.firmware.id) {
      const { firmwareUpdate: _incoherent, ...cleared } = host
      nextState = replaceHost(nextState, cleared)
      continue
    }

    let phaseIndex = Math.max(0, PHASE_SEQUENCE.indexOf(progress.phase))
    let elapsed = progress.elapsedMs + step
    while (phaseIndex < PHASE_SEQUENCE.length && elapsed >= VEYRA_FIRMWARE_UPDATE_PHASE_DURATIONS_MS[PHASE_SEQUENCE[phaseIndex]]) {
      elapsed -= VEYRA_FIRMWARE_UPDATE_PHASE_DURATIONS_MS[PHASE_SEQUENCE[phaseIndex]]
      phaseIndex += 1
    }

    nextState = replaceHost(nextState, phaseIndex >= PHASE_SEQUENCE.length
      ? applyVeyraFirmwareRelease(host, VEYRA_OS_4_2_RELEASE)
      : { ...host, firmwareUpdate: { ...progress, phase: PHASE_SEQUENCE[phaseIndex], elapsedMs: elapsed } })
  }
  return nextState
}
