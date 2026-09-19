import { useState } from 'react'
import type { FilesystemFile, MailAttachment } from '../../core/game/types'
import { formatBytes } from '../byteFormat'
import { artifactKindLabel, describeAttachmentProvenance, describeFileProvenance, describeLocalFile } from './mailPresentation'

/**
 * Attaching artifacts to mail, and reading the attachments a message already
 * carried.
 *
 * Two deliberately different objects. A *local File* lives on the Device
 * filesystem, is selected by its stable File identity, and keeps existing
 * exactly as it was after being sent. A *sent attachment* is Mail-owned
 * history: it is described entirely from its own snapshot, never by looking
 * the original File up again, so it stays truthful once that File is edited,
 * moved or deleted.
 *
 * Nothing here transfers, installs, opens or consumes anything.
 */

/** Selecting concrete local artifacts. A working surface over the filesystem, not the Files application. */
export function MailAttachmentPicker({ files, deviceName, selected, toggle, done, backLabel }: {
  files: readonly FilesystemFile[]
  deviceName: string
  selected: readonly string[]
  toggle: (fileId: string) => void
  done: () => void
  backLabel: string
}) {
  return <section className="mail-picker" aria-label="Attach local files">
    <button className="node-back" type="button" onClick={done} aria-label={`Back to ${backLabel.toLowerCase()}`}>
      <span aria-hidden="true">←</span> {backLabel}
    </button>

    <div className="node-section">
      <span>LOCAL FILES · {deviceName}</span>
      <span>{files.length}</span>
    </div>

    {files.length > 0
      ? <ul className="mail-filelist">
        {files.map((file) => {
          const { name, sizeBytes } = describeLocalFile(file)
          const provenance = describeFileProvenance(file)
          const chosen = selected.includes(file.id)
          return <li key={file.id}>
            <button
              className={chosen ? 'mail-file mail-file--chosen' : 'mail-file'}
              type="button"
              aria-pressed={chosen}
              onClick={() => toggle(file.id)}
            >
              <span className="mail-file-mark" aria-hidden="true">{chosen ? '■' : '□'}</span>
              <span className="mail-file-copy">
                <span className="mail-file-name">{name}</span>
                <span className="mail-file-meta">{artifactKindLabel(file.kind)} · {formatBytes(sizeBytes)}</span>
                {provenance && <span className="mail-file-provenance">{provenance}</span>}
                <span className="mail-file-path">{file.path}</span>
              </span>
            </button>
          </li>
        })}
      </ul>
      : <div className="node-empty">
        <strong>NO LOCAL FILES</strong>
        <span>This Device holds no artifact that could be attached.</span>
      </div>}

    <div className="mail-actionbar mail-actionbar--sticky">
      <span className="mail-actionbar-state">{selected.length} SELECTED</span>
      <button className="node-action mail-action--secondary" type="button" onClick={done}>DONE</button>
    </div>
  </section>
}

/**
 * What is currently staged on an unsent message, and the way to change it.
 *
 * Staged selection is presentation state: it is a list of concrete File
 * identities the player picked, and it becomes communication only when SEND
 * snapshots it.
 */
export function MailAttachmentTray({ files, selected, remove, openPicker, disabled }: {
  files: readonly FilesystemFile[]
  selected: readonly string[]
  remove: (fileId: string) => void
  openPicker: () => void
  disabled?: boolean
}) {
  const staged = selected
    .map((fileId) => files.find((file) => file.id === fileId))
    .filter((file): file is FilesystemFile => file !== undefined)

  return <div className="mail-tray">
    {staged.length > 0 && <ul className="mail-tray-list">
      {staged.map((file) => {
        const { name, sizeBytes } = describeLocalFile(file)
        return <li className="mail-staged" key={file.id}>
          <span className="mail-staged-mark" aria-hidden="true">▱</span>
          <span className="mail-staged-copy">
            <span className="mail-staged-name">{name}</span>
            <span className="mail-staged-meta">{artifactKindLabel(file.kind)} · {formatBytes(sizeBytes)}</span>
          </span>
          <button
            className="mail-staged-remove"
            type="button"
            aria-label={`Remove attachment ${name}`}
            onClick={() => remove(file.id)}
          >×</button>
        </li>
      })}
    </ul>}
    <button className="node-action mail-action--quiet" type="button" onClick={openPicker} disabled={disabled}>
      <span aria-hidden="true">▱</span>
      {staged.length > 0 ? `ATTACHMENTS · ${staged.length}` : 'ATTACH'}
    </button>
  </div>
}

/** The attachments one message actually carried, described from its own snapshot. */
export function SentMailAttachments({ attachments }: { attachments: readonly MailAttachment[] }) {
  return <ul className="mail-sent-attachments">
    {attachments.map((attachment) => <li className="mail-attachment" key={attachment.id}>
      <span className="mail-attachment-mark" aria-hidden="true">▱</span>
      <span className="mail-attachment-copy">
        <span className="mail-attachment-name">{attachment.sentName}</span>
        <span className="mail-attachment-meta">{artifactKindLabel(attachment.kind)} · {formatBytes(attachment.sizeBytes)}</span>
        {describeAttachmentProvenance(attachment) && <span className="mail-attachment-provenance">{describeAttachmentProvenance(attachment)}</span>}
        {attachment.kind === 'text' && <SentTextAttachment name={attachment.sentName} content={attachment.content} />}
      </span>
    </li>)}
  </ul>
}

/** The text exactly as it was sent, available without pretending the attachment is a file on a Device. */
function SentTextAttachment({ name, content }: { name: string; content: string }) {
  const [open, setOpen] = useState(false)
  return <span className="mail-attachment-content">
    <button
      className="node-disclosure mail-attachment-disclosure"
      type="button"
      aria-expanded={open}
      aria-label={`${open ? 'Hide' : 'Show'} the text sent as ${name}`}
      onClick={() => setOpen(!open)}
    >
      <span>SENT CONTENT</span>
      <span className="node-disclosure-mark" aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <span className="mail-attachment-text">{content}</span>}
  </span>
}
