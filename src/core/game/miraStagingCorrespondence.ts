import type { MailMessage } from './types'

/**
 * The one concrete interactive correspondence represented in V1.
 *
 * This is deliberately a thread-specific authored rule, not a dialogue engine,
 * intent resolver, correspondent brain, or entity extractor (ARCHITECTURE.md
 * A16). It proves one thing: free player text plus a concrete authored
 * interaction produces a deterministic represented response.
 */

export const MIRA_CORRESPONDENT_ID = 'mail-correspondent-mira'
export const MIRA_CORRESPONDENT_NAME = 'Mira Keller'
export const MIRA_CORRESPONDENT_ADDRESS = 'mira@vector-node.net'
export const MIRA_STAGING_THREAD_ID = 'mail-thread-mira-staging'
export const MIRA_STAGING_THREAD_SUBJECT = 'staging endpoint'

/**
 * The address Mira communicates.
 *
 * It is authored correspondence content — what one represented identity tells
 * another — and never a projection of any Device's current network address. It
 * must not be resolved against World Truth when the message is created or
 * rendered: if the World later changes, what Mira said stays what Mira said.
 */
export const MIRA_STAGING_ENDPOINT_ADDRESS = '203.0.113.42'

export const MIRA_STAGING_OPENING_MESSAGE = 'I still have the staging endpoint.\nIf you need the address, ask.'

const ENDPOINT_REPLY = `Use ${MIRA_STAGING_ENDPOINT_ADDRESS}.\nThat's the staging endpoint I have.`
const ENDPOINT_AGAIN_REPLY = `Same address as before: ${MIRA_STAGING_ENDPOINT_ADDRESS}.`
const CREDENTIAL_REFUSAL_REPLY = "I'm not sending credentials over mail."
const FALLBACK_REPLY = 'I mean the staging endpoint.\nIf you need the address, ask.'

/**
 * A deliberately small useful vocabulary. This is authored matching for one
 * conversation, not language understanding: unrecognized text is still a real
 * message and still gets a natural answer.
 */
const HOST_INFORMATION_WORDS = /\b(?:ip|address|host|server|endpoint)s?\b/
const CREDENTIAL_WORDS = /\b(?:password|passwd|credential|login)s?\b/

/**
 * Resolve what Mira says in reply to one player message.
 *
 * `history` is the thread's real message history, which is the only
 * conversation truth this rule consults — V1 stores no conversation stage,
 * intent, mood or "already told them" flag beside the messages themselves.
 */
export function resolveMiraStagingReply(history: readonly MailMessage[], playerText: string): string {
  const asked = playerText.toLowerCase()
  const wantsHostInformation = HOST_INFORMATION_WORDS.test(asked)
  const wantsCredentials = CREDENTIAL_WORDS.test(asked)

  if (!wantsHostInformation) return wantsCredentials ? CREDENTIAL_REFUSAL_REPLY : FALLBACK_REPLY

  const endpointReply = hasCommunicatedEndpoint(history) ? ENDPOINT_AGAIN_REPLY : ENDPOINT_REPLY
  return wantsCredentials ? `${endpointReply}\n${CREDENTIAL_REFUSAL_REPLY}` : endpointReply
}

/** Whether Mira has already put the address in this thread, read from what she actually said. */
function hasCommunicatedEndpoint(history: readonly MailMessage[]): boolean {
  return history.some((message) => message.sender === 'correspondent' && message.body.includes(MIRA_STAGING_ENDPOINT_ADDRESS))
}
