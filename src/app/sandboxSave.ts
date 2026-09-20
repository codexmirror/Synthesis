import { GAME_STATE_VERSION } from '../core/game/initialState'
import type { GameState } from '../core/game/types'

export const SANDBOX_SAVE_KEY = 'synthesis.sandbox.v1'
export const SANDBOX_BACKUP_KEY = 'synthesis.sandbox.previous'
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>
export type SandboxSave = { status: 'empty' } | { status: 'ready'; state: GameState } | { status: 'unavailable'; reason: string }

/** A local, same-build checkpoint, deliberately separate from Online persistence and migration. */
export function loadSandboxSave(storage: StorageAccess): SandboxSave {
  try {
    const raw = storage.getItem(SANDBOX_SAVE_KEY)
    if (!raw) return { status: 'empty' }
    const value = JSON.parse(raw)
    const s = value?.state
    if (value?.format !== 1 || s?.version !== GAME_STATE_VERSION || s?.fieldwork?.edition !== 1) return { status: 'unavailable', reason: 'This checkpoint belongs to a different Sandbox version.' }
    // Check the concrete boundaries consumed immediately by the Sandbox. This
    // is owned local storage, not an import format or an Online trust boundary.
    if (!Array.isArray(s.fieldwork.requests) || !Array.isArray(s.fieldwork.receipts)
      || !Number.isFinite(s.fieldwork.elapsedMs) || !(s.fieldwork.dispatchRemainingMs > 0)
      || !Array.isArray(s.player?.localDevice?.filesystem?.files)
      || !Array.isArray(s.player?.localDevice?.installedSoftware)
      || !Array.isArray(s.world?.network?.hosts) || !Array.isArray(s.world?.network?.localNetworks)
      || !Array.isArray(s.discovery?.devices) || !Array.isArray(s.process?.processes)
      || !Array.isArray(s.deviceAccess?.established) || !s.remoteSession || !s.fileTransfer
      || !s.nodeWallet || !s.nodeEconomy || !s.market || !s.knowledge || !s.business
      || !s.mail || !s.recentActivity) return { status: 'unavailable', reason: 'The saved checkpoint is incomplete.' }
    return { status: 'ready', state: s as GameState }
  } catch { return { status: 'unavailable', reason: 'The local checkpoint could not be read.' } }
}
export function saveSandbox(storage: StorageAccess, state: GameState): boolean {
  try { storage.setItem(SANDBOX_SAVE_KEY, JSON.stringify({ format: 1, state })); return true } catch { return false }
}
/** Starting over keeps the previous raw checkpoint, including an unreadable one. */
export function backupSandbox(storage: StorageAccess): boolean {
  try { const previous = storage.getItem(SANDBOX_SAVE_KEY); if (previous) storage.setItem(SANDBOX_BACKUP_KEY, previous); return true } catch { return false }
}
