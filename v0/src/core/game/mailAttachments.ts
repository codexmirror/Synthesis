import { getFilesystemFileSizeBytes } from './filesystem'
import type { FilesystemFile, MailAttachment } from './types'

/**
 * Turning a concrete local artifact into what was actually sent.
 *
 * This is the one boundary between Device-owned filesystem truth and Mail-owned
 * communication history, and it is crossed exactly once, at send time. A
 * `FilesystemFile` keeps living on its Device — it can be edited, moved,
 * installed from, or deleted — and none of that reaches back into the message
 * that was already sent. The snapshot therefore copies the represented facts
 * out rather than keeping a reference to resolve later.
 *
 * Sending is not a transfer. Nothing here consumes, mutates or moves the
 * source File, starts a `FileTransfer` or `GameProcess`, touches network
 * capacity, or creates Discovery or Knowledge.
 */

/** The filename a File currently carries, which is what a recipient is told it was sent as. */
export function filesystemFileName(file: FilesystemFile): string {
  return file.path.slice(file.path.lastIndexOf('/') + 1)
}

/**
 * Snapshot one artifact as one sent attachment.
 *
 * Each represented kind states different things, so each is snapshotted as
 * what it actually is. The concrete copy identity (`id`) and location (`path`)
 * are deliberately not carried over: neither is artifact truth, and a sent
 * attachment is not a file residing anywhere.
 */
export function snapshotMailAttachment(file: FilesystemFile, attachmentId: string): MailAttachment {
  const base = { id: attachmentId, sentName: filesystemFileName(file), sizeBytes: getFilesystemFileSizeBytes(file) }
  switch (file.kind) {
    case 'text':
      return { ...base, kind: 'text', content: file.content }
    case 'software_package':
      return {
        ...base,
        kind: 'software_package',
        productId: file.productId,
        releaseId: file.releaseId,
        buildId: file.buildId,
        productName: file.name,
        version: file.version,
        ...(file.channel === undefined ? {} : { channel: file.channel }),
        ...(file.publisher === undefined ? {} : { publisher: file.publisher }),
      }
    case 'software_module':
      return {
        ...base,
        kind: 'software_module',
        hostProductId: file.hostProductId,
        moduleId: file.moduleId,
        releaseId: file.releaseId,
        buildId: file.buildId,
        moduleName: file.name,
        version: file.version,
      }
    case 'deauth_extension':
      return {
        ...base,
        kind: 'deauth_extension',
        extensionId: file.extensionId,
        hostProductId: file.hostProductId,
        compatibleHostReleaseId: file.compatibleHostReleaseId,
        releaseId: file.releaseId,
        buildId: file.buildId,
        version: file.version,
      }
    case 'executable':
      return {
        ...base,
        kind: 'executable',
        programId: file.programId,
        releaseId: file.releaseId,
        buildId: file.buildId,
        programName: file.name,
        version: file.version,
      }
    case 'rattler_payload':
      return {
        ...base,
        kind: 'rattler_payload',
        rattlerReleaseId: file.rattlerReleaseId,
        rattlerBuildId: file.rattlerBuildId,
        targetDeviceId: file.targetDeviceId,
        targetAddressSnapshot: file.targetAddressSnapshot,
      }
    case 'firmware_package':
      return {
        ...base,
        kind: 'firmware_package',
        firmwareId: file.firmwareId,
        buildId: file.buildId,
        firmwareName: file.name,
        version: file.version,
        ...(file.publisher === undefined ? {} : { publisher: file.publisher }),
      }
  }
}
