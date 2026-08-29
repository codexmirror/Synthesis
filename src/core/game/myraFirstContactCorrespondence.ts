import type { MailMessage } from './types'

/**
 * The one concrete interactive correspondence represented in V1.
 *
 * This is deliberately a thread-specific authored rule, not a dialogue engine,
 * intent resolver, correspondent brain, or entity extractor (ARCHITECTURE.md
 * A16). It proves one thing: free player text plus a concrete authored
 * interaction produces a deterministic represented response.
 */

// The existing `mira` values are stable identity; the corrected spelling is presentation.
export const MYRA_CORRESPONDENT_ID = 'mail-correspondent-mira'
export const MYRA_CORRESPONDENT_NAME = 'Myra Keller'
export const MYRA_CORRESPONDENT_ADDRESS = 'mira@vector-node.net'
export const MYRA_FIRST_CONTACT_THREAD_ID = 'mail-thread-mira-staging'
export const MYRA_FIRST_CONTACT_THREAD_SUBJECT = 'something for you'

/**
 * The address Myra communicates.
 *
 * It is authored correspondence content — what one represented identity tells
 * another — and never a projection of any Device's current network address. It
 * must not be resolved against World Truth when the message is created or
 * rendered: if the World later changes, what Myra said stays what Myra said.
 */
export const MYRA_FIRST_TARGET_ADDRESS = '198.51.100.61'

export const MYRA_FIRST_CONTACT_OPENING_MESSAGE = 'Maybe I have something you might be interested in.\nLet me know if you want it.'

const FIRST_LEAD_REPLY = `Alright. First one's free.\nTry ${MYRA_FIRST_TARGET_ADDRESS}.\n\nConsumer endpoint. Small operation.\nThat's all I have.`
const FIRST_LEAD_AGAIN_REPLY = `Same address as before: ${MYRA_FIRST_TARGET_ADDRESS}.`
const CREDENTIAL_REFUSAL_REPLY = "I don't have credentials for you."
const FALLBACK_REPLY = 'Up to you. Let me know if you want it.'

/**
 * A deliberately small useful vocabulary. This is authored matching for one
 * conversation, not language understanding: unrecognized text is still a real
 * message and still gets a natural answer.
 */
const INTEREST_WORDS = /\b(?:yes|yeah|interested|send\s+(?:it|that)|what\s+do\s+you\s+have|let\s+me\s+see|tell\s+me|give\s+me\s+the\s+address|address)\b/
const CREDENTIAL_WORDS = /\b(?:password|passwd|credential|login)s?\b/

/**
 * Resolve what Myra says in reply to one player message.
 *
 * `history` is the thread's real message history, which is the only
 * conversation truth this rule consults — V1 stores no conversation stage,
 * intent, mood or "already told them" flag beside the messages themselves.
 */
export function resolveMyraFirstContactReply(history: readonly MailMessage[], playerText: string): string {
  const asked = playerText.toLowerCase()
  const isInterested = INTEREST_WORDS.test(asked)
  const wantsCredentials = CREDENTIAL_WORDS.test(asked)

  if (wantsCredentials) return CREDENTIAL_REFUSAL_REPLY
  if (!isInterested) return FALLBACK_REPLY

  return hasCommunicatedFirstTarget(history) ? FIRST_LEAD_AGAIN_REPLY : FIRST_LEAD_REPLY
}

/** Whether Myra has already put the address in this thread, read from what she actually said. */
function hasCommunicatedFirstTarget(history: readonly MailMessage[]): boolean {
  return history.some((message) => message.sender === 'correspondent' && message.body.includes(MYRA_FIRST_TARGET_ADDRESS))
}
