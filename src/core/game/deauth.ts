import { findInstalledFlipper, isSupportedFlipperBuild } from './flipper'
import { interruptLocalNetworkConnectivity } from './networkConnectivity'
import { startProcess } from './processes'
import type { DeauthExtensionFile, DeauthProcess, GameState, LocalDeviceState } from './types'

export const DEAUTH_EXTENSION = {
  extensionId: 'deauth', hostProductId: 'flipper', compatibleHostReleaseId: 'flipper-1.0',
  releaseId: 'deauth-extension-1.0', buildId: 'build-deauth-extension-1.0-v0',
  name: 'deauth.ext', version: '1.0', sizeBytes: 1_250_000,
} as const satisfies Omit<DeauthExtensionFile, 'kind' | 'id' | 'path'>
export const DEAUTH_WORK_REQUIRED = 1000
export const DEAUTH_RAM_REQUIRED_MIB = 640

export function findCompatibleDeauthExtension(device: Pick<LocalDeviceState, 'installedSoftware' | 'filesystem'>): DeauthExtensionFile | undefined {
  const flipper = findInstalledFlipper(device)
  if (!flipper || !isSupportedFlipperBuild(flipper) || flipper.releaseId !== DEAUTH_EXTENSION.compatibleHostReleaseId) return undefined
  return device.filesystem.files.find((file): file is DeauthExtensionFile => file.kind === 'deauth_extension'
    && file.extensionId === DEAUTH_EXTENSION.extensionId && file.hostProductId === DEAUTH_EXTENSION.hostProductId
    && file.compatibleHostReleaseId === DEAUTH_EXTENSION.compatibleHostReleaseId
    && file.releaseId === DEAUTH_EXTENSION.releaseId && file.buildId === DEAUTH_EXTENSION.buildId
    && file.name === DEAUTH_EXTENSION.name && file.version === DEAUTH_EXTENSION.version && file.sizeBytes === DEAUTH_EXTENSION.sizeBytes)
}

export interface DeauthObservation { readonly networkId: string; readonly networkName: string; readonly contextDeviceId: string }
export type StartDeauthResult = { readonly status: 'started'; readonly state: GameState; readonly processId: string }
  | { readonly status: 'provider_unavailable' | 'network_unavailable' | 'already_running'; readonly state: GameState }
  | { readonly status: 'insufficient_memory'; readonly state: GameState; readonly requiredMiB: number; readonly availableMiB: number }

export function startDeauthAttempt(state: GameState, observed: DeauthObservation): StartDeauthResult {
  const extension = findCompatibleDeauthExtension(state.player.localDevice)
  if (!extension) return { status: 'provider_unavailable', state }
  const network = state.world.network.localNetworks.find(({ id }) => id === observed.networkId)
  if (!network || !network.memberDeviceIds.includes(observed.contextDeviceId)) return { status: 'network_unavailable', state }
  if (state.process.processes.some((p) => p.kind === 'deauth' && p.status === 'running' && p.targetNetworkId === network.id)) return { status: 'already_running', state }
  const started = startProcess(state.process, state.player.localDevice, { label: 'DEAUTH', workRequired: DEAUTH_WORK_REQUIRED, ramRequiredMiB: DEAUTH_RAM_REQUIRED_MIB })
  if (started.status !== 'started') return { ...started, state }
  const deauth: DeauthProcess = { id: started.processId, label: 'DEAUTH', executorDeviceId: state.player.localDevice.id, status: 'running', workRequired: DEAUTH_WORK_REQUIRED, workCompleted: 0, ramRequiredMiB: DEAUTH_RAM_REQUIRED_MIB, kind: 'deauth', targetNetworkId: network.id, targetNetworkName: observed.networkName, contextDeviceId: observed.contextDeviceId, providerFileId: extension.id, providerReleaseId: extension.releaseId, providerBuildId: extension.buildId }
  return { status: 'started', processId: started.processId, state: { ...state, process: { ...started.state, processes: started.state.processes.map((p) => p.id === deauth.id ? deauth : p) } } }
}

export function resolveCompletedDeauthAttempts(state: GameState): GameState {
  let next = state
  const processes = state.process.processes.map((process) => {
    if (process.kind !== 'deauth' || process.status !== 'completed' || process.result) return process
    const extension = findCompatibleDeauthExtension(next.player.localDevice)
    const network = next.world.network.localNetworks.find(({ id }) => id === process.targetNetworkId)
    const valid = extension?.id === process.providerFileId && extension.releaseId === process.providerReleaseId
      && extension.buildId === process.providerBuildId && network?.memberDeviceIds.includes(process.contextDeviceId)
    if (!valid) return { ...process, result: { status: 'attempt_failed', message: 'DEAUTH prerequisites no longer valid.' } as const }
    next = interruptLocalNetworkConnectivity(next, process.targetNetworkId)
    return { ...process, result: { status: 'connectivity_interrupted' } as const }
  })
  return { ...next, process: { ...next.process, processes } }
}
