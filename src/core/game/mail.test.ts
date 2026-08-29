import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import {
  createInitialMailState,
  deriveThreadUnreadCount,
  deriveUnreadMailCount,
  findLatestThreadMessage,
  listThreadMessages,
  openMailThread,
  sendMailReply,
  threadAcceptsReply,
  WELCOME_THREAD_ID,
} from './mail'
import { MYRA_FIRST_TARGET_ADDRESS, MYRA_FIRST_CONTACT_THREAD_ID } from './myraFirstContactCorrespondence'
import { rememberScan } from './discovery'
import { scanNetworkTarget } from './scan'
import type { GameState, MailMessage } from './types'

function send(state: GameState, text: string): GameState {
  const result = sendMailReply(state, MYRA_FIRST_CONTACT_THREAD_ID, text)
  if (result.status !== 'sent') throw new Error(result.status)
  return result.state
}

function bodies(state: GameState, threadId: string): string[] {
  return listThreadMessages(state.mail, threadId).map((message) => message.body)
}

function lastReply(state: GameState): string {
  const last = findLatestThreadMessage(state.mail, MYRA_FIRST_CONTACT_THREAD_ID)
  if (!last || last.sender !== 'correspondent') throw new Error('expected a correspondent reply')
  return last.body
}

describe('initial mailbox', () => {
  it('seeds a deterministic account, correspondents and authored threads', () => {
    const first = createInitialMailState()
    const second = createInitialMailState()

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.account).toEqual({ id: 'mail-account-player-v0', address: 'user@node.mail' })
    expect(first.correspondents).toEqual([
      { id: 'mail-correspondent-nodemail', name: 'NodeMail', address: 'system@node.mail' },
      { id: 'mail-correspondent-mira', name: 'Myra Keller', address: 'mira@vector-node.net' },
    ])
    expect(first.threads).toEqual([
      { id: WELCOME_THREAD_ID, correspondentId: 'mail-correspondent-nodemail', subject: 'Welcome to NodeMail' },
      { id: MYRA_FIRST_CONTACT_THREAD_ID, correspondentId: 'mail-correspondent-mira', subject: 'something for you' },
    ])
    expect(first.messages.map((message) => message.id)).toEqual(['message-0001', 'message-0002'])
    expect(bodies({ mail: first } as GameState, WELCOME_THREAD_ID)).toEqual([
      'Your account user@node.mail is active.\nMessages delivered to this account will appear here.',
    ])
    expect(bodies({ mail: first } as GameState, MYRA_FIRST_CONTACT_THREAD_ID)).toEqual([
      'Maybe I have something you might be interested in.\nLet me know if you want it.',
    ])
    expect(bodies({ mail: first } as GameState, MYRA_FIRST_CONTACT_THREAD_ID)[0]).not.toContain(MYRA_FIRST_TARGET_ADDRESS)
  })

  it('starts with both incoming messages unread', () => {
    const mail = createInitialMailState()
    expect(deriveUnreadMailCount(mail)).toBe(2)
    expect(deriveThreadUnreadCount(mail, WELCOME_THREAD_ID)).toBe(1)
    expect(deriveThreadUnreadCount(mail, MYRA_FIRST_CONTACT_THREAD_ID)).toBe(1)
  })

  it('represents only the welcome thread as read-only correspondence', () => {
    expect(threadAcceptsReply(WELCOME_THREAD_ID)).toBe(false)
    expect(threadAcceptsReply(MYRA_FIRST_CONTACT_THREAD_ID)).toBe(true)
    const refused = sendMailReply(createInitialGameState(), WELCOME_THREAD_ID, 'thanks')
    expect(refused.status).toBe('thread_not_replyable')
    expect(refused.state).toEqual(createInitialGameState())
  })
})

describe('reading mail', () => {
  it('marks only the opened thread read', () => {
    const opened = openMailThread(createInitialGameState(), WELCOME_THREAD_ID)

    expect(deriveThreadUnreadCount(opened.mail, WELCOME_THREAD_ID)).toBe(0)
    expect(deriveThreadUnreadCount(opened.mail, MYRA_FIRST_CONTACT_THREAD_ID)).toBe(1)
    expect(deriveUnreadMailCount(opened.mail)).toBe(1)

    const both = openMailThread(opened, MYRA_FIRST_CONTACT_THREAD_ID)
    expect(deriveUnreadMailCount(both.mail)).toBe(0)
  })

  it('is inert for an already-read thread and for an unknown thread', () => {
    const opened = openMailThread(createInitialGameState(), WELCOME_THREAD_ID)
    expect(openMailThread(opened, WELCOME_THREAD_ID)).toBe(opened)
    expect(openMailThread(opened, 'mail-thread-nonexistent')).toBe(opened)
  })

  it("never counts the player's own messages as unread", () => {
    const sent = send(openMailThread(createInitialGameState(), MYRA_FIRST_CONTACT_THREAD_ID), 'what is the address?')
    const messages = listThreadMessages(sent.mail, MYRA_FIRST_CONTACT_THREAD_ID)

    expect(messages.map((message) => message.sender)).toEqual(['correspondent', 'account', 'correspondent'])
    expect(messages.some((message) => message.sender === 'account' && 'read' in message)).toBe(false)
    expect(deriveUnreadMailCount(sent.mail)).toBe(1) // the still-unopened welcome thread only
    expect(deriveThreadUnreadCount(sent.mail, MYRA_FIRST_CONTACT_THREAD_ID)).toBe(0)
  })

  it('does not report the open conversation as newly unread after a reply arrives', () => {
    const read = openMailThread(createInitialGameState(), MYRA_FIRST_CONTACT_THREAD_ID)
    expect(deriveThreadUnreadCount(send(read, 'yes').mail, MYRA_FIRST_CONTACT_THREAD_ID)).toBe(0)
  })
})

describe('sending mail', () => {
  it("appends exactly the player's text and advances message identity deterministically", () => {
    const state = createInitialGameState()
    const result = sendMailReply(state, MYRA_FIRST_CONTACT_THREAD_ID, 'Myra —\nwhat is the host address?')
    if (result.status !== 'sent') throw new Error(result.status)

    expect(result.playerMessageId).toBe('message-0003')
    expect(result.replyMessageId).toBe('message-0004')
    expect(result.state.mail.nextMessageId).toBe(5)
    expect(listThreadMessages(result.state.mail, MYRA_FIRST_CONTACT_THREAD_ID)[1]).toEqual({
      id: 'message-0003', threadId: MYRA_FIRST_CONTACT_THREAD_ID, sender: 'account', body: 'Myra —\nwhat is the host address?',
    })

    const second = sendMailReply(result.state, MYRA_FIRST_CONTACT_THREAD_ID, 'thanks')
    if (second.status !== 'sent') throw new Error(second.status)
    expect([second.playerMessageId, second.replyMessageId]).toEqual(['message-0005', 'message-0006'])
    expect(second.state.mail.nextMessageId).toBe(7)
  })

  it('refuses an empty or whitespace-only message without changing the mailbox', () => {
    const state = createInitialGameState()
    for (const text of ['', '   ', '\n\n']) {
      const result = sendMailReply(state, MYRA_FIRST_CONTACT_THREAD_ID, text)
      expect(result.status).toBe('empty_message')
      expect(result.state).toBe(state)
    }
    expect(sendMailReply(state, 'mail-thread-nonexistent', 'hello').status).toBe('thread_unavailable')
  })

  it('leaves every other canonical slice untouched', () => {
    const state = createInitialGameState()
    const sent = send(state, 'address?')
    expect({ ...sent, mail: state.mail }).toEqual(state)
  })
})

describe('Myra first-contact correspondence', () => {
  const firstLead = `Alright. First one's free.\nTry ${MYRA_FIRST_TARGET_ADDRESS}.\n\nConsumer endpoint. Small operation.\nThat's all I have.`

  it('answers a small authored set of clear-interest wording with the first lead', () => {
    for (const asked of ['yes', 'Yeah.', "I'm interested", 'send it', 'what do you have?', 'let me see', 'tell me', 'give me the address']) {
      expect(lastReply(send(createInitialGameState(), asked))).toBe(firstLead)
    }
  })

  it('refuses credential wording', () => {
    for (const asked of ['password?', 'send the PASSWD', 'i need credentials', 'what is the login']) {
      expect(lastReply(send(createInitialGameState(), asked))).toBe("I don't have credentials for you.")
    }
  })

  it('does not disclose the lead or invent credentials for a credential request', () => {
    expect(lastReply(send(createInitialGameState(), 'send it with the password'))).toBe("I don't have credentials for you.")
    expect(lastReply(send(createInitialGameState(), 'send it with the password'))).not.toContain(MYRA_FIRST_TARGET_ADDRESS)
  })

  it('keeps unrecognized text as a real message and answers naturally', () => {
    const sent = send(createInitialGameState(), 'been a while. how have you been?')
    expect(bodies(sent, MYRA_FIRST_CONTACT_THREAD_ID)).toContain('been a while. how have you been?')
    expect(lastReply(sent)).toBe('Up to you. Let me know if you want it.')
    expect(lastReply(sent)).not.toMatch(/UNKNOWN|INTENT|PARSE|ERROR/i)
  })

  it('does not match a vocabulary word inside an unrelated word', () => {
    expect(lastReply(send(createInitialGameState(), 'lorem ipsum, hostile addressee, serverless')))
      .toBe('Up to you. Let me know if you want it.')
    expect(lastReply(send(createInitialGameState(), 'interested'))).toBe(firstLead)
  })

  it('reads the real message history rather than a hidden conversation stage', () => {
    const first = send(createInitialGameState(), 'address?')
    const again = send(first, 'sorry — the address again?')
    expect(lastReply(again)).toBe(`Same address as before: ${MYRA_FIRST_TARGET_ADDRESS}.`)

    // Proven by history alone: the same mailbox with that exchange removed answers as a first request again.
    const withoutHistory: GameState = {
      ...again,
      mail: { ...again.mail, messages: again.mail.messages.filter((message) => !message.body.includes(MYRA_FIRST_TARGET_ADDRESS)) },
    }
    expect(lastReply(send(withoutHistory, 'address?'))).toBe(firstLead)
    expect(again.mail).not.toHaveProperty('conversationStage')
    expect(again.mail).not.toHaveProperty('lastIntent')
  })
})

describe('communicated information is not observation', () => {
  it('does not touch Discovery, Knowledge, DeviceAccess or RemoteSession when Myra answers', () => {
    const state = createInitialGameState()
    const sent = send(state, 'interested')

    expect(sent.discovery).toEqual(state.discovery)
    expect(sent.discovery.devices).toEqual([])
    expect(sent.knowledge).toEqual(state.knowledge)
    expect(sent.deviceAccess).toEqual(state.deviceAccess)
    expect(sent.remoteSession).toEqual(state.remoteSession)
    expect(lastReply(sent)).toContain(MYRA_FIRST_TARGET_ADDRESS)
  })

  it('leaves a later legitimate Scan responsible for Device Discovery', () => {
    const mailed = send(createInitialGameState(), 'send it')
    expect(mailed.discovery.devices).not.toContainEqual(expect.objectContaining({ id: 'host-phone-001' }))

    const observation = scanNetworkTarget({ localDevice: mailed.player.localDevice, network: mailed.world.network }, MYRA_FIRST_TARGET_ADDRESS)
    const discovery = rememberScan(mailed.discovery, observation, mailed.player.localDevice.id)
    expect(discovery.devices).toContainEqual(expect.objectContaining({ id: 'host-phone-001', address: MYRA_FIRST_TARGET_ADDRESS }))
  })

  it('keeps a communicated address as a historical snapshot when World Truth changes afterwards', () => {
    const sent = send(createInitialGameState(), 'address?')
    const communicated = sent.mail.messages.map((message: MailMessage) => message.body)

    const worldMoved: GameState = {
      ...sent,
      world: { network: { ...sent.world.network, hosts: sent.world.network.hosts.map((host) =>
        host.ip === MYRA_FIRST_TARGET_ADDRESS ? { ...host, ip: '203.0.113.77' } : host) } },
    }

    expect(worldMoved.world.network.hosts.some((host) => host.ip === MYRA_FIRST_TARGET_ADDRESS)).toBe(false)
    expect(worldMoved.mail.messages.map((message) => message.body)).toEqual(communicated)
    expect(lastReply(worldMoved)).toContain(MYRA_FIRST_TARGET_ADDRESS)

    // And a mailbox with no represented host behind that address still communicates it.
    const emptyWorld: GameState = { ...worldMoved, world: { network: { ...worldMoved.world.network, hosts: [] } } }
    expect(lastReply(send(emptyWorld, 'address again?'))).toContain(MYRA_FIRST_TARGET_ADDRESS)
  })
})
