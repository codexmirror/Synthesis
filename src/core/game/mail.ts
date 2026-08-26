import {
  MIRA_CORRESPONDENT_ADDRESS,
  MIRA_CORRESPONDENT_ID,
  MIRA_CORRESPONDENT_NAME,
  MIRA_STAGING_OPENING_MESSAGE,
  MIRA_STAGING_THREAD_ID,
  MIRA_STAGING_THREAD_SUBJECT,
  resolveMiraStagingReply,
} from './miraStagingCorrespondence'
import type { GameState, IncomingMailMessage, MailCorrespondent, MailMessage, MailState, MailThread, OutgoingMailMessage } from './types'

/**
 * The player's canonical mailbox and the operations over it.
 *
 * Mail is represented communication: what one identity told another. It is not
 * Discovery and not Knowledge. A communicated address is a string somebody
 * said, and nothing here observes, verifies, or resolves it against the World
 * (ARCHITECTURE.md A03, A09) — the existing observation operations stay
 * responsible for that.
 */

export const PLAYER_MAIL_ACCOUNT_ID = 'mail-account-player-v0'
export const PLAYER_MAIL_ACCOUNT_ADDRESS = 'user@node.mail'

export const NODEMAIL_SYSTEM_CORRESPONDENT_ID = 'mail-correspondent-nodemail'
export const NODEMAIL_SYSTEM_CORRESPONDENT_NAME = 'NodeMail'
export const NODEMAIL_SYSTEM_CORRESPONDENT_ADDRESS = 'system@node.mail'
export const WELCOME_THREAD_ID = 'mail-thread-welcome'
export const WELCOME_THREAD_SUBJECT = 'Welcome to NodeMail'

export function formatMailMessageId(id: number): string {
  return `message-${String(id).padStart(4, '0')}`
}

/**
 * The authored starting mailbox. Both seeded messages are unread incoming
 * correspondence, so the mailbox starts with a real unread count rather than a
 * decorative one.
 */
export function createInitialMailState(): MailState {
  return {
    account: { id: PLAYER_MAIL_ACCOUNT_ID, address: PLAYER_MAIL_ACCOUNT_ADDRESS },
    correspondents: [
      { id: NODEMAIL_SYSTEM_CORRESPONDENT_ID, name: NODEMAIL_SYSTEM_CORRESPONDENT_NAME, address: NODEMAIL_SYSTEM_CORRESPONDENT_ADDRESS },
      { id: MIRA_CORRESPONDENT_ID, name: MIRA_CORRESPONDENT_NAME, address: MIRA_CORRESPONDENT_ADDRESS },
    ],
    threads: [
      { id: WELCOME_THREAD_ID, correspondentId: NODEMAIL_SYSTEM_CORRESPONDENT_ID, subject: WELCOME_THREAD_SUBJECT },
      { id: MIRA_STAGING_THREAD_ID, correspondentId: MIRA_CORRESPONDENT_ID, subject: MIRA_STAGING_THREAD_SUBJECT },
    ],
    nextMessageId: 3,
    messages: [
      {
        id: formatMailMessageId(1),
        threadId: WELCOME_THREAD_ID,
        sender: 'correspondent',
        correspondentId: NODEMAIL_SYSTEM_CORRESPONDENT_ID,
        read: false,
        body: `Your account ${PLAYER_MAIL_ACCOUNT_ADDRESS} is active.\nMessages delivered to this account will appear here.`,
      },
      {
        id: formatMailMessageId(2),
        threadId: MIRA_STAGING_THREAD_ID,
        sender: 'correspondent',
        correspondentId: MIRA_CORRESPONDENT_ID,
        read: false,
        body: MIRA_STAGING_OPENING_MESSAGE,
      },
    ],
  }
}

export function findMailThread(mail: Readonly<MailState>, threadId: string): MailThread | undefined {
  return mail.threads.find((thread) => thread.id === threadId)
}

export function findMailCorrespondent(mail: Readonly<MailState>, correspondentId: string): MailCorrespondent | undefined {
  return mail.correspondents.find((correspondent) => correspondent.id === correspondentId)
}

/** One thread's messages in the order they were actually said. */
export function listThreadMessages(mail: Readonly<MailState>, threadId: string): readonly MailMessage[] {
  return mail.messages.filter((message) => message.threadId === threadId)
}

export function findLatestThreadMessage(mail: Readonly<MailState>, threadId: string): MailMessage | undefined {
  return listThreadMessages(mail, threadId).at(-1)
}

/** Unread incoming correspondence in one thread. A player's own message has no read state to count. */
export function deriveThreadUnreadCount(mail: Readonly<MailState>, threadId: string): number {
  return listThreadMessages(mail, threadId).filter(isUnreadIncoming).length
}

/** The mailbox's unread count, derived rather than stored. */
export function deriveUnreadMailCount(mail: Readonly<MailState>): number {
  return mail.messages.filter(isUnreadIncoming).length
}

/**
 * Whether the player can write into this thread at all.
 *
 * V1 represents exactly one interactive correspondence, so this is a concrete
 * check rather than a canonical per-thread flag: replyability follows from the
 * authored interaction that exists, and is not separate mailbox state that
 * could disagree with it.
 */
export function threadAcceptsReply(threadId: string): boolean {
  return threadId === MIRA_STAGING_THREAD_ID
}

/**
 * Opening a thread is a canonical mail operation: it marks that thread's
 * unread incoming correspondence read. It touches no other thread.
 */
export function openMailThread(state: GameState, threadId: string): GameState {
  const mail = state.mail
  if (!findMailThread(mail, threadId)) return state
  if (deriveThreadUnreadCount(mail, threadId) === 0) return state
  return {
    ...state,
    mail: {
      ...mail,
      messages: mail.messages.map((message) =>
        message.threadId === threadId && isUnreadIncoming(message) ? { ...message, read: true } : message),
    },
  }
}

export type SendMailReplyResult =
  | { readonly status: 'sent'; readonly state: GameState; readonly playerMessageId: string; readonly replyMessageId: string }
  | { readonly status: 'empty_message'; readonly state: GameState }
  | { readonly status: 'thread_unavailable'; readonly state: GameState }
  | { readonly status: 'thread_not_replyable'; readonly state: GameState }

/**
 * Send the player's own words into a thread.
 *
 * One deterministic canonical transition: append exactly what the player
 * wrote, resolve the thread's concrete authored reply from the real message
 * history, and append that. There is no delivery time, delay, or scheduled
 * work — V1 represents no communication time at all.
 *
 * The reply is created read: it is produced while the player is in this
 * thread, so it is never a new unread message in the conversation they are
 * already looking at.
 */
export function sendMailReply(state: GameState, threadId: string, text: string): SendMailReplyResult {
  const mail = state.mail
  const thread = findMailThread(mail, threadId)
  if (!thread) return { status: 'thread_unavailable', state }
  if (!threadAcceptsReply(thread.id)) return { status: 'thread_not_replyable', state }
  if (text.trim().length === 0) return { status: 'empty_message', state }

  const playerMessage: OutgoingMailMessage = {
    id: formatMailMessageId(mail.nextMessageId),
    threadId: thread.id,
    sender: 'account',
    // Exactly the player's text, preserved as correspondence history.
    body: text,
  }
  const reply: IncomingMailMessage = {
    id: formatMailMessageId(mail.nextMessageId + 1),
    threadId: thread.id,
    sender: 'correspondent',
    correspondentId: thread.correspondentId,
    read: true,
    body: resolveMiraStagingReply(listThreadMessages(mail, thread.id), text),
  }

  return {
    status: 'sent',
    playerMessageId: playerMessage.id,
    replyMessageId: reply.id,
    state: {
      ...state,
      mail: { ...mail, nextMessageId: mail.nextMessageId + 2, messages: [...mail.messages, playerMessage, reply] },
    },
  }
}

function isUnreadIncoming(message: MailMessage): boolean {
  return message.sender === 'correspondent' && !message.read
}
