import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { connectRemoteFromObservation } from '../../core/game/remoteSession'
import { createInitialGameState } from '../../core/game/initialState'
import { Shell } from '../../shell/Shell'
import { Wallet } from '../wallet/Wallet'
import type { GameState } from '../../core/game/types'
import type { EditingViewportState } from '../../shell/useEditingViewport'

let viewport: EditingViewportState
const endEditing = vi.fn()
vi.mock('../../shell/useEditingViewport', () => ({
  useEditingViewport: () => ({ ...viewport, endEditing }),
}))

const PHONE_DEVICE_ID = 'host-phone-001'
const PHONE_ADDRESS = '198.51.100.61'
const PHONE_ACCOUNT_ID = 'dollar-account-veyra-phone-v0'
const PHONE_REFERENCE = 'CD-3318-2204'
const PLAYER_REFERENCE = 'CD-1042-7781'

/** An entered-Session world for the represented VEYRA phone, reached the way the game reaches it. */
function phoneConnectedState(state = createInitialGameState()): GameState {
  const accessed: GameState = {
    ...state,
    deviceAccess: { nextId: 2, established: [{
      id: 'access-phone', sourceDeviceId: state.player.localDevice.id,
      targetDeviceId: PHONE_DEVICE_ID, viaServiceId: 'service-ssh-003', privilege: 'USER',
    }] },
  }
  return connectRemoteFromObservation(accessed, { targetDeviceId: PHONE_DEVICE_ID, address: PHONE_ADDRESS }).state
}

function State() {
  return <output data-testid="state">{JSON.stringify(useGameState())}</output>
}

const canonical = (): GameState => JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState
const accountBalance = (state: GameState, accountId: string) => state.dollarFinance.accounts.find(({ id }) => id === accountId)!.balanceCents
const phoneSurface = () => screen.getByLabelText('VEYRA OS personal device environment')
/** Everything the phone's owner would see, excluding the Shell's operating-context frame. */
const ownerFacing = () => phoneSurface().querySelector('.veyra-viewport') as HTMLElement

async function enterPhone(state = phoneConnectedState()) {
  const user = userEvent.setup()
  render(<GameProvider initialState={state}><Shell /><State /></GameProvider>)
  await user.click(screen.getByRole('button', { name: 'ENTER VEYRA OS →' }))
  return user
}

beforeEach(() => {
  endEditing.mockClear()
  viewport = {
    hostHeight: 780, editTop: 0, editHeight: 780, editing: false,
    editingPresentation: false, presentationPhase: 'normal',
    targetViewportTop: 0, shellTop: 0, shellBottom: 780,
    presentationTop: 0, presentationHeight: 780, recoveryReady: true,
    viewportLifecycle: 'active',
  }
})

describe('VEYRA Home', () => {
  it('is an ordinary launcher of icon-and-label applications', async () => {
    await enterPhone()
    const home = screen.getByRole('region', { name: 'Home' })

    const apps = within(home).getAllByRole('button')
    expect(apps.map((app) => app.textContent)).toEqual(['Wallet', 'Settings'])
    // Icons are decoration beside a real label, never the control itself.
    for (const app of apps) {
      expect(app.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      expect(app.querySelector('.veyra-app__label')?.textContent).toBeTruthy()
    }
  })

  it('shows no application without a represented basis, and fakes none', async () => {
    await enterPhone()
    const home = screen.getByRole('region', { name: 'Home' })

    // No foreign communication truth is represented, so there is no
    // Communication application — not a disabled one, not an empty one.
    for (const absent of ['Communication', 'Messages', 'Mail', 'Photos', 'Notes', 'Camera', 'Browser', 'Coming soon']) {
      expect(within(home).queryByText(absent)).not.toBeInTheDocument()
    }
    expect(within(home).queryByRole('button', { name: /communication|message/i })).not.toBeInTheDocument()
  })

  it('derives Wallet presence from this Device having a Financial Session, not from the launcher', async () => {
    const base = createInitialGameState()
    const withoutPhoneSession: GameState = { ...base, dollarFinance: { ...base.dollarFinance, sessions: {
      ...base.dollarFinance.sessions,
      active: base.dollarFinance.sessions.active.filter(({ clientDeviceId }) => clientDeviceId !== PHONE_DEVICE_ID),
    } } }
    await enterPhone(phoneConnectedState(withoutPhoneSession))
    const home = screen.getByRole('region', { name: 'Home' })

    // The player is still signed in on their own Device; that is not this phone's basis.
    expect(withoutPhoneSession.dollarFinance.sessions.active).toHaveLength(1)
    expect(within(home).getAllByRole('button').map((app) => app.textContent)).toEqual(['Settings'])
  })
})

describe('VEYRA Wallet', () => {
  it('presents the Account this Device is signed in to, resolved through its Financial Session', async () => {
    const base = createInitialGameState()
    // Altered represented truth: a hardcoded surface would fail here.
    const altered: GameState = { ...base, dollarFinance: { ...base.dollarFinance, accounts: base.dollarFinance.accounts.map((account) =>
      account.id === PHONE_ACCOUNT_ID ? { ...account, accountReference: 'CD-7788-0042', balanceCents: 9_105 } : account) } }
    const user = await enterPhone(phoneConnectedState(altered))
    await user.click(screen.getByRole('button', { name: 'Wallet' }))

    const wallet = screen.getByRole('region', { name: 'Wallet' })
    expect(wallet).toHaveTextContent('$91.05')
    expect(wallet).toHaveTextContent('Civic Dollar')
    // Never the player's own money.
    expect(wallet).not.toHaveTextContent('$1,250.00')
    expect(wallet).not.toHaveTextContent(PLAYER_REFERENCE)

    await user.click(within(wallet).getByRole('button', { name: 'Account' }))
    const account = screen.getByRole('region', { name: 'Account' })
    expect(account).toHaveTextContent('CD-7788-0042')
    // Authority data is not owner-facing information.
    expect(account.textContent).not.toContain(PHONE_ACCOUNT_ID)
    expect(account.textContent).not.toContain('dollar-session')
    expect(account.textContent).not.toContain('dollar-credential')
  })

  it('sends real canonical Dollars from the foreign Account to the player’s own Account', async () => {
    const user = await enterPhone()
    await user.click(screen.getByRole('button', { name: 'Wallet' }))
    await user.click(screen.getByRole('button', { name: 'Send' }))

    await user.type(screen.getByLabelText('Amount'), '25.50')
    await user.type(screen.getByLabelText('To account number'), PLAYER_REFERENCE)
    await user.click(screen.getByRole('button', { name: 'Review' }))

    const review = screen.getByRole('region', { name: 'Review transfer' })
    expect(review).toHaveTextContent('$25.50')
    expect(review).toHaveTextContent(PLAYER_REFERENCE)
    expect(review).toHaveTextContent(PHONE_REFERENCE)
    // Nothing has moved yet.
    expect(canonical().dollarFinance.transactions.records).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Send $25.50' }))

    const after = canonical()
    expect(accountBalance(after, PHONE_ACCOUNT_ID)).toBe(34_250 - 2_550)
    expect(accountBalance(after, 'dollar-account-local-v0')).toBe(125_000 + 2_550)
    expect(after.dollarFinance.transactions.records).toEqual([{
      id: 'dollar-transaction-0001',
      sourceAccountId: PHONE_ACCOUNT_ID,
      destinationAccountId: 'dollar-account-local-v0',
      amountCents: 2_550,
      sourceAccountReference: PHONE_REFERENCE,
      destinationAccountReference: PLAYER_REFERENCE,
    }])

    // The Wallet now reads the new canonical truth, including the Transaction.
    const wallet = screen.getByRole('region', { name: 'Wallet' })
    expect(wallet).toHaveTextContent('$317.00')
    expect(wallet).toHaveTextContent('Sent')
    expect(wallet).toHaveTextContent('−$25.50')
    expect(wallet).toHaveTextContent(PLAYER_REFERENCE)
  })

  it('derives Activity only from canonical Transactions', async () => {
    const base = createInitialGameState()
    const withHistory: GameState = { ...base, dollarFinance: { ...base.dollarFinance, transactions: { nextId: 2, records: [{
      id: 'dollar-transaction-0001',
      sourceAccountId: 'dollar-account-local-v0',
      destinationAccountId: PHONE_ACCOUNT_ID,
      amountCents: 4_000,
      sourceAccountReference: PLAYER_REFERENCE,
      destinationAccountReference: PHONE_REFERENCE,
    }] } } }
    const user = await enterPhone(phoneConnectedState(withHistory))
    await user.click(screen.getByRole('button', { name: 'Wallet' }))

    const wallet = screen.getByRole('region', { name: 'Wallet' })
    expect(wallet).toHaveTextContent('Received')
    expect(wallet).toHaveTextContent('+$40.00')
    expect(wallet).toHaveTextContent(PLAYER_REFERENCE)
    // Nothing beyond what a Transaction carries.
    expect(wallet.textContent).not.toMatch(/pending|fee|categor|merchant|ago|today/i)
  })

  it('shows an empty Activity state rather than inventing a history', async () => {
    const user = await enterPhone()
    await user.click(screen.getByRole('button', { name: 'Wallet' }))

    const wallet = screen.getByRole('region', { name: 'Wallet' })
    expect(wallet).toHaveTextContent('Money you send or receive will appear here.')
    expect(canonical().dollarFinance.transactions.records).toEqual([])
  })

  it('refuses a transfer in product wording and moves no money', async () => {
    const user = await enterPhone()
    await user.click(screen.getByRole('button', { name: 'Wallet' }))
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await user.type(screen.getByLabelText('Amount'), '9000.00')
    await user.type(screen.getByLabelText('To account number'), PLAYER_REFERENCE)
    await user.click(screen.getByRole('button', { name: 'Review' }))
    await user.click(screen.getByRole('button', { name: 'Send $9,000.00' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Not enough money in this account.')
    expect(screen.getByRole('alert').textContent).not.toMatch(/insufficient_funds/)
    const after = canonical()
    expect(accountBalance(after, PHONE_ACCOUNT_ID)).toBe(34_250)
    expect(after.dollarFinance.transactions.records).toEqual([])
  })

  it('presents RECEIVE as the represented reference and nothing more', async () => {
    const user = await enterPhone()
    await user.click(screen.getByRole('button', { name: 'Wallet' }))
    await user.click(screen.getByRole('button', { name: 'Receive' }))

    const receive = screen.getByRole('region', { name: 'Receive money' })
    expect(receive).toHaveTextContent(PHONE_REFERENCE)
    expect(within(receive).getByRole('button', { name: `Copy account number ${PHONE_REFERENCE}` })).toBeInTheDocument()
    expect(receive.querySelector('canvas, img')).toBeNull()
    expect(receive.textContent).not.toMatch(/QR/i)
    // Opening RECEIVE creates nothing.
    expect(canonical().dollarFinance.transactions.records).toEqual([])
  })
})

describe('VEYRA Settings', () => {
  it('presents only truthful human-facing Device and Firmware facts', async () => {
    const base = createInitialGameState()
    const altered: GameState = { ...base, world: { network: { ...base.world.network, hosts: base.world.network.hosts.map((host) =>
      host.id === PHONE_DEVICE_ID
        ? { ...host, displayName: 'Renamed Phone', firmware: { ...host.firmware!, name: 'VEYRA OS', version: '5.2' } }
        : host) } } }
    const user = await enterPhone(phoneConnectedState(altered))
    await user.click(screen.getByRole('button', { name: 'Settings' }))

    const settings = screen.getByRole('region', { name: 'Settings' })
    expect(within(settings).getAllByRole('button').map((row) => row.textContent)).toEqual(['This Device'])

    await user.click(within(settings).getByRole('button', { name: 'This Device' }))
    const device = screen.getByRole('region', { name: 'This Device' })
    expect(device).toHaveTextContent('Renamed Phone')
    expect(device).toHaveTextContent('VEYRA OS 5.2')
  })

  it('never derives owner-facing connection state from the player’s Remote Session', async () => {
    const user = await enterPhone()
    await user.click(screen.getByRole('button', { name: 'Settings' }))

    // A Session is live right now; Settings says nothing about it.
    expect(canonical().remoteSession.active).not.toBeNull()
    const settings = screen.getByRole('region', { name: 'Settings' })
    expect(settings.textContent).not.toMatch(/connected|connection|session|remote/i)
    await user.click(within(settings).getByRole('button', { name: 'This Device' }))
    expect(screen.getByRole('region', { name: 'This Device' }).textContent).not.toMatch(/connected|connection|session|remote/i)
  })

  it('exposes no machine, access or hacker context anywhere in the owner-facing phone', async () => {
    const user = await enterPhone()
    for (const app of ['Wallet', 'Settings']) {
      await user.click(screen.getByRole('button', { name: app }))
      const owner = ownerFacing().textContent ?? ''
      expect(owner).not.toContain('session-0001')
      expect(owner).not.toContain('access-phone')
      expect(owner).not.toContain(PHONE_DEVICE_ID)
      expect(owner).not.toContain(PHONE_ADDRESS)
      expect(owner).not.toMatch(/USER|SSH|privilege|exploit|CPU|RAM/)
      await user.click(screen.getByRole('button', { name: 'Home' }))
    }
  })
})

describe('VEYRA navigation', () => {
  it('moves Home → app root → detail and back up, without ever leaving the phone', async () => {
    const user = await enterPhone()
    await user.click(screen.getByRole('button', { name: 'Wallet' }))
    await user.click(screen.getByRole('button', { name: 'Account' }))
    expect(screen.getByRole('region', { name: 'Account' })).toBeInTheDocument()

    // BACK moves exactly one level up.
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('region', { name: 'Wallet' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('region', { name: 'Home' })).toBeInTheDocument()

    // HOME returns to the launcher from any depth, and neither control leaves VEYRA.
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: 'This Device' }))
    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(screen.getByRole('region', { name: 'Home' })).toBeInTheDocument()
    expect(phoneSurface()).not.toHaveAttribute('hidden')
    expect(canonical().remoteSession.active).not.toBeNull()
    expect(document.querySelector('.node-workspace')).toHaveAttribute('hidden')
  })

  it('keeps returning to NODE-OS and ending the Session distinct from Back and Home', async () => {
    const user = await enterPhone()

    // Returning local changes only which environment is presented.
    await user.click(screen.getByRole('button', { name: 'Return to NODE-OS without disconnecting' }))
    expect(document.querySelector('.node-workspace')).not.toHaveAttribute('hidden')
    expect(phoneSurface()).toHaveAttribute('hidden')
    const session = canonical().remoteSession.active
    expect(session).not.toBeNull()

    await user.click(screen.getByRole('button', { name: `RETURN REMOTE · ${PHONE_ADDRESS}` }))
    expect(phoneSurface()).not.toHaveAttribute('hidden')
    expect(canonical().remoteSession.active).toEqual(session)

    // DISCONNECT is the only one that ends the Session.
    await user.click(within(phoneSurface()).getByRole('button', { name: 'DISCONNECT' }))
    expect(canonical().remoteSession.active).toBeNull()
    expect(screen.queryByLabelText('VEYRA OS personal device environment')).not.toBeInTheDocument()
  })

  it('releases Shell-owned editing when moving between VEYRA surfaces', async () => {
    const user = await enterPhone()
    endEditing.mockClear()
    await user.click(screen.getByRole('button', { name: 'Wallet' }))
    expect(endEditing).toHaveBeenCalled()
  })
})

describe('local NODE-OS finance is unaffected by an operated foreign phone', () => {
  it('keeps the NODE Wallet bound to the local Device while a VEYRA Session is active', () => {
    render(<GameProvider initialState={phoneConnectedState()}><Wallet /></GameProvider>)

    expect(screen.getByLabelText('Dollar account')).toHaveTextContent('$1,250.00')
    expect(screen.getByLabelText('Dollar account')).toHaveTextContent(PLAYER_REFERENCE)
    expect(screen.getByLabelText('Dollar account')).not.toHaveTextContent(PHONE_REFERENCE)
    expect(screen.getByLabelText('Dollar account')).not.toHaveTextContent('$342.50')
  })
})
