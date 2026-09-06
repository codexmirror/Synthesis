import { filesystemFileName } from '../../core/game/mailAttachments'
import { getFilesystemFileSizeBytes } from '../../core/game/filesystem'
import type { FilesystemFile, MailAttachment, MailCorrespondent, MailMessage, MailThread } from '../../core/game/types'

/**
 * How NodeMail names the things it presents: correspondents, the last thing
 * said in a correspondence, and the artifacts it can send.
 *
 * Everything here is projected from canonical mail and filesystem state when it
 * is rendered, and none of it is stored beside that state.
 *
 * How NodeMail names the artifacts it can send and the attachments it has
 * already sent.
 *
 * Both are described from represented facts only. The provenance line states
 * what the artifact itself carries — a release and its channel, a module's
 * host product, a firmware build, the Device a payload was authored against —
 * and never a fact NodeMail would have to resolve against the World to know.
 */

export type MailArtifactKind = FilesystemFile['kind']

const KIND_LABELS: Record<MailArtifactKind, string> = {
  text: 'TEXT',
  software_package: 'SOFTWARE PACKAGE',
  software_module: 'SOFTWARE MODULE',
  deauth_extension: 'FLIPPER EXTENSION',
  executable: 'EXECUTABLE',
  rattler_payload: 'RATTLER PAYLOAD',
  firmware_package: 'FIRMWARE INSTALLER',
}

export function artifactKindLabel(kind: MailArtifactKind): string {
  return KIND_LABELS[kind]
}

/** The concrete filename and size a local File currently carries. */
export function describeLocalFile(file: FilesystemFile): { readonly name: string; readonly sizeBytes: number } {
  return { name: filesystemFileName(file), sizeBytes: getFilesystemFileSizeBytes(file) }
}

/** What a local artifact states about itself, beyond its kind and size. */
export function describeFileProvenance(file: FilesystemFile): string | undefined {
  switch (file.kind) {
    case 'text':
      return undefined
    case 'software_package':
      return joinFacts([`${file.name} ${file.version}`, file.channel, file.publisher])
    case 'software_module':
      return joinFacts([`${file.name} ${file.version}`, `HOST ${file.hostProductId}`])
    case 'deauth_extension':
      return joinFacts([`${file.name} ${file.version}`, `HOST ${file.hostProductId}`])
    case 'executable':
      return joinFacts([`${file.name} ${file.version}`])
    case 'rattler_payload':
      return joinFacts([`RELEASE ${file.rattlerReleaseId}`, `TARGET ${file.targetAddressSnapshot}`])
    case 'firmware_package':
      return joinFacts([`${file.name} ${file.version}`, file.publisher])
  }
}

/**
 * What a sent attachment states about itself.
 *
 * Read from the snapshot alone. Nothing here consults the local filesystem, so
 * the line stays exactly what was communicated even after the source File has
 * changed or stopped existing.
 */
export function describeAttachmentProvenance(attachment: MailAttachment): string | undefined {
  switch (attachment.kind) {
    case 'text':
      return undefined
    case 'software_package':
      return joinFacts([`${attachment.productName} ${attachment.version}`, attachment.channel, attachment.publisher])
    case 'software_module':
      return joinFacts([`${attachment.moduleName} ${attachment.version}`, `HOST ${attachment.hostProductId}`])
    case 'deauth_extension':
      return joinFacts([`${attachment.extensionId} ${attachment.version}`, `HOST ${attachment.hostProductId}`])
    case 'executable':
      return joinFacts([`${attachment.programName} ${attachment.version}`])
    case 'rattler_payload':
      return joinFacts([`RELEASE ${attachment.rattlerReleaseId}`, `TARGET ${attachment.targetAddressSnapshot}`])
    case 'firmware_package':
      return joinFacts([`${attachment.firmwareName} ${attachment.version}`, attachment.publisher])
  }
}

function joinFacts(facts: readonly (string | undefined)[]): string | undefined {
  const stated = facts.filter((fact): fact is string => fact !== undefined && fact.length > 0)
  return stated.length > 0 ? stated.join(' · ') : undefined
}


/** A correspondent's represented display name, falling back to the identity the thread names. */
export function correspondentLabel(correspondent: MailCorrespondent | undefined, thread: MailThread): string {
  return correspondent?.name ?? thread.correspondentId
}

/** A compact projection of the last thing said in a correspondence; derived, never stored. */
export function previewText(message: MailMessage): string {
  return message.body.replace(/\s+/g, ' ').trim()
}
