import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { openMailThread, sendMailReply } from '../../core/game/mail'
import { MYRA_FIRST_TARGET_ADDRESS, MYRA_FIRST_CONTACT_THREAD_ID } from '../../core/game/myraFirstContactCorrespondence'
import type { GameState } from '../../core/game/types'
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
