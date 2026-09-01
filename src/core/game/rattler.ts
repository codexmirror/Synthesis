import { checkDestinationPlacement, copyFilesystemFileToPath, getFilesystemFile } from './filesystem'
import { RATTLER_1_0 } from './softwareReleaseContent'
import { resolveActiveRemoteTarget } from './remoteSession'
import { deriveResourceUsage } from './processes'
import type { ExecutableFile, GameState, NetworkHost, RattlerPayloadFile, RattlerPinSearchProcess } from './types'

export const RATTLER_PRODUCT_ID = RATTLER_1_0.productId
export const RATTLER_PROGRAM_ID = 'program-rattler-v0' as const
export const RATTLER_INSTALLED_EXECUTABLE_PATH = '/opt/rattler/rattler.exe'
export const RATTLER_EXECUTABLE_SIZE_BYTES = 1_900_000
export const RATTLER_PAYLOAD_SIZE_BYTES = 65_536
export const RATTLER_CANDIDATE_BUDGET = 10_000
export const RATTLER_ATTEMPTS_PER_MINUTE = 625
export const RATTLER_RAM_REQUIRED_MIB = 96

/** RATTLER 1.0's full deterministic ascending search: 0000..9999. Petra's 7042 is attempt 7043. */
export function rattlerCandidateAt(index: number): string | undefined {
  return Number.isInteger(index) && index >= 0 && index < RATTLER_CANDIDATE_BUDGET
    ? String(index).padStart(4, '0') : undefined
}

export function deriveRattlerPayloadPath(targetDeviceId: string): string {
  return `/opt/rattler/payload-${targetDeviceId}.rpl`
}

export type DeployRattlerResult =
  | { readonly status: 'started'; readonly state: GameState; readonly processId: string }
  | { readonly status: 'software_unavailable' | 'session_unavailable' | 'payload_unavailable' | 'target_unavailable' | 'already_running'; readonly state: GameState }
  | { readonly status: 'insufficient_memory'; readonly state: GameState; readonly requiredMiB: number; readonly availableMiB: number }

function matchingPayload(host: NetworkHost, targetDeviceId: string, fileId?: string): RattlerPayloadFile | undefined {
  return host.filesystem?.files.find((file): file is RattlerPayloadFile => file.kind === 'rattler_payload'
    && file.targetDeviceId === targetDeviceId && file.rattlerReleaseId === RATTLER_1_0.releaseId
    && file.rattlerBuildId === RATTLER_1_0.buildId && (!fileId || file.id === fileId))
}

/** Admission is resolved exclusively through the active Session -> DeviceAccess target. */
export function deployRattler(state: GameState): DeployRattlerResult {
  const installation = state.player.localDevice.installedSoftware.find(({ id }) => id === RATTLER_PRODUCT_ID)
  const executable = getFilesystemFile(state.player.localDevice.filesystem, RATTLER_INSTALLED_EXECUTABLE_PATH)
  if (!installation || installation.releaseId !== RATTLER_1_0.releaseId || installation.buildId !== RATTLER_1_0.buildId
    || executable.status !== 'ok' || executable.file.kind !== 'executable' || executable.file.programId !== RATTLER_PROGRAM_ID
    || executable.file.releaseId !== installation.releaseId || executable.file.buildId !== installation.buildId) return { status: 'software_unavailable', state }
  const remote = resolveActiveRemoteTarget(state)
  if (!remote) return { status: 'session_unavailable', state }
  const target = remote.target
  if (!target.hardware || !target.runtime || !target.security || !target.filesystem) return { status: 'target_unavailable', state }
  const payload = matchingPayload(target, target.id)
  if (!payload) return { status: 'payload_unavailable', state }
  if (state.process.processes.some((process) => process.kind === 'rattler_pin_search' && process.status === 'running'
    && process.targetDeviceId === target.id && process.attackedSurface === 'veyra_wallet_device_pin')) return { status: 'already_running', state }
  const availableMiB = deriveResourceUsage(target as Required<Pick<NetworkHost, 'id' | 'hardware' | 'runtime'>>, state.process).availableRamMiB
  if (RATTLER_RAM_REQUIRED_MIB > availableMiB) return { status: 'insufficient_memory', state, requiredMiB: RATTLER_RAM_REQUIRED_MIB, availableMiB }
  const processId = `process-${String(state.process.nextId).padStart(4, '0')}`
  const process: RattlerPinSearchProcess = {
    id: processId, kind: 'rattler_pin_search', label: 'RATTLER 1.0', status: 'running', executorDeviceId: target.id,
    ramRequiredMiB: RATTLER_RAM_REQUIRED_MIB, workRequired: RATTLER_CANDIDATE_BUDGET, workCompleted: 0,
    targetDeviceId: target.id, attackedSurface: 'veyra_wallet_device_pin', rattlerReleaseId: payload.rattlerReleaseId,
    rattlerBuildId: payload.rattlerBuildId, payloadFileId: payload.id, payloadPathSnapshot: payload.path,
    attemptsCompleted: 0, elapsedMs: 0,
  }
  return { status: 'started', processId, state: { ...state, process: { nextId: state.process.nextId + 1, processes: [...state.process.processes, process] } } }
}

/** Advances actual candidates from elapsed canonical time; the UI owns no attempt clock. */
export function advanceRattlerPinSearches(state: GameState, elapsedMs: number): GameState {
  if (elapsedMs <= 0 || !state.process.processes.some((process) => process.kind === 'rattler_pin_search' && process.status === 'running')) return state
  let knownDevicePins = state.knowledge.knownDevicePins ?? []
  let changed = false
  const processes = state.process.processes.map((process) => {
    if (process.kind !== 'rattler_pin_search' || process.status !== 'running') return process
    const host = state.world.network.hosts.find(({ id }) => id === process.targetDeviceId)
    const payload = host && matchingPayload(host, process.targetDeviceId, process.payloadFileId)
    if (!host?.security || !payload || payload.rattlerReleaseId !== process.rattlerReleaseId || payload.rattlerBuildId !== process.rattlerBuildId) {
      changed = true
      return { ...process, status: 'completed' as const, result: { status: 'payload_interrupted' as const } }
    }
    const elapsed = process.elapsedMs + elapsedMs
    const due = Math.min(RATTLER_CANDIDATE_BUDGET, Math.floor(elapsed * RATTLER_ATTEMPTS_PER_MINUTE / 60_000))
    if (due <= process.attemptsCompleted) return elapsed === process.elapsedMs ? process : (changed = true, { ...process, elapsedMs: elapsed })
    let attempts = process.attemptsCompleted
    let current = process.currentCandidate
    while (attempts < due) {
      current = rattlerCandidateAt(attempts)!
      attempts++
      if (current === host.security.devicePin) {
        if (!knownDevicePins.some(({ deviceId, pin }) => deviceId === host.id && pin === current)) knownDevicePins = [...knownDevicePins, { deviceId: host.id, pin: current }]
        changed = true
        return { ...process, elapsedMs: elapsed, attemptsCompleted: attempts, workCompleted: attempts, currentCandidate: current,
          status: 'completed' as const, result: { status: 'pin_found' as const, pin: current } }
      }
    }
    changed = true
    return { ...process, elapsedMs: elapsed, attemptsCompleted: attempts, workCompleted: attempts, currentCandidate: current,
      ...(attempts === RATTLER_CANDIDATE_BUDGET ? { status: 'completed' as const, result: { status: 'search_exhausted' as const } } : {}) }
  })
  if (!changed) return state
  return { ...state, process: { ...state.process, processes }, knowledge: knownDevicePins === state.knowledge.knownDevicePins ? state.knowledge : { ...state.knowledge, knownDevicePins } }
}

export function deriveRattlerProcessForDevice(state: GameState, deviceId: string): RattlerPinSearchProcess | undefined {
  return [...state.process.processes].reverse().find((process): process is RattlerPinSearchProcess => process.kind === 'rattler_pin_search' && process.targetDeviceId === deviceId)
}

/** RATTLER's product-specific monitor follows the most recently admitted deployment, independent of Session state. */
export function deriveLatestRattlerProcess(state: GameState): RattlerPinSearchProcess | undefined {
  return [...state.process.processes].reverse().find((process): process is RattlerPinSearchProcess => process.kind === 'rattler_pin_search')
}

/** RATTLER's own concrete deployment records, retained in canonical admission order. */
export function deriveRattlerProcesses(state: GameState): readonly RattlerPinSearchProcess[] {
  return state.process.processes.filter((process): process is RattlerPinSearchProcess => process.kind === 'rattler_pin_search')
}

export type CreateRattlerPayloadResult =
  | { readonly status: 'created'; readonly state: GameState; readonly file: RattlerPayloadFile }
  | { readonly status: 'software_unavailable' | 'executable_unavailable' | 'unknown_target' | 'ambiguous_target' | 'destination_exists' | 'destination_conflict' | 'invalid_path'; readonly state: GameState }

/**
 * Author one RATTLER artifact using only represented local software/filesystem
 * authority and remembered Discovery. World hosts are intentionally never read.
 */
export function createRattlerPayload(state: GameState, enteredAddress: string): CreateRattlerPayloadResult {
  const installation = state.player.localDevice.installedSoftware.find(({ id }) => id === RATTLER_PRODUCT_ID)
  if (!installation || installation.releaseId !== RATTLER_1_0.releaseId || installation.buildId !== RATTLER_1_0.buildId) {
    return { status: 'software_unavailable', state }
  }

  const resolvedExecutable = getFilesystemFile(state.player.localDevice.filesystem, RATTLER_INSTALLED_EXECUTABLE_PATH)
  if (resolvedExecutable.status !== 'ok' || resolvedExecutable.file.kind !== 'executable') return { status: 'executable_unavailable', state }
  const executable: ExecutableFile = resolvedExecutable.file
  if (executable.programId !== RATTLER_PROGRAM_ID || executable.releaseId !== installation.releaseId || executable.buildId !== installation.buildId) {
    return { status: 'executable_unavailable', state }
  }

  const matches = state.discovery.devices.filter(({ address }) => address === enteredAddress)
  if (!matches.length) return { status: 'unknown_target', state }
  if (matches.length !== 1) return { status: 'ambiguous_target', state }
  const target = matches[0]
  const path = deriveRattlerPayloadPath(target.id)
  const placement = checkDestinationPlacement(state.player.localDevice.filesystem, path)
  if (placement !== 'ok') return { status: placement, state }

  const pending: RattlerPayloadFile = {
    kind: 'rattler_payload', id: 'pending-rattler-payload', path: '/', sizeBytes: RATTLER_PAYLOAD_SIZE_BYTES,
    rattlerReleaseId: installation.releaseId, rattlerBuildId: installation.buildId,
    targetDeviceId: target.id, targetAddressSnapshot: enteredAddress,
  }
  const copied = copyFilesystemFileToPath(pending, state.player.localDevice.filesystem, path)
  if (copied.status !== 'copied') return { status: copied.status, state }
  const file = copied.file as RattlerPayloadFile
  return {
    status: 'created', file,
    state: { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: copied.filesystem } } },
  }
}
