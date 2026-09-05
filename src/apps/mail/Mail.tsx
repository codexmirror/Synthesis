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

/**
 * The mailbox as an index rather than a stack of cards.
 *
 * Every row is one ruled entry in a single column, so the list reads as one
 * object at two threads and still reads as one object at fifty. Unread is
 * stated three independent ways — an accent rail on the entry, brighter
 * correspondent and subject type, and the explicit `UNREAD` chip — so it
 * survives both fast scanning and colour blindness.
 */
function Inbox({ mail, open }: { mail: MailState; open: (thread: MailThread) => void }) {
  const unread = deriveUnreadMailCount(mail)

  return <section className="app-content mail-app" aria-label="NodeMail inbox">
    <header className="node-masthead">
      <span className="node-masthead-subject">{mail.account.address}</span>
      <span className="node-masthead-meta">MAILBOX</span>
    </header>

    <div className="node-section">
      <span>INBOX</span>
      <span className={unread > 0 ? 'mail-unread mail-unread--live' : 'mail-unread'}>{unread} UNREAD</span>
    </div>

    {mail.threads.length > 0
      ? <ol className="mail-index">
        {mail.threads.map((thread) => {
          const correspondent = findMailCorrespondent(mail, thread.correspondentId)
          const latest = findLatestThreadMessage(mail, thread.id)
          const unreadInThread = deriveThreadUnreadCount(mail, thread.id)
          return <li key={thread.id}>
            <button
              className={unreadInThread > 0 ? 'mail-entry mail-entry--unread' : 'mail-entry'}
              type="button"
              onClick={() => open(thread)}
              aria-label={`Open ${thread.subject} from ${correspondentLabel(correspondent, thread)}`}
            >
              <span className="mail-entry-head">
                <strong className="mail-entry-from">{correspondentLabel(correspondent, thread)}</strong>
                {unreadInThread > 0 && <span className="node-chip">UNREAD</span>}
                <span className="node-row-arrow" aria-hidden="true">→</span>
              </span>
              <span className="mail-entry-subject">{thread.subject}</span>
              {latest && <span className="mail-preview">
                {latest.sender === 'account' && <span className="mail-preview-mark">YOU</span>}
                {preview(latest)}
              </span>}
            </button>
          </li>
        })}
      </ol>
      : <div className="node-empty">
        <strong>NO CORRESPONDENCE</strong>
        <span>Nothing has been delivered to {mail.account.address}.</span>
      </div>}
  </section>
}

/**
 * One correspondence, read as a transcript.
 *
 * The subject leads, the two identities the correspondence is between are
 * stated once underneath it, and then the messages themselves are the surface.
 * Direction is stated by the author line and reinforced structurally rather
 * than by alignment: what was said to the player sits on the page behind an
 * accent rule, what the player said sits in a quieter inset block.
 */
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
    <dl className="node-facts mail-parties">
      <div>
        <dt>CORRESPONDENT</dt>
        <dd>
          <span className="mail-party-name">{correspondentLabel(correspondent, thread)}</span>
          {correspondent && <span className="mail-party-address">{correspondent.address}</span>}
        </dd>
      </div>
      <div>
        <dt>ACCOUNT</dt>
        <dd><span className="mail-party-address">{mail.account.address}</span></dd>
      </div>
    </dl>

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
      : <div className="node-empty mail-closed">
        <strong>NO REPLY</strong>
        <span>{correspondent ? `${correspondent.address} does not accept replies.` : 'This thread does not accept replies.'}</span>
      </div>}
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

  /*
   * The reply continues the correspondence rather than being a form appended
   * to it: it opens with the same section rule the transcript did, and states
   * who it is going to instead of labelling its own input.
   */
  return <form className="mail-composer" onSubmit={submit}>
    <div className="node-section mail-composer-head">
      <span>REPLY</span>
      {correspondent && <span>TO {correspondent.address}</span>}
    </div>
    <textarea
      className="mail-composer-input"
      data-editing-scroll-owner
      rows={4}
      value={draft}
      placeholder="Write a reply…"
      aria-label={`Reply to ${correspondentLabel(correspondent, thread)}`}
      onChange={(event) => { setDraft(event.target.value); setFailure(undefined) }}
    />
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
  return message.body.replace(/\s+/g, ' ').trim()
}
