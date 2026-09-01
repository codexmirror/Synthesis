import { checkDestinationPlacement } from './filesystem'
import type { GameState, RattlerPayloadFile } from './types'

export const RATTLER_PRODUCT_ID = 'rattler' as const
export const RATTLER_RELEASE_ID = 'rattler-1.0' as const
export const RATTLER_BUILD_ID = 'build-rattler-1.0-v0' as const
export const RATTLER_PROGRAM_ID = 'rattler' as const
export const RATTLER_INSTALLED_EXECUTABLE_PATH = '/opt/rattler/rattler.exe'
export const RATTLER_EXECUTABLE_SIZE_BYTES = 2_800_000
export const RATTLER_PAYLOAD_SIZE_BYTES = 48_000

export type CreateRattlerPayloadResult =
  | { readonly status: 'created'; readonly state: GameState; readonly file: RattlerPayloadFile }
  | { readonly status: 'software_unavailable' | 'unknown_target' | 'destination_exists'; readonly state: GameState }

/** Resolve exclusively from remembered Discovery, never hidden World Truth. */
export function createRattlerPayload(state: GameState, enteredAddress: string): CreateRattlerPayloadResult {
  const installed = state.player.localDevice.installedSoftware.find(({ id }) => id === RATTLER_PRODUCT_ID)
  if (!installed || installed.releaseId !== RATTLER_RELEASE_ID || installed.buildId !== RATTLER_BUILD_ID) return { status: 'software_unavailable', state }
  const executable = state.player.localDevice.filesystem.files.find((file) => file.kind === 'executable'
    && file.programId === RATTLER_PROGRAM_ID && file.releaseId === installed.releaseId && file.buildId === installed.buildId)
  if (!executable) return { status: 'software_unavailable', state }
  const address = enteredAddress.trim()
  const known = state.discovery.devices.find((device) => device.address === address)
  if (!known) return { status: 'unknown_target', state }
  const path = `/opt/rattler/payload-${known.id}.rpl`
  if (checkDestinationPlacement(state.player.localDevice.filesystem, path) !== 'ok') return { status: 'destination_exists', state }
  const filesystem = state.player.localDevice.filesystem
  const file: RattlerPayloadFile = {
    kind: 'rattler_payload', id: `file-${String(filesystem.nextFileId).padStart(4, '0')}`, path,
    productId: RATTLER_PRODUCT_ID, releaseId: installed.releaseId, buildId: installed.buildId,
    targetDeviceId: known.id, targetAddressSnapshot: address, sizeBytes: RATTLER_PAYLOAD_SIZE_BYTES,
  }
  const next = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: filesystem.nextFileId + 1, files: [...filesystem.files, file] } } } }
  return { status: 'created', state: next, file }
}
