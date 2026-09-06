import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import {
  composeMail,
  createInitialMailState,
  deleteMailThreads,
  deriveThreadAttachmentCount,
  deriveThreadUnreadCount,
  deriveUnreadMailCount,
  findLatestThreadMessage,
  isMailThreadDeleted,
  listActiveMailThreads,
  listThreadMessages,
  openMailThread,
  resolveMailRecipient,
  sendMailReply,
  threadAcceptsReply,
  WELCOME_THREAD_ID,
} from './mail'
import { NODEMAIL_SYSTEM_CORRESPONDENT_ADDRESS } from './mail'
import { snapshotMailAttachment } from './mailAttachments'
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

  it('allocates no runtime thread, attachment or deletion state before anything happens', () => {
    const mail = createInitialMailState()
    expect(mail.nextThreadId).toBe(1)
    expect(mail.nextAttachmentId).toBe(1)
    expect(mail.deletedThreadIds).toEqual([])
    expect(listActiveMailThreads(mail).map((thread) => thread.id)).toEqual([WELCOME_THREAD_ID, MYRA_FIRST_CONTACT_THREAD_ID])
    expect(mail.messages.some((message) => 'attachments' in message)).toBe(false)
  })

  it('represents only the welcome thread as read-only correspondence', () => {
    const mail = createInitialMailState()
    expect(threadAcceptsReply(mail, WELCOME_THREAD_ID)).toBe(false)
    expect(threadAcceptsReply(mail, MYRA_FIRST_CONTACT_THREAD_ID)).toBe(true)
    expect(threadAcceptsReply(mail, 'mail-thread-nonexistent')).toBe(false)
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

/*
 * Runtime correspondence, attachments and mailbox deletion.
 *
 * These cover the operations the player now has over their own mailbox, and
 * the boundaries they must not cross: no fabricated correspondent, no answer
 * nobody authored, no filesystem mutation, and no history rewritten by
 * removing something from the inbox.
 */

const MYRA_ADDRESS = 'mira@vector-node.net'

function localFiles(state: GameState) {
  return state.player.localDevice.filesystem.files
}

/** Extra represented artifact kinds the authored starting Device does not happen to hold. */
function withExtraLocalFiles(state: GameState): GameState {
  const filesystem = state.player.localDevice.filesystem
  return {
    ...state,
    player: {
      ...state.player,
      localDevice: {
        ...state.player.localDevice,
        filesystem: {
          nextFileId: filesystem.nextFileId + 3,
          files: [
            ...filesystem.files,
            { kind: 'executable', id: 'file-0101', path: '/home/user/tools/rattler', programId: 'rattler', releaseId: 'rattler-1.0', buildId: 'build-rattler-1.0-v0', name: 'RATTLER', version: '1.0', sizeBytes: 2_100_000 },
            { kind: 'firmware_package', id: 'file-0102', path: '/home/user/downloads/rack-os-1.1.fw', firmwareId: 'firmware-rack-os', buildId: 'build-rack-os-1.1-v0', name: 'RACK-OS', version: '1.1', publisher: 'rack-systems', sizeBytes: 8_800_000 },
            { kind: 'rattler_payload', id: 'file-0103', path: '/home/user/payloads/rattler-198.51.100.61.bin', sizeBytes: 640_000, rattlerReleaseId: 'rattler-1.0', rattlerBuildId: 'build-rattler-1.0-v0', targetDeviceId: 'host-phone-001', targetAddressSnapshot: '198.51.100.61' },
          ],
        },
      },
    },
  }
}

function composed(state: GameState, input: Partial<Parameters<typeof composeMail>[1]> = {}) {
  const result = composeMail(state, { to: MYRA_ADDRESS, subject: 'about that lead', body: 'Following up.', ...input })
  if (result.status !== 'sent') throw new Error(result.status)
  return result
}

describe('resolving a recipient', () => {
  it('resolves only addresses the mailbox already represents', () => {
    const mail = createInitialMailState()
    expect(resolveMailRecipient(mail, MYRA_ADDRESS)?.id).toBe('mail-correspondent-mira')
    expect(resolveMailRecipient(mail, `  ${MYRA_ADDRESS.toUpperCase()} `)?.id).toBe('mail-correspondent-mira')
    expect(resolveMailRecipient(mail, NODEMAIL_SYSTEM_CORRESPONDENT_ADDRESS)?.id).toBe('mail-correspondent-nodemail')
    expect(resolveMailRecipient(mail, 'someone@elsewhere.net')).toBeUndefined()
    expect(resolveMailRecipient(mail, '')).toBeUndefined()
    // The account's own address is not a correspondent.
    expect(resolveMailRecipient(mail, mail.account.address)).toBeUndefined()
  })
})

describe('composing a new correspondence', () => {
  it('creates one thread with deterministic mailbox-local identity and exactly one outgoing message', () => {
    const state = createInitialGameState()
    const first = composed(state)

    expect(first.threadId).toBe('mail-thread-0001')
    expect(first.messageId).toBe('message-0003')
    expect(first.state.mail.nextThreadId).toBe(2)
    expect(first.state.mail.threads.at(-1)).toEqual({
      id: 'mail-thread-0001', correspondentId: 'mail-correspondent-mira', subject: 'about that lead',
    })
    expect(listThreadMessages(first.state.mail, first.threadId)).toEqual([
      { id: 'message-0003', threadId: 'mail-thread-0001', sender: 'account', body: 'Following up.' },
    ])

    // Identity comes from the mailbox counter, not the subject or the address.
    const second = composed(first.state, { subject: 'about that lead' })
    expect(second.threadId).toBe('mail-thread-0002')
    expect(second.state.mail.nextThreadId).toBe(3)

    // Existing authored identities are untouched.
    expect(second.state.mail.threads.slice(0, 2).map((thread) => thread.id))
      .toEqual([WELCOME_THREAD_ID, MYRA_FIRST_CONTACT_THREAD_ID])
  })

  it('fabricates nothing for an address no represented correspondent carries', () => {
    const state = createInitialGameState()
    for (const to of ['stranger@nowhere.net', '', '   ', state.mail.account.address]) {
      const result = composeMail(state, { to, subject: 'hello', body: 'anyone there?' })
      expect(result.status === 'unknown_recipient' || result.status === 'empty_recipient').toBe(true)
      expect(result.state).toBe(state)
    }
    expect(createInitialGameState().mail.correspondents).toHaveLength(2)
  })

  it('refuses an unsubjected or empty message without creating a thread', () => {
    const state = createInitialGameState()
    expect(composeMail(state, { to: MYRA_ADDRESS, subject: '  ', body: 'text' }).status).toBe('empty_subject')
    expect(composeMail(state, { to: MYRA_ADDRESS, subject: 'subject', body: '  \n ' }).status).toBe('empty_message')
    expect(composeMail(state, { to: MYRA_ADDRESS, subject: '  ', body: 'text' }).state).toBe(state)
    expect(composeMail(state, { to: MYRA_ADDRESS, subject: 'subject', body: ' ' }).state).toBe(state)
  })

  it('never fabricates an answer to a correspondence the player started', () => {
    const sent = composed(createInitialGameState(), { body: 'yes, send it, what is the address?' })
    const messages = listThreadMessages(sent.state.mail, sent.threadId)
    expect(messages.map((message) => message.sender)).toEqual(['account'])
    expect(deriveUnreadMailCount(sent.state.mail)).toBe(2) // the two authored unread messages only
  })

  it('accepts further outgoing messages in a runtime-created thread without an answer', () => {
    const first = composed(createInitialGameState())
    expect(threadAcceptsReply(first.state.mail, first.threadId)).toBe(true)

    const again = sendMailReply(first.state, first.threadId, 'Still interested.')
    if (again.status !== 'sent') throw new Error(again.status)
    expect(again.replyMessageId).toBeUndefined()
    expect(listThreadMessages(again.state.mail, first.threadId).map((message) => message.sender)).toEqual(['account', 'account'])
    expect(again.state.mail.nextMessageId).toBe(5)
    expect(deriveThreadUnreadCount(again.state.mail, first.threadId)).toBe(0)
  })

  it('leaves every other canonical slice untouched', () => {
    const state = createInitialGameState()
    const sent = composed(state)
    expect({ ...sent.state, mail: state.mail }).toEqual(state)
  })
})

describe('attaching represented local files', () => {
  it('snapshots what was actually sent for materially different artifact kinds', () => {
    const state = withExtraLocalFiles(createInitialGameState())
    const sent = composed(state, { attachmentFileIds: ['file-0001', 'file-0002', 'file-0003', 'file-0102', 'file-0103'] })
    const message = listThreadMessages(sent.state.mail, sent.threadId)[0]

    expect(message.attachments?.map((attachment) => attachment.id))
      .toEqual(['attachment-0001', 'attachment-0002', 'attachment-0003', 'attachment-0004', 'attachment-0005'])
    expect(sent.state.mail.nextAttachmentId).toBe(6)

    expect(message.attachments?.[0]).toEqual({
      id: 'attachment-0001', kind: 'text', sentName: 'welcome.txt', sizeBytes: 33,
      content: 'Welcome to your local filesystem.',
    })
    expect(message.attachments?.[1]).toMatchObject({
      kind: 'software_package', sentName: 'node-miner-1.0.pkg', productId: 'node-miner',
      productName: 'NODE Miner', version: '1.0', sizeBytes: 3_400_000,
    })
    expect(message.attachments?.[2]).toMatchObject({ kind: 'software_module', hostProductId: 'flipper', moduleId: 'credential-access' })
    expect(message.attachments?.[3]).toMatchObject({ kind: 'firmware_package', firmwareId: 'firmware-rack-os', buildId: 'build-rack-os-1.1-v0', firmwareName: 'RACK-OS' })
    expect(message.attachments?.[4]).toMatchObject({ kind: 'rattler_payload', targetDeviceId: 'host-phone-001', targetAddressSnapshot: '198.51.100.61' })

    // A snapshot is not a file: it carries no source File identity or location to resolve.
    for (const attachment of message.attachments ?? []) {
      expect(attachment).not.toHaveProperty('path')
      expect(attachment).not.toHaveProperty('sourceFileId')
    }
    expect(deriveThreadAttachmentCount(sent.state.mail, sent.threadId)).toBe(5)
  })

  it('describes an executable and a Flipper extension as what they actually are', () => {
    const state = withExtraLocalFiles(createInitialGameState())
    const sent = composed(state, { attachmentFileIds: ['file-0101', 'file-0004'] })
    const attachments = listThreadMessages(sent.state.mail, sent.threadId)[0].attachments ?? []
    expect(attachments[0]).toMatchObject({ kind: 'executable', programId: 'rattler', programName: 'RATTLER', sentName: 'rattler' })
    expect(attachments[1]).toMatchObject({ kind: 'deauth_extension', extensionId: 'deauth', hostProductId: 'flipper', sentName: 'deauth.ext' })
  })

  it('does not mutate, consume or move the source File, and starts no transfer, process or activity', () => {
    const state = withExtraLocalFiles(createInitialGameState())
    const sent = composed(state, { attachmentFileIds: ['file-0001', 'file-0002'] })

    expect(sent.state.player.localDevice.filesystem).toEqual(state.player.localDevice.filesystem)
    expect(sent.state.fileTransfer).toEqual(state.fileTransfer)
    expect(sent.state.process).toEqual(state.process)
    expect(sent.state.recentActivity).toEqual(state.recentActivity)
    expect(sent.state.player.localDevice.installedSoftware).toEqual(state.player.localDevice.installedSoftware)
    expect(sent.state.discovery).toEqual(state.discovery)
    expect(sent.state.knowledge).toEqual(state.knowledge)
    expect(sent.state.deviceAccess).toEqual(state.deviceAccess)
  })

  it('keeps a sent attachment historically true after the source File changes or disappears', () => {
    const state = withExtraLocalFiles(createInitialGameState())
    const sent = composed(state, { attachmentFileIds: ['file-0001', 'file-0002'] })
    const communicated = listThreadMessages(sent.state.mail, sent.threadId)[0].attachments

    const filesystemMoved: GameState = {
      ...sent.state,
      player: {
        ...sent.state.player,
        localDevice: {
          ...sent.state.player.localDevice,
          filesystem: {
            ...sent.state.player.localDevice.filesystem,
            files: localFiles(sent.state)
              .filter((file) => file.id !== 'file-0002')
              .map((file) => file.id === 'file-0001' && file.kind === 'text'
                ? { ...file, path: '/home/user/notes/renamed.txt', content: 'Completely different text.' }
                : file),
          },
        },
      },
    }

    expect(localFiles(filesystemMoved).some((file) => file.id === 'file-0002')).toBe(false)
    expect(listThreadMessages(filesystemMoved.mail, sent.threadId)[0].attachments).toEqual(communicated)
    expect(listThreadMessages(filesystemMoved.mail, sent.threadId)[0].attachments?.[0]).toMatchObject({
      sentName: 'welcome.txt', content: 'Welcome to your local filesystem.',
    })
  })

  it('refuses the whole send when a selected File no longer resolves', () => {
    const state = createInitialGameState()
    const refused = composeMail(state, { to: MYRA_ADDRESS, subject: 'subject', body: 'text', attachmentFileIds: ['file-0002', 'file-9999'] })
    expect(refused.status).toBe('attachment_unavailable')
    expect(refused.state).toBe(state)

    const refusedReply = sendMailReply(state, MYRA_FIRST_CONTACT_THREAD_ID, 'here you go', ['file-9999'])
    expect(refusedReply.status).toBe('attachment_unavailable')
    expect(refusedReply.state).toBe(state)
  })

  it('attaches to a reply into the authored correspondence without disturbing the authored answer', () => {
    const state = createInitialGameState()
    const result = sendMailReply(state, MYRA_FIRST_CONTACT_THREAD_ID, 'interested', ['file-0002'])
    if (result.status !== 'sent') throw new Error(result.status)

    const messages = listThreadMessages(result.state.mail, MYRA_FIRST_CONTACT_THREAD_ID)
    expect(messages[1].attachments).toHaveLength(1)
    expect(messages[2].attachments).toBeUndefined()
    expect(messages[2].body).toContain(MYRA_FIRST_TARGET_ADDRESS)
    expect(result.state.player.localDevice.filesystem).toEqual(state.player.localDevice.filesystem)
  })

  it('snapshots the same artifact twice as two distinct sent attachments', () => {
    const first = composed(createInitialGameState(), { attachmentFileIds: ['file-0002'] })
    const second = composed(first.state, { attachmentFileIds: ['file-0002'] })
    const a = listThreadMessages(second.state.mail, first.threadId)[0].attachments?.[0]
    const b = listThreadMessages(second.state.mail, second.threadId)[0].attachments?.[0]
    expect(a?.id).toBe('attachment-0001')
    expect(b?.id).toBe('attachment-0002')
    expect({ ...a, id: '' }).toEqual({ ...b, id: '' })
  })

  it('snapshots one artifact once even when it is selected twice', () => {
    const sent = composed(createInitialGameState(), { attachmentFileIds: ['file-0002', 'file-0002'] })
    expect(listThreadMessages(sent.state.mail, sent.threadId)[0].attachments).toHaveLength(1)
    expect(sent.state.mail.nextAttachmentId).toBe(2)
  })

  it('computes a text attachment size from the content it actually sent', () => {
    const file = localFiles(createInitialGameState()).find((candidate) => candidate.id === 'file-0001')!
    expect(snapshotMailAttachment(file, 'attachment-0001')).toMatchObject({ sizeBytes: 33, sentName: 'welcome.txt' })
  })
})

describe('removing correspondence from the active mailbox', () => {
  it('removes it from the active inbox and the unread summary without rewriting history', () => {
    const state = createInitialGameState()
    const removed = deleteMailThreads(state, [MYRA_FIRST_CONTACT_THREAD_ID])

    expect(isMailThreadDeleted(removed.mail, MYRA_FIRST_CONTACT_THREAD_ID)).toBe(true)
    expect(listActiveMailThreads(removed.mail).map((thread) => thread.id)).toEqual([WELCOME_THREAD_ID])
    expect(deriveUnreadMailCount(removed.mail)).toBe(1)

    // History is deliberately retained exactly as it was.
    expect(removed.mail.messages).toEqual(state.mail.messages)
    expect(removed.mail.threads).toEqual(state.mail.threads)
    expect(listThreadMessages(removed.mail, MYRA_FIRST_CONTACT_THREAD_ID)).toHaveLength(1)
    expect(deriveThreadUnreadCount(removed.mail, MYRA_FIRST_CONTACT_THREAD_ID)).toBe(1)
  })

  it('does not rewrite what Myra already said, or anything her answer already caused', () => {
    const answered = send(createInitialGameState(), 'address?')
    const communicated = answered.mail.messages.map((message: MailMessage) => message.body)
    const removed = deleteMailThreads(answered, [MYRA_FIRST_CONTACT_THREAD_ID])

    expect(removed.mail.messages.map((message) => message.body)).toEqual(communicated)
    expect(removed.mail.messages.some((message) => message.body.includes(MYRA_FIRST_TARGET_ADDRESS))).toBe(true)
    expect(removed.discovery).toEqual(answered.discovery)
    expect(removed.knowledge).toEqual(answered.knowledge)
    expect(removed.deviceAccess).toEqual(answered.deviceAccess)
    expect({ ...removed, mail: answered.mail }).toEqual(answered)
  })

  it('leaves the source Files of a sent attachment untouched', () => {
    const state = withExtraLocalFiles(createInitialGameState())
    const sent = composed(state, { attachmentFileIds: ['file-0001', 'file-0002'] })
    const removed = deleteMailThreads(sent.state, [sent.threadId])

    expect(removed.player.localDevice.filesystem).toEqual(state.player.localDevice.filesystem)
    expect(localFiles(removed).map((file) => file.id)).toContain('file-0002')
    expect(listThreadMessages(removed.mail, sent.threadId)[0].attachments).toHaveLength(2)
  })

  it('removes several at once, ignores unknown and already-removed threads, and never rewinds', () => {
    const state = createInitialGameState()
    const both = deleteMailThreads(state, [WELCOME_THREAD_ID, MYRA_FIRST_CONTACT_THREAD_ID, WELCOME_THREAD_ID])
    expect(both.mail.deletedThreadIds).toEqual([WELCOME_THREAD_ID, MYRA_FIRST_CONTACT_THREAD_ID])
    expect(listActiveMailThreads(both.mail)).toEqual([])
    expect(deriveUnreadMailCount(both.mail)).toBe(0)

    expect(deleteMailThreads(both, [WELCOME_THREAD_ID])).toBe(both)
    expect(deleteMailThreads(state, ['mail-thread-nonexistent'])).toBe(state)
  })

  it('accepts nothing into a correspondence that is no longer in the mailbox', () => {
    const removed = deleteMailThreads(createInitialGameState(), [MYRA_FIRST_CONTACT_THREAD_ID])
    expect(threadAcceptsReply(removed.mail, MYRA_FIRST_CONTACT_THREAD_ID)).toBe(false)
    const refused = sendMailReply(removed, MYRA_FIRST_CONTACT_THREAD_ID, 'still there?')
    expect(refused.status).toBe('thread_not_replyable')
    expect(refused.state).toBe(removed)
  })

  it('keeps mailbox identity allocation monotonic across a removal', () => {
    const first = composed(createInitialGameState())
    const removed = deleteMailThreads(first.state, [first.threadId])
    const second = composed(removed)
    expect(second.threadId).toBe('mail-thread-0002')
    expect(second.state.mail.nextThreadId).toBe(3)
  })
})
