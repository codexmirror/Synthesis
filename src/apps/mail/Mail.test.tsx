import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { composeMail, deleteMailThreads, openMailThread, sendMailReply } from '../../core/game/mail'
import { MYRA_FIRST_TARGET_ADDRESS, MYRA_FIRST_CONTACT_THREAD_ID } from '../../core/game/myraFirstContactCorrespondence'
import type { GameState } from '../../core/game/types'
import { Home } from '../../shell/Home'
import { appEntries } from '../../shell/appRegistry'
import { Mail } from './Mail'
import mailSource from './Mail.tsx?raw'
import threadSource from './MailThreadView.tsx?raw'
import composeSource from './MailCompose.tsx?raw'
import attachmentsSource from './MailAttachments.tsx?raw'
import bodySource from './MailMessageBody.tsx?raw'
import mailCss from './mail.css?raw'

const MYRA_ADDRESS = 'mira@vector-node.net'

function Capture() {
  return <output data-testid="state">{JSON.stringify(useGameState())}</output>
}

function captured(): GameState {
  return JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState
}

function renderMail(initialState?: GameState) {
  return render(<GameProvider initialState={initialState}><Mail /><Capture /></GameProvider>)
}

async function openMyraThread() {
  const user = userEvent.setup()
  renderMail()
  await user.click(screen.getByRole('button', { name: 'Open something for you from Myra Keller' }))
  return user
}

const composer = () => screen.getByRole('textbox', { name: `Reply to ${MYRA_ADDRESS}` }) as HTMLTextAreaElement
/** The application surface only, so the state probe rendered beside it never satisfies a query. */
const app = () => document.querySelector('.mail-app') as HTMLElement
const launcher = () => screen.getByRole('button', { name: 'Open NodeMail' })
const entries = () => Array.from(document.querySelectorAll('.mail-entry'))

/** One derived mailbox fact from the summary strip. */
function summary(label: string): string {
  const cell = Array.from(document.querySelectorAll('.mail-summary-cell'))
    .find((candidate) => candidate.querySelector('dt')?.textContent === label)
  return cell?.querySelector('dd')?.textContent ?? ''
}

function composedState(state: GameState, subject: string, body = 'Following up.', attachmentFileIds: readonly string[] = []): GameState {
  const result = composeMail(state, { to: MYRA_ADDRESS, subject, body, attachmentFileIds })
  if (result.status !== 'sent') throw new Error(result.status)
  return result.state
}

describe('NodeMail on Home', () => {
  it('is a launcher in the current application order', () => {
    expect(appEntries.map(([id]) => id)).toEqual(['terminal', 'network', 'mail', 'processes', 'files', 'market', 'wallet', 'notes', 'system'])
    render(<GameProvider><Home openApp={vi.fn()} /></GameProvider>)
    expect(screen.getByRole('button', { name: 'Open NodeMail' })).toBeInTheDocument()
  })

  it('derives its launcher value from canonical unread mail rather than a fixed label', async () => {
    const openApp = vi.fn()
    const renderHome = (state?: GameState) => {
      cleanup()
      render(<GameProvider initialState={state}><Home openApp={openApp} /></GameProvider>)
    }

    renderHome()
    expect(within(launcher()).getByText('2 UNREAD')).toBeInTheDocument()

    const read = openMailThread(createInitialGameState(), MYRA_FIRST_CONTACT_THREAD_ID)
    renderHome(read)
    expect(within(launcher()).getByText('1 UNREAD')).toBeInTheDocument()

    const sent = sendMailReply(read, MYRA_FIRST_CONTACT_THREAD_ID, 'address?')
    if (sent.status !== 'sent') throw new Error(sent.status)
    renderHome(sent.state)
    // The reply the player just triggered is not a new unread message.
    expect(within(launcher()).getByText('1 UNREAD')).toBeInTheDocument()

    // A correspondence removed from the mailbox leaves the unread summary with it.
    renderHome(deleteMailThreads(createInitialGameState(), ['mail-thread-welcome']))
    expect(within(launcher()).getByText('1 UNREAD')).toBeInTheDocument()

    renderHome(openMailThread(read, 'mail-thread-welcome'))
    expect(within(launcher()).getByText('0 UNREAD')).toBeInTheDocument()

    await userEvent.setup().click(launcher())
    expect(openApp).toHaveBeenCalledWith('mail')
  })
})

describe('Inbox', () => {
  it('states the mailbox account and what it actually holds', () => {
    renderMail()
    expect(within(app()).getByText('user@node.mail')).toBeInTheDocument()
    expect(summary('UNREAD')).toBe('2')
    expect(summary('CORRESPONDENCE')).toBe('2')
    expect(summary('MESSAGES')).toBe('2')
    expect(within(app()).queryByText(/MISSION|OBJECTIVE|REWARD|ACCEPT/i)).not.toBeInTheDocument()
  })

  it('reads correspondent, subject and the last thing said, with unread stated in words', () => {
    renderMail()
    const rows = screen.getAllByRole('button', { name: /^Open / })
    expect(rows.map((row) => row.querySelector('.mail-entry-from')?.textContent)).toEqual(['NodeMail', 'Myra Keller'])
    expect(within(rows[0]).getByText('Welcome to NodeMail')).toBeInTheDocument()
    expect(within(rows[0]).getByText(/Your account user@node.mail is active/)).toBeInTheDocument()
    expect(within(rows[1]).getByText('something for you')).toBeInTheDocument()
    expect(rows.every((row) => within(row).getByText('UNREAD'))).toBe(true)
  })

  it('projects the preview from canonical message state, not a stored preview field', async () => {
    const user = await openMyraThread()
    await user.type(composer(), 'interested')
    await user.click(screen.getByRole('button', { name: 'SEND' }))
    await user.click(screen.getByRole('button', { name: 'Back to inbox' }))

    const miraRow = screen.getByRole('button', { name: 'Open something for you from Myra Keller' })
    expect(miraRow.querySelector('.mail-preview')?.textContent).toBe(`Alright. First one's free. Try ${MYRA_FIRST_TARGET_ADDRESS}. Consumer endpoint. Small operation. That's all I have.`)
    expect(captured().mail).not.toHaveProperty('threadPreview')
    expect(captured().mail.threads[1]).not.toHaveProperty('preview')
  })

  it("marks the player's own last contribution rather than implying direction", () => {
    const state = composedState(createInitialGameState(), 'about that lead', 'Are you still there?')
    renderMail(state)
    const row = screen.getByRole('button', { name: 'Open about that lead from Myra Keller' })
    expect(within(row).getByText('YOU')).toBeInTheDocument()
    expect(row.querySelector('.mail-preview')?.textContent).toBe('YOUAre you still there?')
  })

  it('marks only the opened thread read through the canonical mail operation', async () => {
    const user = userEvent.setup()
    renderMail()
    await user.click(screen.getByRole('button', { name: 'Open Welcome to NodeMail from NodeMail' }))
    await user.click(screen.getByRole('button', { name: 'Back to inbox' }))

    expect(summary('UNREAD')).toBe('1')
    const welcomeRow = screen.getByRole('button', { name: 'Open Welcome to NodeMail from NodeMail' })
    const miraRow = screen.getByRole('button', { name: 'Open something for you from Myra Keller' })
    expect(within(welcomeRow).queryByText('UNREAD')).not.toBeInTheDocument()
    expect(within(miraRow).getByText('UNREAD')).toBeInTheDocument()
    expect(welcomeRow.className).not.toBe(miraRow.className)

    const mail = captured().mail
    expect(mail.messages.filter((message) => message.sender === 'correspondent' && !message.read)).toHaveLength(1)
  })

  it('stays one scannable column with a substantially larger mailbox and long authored text', () => {
    const longSubject = 'a subject that keeps going '.repeat(8).trim()
    let state = createInitialGameState()
    for (let index = 0; index < 24; index += 1) state = composedState(state, `correspondence ${index}`, `body ${index}`)
    state = composedState(state, longSubject, 'x'.repeat(900))

    renderMail(state)
    expect(entries()).toHaveLength(27)
    expect(summary('CORRESPONDENCE')).toBe('27')
    expect(screen.getByRole('button', { name: `Open ${longSubject} from Myra Keller` })).toBeInTheDocument()
    // Every entry is the same object in the same column, not a card per thread.
    expect(new Set(entries().map((entry) => entry.tagName))).toEqual(new Set(['BUTTON']))
    expect(document.querySelectorAll('.mail-index')).toHaveLength(1)
    expect(mailCss).toMatch(/\.mail-entry-subject\s*{[^}]*overflow-wrap:\s*anywhere/)
    expect(mailCss).toMatch(/\.mail-preview\s*{[^}]*-webkit-line-clamp/)
  })

  it('invents no chronology anywhere on the surface', () => {
    let state = createInitialGameState()
    state = composedState(state, 'about that lead', 'Following up.')
    renderMail(state)
    expect(app().textContent).not.toMatch(/\d{1,2}:\d{2}|\bago\b|\bAM\b|\bPM\b|20\d\d-\d\d|yesterday|today/i)
    expect(app().querySelector('time')).toBeNull()
  })
})

describe('Thread', () => {
  it('presents the system announcement as correspondence nothing can be sent into', async () => {
    const user = userEvent.setup()
    renderMail()
    await user.click(screen.getByRole('button', { name: 'Open Welcome to NodeMail from NodeMail' }))

    expect(screen.getByRole('heading', { name: 'Welcome to NodeMail' })).toBeInTheDocument()
    expect(within(app()).getByText('system@node.mail')).toBeInTheDocument()
    expect(within(app()).getByText(/Your account user@node.mail is active/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'SEND' })).not.toBeInTheDocument()
    expect(within(app()).getByText(/not an open correspondence/)).toBeInTheDocument()
  })

  it('states the correspondence, both parties and what it holds in one header', async () => {
    await openMyraThread()
    const head = app().querySelector('.mail-head') as HTMLElement
    expect(within(head).getByRole('heading', { name: 'something for you' })).toBeInTheDocument()
    expect(within(head).getByText('Myra Keller')).toBeInTheDocument()
    expect(within(head).getByText(MYRA_ADDRESS)).toBeInTheDocument()
    expect(within(head).getByText('user@node.mail')).toBeInTheDocument()
    expect(within(head).getByText('1 MESSAGE')).toBeInTheDocument()
  })

  it('distinguishes the player from the correspondent in the message history', async () => {
    const user = await openMyraThread()
    await user.type(composer(), "I'm interested")
    await user.click(screen.getByRole('button', { name: 'SEND' }))

    const messages = Array.from(document.querySelectorAll('.mail-message'))
    expect(messages.map((message) => message.querySelector('.mail-message-author')?.textContent))
      .toEqual(['Myra Keller', 'YOU', 'Myra Keller'])
    expect(messages[1].className).not.toBe(messages[2].className)
    expect(messages[1]).toHaveTextContent("I'm interested")
    expect(messages[2]).toHaveTextContent("Alright. First one's free. Try 198.51.100.61. Consumer endpoint. Small operation. That's all I have.")
  })

  it('accepts multiline free text, keeps Enter as a newline, and only sends on SEND', async () => {
    const user = await openMyraThread()
    const input = composer()
    expect(input.tagName).toBe('TEXTAREA')
    expect(input).not.toHaveFocus()

    await user.click(input)
    await user.keyboard('Myra —{Enter}send it')
    expect(input.value).toBe('Myra —\nsend it')
    expect(captured().mail.messages).toHaveLength(2)
    expect(document.querySelectorAll('.mail-message')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'SEND' }))
    const messages = captured().mail.messages
    expect(messages).toHaveLength(4)
    expect(messages[2]).toEqual({ id: 'message-0003', threadId: MYRA_FIRST_CONTACT_THREAD_ID, sender: 'account', body: 'Myra —\nsend it' })
    expect(composer().value).toBe('')
  })

  it('keeps SEND unavailable until the player has actually written something', async () => {
    const user = await openMyraThread()
    expect(screen.getByRole('button', { name: 'SEND' })).toBeDisabled()
    await user.type(composer(), '   ')
    expect(screen.getByRole('button', { name: 'SEND' })).toBeDisabled()
    await user.type(composer(), 'yes')
    expect(screen.getByRole('button', { name: 'SEND' })).toBeEnabled()
  })

  it('keeps the whole exchange in history across navigation', async () => {
    const user = await openMyraThread()
    await user.type(composer(), 'password?')
    await user.click(screen.getByRole('button', { name: 'SEND' }))
    await user.click(screen.getByRole('button', { name: 'Back to inbox' }))
    await user.click(screen.getByRole('button', { name: 'Open something for you from Myra Keller' }))

    expect(within(app()).getByText('password?')).toBeInTheDocument()
    expect(within(app()).getByText("I don't have credentials for you.")).toBeInTheDocument()
    expect(within(app()).getByText('3 MESSAGES')).toBeInTheDocument()
    expect(document.querySelectorAll('.mail-message')).toHaveLength(3)
  })

  it('lets a correspondence the player started take further outgoing messages with no answer', async () => {
    const user = userEvent.setup()
    renderMail(composedState(createInitialGameState(), 'about that lead'))
    await user.click(screen.getByRole('button', { name: 'Open about that lead from Myra Keller' }))

    await user.type(screen.getByRole('textbox', { name: `Reply to ${MYRA_ADDRESS}` }), 'Still interested.')
    await user.click(screen.getByRole('button', { name: 'SEND' }))

    const messages = Array.from(document.querySelectorAll('.mail-message'))
    expect(messages.map((message) => message.querySelector('.mail-message-author')?.textContent)).toEqual(['YOU', 'YOU'])
    expect(within(app()).getByText('2 MESSAGES')).toBeInTheDocument()
  })
})

describe('Compose', () => {
  async function openCompose() {
    const user = userEvent.setup()
    renderMail()
    await user.click(screen.getByRole('button', { name: 'COMPOSE' }))
    return user
  }

  const recipient = () => screen.getByRole('textbox', { name: 'TO' }) as HTMLInputElement
  const subject = () => screen.getByRole('textbox', { name: 'SUBJECT' }) as HTMLInputElement
  const message = () => screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement

  it('is a workspace with a recipient, a subject, a message and attachments', async () => {
    await openCompose()
    expect(screen.getByRole('heading', { name: 'New correspondence' })).toBeInTheDocument()
    expect(within(app()).getByText('user@node.mail')).toBeInTheDocument()
    for (const field of [recipient(), subject(), message()]) expect(field).toBeInTheDocument()
    expect(message().tagName).toBe('TEXTAREA')
    expect(screen.getByRole('button', { name: 'ATTACH' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SEND' })).toBeInTheDocument()
    // Nothing is focused merely because Compose opened.
    for (const field of [recipient(), subject(), message()]) expect(field).not.toHaveFocus()
  })

  it('offers the represented correspondents as real choices and resolves what was typed', async () => {
    const user = await openCompose()
    const directory = screen.getByRole('list', { name: 'Represented correspondents' })
    expect(within(directory).getAllByRole('button')).toHaveLength(2)
    expect(within(app()).getByText(/Mail resolves against the correspondents/)).toBeInTheDocument()

    await user.click(within(directory).getByRole('button', { name: /Myra Keller/ }))
    expect(recipient().value).toBe(MYRA_ADDRESS)
    expect(within(app()).getByText('Resolves to Myra Keller.')).toBeInTheDocument()

    await user.clear(recipient())
    await user.type(recipient(), 'stranger@nowhere.net')
    expect(within(app()).getByText(/No correspondent at this address is represented/)).toBeInTheDocument()
  })

  it('creates one correspondence, opens it, and fabricates no answer', async () => {
    const user = await openCompose()
    await user.type(recipient(), MYRA_ADDRESS)
    await user.type(subject(), 'about that lead')
    await user.type(message(), 'Following up.')
    await user.click(screen.getByRole('button', { name: 'SEND' }))

    expect(screen.getByRole('heading', { name: 'about that lead' })).toBeInTheDocument()
    const messages = Array.from(document.querySelectorAll('.mail-message'))
    expect(messages).toHaveLength(1)
    expect(messages[0].querySelector('.mail-message-author')?.textContent).toBe('YOU')

    const mail = captured().mail
    expect(mail.threads.at(-1)).toEqual({ id: 'mail-thread-0001', correspondentId: 'mail-correspondent-mira', subject: 'about that lead' })
    expect(mail.messages.filter((candidate) => candidate.threadId === 'mail-thread-0001')).toHaveLength(1)
  })

  it('refuses an unrepresented recipient truthfully and changes nothing', async () => {
    const user = await openCompose()
    await user.type(recipient(), 'stranger@nowhere.net')
    await user.type(subject(), 'hello')
    await user.type(message(), 'anyone there?')
    const before = captured()
    await user.click(screen.getByRole('button', { name: 'SEND' }))

    expect(within(app()).getByText(/Nothing was sent, and no correspondence was created/)).toBeInTheDocument()
    expect(captured()).toEqual(before)
    expect(captured().mail.correspondents).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'New correspondence' })).toBeInTheDocument()
  })

  it('says what is missing rather than sending an unaddressed or unsubjected correspondence', async () => {
    const user = await openCompose()
    await user.type(message(), 'body only')
    await user.click(screen.getByRole('button', { name: 'SEND' }))
    expect(within(app()).getByText('Address the correspondence before sending.')).toBeInTheDocument()

    await user.type(recipient(), MYRA_ADDRESS)
    await user.click(screen.getByRole('button', { name: 'SEND' }))
    expect(within(app()).getByText('Give the correspondence a subject before sending.')).toBeInTheDocument()
    expect(captured().mail.threads).toHaveLength(2)
  })

  it('leaves the unsent draft behind rather than persisting it', async () => {
    const user = await openCompose()
    await user.type(subject(), 'never sent')
    await user.click(screen.getByRole('button', { name: 'DISCARD' }))

    expect(captured().mail.threads).toHaveLength(2)
    expect(JSON.stringify(captured())).not.toContain('never sent')
    await user.click(screen.getByRole('button', { name: 'COMPOSE' }))
    expect((screen.getByRole('textbox', { name: 'SUBJECT' }) as HTMLInputElement).value).toBe('')
  })
})

describe('Attachments', () => {
  async function attachInCompose(fileName: RegExp) {
    const user = userEvent.setup()
    renderMail()
    await user.click(screen.getByRole('button', { name: 'COMPOSE' }))
    await user.click(screen.getByRole('button', { name: 'ATTACH' }))
    await user.click(screen.getByRole('button', { name: fileName }))
    await user.click(screen.getByRole('button', { name: 'DONE' }))
    return user
  }

  it('selects from real local filesystem truth, by stable File identity', async () => {
    const user = userEvent.setup()
    renderMail()
    await user.click(screen.getByRole('button', { name: 'COMPOSE' }))
    await user.click(screen.getByRole('button', { name: 'ATTACH' }))

    expect(within(app()).getByText('LOCAL FILES · node-01')).toBeInTheDocument()
    const files = Array.from(document.querySelectorAll('.mail-file'))
    expect(files.map((file) => file.querySelector('.mail-file-name')?.textContent))
      .toEqual(['welcome.txt', 'node-miner-1.0.pkg', 'credential-access-1.0.mod', 'deauth.ext', 'nodescan-1.2.pkg'])

    // Kind, size and the provenance the artifact itself states.
    expect(within(files[1] as HTMLElement).getByText('SOFTWARE PACKAGE · 3.4 MB')).toBeInTheDocument()
    expect(within(files[1] as HTMLElement).getByText('NODE Miner 1.0 · unofficial · nm-dev')).toBeInTheDocument()
    expect(within(files[3] as HTMLElement).getByText('FLIPPER EXTENSION · 1.3 MB')).toBeInTheDocument()

    // Selection is a choice, not an action on the file.
    const before = captured()
    await user.click(screen.getByRole('button', { name: /node-miner-1\.0\.pkg/ }))
    expect(screen.getByRole('button', { name: /node-miner-1\.0\.pkg/ })).toHaveAttribute('aria-pressed', 'true')
    expect(captured()).toEqual(before)
  })

  it('stages selection, allows removing it, and sends it as a snapshot', async () => {
    const user = await attachInCompose(/node-miner-1\.0\.pkg/)
    expect(screen.getByRole('button', { name: 'ATTACHMENTS · 1' })).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'TO' }), MYRA_ADDRESS)
    await user.type(screen.getByRole('textbox', { name: 'SUBJECT' }), 'the miner build')
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Here it is.')
    await user.click(screen.getByRole('button', { name: 'SEND' }))

    const attachment = document.querySelector('.mail-attachment') as HTMLElement
    expect(within(attachment).getByText('node-miner-1.0.pkg')).toBeInTheDocument()
    expect(within(attachment).getByText('SOFTWARE PACKAGE · 3.4 MB')).toBeInTheDocument()
    expect(within(attachment).getByText('NODE Miner 1.0 · unofficial · nm-dev')).toBeInTheDocument()

    const sent = captured().mail.messages.at(-1)
    expect(sent?.attachments).toHaveLength(1)
    expect(sent?.attachments?.[0]).toMatchObject({ id: 'attachment-0001', kind: 'software_package', sentName: 'node-miner-1.0.pkg' })
    // The source File is untouched, and nothing was transferred or installed.
    expect(captured().player.localDevice.filesystem).toEqual(createInitialGameState().player.localDevice.filesystem)
    expect(captured().fileTransfer).toEqual(createInitialGameState().fileTransfer)
    expect(captured().process).toEqual(createInitialGameState().process)
  })

  it('removes a staged attachment before it is ever sent', async () => {
    const user = await attachInCompose(/welcome\.txt/)
    await user.click(screen.getByRole('button', { name: 'Remove attachment welcome.txt' }))
    expect(screen.getByRole('button', { name: 'ATTACH' })).toBeInTheDocument()
    expect(document.querySelector('.mail-staged')).toBeNull()
  })

  it('attaches to a reply and shows the text exactly as it was sent', async () => {
    const user = await openMyraThread()
    await user.click(screen.getByRole('button', { name: 'ATTACH' }))
    await user.click(screen.getByRole('button', { name: /welcome\.txt/ }))
    await user.click(screen.getByRole('button', { name: 'DONE' }))
    await user.type(composer(), 'interested')
    await user.click(screen.getByRole('button', { name: 'SEND' }))

    const attachment = document.querySelector('.mail-attachment') as HTMLElement
    expect(within(attachment).getByText('welcome.txt')).toBeInTheDocument()
    expect(within(attachment).getByText('TEXT · 33 B')).toBeInTheDocument()
    expect(screen.queryByText('Welcome to your local filesystem.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show the text sent as welcome.txt' }))
    expect(within(attachment).getByText('Welcome to your local filesystem.')).toBeInTheDocument()

    // Myra's authored answer still follows, and carries nothing of its own.
    const messages = Array.from(document.querySelectorAll('.mail-message'))
    expect(messages).toHaveLength(3)
    expect(messages[2].querySelector('.mail-attachment')).toBeNull()
    // The composer is clear again.
    expect(screen.getByRole('button', { name: 'ATTACH' })).toBeInTheDocument()
  })

  it('states attachment presence on the inbox entry without an action of its own', () => {
    const state = composedState(createInitialGameState(), 'the miner build', 'Here it is.', ['file-0002'])
    renderMail(state)
    const row = screen.getByRole('button', { name: 'Open the miner build from Myra Keller' })
    expect(within(row).getByLabelText('1 sent attachment')).toBeInTheDocument()
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it('offers nothing that would open, install, transfer or re-download a sent attachment', async () => {
    const user = userEvent.setup()
    renderMail(composedState(createInitialGameState(), 'the miner build', 'Here it is.', ['file-0002', 'file-0004']))
    await user.click(screen.getByRole('button', { name: 'Open the miner build from Myra Keller' }))
    const attachments = document.querySelector('.mail-sent-attachments') as HTMLElement
    expect(within(attachments).queryByRole('button', { name: /install|download|open|save|transfer|run/i })).toBeNull()
    expect(attachments.textContent).not.toContain('/home/user')
  })
})

describe('Removing correspondence', () => {
  it('removes the open correspondence after an in-application confirmation', async () => {
    const user = await openMyraThread()
    await user.click(screen.getByRole('button', { name: 'DELETE' }))

    expect(within(app()).getByText('Remove “something for you” from this mailbox?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'KEEP' }))
    expect(within(app()).queryByText(/Remove “something for you”/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'DELETE' }))
    await user.click(screen.getByRole('button', { name: 'REMOVE' }))

    expect(screen.queryByRole('button', { name: 'Open something for you from Myra Keller' })).not.toBeInTheDocument()
    expect(summary('CORRESPONDENCE')).toBe('1')
    expect(summary('UNREAD')).toBe('1')

    // History is kept; only mailbox presence changed.
    const mail = captured().mail
    expect(mail.deletedThreadIds).toEqual([MYRA_FIRST_CONTACT_THREAD_ID])
    expect(mail.threads).toHaveLength(2)
    expect(mail.messages).toHaveLength(2)
  })

  it('removes several correspondences from the inbox through an explicit selection mode', async () => {
    const user = userEvent.setup()
    renderMail(composedState(createInitialGameState(), 'about that lead'))
    await user.click(screen.getByRole('button', { name: 'SELECT' }))

    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull()
    expect(within(app()).getByText('0 SELECTED')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'DELETE' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Select Welcome to NodeMail from NodeMail' }))
    await user.click(screen.getByRole('button', { name: 'Select about that lead from Myra Keller' }))
    expect(within(app()).getByText('2 SELECTED')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'DELETE' }))
    expect(within(app()).getByText('Remove 2 correspondences from this mailbox?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'REMOVE' }))

    expect(entries()).toHaveLength(1)
    expect(summary('CORRESPONDENCE')).toBe('1')
    expect(captured().mail.deletedThreadIds).toEqual(['mail-thread-welcome', 'mail-thread-0001'])
    // Selection mode ends with the removal rather than staying armed.
    expect(screen.getByRole('button', { name: 'COMPOSE' })).toBeInTheDocument()
  })

  it('leaves the source Files of a removed correspondence on the Device', async () => {
    const user = userEvent.setup()
    renderMail(composedState(createInitialGameState(), 'the miner build', 'Here it is.', ['file-0002']))
    await user.click(screen.getByRole('button', { name: 'Open the miner build from Myra Keller' }))
    await user.click(screen.getByRole('button', { name: 'DELETE' }))
    await user.click(screen.getByRole('button', { name: 'REMOVE' }))

    expect(captured().player.localDevice.filesystem).toEqual(createInitialGameState().player.localDevice.filesystem)
    expect(captured().discovery).toEqual(createInitialGameState().discovery)
  })

  it('says the mailbox is empty rather than showing an empty column', async () => {
    const user = userEvent.setup()
    renderMail(deleteMailThreads(createInitialGameState(), ['mail-thread-welcome', MYRA_FIRST_CONTACT_THREAD_ID]))
    expect(within(app()).getByText('NO CORRESPONDENCE')).toBeInTheDocument()
    expect(within(app()).getByText(/Nothing is in the active mailbox for user@node.mail/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SELECT' })).toBeDisabled()
    // Compose is still the way out of an empty mailbox.
    await user.click(screen.getByRole('button', { name: 'COMPOSE' }))
    expect(screen.getByRole('heading', { name: 'New correspondence' })).toBeInTheDocument()
  })
})

describe('communicated address affordance', () => {
  it('offers copying the communicated address and nothing that acts on the World', async () => {
    const user = await openMyraThread()
    await user.type(composer(), 'address?')
    await user.click(screen.getByRole('button', { name: 'SEND' }))

    const address = screen.getByRole('button', { name: `Copy address ${MYRA_FIRST_TARGET_ADDRESS}` })
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    const before = captured()
    await user.click(address)
    expect(writeText).toHaveBeenCalledExactlyOnceWith(MYRA_FIRST_TARGET_ADDRESS)
    expect(captured()).toEqual(before)
    expect(captured().discovery).toEqual(createInitialGameState().discovery)

    // The address is copyable text, not a scan, connect, or open control.
    expect(screen.queryByRole('button', { name: /scan|inspect|analyze|connect|open target/i })).not.toBeInTheDocument()
    expect(address.closest('.mail-message-body')).not.toBeNull()
  })

  it('leaves ordinary message text alone', async () => {
    const user = userEvent.setup()
    renderMail()
    await user.click(screen.getByRole('button', { name: 'Open Welcome to NodeMail from NodeMail' }))
    expect(screen.queryByRole('button', { name: /^Copy address/ })).not.toBeInTheDocument()
  })
})

describe('NodeMail presentation contract', () => {
  const applicationSources = [mailSource, threadSource, composeSource, attachmentsSource, bodySource]

  it('reuses the Shell-owned editing presentation instead of adding its own', () => {
    for (const source of applicationSources) {
      expect(source).not.toMatch(/visualViewport|window\.scrollTo|scrollIntoView|autoFocus|\.focus\(\)/)
      expect(source).not.toMatch(/setTimeout\(\s*\(\)\s*=>\s*send|Date\.now\(\)|Math\.random/)
    }
    // Enter is a newline because the draft is a textarea, not because a key handler intercepts it.
    expect(threadSource).toMatch(/<textarea/)
    expect(composeSource).toMatch(/<textarea/)
    for (const source of applicationSources) expect(source).not.toMatch(/onKeyDown|key === 'Enter'/)
    expect(mailCss).not.toMatch(/env\(safe-area-inset/)
  })

  it('lets the correspondence and a long draft each own their scrolling while editing', async () => {
    // While the Shell is in editing presentation a vertical gesture outside a
    // declared scroll owner is refused, so re-reading the thread mid-reply
    // depends on the thread surface declaring itself one.
    await openMyraThread()
    const surface = app()
    expect(surface).toHaveAttribute('data-editing-scroll-owner')
    expect(composer()).toHaveAttribute('data-editing-scroll-owner')
    expect(composer().closest('[data-editing-scroll-owner]')).toBe(composer())
    expect(document.querySelector('.mail-messages')?.closest('[data-editing-scroll-owner]')).toBe(surface)
  })

  it('gives the compose surface the same two scrolling regions', async () => {
    const user = userEvent.setup()
    renderMail()
    await user.click(screen.getByRole('button', { name: 'COMPOSE' }))
    const body = screen.getByRole('textbox', { name: 'Message' })
    expect(app()).toHaveAttribute('data-editing-scroll-owner')
    expect(body).toHaveAttribute('data-editing-scroll-owner')
    // And the send controls stay docked to the bottom edge rather than below a long draft.
    expect(document.querySelector('.mail-actionbar--sticky')).not.toBeNull()
    expect(mailCss).toMatch(/\.mail-actionbar--sticky\s*{[^}]*position:\s*sticky/)
  })

  it('keeps mobile reading, writing and attaching within the shared gutter and touch sizes', () => {
    // The scrolling gutter belongs to `.app-content`; the actions are shared touch-safe primitives.
    expect(mailCss).not.toMatch(/\.mail-app\s*{[^}]*padding/)
    expect(threadSource).toMatch(/className="node-action mail-action--primary" type="submit"/)
    expect(mailCss).toMatch(/@media \(max-width: 480px\)/)
    expect(mailCss).toMatch(/\.mail-message-body\s*{[^}]*overflow-wrap:\s*anywhere/)
    expect(mailCss).toMatch(/\.mail-composer-input\s*{[^}]*width:\s*100%/)
    // Neither composer tool becomes a full-width slab on a narrow viewport.
    expect(mailCss).toMatch(/\.mail-composer-tools \.node-action\s*{[^}]*flex:\s*none/)
  })

  it('implies no mechanic NodeMail does not have', () => {
    const surfaces = applicationSources.join('\n')
    expect(surfaces).not.toMatch(/\b(?:ARCHIVE|SPAM|STARRED?|FORWARD|DRAFTS?|CC|BCC|LABELS?|TRASH|SEARCH|NOTIFICATIONS?)\b/)
    expect(surfaces).not.toMatch(/FileTransfer|startRemoteFile|fileTransfer|networkActivity/)
  })
})
