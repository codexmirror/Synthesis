import type { FileTransfer, GameProcess, GameState, RecentActivityEntry } from './types'

export const RECENT_ACTIVITY_LIMIT = 20

function append(state: GameState, entry: RecentActivityEntry): GameState {
  if (state.recentActivity.entries.some(({ kind, id }) => kind === entry.kind && id === entry.id)) return state
  const allEntries = [...state.recentActivity.entries, entry]
  const evicted = allEntries.slice(0, -RECENT_ACTIVITY_LIMIT)
  const evictedProcessIds = new Set(evicted.filter((item) => item.kind === 'process').map(({ id }) => id))
  const entries = allEntries.slice(-RECENT_ACTIVITY_LIMIT)
  const processes = state.process.processes.filter((process) => !evictedProcessIds.has(process.id))
  return { ...state, process: processes.length === state.process.processes.length ? state.process : { ...state.process, processes }, recentActivity: { entries } }
}

export function archiveProcess(state: GameState, process: GameProcess): GameState {
  return append(state, { kind: 'process', id: process.id, process })
}

export function archiveFileTransfer(state: GameState, transfer: FileTransfer): GameState {
  const access = state.deviceAccess.established.find(({ id }) => id === transfer.accessId)
  const source = access?.sourceDeviceId === transfer.destinationDeviceId && access.targetDeviceId === transfer.sourceDeviceId
    ? state.world.network.hosts.find(({ id }) => id === access.targetDeviceId)
    : undefined
  const sourceFile = source?.filesystem?.files.find(({ id }) => id === transfer.sourceFileId)
  return append(state, {
    kind: 'file_transfer', id: transfer.id, transfer,
    ...(sourceFile ? { sourcePath: sourceFile.path } : {}),
    ...(source ? { route: `${source.displayName ?? source.ip} → ${state.player.localDevice.displayName}` } : {}),
  })
}

export function clearRecentActivity(state: GameState, executorDeviceId: string): GameState {
  const entries = state.recentActivity.entries.filter((entry) => entry.kind === 'process' && entry.process.executorDeviceId !== executorDeviceId)
  const hasLocalCompleted = state.process.processes.some((process) => process.status === 'completed' && process.executorDeviceId === executorDeviceId)
  if (entries.length === state.recentActivity.entries.length && !hasLocalCompleted) return state
  const retained = new Set(entries.filter((entry) => entry.kind === 'process').map(({ id }) => id))
  return {
    ...state,
    process: { ...state.process, processes: state.process.processes.filter((process) => process.status === 'running' || process.executorDeviceId !== executorDeviceId || retained.has(process.id)) },
    recentActivity: { entries },
  }
}

export function removeRecentActivity(state: GameState, activityId: string, executorDeviceId: string): GameState {
  const entry = state.recentActivity.entries.find(({ id }) => id === activityId)
  const completed = state.process.processes.find((process) => process.id === activityId && process.status === 'completed' && process.executorDeviceId === executorDeviceId)
  if ((!entry && !completed) || (entry?.kind === 'process' && entry.process.executorDeviceId !== executorDeviceId)) return state
  const entries = state.recentActivity.entries.filter(({ id }) => id !== activityId)
  return {
    ...state,
    process: entry?.kind === 'file_transfer' ? state.process : { ...state.process, processes: state.process.processes.filter(({ id }) => id !== activityId) },
    recentActivity: { entries },
  }
}
