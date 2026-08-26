import './mail.css'
import { type FormEvent, useState } from 'react'
import { type GameActions, useGameActions, useGameState } from '../../app/GameContext'
import {
  deriveThreadUnreadCount,
  deriveUnreadMailCount,
  findLatestThreadMessage,
  findMailCorrespondent,
  findMailThread,
  listThreadMessages,
  threadAcceptsReply,
} from '../../core/game/mail'
import type { MailCorrespondent, MailMessage, MailState, MailThread } from '../../core/game/types'
import { MailMessageBody } from './MailMessageBody'

/**
 * NodeMail is the client NODE-OS currently provides onto the player's
 * represented in-world mailbox. The mailbox belongs to the mail account, not
 * to node-01 and not to NODE-OS; this application presents canonical mail
 * state and performs mail operations, and owns no communication truth of its
 * own. Which thread is open is Shell-style presentation state and never
 * reaches `GameState`.
 */
export function Mail() {
  const state = useGameState()
  const { openMailThread, sendMailReply } = useGameActions()
  const [openThreadId, setOpenThreadId] = useState<string>()
  const mail = state.mail
  const openThread = openThreadId ? findMailThread(mail, openThreadId) : undefined

  function open(thread: MailThread) {
    setOpenThreadId(thread.id)
    // Reading a thread is a canonical mail transition, not a view effect.
    openMailThread(thread.id)
  }

  if (openThread) {
    return <Thread
      key={openThread.id}
      mail={mail}
      thread={openThread}
      send={sendMailReply}
      close={() => setOpenThreadId(undefined)}
    />
  }

  return <Inbox mail={mail} open={open} />
}

function Inbox({ mail, open }: { mail: MailState; open: (thread: MailThread) => void }) {
  const unread = deriveUnreadMailCount(mail)

  return <section className="app-content mail-app" aria-label="NodeMail inbox">
    <header className="node-masthead">
      <span className="node-masthead-subject">{mail.account.address}</span>
      <span className="node-masthead-meta">MAILBOX</span>
    </header>

    <div className="node-section">
      <span>INBOX</span>
      <span>{unread} UNREAD</span>
    </div>

    {mail.threads.length > 0
      ? <div className="node-list">
        {mail.threads.map((thread) => {
          const correspondent = findMailCorrespondent(mail, thread.correspondentId)
          const latest = findLatestThreadMessage(mail, thread.id)
          const unreadInThread = deriveThreadUnreadCount(mail, thread.id)
          return <button
            className={unreadInThread > 0 ? 'node-row mail-thread mail-thread--unread' : 'node-row mail-thread'}
            type="button"
            key={thread.id}
            onClick={() => open(thread)}
            aria-label={`Open ${thread.subject} from ${correspondentLabel(correspondent, thread)}`}
          >
            <span className="node-row-glyph" aria-hidden="true">{unreadInThread > 0 ? '●' : '○'}</span>
            <span className="node-row-copy">
              <strong>{correspondentLabel(correspondent, thread)}</strong>
              <small>{thread.subject}</small>
              {latest && <span className="mail-preview">{preview(latest)}</span>}
            </span>
            {unreadInThread > 0 && <span className="node-chip">UNREAD</span>}
            <span className="node-row-arrow" aria-hidden="true">→</span>
          </button>
        })}
      </div>
      : <div className="node-empty"><strong>NO CORRESPONDENCE</strong><span>Nothing has been delivered to this account.</span></div>}
  </section>
}

function Thread({ mail, thread, send, close }: {
  mail: MailState
  thread: MailThread
  send: GameActions['sendMailReply']
  close: () => void
}) {
  const correspondent = findMailCorrespondent(mail, thread.correspondentId)
  const messages = listThreadMessages(mail, thread.id)
  /** Presentation only: the exchange this session just produced, so it arrives rather than appearing. */
  const [arrived, setArrived] = useState<readonly string[]>([])

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

    <h2 className="mail-subject">{thread.subject}</h2>
    <p className="mail-parties">
      <span className="mail-party">{correspondentLabel(correspondent, thread)}</span>
      {correspondent && <span className="mail-party-address">{correspondent.address}</span>}
      <span className="mail-party-account">TO {mail.account.address}</span>
    </p>

    <div className="node-section">
      <span>MESSAGES</span>
      <span>{messages.length}</span>
    </div>

    <ol className="mail-messages">
      {messages.map((message) => <li
        className={`mail-message mail-message--${message.sender === 'account' ? 'sent' : 'received'}${arrived.includes(message.id) ? ' mail-message--arrived' : ''}`}
        key={message.id}
      >
        <span className="mail-message-author">{message.sender === 'account' ? 'YOU' : correspondentLabel(correspondent, thread)}</span>
        <p className="mail-message-body"><MailMessageBody body={message.body} /></p>
      </li>)}
    </ol>

    {threadAcceptsReply(thread.id)
      ? <Composer thread={thread} correspondent={correspondent} send={send} onSent={setArrived} />
      : <p className="node-note">{correspondent ? `${correspondent.address} does not accept replies.` : 'This thread does not accept replies.'}</p>}
  </section>
}

function Composer({ thread, correspondent, send, onSent }: {
  thread: MailThread
  correspondent: MailCorrespondent | undefined
  send: GameActions['sendMailReply']
  onSent: (messageIds: readonly string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const [failure, setFailure] = useState<string>()

  /**
   * SEND is the only thing that sends. The composer is an ordinary multiline
   * textarea under the Shell-owned editing presentation: Enter inserts a
   * newline, and this application adds no keyboard, viewport or focus
   * behavior of its own — including autofocus, which would open the software
   * keyboard merely because a thread was opened.
   */
  function submit(event: FormEvent) {
    event.preventDefault()
    const result = send(thread.id, draft)
    if (result.status !== 'sent') {
      setFailure(result.status === 'empty_message' ? 'Write a reply before sending.' : 'This thread cannot be replied to.')
      return
    }
    setFailure(undefined)
    setDraft('')
    onSent([result.playerMessageId, result.replyMessageId])
  }

  return <form className="mail-composer" onSubmit={submit}>
    <label className="node-field">
      <span>REPLY{correspondent ? ` TO ${correspondent.address}` : ''}</span>
      <textarea
        className="mail-composer-input"
        data-editing-scroll-owner
        rows={4}
        value={draft}
        placeholder="Write a reply…"
        aria-label={`Reply to ${correspondentLabel(correspondent, thread)}`}
        onChange={(event) => { setDraft(event.target.value); setFailure(undefined) }}
      />
    </label>
    <div className="mail-composer-actions">
      <button className="node-action" type="submit" disabled={draft.trim().length === 0}>SEND</button>
    </div>
    {failure && <p className="node-note node-note--caution">{failure}</p>}
  </form>
}

function correspondentLabel(correspondent: MailCorrespondent | undefined, thread: MailThread): string {
  return correspondent?.name ?? thread.correspondentId
}

/** A compact projection of the last thing said in a thread; derived, never stored. */
function preview(message: MailMessage): string {
  const text = message.body.replace(/\s+/g, ' ').trim()
  return message.sender === 'account' ? `You: ${text}` : text
}
