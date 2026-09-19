import { type FormEvent, useState } from 'react'
import type { GameActions } from '../../app/GameContext'
import {
  deriveThreadAttachmentCount,
  findMailCorrespondent,
  listThreadMessages,
  threadAcceptsReply,
} from '../../core/game/mail'
import type { FilesystemFile, MailState, MailThread } from '../../core/game/types'
import { MailAttachmentPicker, MailAttachmentTray, SentMailAttachments } from './MailAttachments'
import { MailConfirm } from './MailConfirm'
import { MailMessageBody } from './MailMessageBody'
import { correspondentLabel } from './mailPresentation'

/**
 * One correspondence, read as a transcript.
 *
 * The correspondence itself is the surface. Its identity — subject, the two
 * parties, what it holds, and the actions that belong to it — is stated once
 * in a single header block instead of being spread across the page as
 * metadata chrome, and everything below it is what was actually said.
 *
 * Direction is stated rather than implied by alignment: no bubbles, no
 * avatars, no delivery marks, and nothing that would suggest a delivery time
 * the mailbox does not represent.
 */
export function MailThreadView({ mail, thread, files, deviceName, send, remove, close }: {
  mail: MailState
  thread: MailThread
  files: readonly FilesystemFile[]
  deviceName: string
  send: GameActions['sendMailReply']
  remove: GameActions['deleteMailThreads']
  close: () => void
}) {
  const correspondent = findMailCorrespondent(mail, thread.correspondentId)
  const messages = listThreadMessages(mail, thread.id)
  const attachmentCount = deriveThreadAttachmentCount(mail, thread.id)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  /** Presentation only: the exchange this session just produced, so it arrives rather than appearing. */
  const [arrived, setArrived] = useState<readonly string[]>([])
  /**
   * The unsent reply lives here rather than inside the composer, because
   * choosing attachments replaces the composer on screen and a draft must
   * survive that. It is presentation state only: nothing is communicated
   * until SEND.
   */
  const [draft, setDraft] = useState('')
  const [failure, setFailure] = useState<string>()
  const [attachmentSelection, setAttachmentSelection] = useState<readonly string[]>([])
  const [picking, setPicking] = useState(false)

  function toggleAttachment(fileId: string) {
    setAttachmentSelection((current) => current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId])
  }

  if (picking) {
    return <section className="app-content mail-app" aria-label="Attach local files to this reply">
      <MailAttachmentPicker
        files={files}
        deviceName={deviceName}
        selected={attachmentSelection}
        toggle={toggleAttachment}
        done={() => setPicking(false)}
        backLabel="REPLY"
      />
    </section>
  }

  /*
   * Two scroll owners, because a thread has two things a finger can move
   * while the software keyboard is up: the correspondence itself — the player
   * re-reading what was said while writing back — and a long draft inside the
   * composer. The Shell resolves the nearest one; neither is a keyboard or
   * viewport behavior of NodeMail's own.
   */
  return <section className="app-content mail-app mail-thread-view" data-editing-scroll-owner aria-label={`Thread ${thread.subject}`}>
    <button className="node-back" type="button" onClick={close} aria-label="Back to inbox">
      <span aria-hidden="true">←</span> INBOX
    </button>

    <header className="mail-head">
      <h2 className="mail-subject">{thread.subject}</h2>
      <p className="mail-parties">
        <span className="mail-party">
          <span className="mail-party-name">{correspondentLabel(correspondent, thread)}</span>
          {correspondent && <span className="mail-party-address">{correspondent.address}</span>}
        </span>
        <span className="mail-party-link" aria-hidden="true">↔</span>
        <span className="mail-party">
          <span className="mail-party-name">This account</span>
          <span className="mail-party-address">{mail.account.address}</span>
        </span>
      </p>
      <div className="mail-head-foot">
        <span className="mail-head-stats">
          {messages.length} {messages.length === 1 ? 'MESSAGE' : 'MESSAGES'}
          {attachmentCount > 0 && <> · {attachmentCount} {attachmentCount === 1 ? 'ATTACHMENT' : 'ATTACHMENTS'}</>}
        </span>
        {!confirmingDelete && <button
          className="node-action node-action--destructive mail-action--remove"
          type="button"
          onClick={() => setConfirmingDelete(true)}
        >DELETE</button>}
      </div>
      {confirmingDelete && <MailConfirm
        question={`Remove “${thread.subject}” from this mailbox?`}
        detail="The correspondence leaves the inbox and the unread summary. Anything it already caused, and any file that was attached to it, is untouched."
        confirmLabel="REMOVE"
        confirm={() => { remove([thread.id]); close() }}
        cancel={() => setConfirmingDelete(false)}
      />}
    </header>

    <ol className="mail-messages">
      {messages.map((message) => <li
        className={`mail-message mail-message--${message.sender === 'account' ? 'sent' : 'received'}${arrived.includes(message.id) ? ' mail-message--arrived' : ''}`}
        key={message.id}
      >
        <span className="mail-message-author">{message.sender === 'account' ? 'YOU' : correspondentLabel(correspondent, thread)}</span>
        <p className="mail-message-body"><MailMessageBody body={message.body} /></p>
        {message.attachments && <SentMailAttachments attachments={message.attachments} />}
      </li>)}
    </ol>

    {threadAcceptsReply(mail, thread.id)
      ? <MailReplyComposer
        thread={thread}
        recipientLabel={correspondent?.address ?? correspondentLabel(correspondent, thread)}
        files={files}
        draft={draft}
        setDraft={(value) => { setDraft(value); setFailure(undefined) }}
        failure={failure}
        setFailure={setFailure}
        selection={attachmentSelection}
        toggleAttachment={toggleAttachment}
        openPicker={() => setPicking(true)}
        clearSelection={() => setAttachmentSelection([])}
        send={send}
        onSent={setArrived}
      />
      : <p className="node-note mail-closed">This is an announcement from {correspondent?.address ?? 'this address'}, not an open correspondence. Nothing can be sent into it.</p>}
  </section>
}

/**
 * Writing back.
 *
 * The composer is a tool block rather than a form: one draft, the artifacts
 * staged for this message beside it, and one explicit SEND on the same row as
 * the attach control, so neither the draft nor the action ever grows into a
 * full-width slab of empty screen.
 *
 * SEND is the only thing that sends. The draft is an ordinary multiline
 * textarea under the Shell-owned editing presentation: Enter inserts a
 * newline, and this application adds no keyboard, viewport or focus behavior
 * of its own — including autofocus, which would open the software keyboard
 * merely because a thread was opened.
 */
function MailReplyComposer({ thread, recipientLabel, files, draft, setDraft, failure, setFailure, selection, toggleAttachment, openPicker, clearSelection, send, onSent }: {
  thread: MailThread
  recipientLabel: string
  files: readonly FilesystemFile[]
  draft: string
  setDraft: (value: string) => void
  failure: string | undefined
  setFailure: (value: string | undefined) => void
  selection: readonly string[]
  toggleAttachment: (fileId: string) => void
  openPicker: () => void
  clearSelection: () => void
  send: GameActions['sendMailReply']
  onSent: (messageIds: readonly string[]) => void
}) {
  function submit(event: FormEvent) {
    event.preventDefault()
    const result = send(thread.id, draft, selection)
    if (result.status !== 'sent') {
      setFailure(describeReplyFailure(result.status))
      return
    }
    setFailure(undefined)
    setDraft('')
    clearSelection()
    onSent([result.playerMessageId, ...(result.replyMessageId ? [result.replyMessageId] : [])])
  }

  return <form className="mail-composer" onSubmit={submit}>
    <div className="mail-composer-head">
      <span className="eyebrow">REPLY</span>
      <span className="mail-composer-to">TO {recipientLabel}</span>
    </div>
    <textarea
      className="mail-composer-input"
      data-editing-scroll-owner
      rows={4}
      value={draft}
      placeholder="Write a reply…"
      aria-label={`Reply to ${recipientLabel}`}
      onChange={(event) => setDraft(event.target.value)}
    />
    <div className="mail-composer-tools">
      <MailAttachmentTray files={files} selected={selection} remove={toggleAttachment} openPicker={openPicker} />
      <button className="node-action mail-action--primary" type="submit" disabled={draft.trim().length === 0}>SEND</button>
    </div>
    {failure && <p className="node-note node-note--caution">{failure}</p>}
  </form>
}

function describeReplyFailure(status: string): string {
  if (status === 'empty_message') return 'Write a reply before sending.'
  if (status === 'attachment_unavailable') return 'One of the selected files is no longer on this Device. Nothing was sent.'
  return 'This correspondence cannot be written into.'
}
