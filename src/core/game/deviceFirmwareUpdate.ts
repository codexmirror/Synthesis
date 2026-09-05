import { RACK_OS_1_1_BUSINESS_RELEASE, stepRackOsFirmwareUpdate } from './rackOsFirmwareUpdate'
import { VEYRA_OS_4_2_RELEASE, stepVeyraFirmwareUpdate } from './veyraFirmwareUpdate'
import type { DeviceFirmwareUpdateProgress, FirmwareUpdateStepResult, GameState, NetworkHost } from './types'

/**
 * Canonical advancement for every running Firmware installation, called from
 * `advanceGameState` alongside the other represented Device transitions.
 *
 * This owns only *which* installations participate and which concrete update
 * route advances each one; what a route's stages are, how long they take and
 * what activating its release changes all stay with that route. The dispatch
 * below is deliberately two explicit branches over the two represented
 * firmware-update routes, not a firmware registry, plugin surface or update
 * framework (A16): a third represented route adds a third branch.
 *
 * The two routes are genuinely different mechanics, and that difference is
 * preserved rather than generalized away — VEYRA's release is delivered by the
 * phone's own closed update path and begins by downloading it, while RACK-OS
 * 1.1 Business is installed from an installer artifact already sitting on the
 * target Device's filesystem and therefore has no download stage at all.
 *
 * An installation naming a release the world does not represent is dropped
 * without applying anything, so an incoherent update can never install
 * something that does not exist.
 */
function stepFirmwareUpdate(state: GameState, host: NetworkHost, progress: DeviceFirmwareUpdateProgress, elapsedMs: number): FirmwareUpdateStepResult | undefined {
  if (progress.releaseId === VEYRA_OS_4_2_RELEASE.firmware.id) return stepVeyraFirmwareUpdate(state, host, progress, elapsedMs)
  if (progress.releaseId === RACK_OS_1_1_BUSINESS_RELEASE.firmware.id) return stepRackOsFirmwareUpdate(state, host, progress, elapsedMs)
  return undefined
}

/**
 * Advances every running installation while retaining only the per-Device
 * elapsed time left after an activation. `advanceGameState` gives that causal
 * remainder to the Device recovery owner; callers interested only in firmware
 * state use `advanceDeviceFirmwareUpdates` below.
 */
export function advanceDeviceFirmwareUpdatesWithRemainder(state: GameState, elapsedMs: number): {
  readonly state: GameState
  readonly recoveryRemainders: readonly { readonly deviceId: string; readonly elapsedMs: number }[]
} {
  let nextState = state
  const recoveryRemainders: { deviceId: string; elapsedMs: number }[] = []
  for (const host of state.world.network.hosts) {
    const progress = host.firmwareUpdate
    if (!progress) continue
    const stepped = stepFirmwareUpdate(nextState, host, progress, elapsedMs)
    if (!stepped) {
      const { firmwareUpdate: _incoherent, ...cleared } = host
      nextState = replaceHost(nextState, cleared)
      continue
    }
    nextState = stepped.state
    if (stepped.recoveryRemainderMs !== undefined) recoveryRemainders.push({ deviceId: host.id, elapsedMs: stepped.recoveryRemainderMs })
  }
  return { state: nextState, recoveryRemainders }
}

export function advanceDeviceFirmwareUpdates(state: GameState, elapsedMs: number): GameState {
  return advanceDeviceFirmwareUpdatesWithRemainder(state, elapsedMs).state
}

function replaceHost(state: GameState, next: NetworkHost): GameState {
  const hosts = state.world.network.hosts.map((host) => host.id === next.id ? next : host)
  return { ...state, world: { ...state.world, network: { ...state.world.network, hosts } } }
}
