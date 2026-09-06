import './mail.css'
import { useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import {
  deriveThreadAttachmentCount,
  deriveThreadUnreadCount,
  deriveUnreadMailCount,
  findLatestThreadMessage,
  findMailCorrespondent,
  findMailThread,
  listActiveMailThreads,
  listThreadMessages,
} from '../../core/game/mail'
import type { MailState, MailThread } from '../../core/game/types'
import { MailCompose } from './MailCompose'
import { MailConfirm } from './MailConfirm'
import { MailThreadView } from './MailThreadView'
import { correspondentLabel, previewText } from './mailPresentation'

/**
 * NodeMail is the client NODE-OS currently provides onto the player's
 * represented in-world mailbox. The mailbox belongs to the mail account, not
 * to node-01 and not to NODE-OS; this application presents canonical mail
 * state and performs mail operations, and owns no communication truth of its
 * own.
 *
 * Which surface is open, which correspondences are selected, and anything the
 * player has typed but not sent are Shell-style presentation state and never
 * reach `GameState`.
 */

type MailSurface =
  | { readonly kind: 'inbox' }
  | { readonly kind: 'thread'; readonly threadId: string }
  | { readonly kind: 'compose' }

export function Mail() {
  const state = useGameState()
  const actions = useGameActions()
  const [surface, setSurface] = useState<MailSurface>({ kind: 'inbox' })
  const mail = state.mail
  const localDevice = state.player.localDevice
  const openThread = surface.kind === 'thread' ? findMailThread(mail, surface.threadId) : undefined

  function open(thread: MailThread) {
    setSurface({ kind: 'thread', threadId: thread.id })
    // Reading a thread is a canonical mail transition, not a view effect.
    actions.openMailThread(thread.id)
  }

  if (surface.kind === 'compose') {
    return <MailCompose
      mail={mail}
      files={localDevice.filesystem.files}
      deviceName={localDevice.displayName}
      compose={actions.composeMail}
      close={() => setSurface({ kind: 'inbox' })}
      opened={(threadId) => setSurface({ kind: 'thread', threadId })}
    />
  }

  if (openThread) {
    return <MailThreadView
      key={openThread.id}
      mail={mail}
      thread={openThread}
      files={localDevice.filesystem.files}
      deviceName={localDevice.displayName}
      send={actions.sendMailReply}
      remove={actions.deleteMailThreads}
      close={() => setSurface({ kind: 'inbox' })}
    />
  }

  return <Inbox
    mail={mail}
    open={open}
    compose={() => setSurface({ kind: 'compose' })}
    remove={actions.deleteMailThreads}
  />
}

/**
 * The mailbox as an index, not a stack of cards.
 *
 * A summary strip states what the mailbox actually holds, one toolbar carries
 * the two things a mailbox does — start a correspondence, remove one — and the
 * correspondences themselves are one hairline-ruled column that reads the same
 * way at two entries and at fifty. Deletion lives in an explicit selection
 * mode so an ordinary row stays clean rather than carrying a destructive
 * control of its own.
 */
function Inbox({ mail, open, compose, remove }: {
  mail: MailState
  open: (thread: MailThread) => void
  compose: () => void
  remove: (threadIds: readonly string[]) => void
}) {
  const [selecting, setSelecting] = useState(false)
  const [selection, setSelection] = useState<readonly string[]>([])
  const [confirming, setConfirming] = useState(false)
  const threads = listActiveMailThreads(mail)
  const unread = deriveUnreadMailCount(mail)
  const messageCount = threads.reduce((total, thread) => total + listThreadMessages(mail, thread.id).length, 0)

  function leaveSelection() {
    setSelecting(false)
    setSelection([])
    setConfirming(false)
  }

  function toggle(threadId: string) {
    setSelection((current) => current.includes(threadId) ? current.filter((id) => id !== threadId) : [...current, threadId])
    setConfirming(false)
  }

  return <section className="app-content mail-app" aria-label="NodeMail inbox">
    <header className="node-masthead">
      <span className="node-masthead-subject">{mail.account.address}</span>
      <span className="node-masthead-meta">MAILBOX</span>
    </header>

    <dl className="mail-summary">
      <div className={unread > 0 ? 'mail-summary-cell mail-summary-cell--live' : 'mail-summary-cell'}>
        <dt>UNREAD</dt>
        <dd>{unread}</dd>
      </div>
      <div className="mail-summary-cell">
        <dt>CORRESPONDENCE</dt>
        <dd>{threads.length}</dd>
      </div>
      <div className="mail-summary-cell">
        <dt>MESSAGES</dt>
        <dd>{messageCount}</dd>
      </div>
    </dl>

    <div className="mail-actionbar">
      {selecting
        ? <>
          <span className="mail-actionbar-state">{selection.length} SELECTED</span>
          <button className="node-action" type="button" onClick={leaveSelection}>DONE</button>
          <button
            className="node-action node-action--destructive"
            type="button"
            disabled={selection.length === 0}
            onClick={() => setConfirming(true)}
          >DELETE</button>
        </>
        : <>
          <button className="node-action mail-action--secondary" type="button" onClick={compose}>COMPOSE</button>
          <button
            className="node-action mail-action--quiet"
            type="button"
            disabled={threads.length === 0}
            onClick={() => setSelecting(true)}
          >SELECT</button>
        </>}
    </div>

    {confirming && selection.length > 0 && <MailConfirm
      question={`Remove ${selection.length} ${selection.length === 1 ? 'correspondence' : 'correspondences'} from this mailbox?`}
      detail="They leave the inbox and the unread summary. Anything they already caused, and any file that was attached to them, is untouched."
      confirmLabel="REMOVE"
      confirm={() => { remove(selection); leaveSelection() }}
      cancel={() => setConfirming(false)}
    />}

    <div className="node-section"><span>INBOX</span></div>

    {threads.length > 0
      ? <ol className="mail-index">
        {threads.map((thread) => {
          const correspondent = findMailCorrespondent(mail, thread.correspondentId)
          const who = correspondentLabel(correspondent, thread)
          const latest = findLatestThreadMessage(mail, thread.id)
          const unreadInThread = deriveThreadUnreadCount(mail, thread.id)
          const attachments = deriveThreadAttachmentCount(mail, thread.id)
          const chosen = selection.includes(thread.id)
          return <li key={thread.id}>
            <button
              className={entryClassName(unreadInThread > 0, selecting && chosen)}
              type="button"
              aria-pressed={selecting ? chosen : undefined}
              aria-label={selecting ? `Select ${thread.subject} from ${who}` : `Open ${thread.subject} from ${who}`}
              onClick={() => selecting ? toggle(thread.id) : open(thread)}
            >
              <span className="mail-entry-head">
                <strong className="mail-entry-from">{who}</strong>
                {unreadInThread > 0 && <span className="node-chip">UNREAD</span>}
                {attachments > 0 && <span className="node-chip node-chip--quiet" aria-label={`${attachments} sent ${attachments === 1 ? 'attachment' : 'attachments'}`}>
                  <span aria-hidden="true">▱ </span>{attachments}
                </span>}
              </span>
              <span className="mail-entry-subject">{thread.subject}</span>
              {latest && <span className="mail-preview">
                {latest.sender === 'account' && <span className="mail-preview-mark">YOU</span>}
                {previewText(latest)}
              </span>}
              <span className="mail-entry-mark" aria-hidden="true">{selecting ? (chosen ? '■' : '□') : '→'}</span>
            </button>
          </li>
        })}
      </ol>
      : <div className="node-empty">
        <strong>NO CORRESPONDENCE</strong>
        <span>Nothing is in the active mailbox for {mail.account.address}.</span>
      </div>}
  </section>
}

function entryClassName(unread: boolean, chosen: boolean): string {
  return ['mail-entry', unread ? 'mail-entry--unread' : '', chosen ? 'mail-entry--chosen' : ''].filter(Boolean).join(' ')
}
