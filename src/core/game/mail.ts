import { snapshotMailAttachment } from './mailAttachments'
import {
  MYRA_CORRESPONDENT_ADDRESS,
  MYRA_CORRESPONDENT_ID,
  MYRA_CORRESPONDENT_NAME,
  MYRA_FIRST_CONTACT_OPENING_MESSAGE,
  MYRA_FIRST_CONTACT_THREAD_ID,
  MYRA_FIRST_CONTACT_THREAD_SUBJECT,
  resolveMyraFirstContactReply,
} from './myraFirstContactCorrespondence'
import type {
  GameState,
  IncomingMailMessage,
  MailAttachment,
  MailCorrespondent,
  MailMessage,
  MailState,
  MailThread,
  OutgoingMailMessage,
} from './types'

/**
 * The player's canonical mailbox and the operations over it.
 *
 * Mail is represented communication: what one identity told another. It is not
 * Discovery and not Knowledge. A communicated address is a string somebody
 * said, and nothing here observes, verifies, or resolves it against the World
 * (ARCHITECTURE.md A03, A09) — the existing observation operations stay
 * responsible for that.
 *
 * The mailbox now allocates its own thread and attachment identity, because
 * the player can create a correspondence and attach concrete local artifacts
 * to it. Both allocations are mailbox-monotonic counters: identity never comes
 * from a subject, an address, a display name, randomness, or wall-clock time.
 * The mailbox still represents no communication time, no delivery runtime and
 * no network transfer.
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
 * Runtime correspondence identity.
 *
 * Deliberately its own series rather than a hash of the subject or recipient:
 * two correspondences may share both and still be two different
 * correspondences, and neither is identity (`A01`).
 */
export function formatMailThreadId(id: number): string {
  return `mail-thread-${String(id).padStart(4, '0')}`
}

export function formatMailAttachmentId(id: number): string {
  return `attachment-${String(id).padStart(4, '0')}`
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
      { id: MYRA_CORRESPONDENT_ID, name: MYRA_CORRESPONDENT_NAME, address: MYRA_CORRESPONDENT_ADDRESS },
    ],
    threads: [
      { id: WELCOME_THREAD_ID, correspondentId: NODEMAIL_SYSTEM_CORRESPONDENT_ID, subject: WELCOME_THREAD_SUBJECT },
      { id: MYRA_FIRST_CONTACT_THREAD_ID, correspondentId: MYRA_CORRESPONDENT_ID, subject: MYRA_FIRST_CONTACT_THREAD_SUBJECT },
    ],
    nextThreadId: 1,
    nextMessageId: 3,
    nextAttachmentId: 1,
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
        threadId: MYRA_FIRST_CONTACT_THREAD_ID,
        sender: 'correspondent',
        correspondentId: MYRA_CORRESPONDENT_ID,
        read: false,
        body: MYRA_FIRST_CONTACT_OPENING_MESSAGE,
      },
    ],
    deletedThreadIds: [],
  }
}

export function findMailThread(mail: Readonly<MailState>, threadId: string): MailThread | undefined {
  return mail.threads.find((thread) => thread.id === threadId)
}

export function findMailCorrespondent(mail: Readonly<MailState>, correspondentId: string): MailCorrespondent | undefined {
  return mail.correspondents.find((correspondent) => correspondent.id === correspondentId)
}

/** Whether the player removed this correspondence from their active mailbox. Its history is still there. */
export function isMailThreadDeleted(mail: Readonly<MailState>, threadId: string): boolean {
  return mail.deletedThreadIds.includes(threadId)
}

/** The correspondences currently in the mailbox, in mailbox order. */
export function listActiveMailThreads(mail: Readonly<MailState>): readonly MailThread[] {
  return mail.threads.filter((thread) => !isMailThreadDeleted(mail, thread.id))
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

/** Everything actually sent in one correspondence; derived, never stored. */
export function deriveThreadAttachmentCount(mail: Readonly<MailState>, threadId: string): number {
  return listThreadMessages(mail, threadId).reduce((total, message) => total + (message.attachments?.length ?? 0), 0)
}

/**
 * The active mailbox's unread count, derived rather than stored.
 *
 * A correspondence the player removed from the mailbox is no longer part of
 * the active summary, even though its messages and their canonical read state
 * are deliberately still there.
 */
export function deriveUnreadMailCount(mail: Readonly<MailState>): number {
  return mail.messages.filter((message) => isUnreadIncoming(message) && !isMailThreadDeleted(mail, message.threadId)).length
}

/**
 * Whether the player can write into this thread at all.
 *
 * Concrete cases, not a canonical per-thread flag that could disagree with the
 * correspondence itself: the authored NodeMail announcement is a statement
 * rather than a correspondence and accepts nothing, a correspondence removed
 * from the mailbox is not there to write into, and every other represented
 * thread — Myra's authored interaction and any correspondence the player
 * themselves started — accepts the player's own further messages. Accepting a
 * message is not a promise that anything answers it.
 */
export function threadAcceptsReply(mail: Readonly<MailState>, threadId: string): boolean {
  if (!findMailThread(mail, threadId)) return false
  // A correspondence the player removed is no longer in their mailbox, so
  // there is nothing to write into.
  if (isMailThreadDeleted(mail, threadId)) return false
  return threadId !== WELCOME_THREAD_ID
}

/**
 * Resolve a typed address against represented correspondent truth.
 *
 * An address is an addressing attribute, never identity (`A01`): resolution
 * matches an address the mailbox already represents, and typing an unknown one
 * resolves to nothing rather than bringing a new correspondent into existence.
 * Matching ignores surrounding whitespace and case, which is addressing
 * convention, not identity.
 */
export function resolveMailRecipient(mail: Readonly<MailState>, address: string): MailCorrespondent | undefined {
  const normalized = address.trim().toLowerCase()
  if (normalized.length === 0) return undefined
  return mail.correspondents.find((correspondent) => correspondent.address.toLowerCase() === normalized)
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

/**
 * Remove correspondences from the active mailbox.
 *
 * Deliberately not a rewrite of history: the threads and every message in them
 * stay exactly as they were, because what was communicated is what prior
 * consequences were caused by. Nothing else moves — no source File, no
 * Discovery, no Knowledge, no already-caused World state.
 */
export function deleteMailThreads(state: GameState, threadIds: readonly string[]): GameState {
  const mail = state.mail
  const removed = [...new Set(threadIds)]
    .filter((threadId) => findMailThread(mail, threadId) && !isMailThreadDeleted(mail, threadId))
  if (removed.length === 0) return state
  return { ...state, mail: { ...mail, deletedThreadIds: [...mail.deletedThreadIds, ...removed] } }
}

export type ComposeMailInput = {
  /** What the player typed into TO. An addressing attribute, never identity. */
  readonly to: string
  readonly subject: string
  readonly body: string
  /** Stable local File identity for each artifact the player chose to attach. */
  readonly attachmentFileIds?: readonly string[]
}

export type ComposeMailResult =
  | { readonly status: 'sent'; readonly state: GameState; readonly threadId: string; readonly messageId: string }
  | { readonly status: 'unknown_recipient'; readonly state: GameState }
  | { readonly status: 'empty_recipient'; readonly state: GameState }
  | { readonly status: 'empty_subject'; readonly state: GameState }
  | { readonly status: 'empty_message'; readonly state: GameState }
  | { readonly status: 'attachment_unavailable'; readonly state: GameState }

/**
 * Start a new correspondence.
 *
 * One deterministic canonical transition: resolve the typed address against
 * represented correspondent truth, allocate the mailbox's next thread
 * identity, and append exactly one outgoing message with exactly the
 * attachments the player selected, snapshotted as sent.
 *
 * Nothing answers it. A represented correspondent replying is a concrete
 * authored interaction, and starting a correspondence is not one, so a new
 * thread is outgoing-only until something represented actually writes back.
 */
export function composeMail(state: GameState, input: ComposeMailInput): ComposeMailResult {
  const mail = state.mail
  if (input.to.trim().length === 0) return { status: 'empty_recipient', state }
  const recipient = resolveMailRecipient(mail, input.to)
  if (!recipient) return { status: 'unknown_recipient', state }
  if (input.subject.trim().length === 0) return { status: 'empty_subject', state }
  if (input.body.trim().length === 0) return { status: 'empty_message', state }

  const attached = snapshotSelectedAttachments(state, input.attachmentFileIds ?? [], mail.nextAttachmentId)
  if (!attached) return { status: 'attachment_unavailable', state }

  const thread: MailThread = {
    id: formatMailThreadId(mail.nextThreadId),
    correspondentId: recipient.id,
    subject: input.subject.trim(),
  }
  const message: OutgoingMailMessage = {
    id: formatMailMessageId(mail.nextMessageId),
    threadId: thread.id,
    sender: 'account',
    body: input.body,
    ...(attached.attachments.length > 0 ? { attachments: attached.attachments } : {}),
  }

  return {
    status: 'sent',
    threadId: thread.id,
    messageId: message.id,
    state: {
      ...state,
      mail: {
        ...mail,
        threads: [...mail.threads, thread],
        nextThreadId: mail.nextThreadId + 1,
        nextMessageId: mail.nextMessageId + 1,
        nextAttachmentId: attached.nextAttachmentId,
        messages: [...mail.messages, message],
      },
    },
  }
}

export type SendMailReplyResult =
  | { readonly status: 'sent'; readonly state: GameState; readonly playerMessageId: string; readonly replyMessageId?: string }
  | { readonly status: 'empty_message'; readonly state: GameState }
  | { readonly status: 'thread_unavailable'; readonly state: GameState }
  | { readonly status: 'thread_not_replyable'; readonly state: GameState }
  | { readonly status: 'attachment_unavailable'; readonly state: GameState }

/**
 * Send the player's own words into an existing thread.
 *
 * One deterministic canonical transition: append exactly what the player
 * wrote, with exactly what they attached, and then append the thread's
 * concrete authored answer if that thread has one. There is no delivery time,
 * delay, or scheduled work — the mailbox represents no communication time.
 *
 * Only Myra's authored first-contact correspondence answers. A correspondence
 * the player started themselves accepts their further messages and stays
 * outgoing-only, which is what keeps this a concrete authored interaction
 * rather than a dialogue engine (`A16`).
 *
 * An authored answer is created read: it is produced while the player is in
 * this thread, so it is never a new unread message in the conversation they
 * are already looking at.
 */
export function sendMailReply(state: GameState, threadId: string, text: string, attachmentFileIds: readonly string[] = []): SendMailReplyResult {
  const mail = state.mail
  const thread = findMailThread(mail, threadId)
  if (!thread) return { status: 'thread_unavailable', state }
  if (!threadAcceptsReply(mail, thread.id)) return { status: 'thread_not_replyable', state }
  if (text.trim().length === 0) return { status: 'empty_message', state }

  const attached = snapshotSelectedAttachments(state, attachmentFileIds, mail.nextAttachmentId)
  if (!attached) return { status: 'attachment_unavailable', state }

  const playerMessage: OutgoingMailMessage = {
    id: formatMailMessageId(mail.nextMessageId),
    threadId: thread.id,
    sender: 'account',
    // Exactly the player's text, preserved as correspondence history.
    body: text,
    ...(attached.attachments.length > 0 ? { attachments: attached.attachments } : {}),
  }

  const answerBody = resolveAuthoredThreadAnswer(mail, thread, text)
  const answer: IncomingMailMessage | undefined = answerBody === undefined ? undefined : {
    id: formatMailMessageId(mail.nextMessageId + 1),
    threadId: thread.id,
    sender: 'correspondent',
    correspondentId: thread.correspondentId,
    read: true,
    body: answerBody,
  }

  return {
    status: 'sent',
    playerMessageId: playerMessage.id,
    ...(answer ? { replyMessageId: answer.id } : {}),
    state: {
      ...state,
      mail: {
        ...mail,
        nextMessageId: mail.nextMessageId + (answer ? 2 : 1),
        nextAttachmentId: attached.nextAttachmentId,
        messages: answer ? [...mail.messages, playerMessage, answer] : [...mail.messages, playerMessage],
      },
    },
  }
}

/**
 * The concrete authored answer a thread has, if it has one.
 *
 * This stays a per-thread authored rule read from the real message history.
 * There is no stage, intent, mood, trust or "already answered" flag beside the
 * messages themselves.
 */
function resolveAuthoredThreadAnswer(mail: Readonly<MailState>, thread: MailThread, text: string): string | undefined {
  if (thread.id !== MYRA_FIRST_CONTACT_THREAD_ID) return undefined
  return resolveMyraFirstContactReply(listThreadMessages(mail, thread.id), text)
}

/**
 * Snapshot the artifacts the player selected, or refuse.
 *
 * Selection is by stable local File identity, never by filename or path. If
 * any selection no longer resolves on the local Device filesystem the whole
 * send is refused and canonical state is left untouched, rather than sending a
 * partial or invented attachment.
 */
function snapshotSelectedAttachments(
  state: GameState,
  fileIds: readonly string[],
  nextAttachmentId: number,
): { readonly attachments: readonly MailAttachment[]; readonly nextAttachmentId: number } | undefined {
  const files = state.player.localDevice.filesystem.files
  const attachments: MailAttachment[] = []
  let nextId = nextAttachmentId
  for (const fileId of [...new Set(fileIds)]) {
    const file = files.find((candidate) => candidate.id === fileId)
    if (!file) return undefined
    attachments.push(snapshotMailAttachment(file, formatMailAttachmentId(nextId)))
    nextId += 1
  }
  return { attachments, nextAttachmentId: nextId }
}

function isUnreadIncoming(message: MailMessage): boolean {
  return message.sender === 'correspondent' && !message.read
}
