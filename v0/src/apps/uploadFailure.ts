import type { StartRemoteFileUploadResult } from '../core/game/fileTransfer'

/**
 * Shared compact presentation of canonical Upload admission failures.
 *
 * Every Upload surface (local Files, RACK-OS Files, RACK-OS Terminal) ends at
 * the same `startRemoteFileUpload` operation, so they must also report the same
 * canonical result with the same words. The map is exhaustive over the result
 * union, which makes a new core status a compile error here rather than a
 * silently unlabelled state in three places.
 */
export type StartRemoteFileUploadFailure = Exclude<StartRemoteFileUploadResult['status'], 'started'>

const UPLOAD_FAILURE_LABELS: Record<StartRemoteFileUploadFailure, string> = {
  session_unavailable: 'SESSION UNAVAILABLE', invalid_path: 'INVALID PATH', source_not_found: 'FILE NOT FOUND', source_not_file: 'NOT A FILE',
  local_offline: 'LOCAL DEVICE OFFLINE', destination_offline: 'DESTINATION UNAVAILABLE', capacity_unavailable: 'TRANSFER CAPACITY UNAVAILABLE',
  transfer_in_progress: 'TRANSFER IN PROGRESS', destination_exists: 'DESTINATION ALREADY EXISTS', destination_conflict: 'DESTINATION CONFLICT',
}

export function describeUploadFailure(status: StartRemoteFileUploadFailure): string { return UPLOAD_FAILURE_LABELS[status] }
