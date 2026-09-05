import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { openMailThread, sendMailReply } from '../../core/game/mail'
import { MYRA_FIRST_TARGET_ADDRESS, MYRA_FIRST_CONTACT_THREAD_ID } from '../../core/game/myraFirstContactCorrespondence'
import type { GameState, MailCorrespondent, MailMessage, MailThread } from '../../core/game/types'
import { Home } from '../../shell/Home'
import { appEntries } from '../../shell/appRegistry'
import { Mail } from './Mail'
import mailSource from './Mail.tsx?raw'
import composerSource from './MailMessageBody.tsx?raw'
import mailCss from './mail.css?raw'

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

const composer = () => screen.getByRole('textbox', { name: 'Reply to Myra Keller' }) as HTMLTextAreaElement
/** The application surface only, so the state probe rendered beside it never satisfies a query. */
const app = () => document.querySelector('.mail-app') as HTMLElement
const launcher = () => screen.getByRole('button', { name: 'Open NodeMail' })

/** Every inbox entry currently rendered, in presented order. */
const entries = () => Array.from(document.querySelectorAll('.mail-entry')) as HTMLElement[]

/**
 * A deliberately larger mailbox than the two authored threads, used only to
 * prove the presentation scales and degrades. It represents nothing: it is a
 * test fixture over the same canonical shape, so it can carry long names,
 * addresses, subjects and bodies without adding represented correspondence.
 */
function crowdedMailbox(): GameState {
  const base = createInitialGameState()
  const veryLong = 'unbroken-token-'.repeat(14)
  const correspondents: MailCorrespondent[] = Array.from({ length: 10 }, (_, index) => ({
    id: `fixture-correspondent-${index}`,
    name: index === 0 ? `Fixture Correspondent With An Unreasonably Long Represented Name ${veryLong}` : `Fixture Correspondent ${index}`,
    address: index === 0 ? `${veryLong}@fixture-domain.test` : `fixture${index}@fixture-domain.test`,
  }))
  const threads: MailThread[] = correspondents.map((correspondent, index) => ({
    id: `fixture-thread-${index}`,
    correspondentId: correspondent.id,
    subject: index === 0 ? `A subject long enough to need more than one rendered line ${veryLong}` : `Fixture subject ${index}`,
  }))
  const messages: MailMessage[] = threads.map((thread, index) => ({
    id: `fixture-message-${index}`,
    threadId: thread.id,
    sender: 'correspondent' as const,
    correspondentId: thread.correspondentId,
    read: index % 2 === 0,
    body: index === 0 ? `${veryLong}\n\n${'A long paragraph of represented correspondence. '.repeat(24)}` : `Fixture body ${index}`,
  }))

  return {
    ...base,
    mail: {
      ...base.mail,
      correspondents: [...base.mail.correspondents, ...correspondents],
      threads: [...base.mail.threads, ...threads],
      messages: [...base.mail.messages, ...messages],
    },
  }
}

/**
 * The mail slice represents no communication time, so no surface may show a
 * clock, a date, or a relative age — including one a redesign invented for
 * rhythm.
 */
const INVENTED_TIME = /\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2}|\b(?:ago|yesterday|today|just now|delivered at|sent at)\b/i

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

    renderHome(openMailThread(read, 'mail-thread-welcome'))
    expect(within(launcher()).getByText('0 UNREAD')).toBeInTheDocument()

    await userEvent.setup().click(launcher())
    expect(openApp).toHaveBeenCalledWith('mail')
  })
})

describe('Inbox', () => {
  it('presents the mailbox account, both authored threads and their unread state', () => {
    renderMail()
    expect(within(app()).getByText('user@node.mail')).toBeInTheDocument()
    expect(within(app()).getByText('2 UNREAD')).toBeInTheDocument()

    const rows = screen.getAllByRole('button', { name: /^Open / })
    expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual(['NodeMail', 'Myra Keller'])
    expect(within(rows[0]).getByText('Welcome to NodeMail')).toBeInTheDocument()
    expect(within(rows[0]).getByText(/Your account user@node.mail is active/)).toBeInTheDocument()
    expect(within(rows[1]).getByText('something for you')).toBeInTheDocument()
    expect(rows.every((row) => within(row).getByText('UNREAD'))).toBe(true)
    expect(within(app()).queryByText(/MISSION|OBJECTIVE|REWARD|ACCEPT/i)).not.toBeInTheDocument()
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

  it('marks only the opened thread read through the canonical mail operation', async () => {
    const user = userEvent.setup()
    renderMail()
    await user.click(screen.getByRole('button', { name: 'Open Welcome to NodeMail from NodeMail' }))
    await user.click(screen.getByRole('button', { name: 'Back to inbox' }))

    expect(within(app()).getByText('1 UNREAD')).toBeInTheDocument()
    const welcomeRow = screen.getByRole('button', { name: 'Open Welcome to NodeMail from NodeMail' })
    const miraRow = screen.getByRole('button', { name: 'Open something for you from Myra Keller' })
    expect(within(welcomeRow).queryByText('UNREAD')).not.toBeInTheDocument()
    expect(within(miraRow).getByText('UNREAD')).toBeInTheDocument()
    expect(welcomeRow.className).not.toBe(miraRow.className)

    const mail = captured().mail
    expect(mail.messages.filter((message) => message.sender === 'correspondent' && !message.read)).toHaveLength(1)
  })
})

describe('Thread', () => {
  it('presents the system thread as correspondence that cannot be replied to', async () => {
    const user = userEvent.setup()
    renderMail()
    await user.click(screen.getByRole('button', { name: 'Open Welcome to NodeMail from NodeMail' }))

    expect(screen.getByRole('heading', { name: 'Welcome to NodeMail' })).toBeInTheDocument()
    expect(within(app()).getByText('system@node.mail')).toBeInTheDocument()
    expect(within(app()).getByText(/Your account user@node.mail is active/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'SEND' })).not.toBeInTheDocument()
    expect(within(app()).getByText('system@node.mail does not accept replies.')).toBeInTheDocument()
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
    // Myra's thread now holds her opening message, the player's, and her answer.
    expect(within(app()).getByText('MESSAGES').parentElement).toHaveTextContent('3')
    expect(document.querySelectorAll('.mail-message')).toHaveLength(3)
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
  it('reuses the Shell-owned editing presentation instead of adding its own', () => {
    for (const source of [mailSource, composerSource]) {
      expect(source).not.toMatch(/visualViewport|window\.scrollTo|scrollIntoView|autoFocus|\.focus\(\)/)
      expect(source).not.toMatch(/setTimeout\(\s*\(\)\s*=>\s*send|Date\.now\(\)|Math\.random/)
    }
    // Enter is a newline because the draft is a textarea, not because a key handler intercepts it.
    expect(mailSource).toMatch(/<textarea/)
    expect(mailSource).not.toMatch(/onKeyDown|key === 'Enter'/)
    expect(mailSource).toMatch(/data-editing-scroll-owner/)
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

  it('keeps mobile reading and replying within the shared gutter and touch sizes', () => {
    // The scrolling gutter belongs to `.app-content`; the composer action is a shared touch-safe primitive.
    expect(mailCss).not.toMatch(/\.mail-app\s*{[^}]*padding/)
    expect(mailSource).toMatch(/className="node-action" type="submit"/)
    expect(mailCss).toMatch(/@media \(max-width: 480px\)/)
    expect(mailCss).toMatch(/\.mail-message-body\s*{[^}]*overflow-wrap:\s*anywhere/)
    expect(mailCss).toMatch(/\.mail-composer-input\s*{[^}]*width:\s*100%/)
  })
})

describe('inbox hierarchy and scale', () => {
  it('states unread structurally and in words, not by colour alone', async () => {
    const user = userEvent.setup()
    renderMail()

    const [welcome, myra] = entries()
    expect(welcome.className).toContain('mail-entry--unread')
    expect(within(welcome).getByText('UNREAD')).toBeInTheDocument()
    expect(myra.className).toContain('mail-entry--unread')

    await user.click(screen.getByRole('button', { name: 'Open Welcome to NodeMail from NodeMail' }))
    await user.click(screen.getByRole('button', { name: 'Back to inbox' }))

    const read = entries()[0]
    expect(read.className).not.toContain('mail-entry--unread')
    expect(within(read).queryByText('UNREAD')).not.toBeInTheDocument()

    // Three independent signals: the entry's own rule, the value of the type
    // inside it, and the word. Colour blindness must not remove the state.
    const unreadRule = mailCss.match(/\.mail-entry--unread\s*{([^}]*)}/)?.[1] ?? ''
    expect(unreadRule).toMatch(/border-left-color/)
    expect(mailCss).toMatch(/\.mail-entry--unread \.mail-entry-from\s*{[^}]*color/)
  })

  it('reads correspondent, subject and the last thing said as three distinct tiers', () => {
    renderMail()
    const [, myra] = entries()

    // The subject is reading text under the name, not a technical label beside it.
    expect(myra.querySelector('.mail-entry-from')?.textContent).toBe('Myra Keller')
    expect(myra.querySelector('.mail-entry-subject')?.textContent).toBe('something for you')
    expect(myra.querySelector('.mail-preview')?.textContent)
      .toBe('Maybe I have something you might be interested in. Let me know if you want it.')

    // One control per correspondence, so the whole entry is the touch target.
    expect(myra.tagName).toBe('BUTTON')
    expect(myra.querySelectorAll('button')).toHaveLength(0)
    expect(myra.closest('.mail-index')).not.toBeNull()
  })

  it('states when the last contribution in a thread was the player’s own', async () => {
    const user = await openMyraThread()
    expect(document.querySelector('.mail-preview-mark')).toBeNull()

    await user.type(composer(), 'password?')
    await user.click(screen.getByRole('button', { name: 'SEND' }))
    await user.click(screen.getByRole('button', { name: 'Back to inbox' }))
    // Myra answered last, so the mark belongs to nobody yet.
    expect(document.querySelector('.mail-preview-mark')).toBeNull()

    // A thread whose latest canonical message is the player's says so.
    const sent = sendMailReply(createInitialGameState(), MYRA_FIRST_CONTACT_THREAD_ID, 'thinking about it')
    if (sent.status !== 'sent') throw new Error(sent.status)
    const playerLast = { ...sent.state, mail: { ...sent.state.mail, messages: sent.state.mail.messages.slice(0, -1) } }
    cleanup()
    renderMail(playerLast)
    const myra = entries()[1]
    expect(within(myra).getByText('YOU')).toBeInTheDocument()
    expect(myra.querySelector('.mail-preview')?.textContent).toBe('YOUthinking about it')
  })

  it('stays one scannable index when the mailbox holds many more threads', () => {
    renderMail(crowdedMailbox())

    const rows = entries()
    expect(rows).toHaveLength(12)
    expect(document.querySelectorAll('.mail-index')).toHaveLength(1)
    // Represented order is presented order: nothing is re-sorted by an
    // invented chronology or by unread state.
    expect(rows.map((row) => row.querySelector('.mail-entry-subject')?.textContent))
      .toEqual(captured().mail.threads.map((thread) => thread.subject))
    for (const row of rows) {
      expect(row.tagName).toBe('BUTTON')
      expect(row.querySelector('.mail-entry-from')?.textContent).toBeTruthy()
      expect(row.querySelector('.mail-preview')?.textContent).toBeTruthy()
    }
    expect(within(app()).getByText('7 UNREAD')).toBeInTheDocument()
    expect(app().textContent).not.toMatch(INVENTED_TIME)
  })
})

describe('thread presentation', () => {
  it('states both identities the correspondence is between', async () => {
    await openMyraThread()
    expect(screen.getByRole('heading', { name: 'something for you' })).toBeInTheDocument()

    const parties = document.querySelector('.mail-parties') as HTMLElement
    expect(within(parties).getByText('Myra Keller')).toBeInTheDocument()
    expect(within(parties).getByText('mira@vector-node.net')).toBeInTheDocument()
    expect(within(parties).getByText('user@node.mail')).toBeInTheDocument()
    expect(app().textContent).not.toMatch(INVENTED_TIME)
  })

  it('keeps a long correspondence readable without inventing anything about it', async () => {
    const user = userEvent.setup()
    renderMail(crowdedMailbox())
    await user.click(screen.getByRole('button', { name: /^Open A subject long enough/ }))

    const body = document.querySelector('.mail-message-body') as HTMLElement
    expect(body.textContent).toContain('A long paragraph of represented correspondence.')
    expect(app().textContent).not.toMatch(INVENTED_TIME)
    // No authored interaction exists for a fixture thread, so it says so
    // rather than offering a composer that could not send.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(app()).getByText(/does not accept replies\./)).toBeInTheDocument()
  })

  it('lets every long represented string wrap instead of overflowing the surface', () => {
    for (const name of ['mail-entry-from', 'mail-entry-subject', 'mail-preview', 'mail-subject', 'mail-message-body']) {
      expect(mailCss.match(new RegExp(`\\.${name}\\s*{([^}]*)}`))?.[1] ?? '', name)
        .toMatch(/overflow-wrap:\s*anywhere/)
    }
    // The preview stays a projection of one line, clamped rather than clipped mid-word.
    expect(mailCss).toMatch(/\.mail-preview\s*{[^}]*-webkit-line-clamp:\s*2/)
  })
})

describe('navigation and canonical state', () => {
  it('keeps which thread is open out of GameState and changes nothing on the way back', async () => {
    const user = userEvent.setup()
    renderMail()
    const before = captured()

    await user.click(screen.getByRole('button', { name: 'Open something for you from Myra Keller' }))
    const opened = captured()
    await user.click(screen.getByRole('button', { name: 'Back to inbox' }))

    // Opening changed exactly one thing: that thread's incoming read state.
    expect(captured()).toEqual(opened)
    expect({ ...opened, mail: before.mail }).toEqual(before)
    expect(opened.mail.messages.map((message) => message.sender === 'correspondent' && message.read))
      .toEqual([false, true])
    expect({ ...opened.mail, messages: before.mail.messages }).toEqual(before.mail)

    for (const key of ['openThreadId', 'openThread', 'view', 'selectedThreadId']) {
      expect(opened.mail).not.toHaveProperty(key)
      expect(opened).not.toHaveProperty(key)
    }
  })
})
