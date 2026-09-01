import { checkDestinationPlacement, copyFilesystemFileToPath, getFilesystemFile } from './filesystem'
import { RATTLER_1_0 } from './softwareReleaseContent'
import type { ExecutableFile, GameState, RattlerPayloadFile } from './types'

export const RATTLER_PRODUCT_ID = RATTLER_1_0.productId
export const RATTLER_PROGRAM_ID = 'program-rattler-v0' as const
export const RATTLER_INSTALLED_EXECUTABLE_PATH = '/opt/rattler/rattler.exe'
export const RATTLER_EXECUTABLE_SIZE_BYTES = 1_900_000
export const RATTLER_PAYLOAD_SIZE_BYTES = 65_536

export function deriveRattlerPayloadPath(targetDeviceId: string): string {
  return `/opt/rattler/payload-${targetDeviceId}.rpl`
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
