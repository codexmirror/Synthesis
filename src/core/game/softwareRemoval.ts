import { NODE_MINER_INSTALLED_EXECUTABLE_PATH, NODE_MINER_PROGRAM_ID } from './nodeMiner'
import { startProcess } from './processes'
import { NODESCAN_1_0_STANDARD_INSTALLATION, NODESCAN_1_0_STANDARD_RELEASE_ID } from './software'
import type { ExecutableFile, GameState, InstalledSoftware, NodeMinerInstallation, NodeScanInstallation } from './types'

export const SOFTWARE_REMOVAL_WORK_REQUIRED = 400
export const SOFTWARE_REMOVAL_RAM_REQUIRED_MIB = 128

/** The two products V1 actually allows removal of; see `removeInstalledSoftware` for the rest. */
export type RemovableProductId = 'nodescan' | 'node-miner'

export type RemoveInstalledSoftwareResult =
  | { readonly status: 'started'; readonly state: GameState; readonly processId: string; readonly productId: RemovableProductId; readonly releaseId: string; readonly name: string; readonly version: string; readonly channel: string }
  | { readonly status: 'not_installed' | 'protected_baseline' | 'unsupported_in_v1' | 'already_removing'; readonly state: GameState }
  | { readonly status: 'insufficient_memory'; readonly state: GameState; readonly requiredMiB: number; readonly availableMiB: number }

/**
 * Admit removal of the currently installed release of one product into a
 * real finite software-removal `GameProcess`, sharing the same Device
 * CPU/RAM contention every other local Process uses. Removal targets
 * whatever is currently installed for `productId`; it does not accept a
 * releaseId, since it is not always the player's choice which concrete
 * release removal restores (see NodeScan below).
 *
 * Not all preinstalled software is the same:
 * - NodeScan 1.0 Standard is the protected NODE-OS 1.0 baseline and is never
 *   removable.
 * - NodeScan 1.1 Experimental is a removable override of that baseline;
 *   completion restores the concrete NodeScan 1.0 Standard baseline (see
 *   `resolveCompletedSoftwareRemovals`).
 * - NODE Miner is ordinary removable software.
 * - Basic Credential Toolkit is ordinary preinstalled software, not a
 *   protected baseline, but V1 has no represented acquisition/reinstallation
 *   path for it, so it is rejected as unsupported for removal rather than
 *   silently treated as a system app.
 *
 * Admission validates current world truth exactly once, at this instant, and
 * snapshots only the release facts completion will need; it applies none of
 * removal's consequences immediately.
 */
export function removeInstalledSoftware(state: GameState, productId: InstalledSoftware['id']): RemoveInstalledSoftwareResult {
  const device = state.player.localDevice
  const installed = device.installedSoftware.find((software) => software.id === productId)
  if (!installed) return { status: 'not_installed', state }

  if (!isRemovableInstallation(installed)) return { status: 'unsupported_in_v1', state }
  if (installed.id === 'nodescan' && installed.releaseId === NODESCAN_1_0_STANDARD_RELEASE_ID) return { status: 'protected_baseline', state }

  const alreadyRemoving = state.process.processes.some((process) => process.kind === 'software_removal' && process.status === 'running' && process.executorDeviceId === device.id && process.productId === installed.id)
  if (alreadyRemoving) return { status: 'already_removing', state }

  const started = startProcess(state.process, device, {
    label: 'SOFTWARE REMOVAL',
    workRequired: SOFTWARE_REMOVAL_WORK_REQUIRED,
    ramRequiredMiB: SOFTWARE_REMOVAL_RAM_REQUIRED_MIB,
  })
  if (started.status === 'insufficient_memory') return { ...started, state }

  const productIdSnapshot = installed.id
  const processes = started.state.processes.map((process) => process.id === started.processId && process.kind === 'generic'
    ? {
        ...process,
        kind: 'software_removal' as const,
        productId: productIdSnapshot,
        releaseId: installed.releaseId,
        name: installed.name,
        version: installed.version,
        channel: installed.channel,
        ...(installed.id === 'node-miner' && installed.publisher ? { publisher: installed.publisher } : {}),
      }
    : process)
  return {
    status: 'started',
    processId: started.processId,
    productId: productIdSnapshot, releaseId: installed.releaseId, name: installed.name, version: installed.version, channel: installed.channel,
    state: { ...state, process: { ...started.state, processes } },
  }
}

function isRemovableInstallation(software: InstalledSoftware): software is NodeScanInstallation | NodeMinerInstallation {
  return software.id === 'nodescan' || software.id === 'node-miner'
}

/**
 * Owned by software removal: resolves every completed, unresolved local
 * software-removal Process against current world truth exactly once. The
 * `!process.result` guard (the same pattern `resolveCompletedSoftwareInstallations`
 * uses) makes repeated advancement after completion a no-op.
 *
 * The currently installed release is re-checked against what admission
 * snapshotted, so a Process never applies a consequence to a release it was
 * not actually admitted against; a mismatch resolves as a truthful
 * `not_installed` failure rather than mutating unrelated installed software.
 *
 * NodeScan completion restores the concrete protected NodeScan 1.0 Standard
 * baseline rather than leaving NodeScan absent — changing installed NodeScan
 * capability never touches Discovery or Knowledge, so previously stored
 * Enhanced Inspect snapshots remain exactly as they were.
 *
 * NODE Miner completion removes InstalledSoftware and, only when the
 * artifact at the deterministic installed path still represents the exact
 * release this removal was admitted against, deletes that executable. An
 * unrelated or replaced artifact occupying that path is left untouched. The
 * downloaded package artifact is never touched. Any already-running
 * `NodeMinerProcess` is a distinct, independent runtime and is never stopped
 * or otherwise affected by this resolution.
 */
export function resolveCompletedSoftwareRemovals(state: GameState): GameState {
  const device = state.player.localDevice
  let installedSoftware = device.installedSoftware
  let filesystem = device.filesystem
  let changed = false

  const processes = state.process.processes.map((process) => {
    if (process.kind !== 'software_removal' || process.status !== 'completed' || process.result || process.executorDeviceId !== device.id) return process
    changed = true

    const current = installedSoftware.find((software) => software.id === process.productId)
    if (!current || current.releaseId !== process.releaseId) return { ...process, result: { status: 'not_installed' as const } }

    if (process.productId === 'nodescan') {
      installedSoftware = installedSoftware.map((software) => software.id === 'nodescan' ? NODESCAN_1_0_STANDARD_INSTALLATION : software)
      return { ...process, result: { status: 'baseline_restored' as const } }
    }

    installedSoftware = installedSoftware.filter((software) => software.id !== 'node-miner')
    const executable = filesystem.files.find((file): file is ExecutableFile => file.kind === 'executable' && file.path === NODE_MINER_INSTALLED_EXECUTABLE_PATH)
    if (executable && executable.programId === NODE_MINER_PROGRAM_ID && executable.releaseId === process.releaseId) {
      filesystem = { ...filesystem, files: filesystem.files.filter((file) => file.id !== executable.id) }
    }
    return { ...process, result: { status: 'removed' as const } }
  })

  if (!changed) return state
  return {
    ...state,
    process: { ...state.process, processes },
    player: { ...state.player, localDevice: { ...device, installedSoftware, filesystem } },
  }
}
