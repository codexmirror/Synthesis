import { type FormEvent, useState } from 'react'
import type { GameActions } from '../../app/GameContext'
import { resolveMailRecipient } from '../../core/game/mail'
import type { ComposeMailResult } from '../../core/game/mail'
import type { FilesystemFile, MailState } from '../../core/game/types'
import { MailAttachmentPicker, MailAttachmentTray } from './MailAttachments'

/**
 * Starting a new correspondence.
 *
 * A workspace rather than four stacked form fields: the account it is being
 * sent from is stated once at the top, the represented correspondents this
 * mailbox actually knows are offered as real choices beside the address the
 * player can type themselves, and the message and its attachments are the
 * body of the surface. The send controls stay reachable at the bottom edge
 * while the software keyboard is open, so a long draft never pushes SEND out
 * of reach.
 *
 * Unsent compose state is presentation only. Nothing here is a Draft: leaving
 * discards it, and no canonical state exists until SEND.
 */
export function MailCompose({ mail, files, deviceName, compose, close, opened }: {
  mail: MailState
  files: readonly FilesystemFile[]
  deviceName: string
  compose: GameActions['composeMail']
  close: () => void
  opened: (threadId: string) => void
}) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [attachmentSelection, setAttachmentSelection] = useState<readonly string[]>([])
  const [picking, setPicking] = useState(false)
  const [failure, setFailure] = useState<string>()

  const typed = to.trim()
  const resolved = resolveMailRecipient(mail, to)

  function toggleAttachment(fileId: string) {
    setAttachmentSelection((current) => current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId])
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = compose({ to, subject, body, attachmentFileIds: attachmentSelection })
    if (result.status !== 'sent') {
      setFailure(describeComposeFailure(result))
      return
    }
    opened(result.threadId)
  }

  if (picking) {
    return <section className="app-content mail-app" aria-label="Attach local files to this correspondence">
      <MailAttachmentPicker
        files={files}
        deviceName={deviceName}
        selected={attachmentSelection}
        toggle={toggleAttachment}
        done={() => setPicking(false)}
        backLabel="COMPOSE"
      />
    </section>
  }

  return <section className="app-content mail-app mail-compose" data-editing-scroll-owner aria-label="Compose new correspondence">
    <button className="node-back" type="button" onClick={close} aria-label="Back to inbox">
      <span aria-hidden="true">←</span> INBOX
    </button>

    <header className="mail-head">
      <h2 className="mail-subject">New correspondence</h2>
      <p className="mail-parties">
        <span className="mail-party">
          <span className="mail-party-name">This account</span>
          <span className="mail-party-address">{mail.account.address}</span>
        </span>
      </p>
    </header>

    <form className="mail-compose-form" onSubmit={submit}>
      <div className="node-section"><span>RECIPIENT</span></div>
      <label className="node-field">
        <span className="sr-only">TO</span>
        <input
          className="node-input"
          type="text"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          value={to}
          placeholder="address"
          onChange={(event) => { setTo(event.target.value); setFailure(undefined) }}
        />
      </label>
      <p className={resolved ? 'mail-resolution mail-resolution--known' : typed.length > 0 ? 'mail-resolution mail-resolution--unknown' : 'mail-resolution'} aria-live="polite">
        {resolved
          ? `Resolves to ${resolved.name}.`
          : typed.length > 0
            ? 'No correspondent at this address is represented. Nothing will be sent.'
            : 'Mail resolves against the correspondents this mailbox represents.'}
      </p>

      <p className="eyebrow mail-directory-label">KNOWN CORRESPONDENTS</p>
      <ul className="mail-directory" aria-label="Represented correspondents">
        {mail.correspondents.map((correspondent) => {
          const chosen = resolved?.id === correspondent.id
          return <li key={correspondent.id}>
            <button
              className={chosen ? 'mail-directory-entry mail-directory-entry--chosen' : 'mail-directory-entry'}
              type="button"
              aria-pressed={chosen}
              onClick={() => { setTo(correspondent.address); setFailure(undefined) }}
            >
              <span className="mail-directory-name">{correspondent.name}</span>
              <span className="mail-directory-address">{correspondent.address}</span>
            </button>
          </li>
        })}
      </ul>

      <div className="node-section"><span>SUBJECT</span></div>
      <label className="node-field">
        <span className="sr-only">SUBJECT</span>
        <input
          className="node-input"
          type="text"
          autoComplete="off"
          value={subject}
          placeholder="What this correspondence is about"
          onChange={(event) => { setSubject(event.target.value); setFailure(undefined) }}
        />
      </label>

      <div className="node-section"><span>MESSAGE</span></div>
      <textarea
        className="mail-composer-input mail-compose-body"
        data-editing-scroll-owner
        rows={7}
        value={body}
        placeholder="Write the message…"
        aria-label="Message"
        onChange={(event) => { setBody(event.target.value); setFailure(undefined) }}
      />

      <div className="node-section">
        <span>ATTACHMENTS</span>
        <span>{attachmentSelection.length}</span>
      </div>
      <MailAttachmentTray files={files} selected={attachmentSelection} remove={toggleAttachment} openPicker={() => setPicking(true)} />

      {failure && <p className="node-note node-note--caution">{failure}</p>}

      <div className="mail-actionbar mail-actionbar--sticky">
        <button className="node-action" type="button" onClick={close}>DISCARD</button>
        <button className="node-action mail-action--primary" type="submit" disabled={body.trim().length === 0}>SEND</button>
      </div>
    </form>
  </section>
}

function describeComposeFailure(result: ComposeMailResult): string {
  switch (result.status) {
    case 'empty_recipient': return 'Address the correspondence before sending.'
    case 'unknown_recipient': return 'No correspondent at that address is represented. Nothing was sent, and no correspondence was created.'
    case 'empty_subject': return 'Give the correspondence a subject before sending.'
    case 'empty_message': return 'Write the message before sending.'
    case 'attachment_unavailable': return 'One of the selected files is no longer on this Device. Nothing was sent.'
    case 'sent': return ''
  }
}
