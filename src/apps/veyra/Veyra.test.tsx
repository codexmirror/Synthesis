import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { connectRemoteFromObservation } from '../../core/game/remoteSession'
import { createInitialGameState } from '../../core/game/initialState'
import { transferDollars } from '../../core/game/dollarFinance'
import { advanceGameState } from '../../core/game/gameAdvancement'
import { PETRA_TECHNICIAN_MESSAGE, PETRA_TECHNICIAN_RESPONSE_DELAY_MS } from '../../core/game/technician'
import { VEYRA_FIRMWARE_UPDATE_DURATION_MS } from '../../core/game/veyraFirmwareUpdate'
import { VEYRA_OS_4_1_FIRMWARE_ID, VEYRA_OS_4_2_FIRMWARE_ID } from '../../core/game/firmwareIdentity'
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
const PHONE_PIN = '7042'

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
/** Presses each digit of a PIN on the shared VEYRA keypad, exactly the way a player would. */
async function enterPin(user: ReturnType<typeof userEvent.setup>, pin: string) {
  for (const digit of pin) await user.click(screen.getByRole('button', { name: digit }))
}
/** Filled/empty state of the four PIN indicators, read as the dots the keypad itself renders. */
const pinDots = () => Array.from(document.querySelectorAll('.veyra-pin__dot')).map((dot) => dot.hasAttribute('data-filled'))
async function enableWalletProtection(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await user.click(screen.getByRole('button', { name: 'Security' }))
  await user.click(screen.getByRole('switch', { name: 'Require Device PIN to open Wallet' }))
  await enterPin(user, PHONE_PIN)
  await user.click(screen.getByRole('button', { name: 'Home' }))
}

async function enterPhone(state = phoneConnectedState(), user = userEvent.setup()) {
  render(<GameProvider initialState={state}><Shell /><State /></GameProvider>)
  await user.click(screen.getByRole('button', { name: 'ENTER VEYRA OS →' }))
  return user
}

const phoneHost = (state: GameState) => state.world.network.hosts.find(({ id }) => id === PHONE_DEVICE_ID)!

/** Runs the represented installation forward through the running application's own canonical advancement. */
async function runInstallation(ms = VEYRA_FIRMWARE_UPDATE_DURATION_MS + 1_000) {
  await act(async () => { vi.advanceTimersByTime(ms) })
}

beforeEach(() => {
  vi.useRealTimers()
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
    expect(apps.map((app) => app.textContent)).toEqual(['Communication', 'Wallet', 'Settings'])
    // Icons are decoration beside a real label, never the control itself.
    for (const app of apps) {
      expect(app.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      expect(app.querySelector('.veyra-app__label')?.textContent).toBeTruthy()
    }
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
    expect(within(home).getAllByRole('button').map((app) => app.textContent)).toEqual(['Communication', 'Settings'])
  })
})

describe('VEYRA Communication', () => {
  it('presents Petra’s represented Company Chat message after the qualifying transfer', async () => {
    const base = createInitialGameState()
    const transferred = transferDollars(base, PHONE_DEVICE_ID, PLAYER_REFERENCE, 2_000)
    if (transferred.status !== 'transferred') throw new Error(transferred.status)
    const user = await enterPhone(phoneConnectedState(transferred.state))
    const before = canonical()
    await user.click(screen.getByRole('button', { name: 'Communication' }))

    const communication = screen.getByRole('region', { name: 'Communication' })
    expect(within(communication).getByLabelText('Company Chat')).toHaveTextContent('Petra')
    expect(communication).toHaveTextContent('There’s a transaction from the work phone that I don’t recognize. Can someone take a look?')
    expect(communication.textContent).not.toMatch(/exploit|credential|attacker|technician|timestamp/i)
    expect(canonical()).toEqual(before)
  })

  it('presents the delayed Technician as a distinct Company Chat correspondent', async () => {
    const transferred = transferDollars(createInitialGameState(), PHONE_DEVICE_ID, PLAYER_REFERENCE, 2_000)
    if (transferred.status !== 'transferred') throw new Error(transferred.status)
    const responded = advanceGameState(transferred.state, PETRA_TECHNICIAN_RESPONSE_DELAY_MS)
    const user = await enterPhone(phoneConnectedState(responded))
    await user.click(screen.getByRole('button', { name: 'Communication' }))

    const chat = screen.getByLabelText('Company Chat')
    expect(within(chat).getByText('Technician')).toBeInTheDocument()
    expect(chat).toHaveTextContent(PETRA_TECHNICIAN_MESSAGE)
  })

  it('uses Back and Home without changing canonical state or the Remote Session', async () => {
    const user = await enterPhone()
    const before = canonical()
    await user.click(screen.getByRole('button', { name: 'Communication' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('region', { name: 'Home' })).toBeInTheDocument()
    expect(canonical()).toEqual(before)

    await user.click(screen.getByRole('button', { name: 'Communication' }))
    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(screen.getByRole('region', { name: 'Home' })).toBeInTheDocument()
    expect(canonical()).toEqual(before)
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
    expect(canonical().dollarFinance.transactions.records).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Send $25.50' }))

    const after = canonical()
    expect(accountBalance(after, PHONE_ACCOUNT_ID)).toBe(34_250 - 2_550)
    expect(accountBalance(after, 'dollar-account-local-v0')).toBe(125_000 + 2_550)
    expect(after.dollarFinance.transactions.records.at(-1)).toEqual({
      id: 'dollar-transaction-0002',
      sourceAccountId: PHONE_ACCOUNT_ID,
      destinationAccountId: 'dollar-account-local-v0',
      amountCents: 2_550,
      sourceAccountReference: PHONE_REFERENCE,
      destinationAccountReference: PLAYER_REFERENCE,
    })

    // The Wallet now reads the new canonical truth, including the Transaction.
    const wallet = screen.getByRole('region', { name: 'Wallet' })
    expect(wallet).toHaveTextContent('$317.00')
    expect(wallet).toHaveTextContent('Sent')
    expect(wallet).toHaveTextContent('−$25.50')
    expect(wallet).toHaveTextContent(PLAYER_REFERENCE)
  })

  it('keeps the editable Send form mounted until Shell recovery, then presents Review', async () => {
    const initial = phoneConnectedState()
    const user = userEvent.setup()
    const view = render(<GameProvider initialState={initial}><Shell /><State /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ENTER VEYRA OS →' }))
    await user.click(screen.getByRole('button', { name: 'Wallet' }))
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await user.type(screen.getByLabelText('Amount'), '20.00')
    await user.type(screen.getByLabelText('To account number'), PLAYER_REFERENCE)

    viewport = { ...viewport, editing: true, editingPresentation: true, presentationPhase: 'editing', recoveryReady: false }
    view.rerender(<GameProvider initialState={initial}><Shell /><State /></GameProvider>)
    endEditing.mockClear()
    await user.click(screen.getByRole('button', { name: 'Review' }))

    expect(endEditing).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('region', { name: 'Send money' })).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveValue('20.00')
    expect(screen.queryByRole('region', { name: 'Review transfer' })).not.toBeInTheDocument()

    viewport = { ...viewport, editing: false, editingPresentation: false, presentationPhase: 'normal', recoveryReady: true }
    view.rerender(<GameProvider initialState={initial}><Shell /><State /></GameProvider>)
    expect(await screen.findByRole('region', { name: 'Review transfer' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Send money' })).not.toBeInTheDocument()
  })

  it('commits one transfer per successful Review while Wallet navigation waits for recovery', async () => {
    const initial = phoneConnectedState()
    const user = userEvent.setup()
    const view = render(<GameProvider initialState={initial}><Shell /><State /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ENTER VEYRA OS →' }))
    await user.click(screen.getByRole('button', { name: 'Wallet' }))
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await user.type(screen.getByLabelText('Amount'), '20.00')
    await user.type(screen.getByLabelText('To account number'), PLAYER_REFERENCE)
    await user.click(screen.getByRole('button', { name: 'Review' }))

    viewport = { ...viewport, editing: false, editingPresentation: true, presentationPhase: 'recovering', recoveryReady: false }
    const confirm = screen.getByRole('button', { name: 'Send $20.00' })
    await user.click(confirm)
    await user.click(confirm)

    const pending = canonical()
    expect(accountBalance(pending, PHONE_ACCOUNT_ID)).toBe(34_250 - 2_000)
    expect(accountBalance(pending, 'dollar-account-local-v0')).toBe(125_000 + 2_000)
    expect(pending.dollarFinance.transactions.records).toHaveLength(2)
    expect(screen.getByRole('region', { name: 'Review transfer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sent $20.00' })).toBeDisabled()

    viewport = { ...viewport, editingPresentation: false, presentationPhase: 'normal', recoveryReady: true }
    view.rerender(<GameProvider initialState={initial}><Shell /><State /></GameProvider>)
    const wallet = await screen.findByRole('region', { name: 'Wallet' })
    expect(wallet).toHaveTextContent('$322.50')
    expect(wallet).toHaveTextContent('−$20.00')
    expect(canonical().dollarFinance.transactions.records).toHaveLength(2)
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

  it('naturally presents the real incoming branch payment from canonical activity', async () => {
    const user = await enterPhone()
    await user.click(screen.getByRole('button', { name: 'Wallet' }))

    const wallet = screen.getByRole('region', { name: 'Wallet' })
    expect(wallet).toHaveTextContent('Received')
    expect(wallet).toHaveTextContent('+$20.00')
    expect(wallet).toHaveTextContent('CD-9000-2000')
    expect(wallet.textContent).not.toMatch(/book|sale|merchant/i)
    expect(canonical().dollarFinance.transactions.records).toHaveLength(1)
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
    expect(after.dollarFinance.transactions.records).toEqual(createInitialGameState().dollarFinance.transactions.records)

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('region', { name: 'Wallet' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(screen.getByRole('region', { name: 'Home' })).toBeInTheDocument()
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
    expect(canonical().dollarFinance.transactions.records).toEqual(createInitialGameState().dollarFinance.transactions.records)
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
    // The System Update row states the same represented Firmware facts: this
    // renamed release is still stable identity 4.1, so 4.2 is still offered.
    expect(within(settings).getAllByRole('button').map((row) => row.textContent))
      .toEqual(['View update', 'This Device', 'System UpdateVEYRA OS 4.2 available', 'Security'])

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
    for (const app of ['Communication', 'Wallet', 'Settings']) {
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

describe('VEYRA Security — Wallet protection', () => {
  async function openSecurity() {
    const user = await enterPhone()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: 'Security' }))
    return user
  }

  it('presents Wallet protection OFF truthfully, deriving nothing from the Remote Session', async () => {
    await openSecurity()
    const security = screen.getByRole('region', { name: 'Security' })
    expect(security).toHaveTextContent('Wallet protection')
    expect(security).toHaveTextContent('Require Device PIN to open Wallet')
    expect(screen.getByRole('switch', { name: 'Require Device PIN to open Wallet' })).toHaveAttribute('aria-checked', 'false')
    expect(canonical().world.network.hosts.find(({ id }) => id === PHONE_DEVICE_ID)?.security?.walletProtectionEnabled).toBe(false)
  })

  it('requests the Device PIN through the shared keypad before mutating anything, and commits the requested state on a correct PIN', async () => {
    const user = await openSecurity()
    const before = canonical()
    await user.click(screen.getByRole('switch', { name: 'Require Device PIN to open Wallet' }))

    const challenge = screen.getByRole('region', { name: 'Enter Device PIN' })
    expect(challenge).toBeInTheDocument()
    // No text field, and no separate Confirm button for the normal four-digit flow.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(challenge.querySelector('input')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
    expect(challenge).not.toHaveTextContent('RATTLER')
    expect(challenge.querySelector('[data-rattler-attempt]')).toBeNull()
    // Tapping the control alone changes nothing.
    expect(canonical()).toEqual(before)

    await enterPin(user, PHONE_PIN)

    expect(screen.getByRole('region', { name: 'Security' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Require Device PIN to open Wallet' })).toHaveAttribute('aria-checked', 'true')
    expect(canonical().world.network.hosts.find(({ id }) => id === PHONE_DEVICE_ID)?.security).toEqual({ devicePin: PHONE_PIN, walletProtectionEnabled: true })
  })

  it('refuses an incorrect PIN in ordinary wording, leaves the setting unchanged, resets entry, and never leaks the correct PIN', async () => {
    const user = await openSecurity()
    const before = canonical()
    await user.click(screen.getByRole('switch', { name: 'Require Device PIN to open Wallet' }))
    await enterPin(user, '0000')

    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect PIN.')
    expect(screen.getByRole('region', { name: 'Enter Device PIN' })).toBeInTheDocument()
    expect(canonical()).toEqual(before)
    // Entry resets so another attempt can be made.
    expect(pinDots()).toEqual([false, false, false, false])
    // The correct PIN never appears anywhere in the owner-facing phone.
    expect(ownerFacing().textContent ?? '').not.toContain(PHONE_PIN)
  })

  it('lets the player correct an accidental digit before the fourth digit is entered', async () => {
    const user = await openSecurity()
    await user.click(screen.getByRole('switch', { name: 'Require Device PIN to open Wallet' }))

    await enterPin(user, '709')
    expect(pinDots()).toEqual([true, true, true, false])
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(pinDots()).toEqual([true, true, false, false])
    await enterPin(user, '42')

    expect(screen.getByRole('region', { name: 'Security' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Require Device PIN to open Wallet' })).toHaveAttribute('aria-checked', 'true')
  })

  it('leaves the setting unchanged when the PIN challenge is cancelled', async () => {
    const user = await openSecurity()
    const before = canonical()
    await user.click(screen.getByRole('switch', { name: 'Require Device PIN to open Wallet' }))
    await enterPin(user, '111')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('region', { name: 'Security' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Require Device PIN to open Wallet' })).toHaveAttribute('aria-checked', 'false')
    expect(canonical()).toEqual(before)
  })

  it('persists the committed setting across navigation rather than resetting it', async () => {
    const user = await openSecurity()
    await user.click(screen.getByRole('switch', { name: 'Require Device PIN to open Wallet' }))
    await enterPin(user, PHONE_PIN)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: 'Security' }))
    expect(screen.getByRole('switch', { name: 'Require Device PIN to open Wallet' })).toHaveAttribute('aria-checked', 'true')
  })
})

describe('VEYRA Wallet — Wallet-open enforcement', () => {
  it('opens Wallet immediately with protection OFF, exactly as before', async () => {
    const user = await enterPhone()
    await user.click(screen.getByRole('button', { name: 'Wallet' }))

    expect(screen.getByRole('region', { name: 'Wallet' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Enter Device PIN' })).not.toBeInTheDocument()
  })

  it('opens a Device-PIN challenge instead of Wallet content with protection ON', async () => {
    const user = await enterPhone()
    await enableWalletProtection(user)
    await user.click(screen.getByRole('button', { name: 'Wallet' }))

    const challenge = screen.getByRole('region', { name: 'Enter Device PIN' })
    expect(challenge).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Wallet' })).not.toBeInTheDocument()
    // No balance, account, activity or Send/Receive control leaks before authentication.
    expect(challenge.textContent).not.toMatch(/\$|send|receive|activity|account number/i)
  })

  it('opens Wallet on a correct PIN', async () => {
    const user = await enterPhone()
    await enableWalletProtection(user)
    await user.click(screen.getByRole('button', { name: 'Wallet' }))
    await enterPin(user, PHONE_PIN)

    const wallet = screen.getByRole('region', { name: 'Wallet' })
    expect(wallet).toBeInTheDocument()
    expect(wallet).toHaveTextContent('$342.50')
    expect(screen.queryByRole('region', { name: 'Enter Device PIN' })).not.toBeInTheDocument()
  })

  it('refuses an incorrect PIN, keeps Wallet closed, resets entry, and allows another attempt', async () => {
    const user = await enterPhone()
    await enableWalletProtection(user)
    await user.click(screen.getByRole('button', { name: 'Wallet' }))
    await enterPin(user, '0000')

    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect PIN.')
    expect(screen.queryByRole('region', { name: 'Wallet' })).not.toBeInTheDocument()
    expect(pinDots()).toEqual([false, false, false, false])

    await enterPin(user, PHONE_PIN)
    expect(screen.getByRole('region', { name: 'Wallet' })).toBeInTheDocument()
  })

  it('cancelling the challenge returns Home without opening Wallet or mutating canonical state', async () => {
    const user = await enterPhone()
    await enableWalletProtection(user)
    const before = canonical()
    await user.click(screen.getByRole('button', { name: 'Wallet' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('region', { name: 'Home' })).toBeInTheDocument()
    expect(canonical()).toEqual(before)
  })

  it('requires the PIN again after leaving an authenticated Wallet and reopening it', async () => {
    const user = await enterPhone()
    await enableWalletProtection(user)
    await user.click(screen.getByRole('button', { name: 'Wallet' }))
    await enterPin(user, PHONE_PIN)
    expect(screen.getByRole('region', { name: 'Wallet' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.click(screen.getByRole('button', { name: 'Wallet' }))

    expect(screen.getByRole('region', { name: 'Enter Device PIN' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Wallet' })).not.toBeInTheDocument()
  })

  it('enabling protection in Settings gates the very next Wallet opening, with no reload or reconnect', async () => {
    const user = await enterPhone()
    await user.click(screen.getByRole('button', { name: 'Wallet' }))
    expect(screen.getByRole('region', { name: 'Wallet' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Home' }))

    await enableWalletProtection(user)
    await user.click(screen.getByRole('button', { name: 'Wallet' }))

    expect(screen.getByRole('region', { name: 'Enter Device PIN' })).toBeInTheDocument()
  })

  it('disabling protection in Settings immediately restores unguarded Wallet opening', async () => {
    const user = await enterPhone()
    await enableWalletProtection(user)
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: 'Security' }))
    await user.click(screen.getByRole('switch', { name: 'Require Device PIN to open Wallet' }))
    await enterPin(user, PHONE_PIN)
    await user.click(screen.getByRole('button', { name: 'Home' }))

    await user.click(screen.getByRole('button', { name: 'Wallet' }))
    expect(screen.getByRole('region', { name: 'Wallet' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Enter Device PIN' })).not.toBeInTheDocument()
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

describe('VEYRA System Update', () => {
  /** Settings -> System Update, exactly the way a player reaches it. */
  async function openSystemUpdate(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: /System Update/ }))
    return screen.getByRole('region', { name: 'System Update' })
  }

  it('presents the one concrete newer release as a system capability, not an app or a package', async () => {
    const user = await enterPhone()
    const before = canonical()

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('region', { name: 'Settings' })).toHaveTextContent('VEYRA OS 4.2 is available')

    await user.click(screen.getByRole('button', { name: /System Update/ }))
    const update = screen.getByRole('region', { name: 'System Update' })
    expect(update).toHaveTextContent('VEYRA OS 4.2')
    expect(update).toHaveTextContent('Updated secure shell service to GateSSH 1.3.3.')
    expect(update).toHaveTextContent("Installing requires this Device's PIN.")
    expect(within(update).getByRole('button', { name: 'Install 4.2' })).toBeInTheDocument()
    // Firmware is not software: nothing here is bought, downloaded to a
    // filesystem, installed as a package or acquired from a Market.
    expect(update.textContent).not.toMatch(/download|market|package|purchase|price|filesystem/i)
    // This update never crosses the real boot boundary, so nothing may claim
    // the Device restarts or reboots to install it.
    expect(update.textContent).not.toMatch(/restart|reboot/i)
    expect(canonical()).toEqual(before)
  })

  it('changes no firmware state from browsing the update or entering a wrong PIN', async () => {
    const user = await enterPhone()
    const update = await openSystemUpdate(user)
    const before = canonical()

    await user.click(within(update).getByRole('button', { name: 'Install 4.2' }))
    await enterPin(user, '1234')
    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect PIN.')
    expect(canonical()).toEqual(before)
    expect(pinDots()).toEqual([false, false, false, false])

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('region', { name: 'System Update' })).toBeInTheDocument()
    expect(canonical()).toEqual(before)
    expect(phoneHost(canonical()).firmware?.id).toBe(VEYRA_OS_4_1_FIRMWARE_ID)
    expect(phoneHost(canonical()).firmwareUpdate).toBeUndefined()
  })

  it('starts a represented installation on the correct Device PIN and gives the whole phone over to it', async () => {
    const user = await enterPhone()
    const update = await openSystemUpdate(user)
    await user.click(within(update).getByRole('button', { name: 'Install 4.2' }))
    await enterPin(user, PHONE_PIN)

    expect(phoneHost(canonical()).firmwareUpdate).toMatchObject({ releaseId: VEYRA_OS_4_2_FIRMWARE_ID })
    const installing = screen.getByRole('region', { name: 'Installing system update' })
    expect(installing).toHaveTextContent('VEYRA OS 4.2')
    expect(installing).toHaveTextContent('Downloading update')
    // Real elapsed time keeps running under the surface, so this states only
    // that the installation has genuinely just begun.
    expect(Number(within(installing).getByRole('progressbar').getAttribute('aria-valuenow'))).toBeLessThan(30)
    // The phone is installing its operating system: no launcher, no
    // navigation, no Settings, and the Firmware it still owns is 4.1.
    expect(screen.queryByRole('region', { name: 'System Update' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'VEYRA navigation' })).not.toBeInTheDocument()
    expect(phoneHost(canonical()).firmware?.version).toBe('4.1')
  })

  it('progresses from canonical advancement rather than from the surface presenting it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = await enterPhone(phoneConnectedState(), userEvent.setup({ advanceTimers: vi.advanceTimersByTime }))
    const update = await openSystemUpdate(user)
    await user.click(within(update).getByRole('button', { name: 'Install 4.2' }))
    await enterPin(user, PHONE_PIN)

    await runInstallation(9_000)
    const midway = screen.getByRole('region', { name: 'Installing system update' })
    expect(midway).toHaveTextContent(/Preparing update|Installing update/)
    expect(Number(within(midway).getByRole('progressbar').getAttribute('aria-valuenow'))).toBeGreaterThan(20)
    expect(phoneHost(canonical()).firmware?.version).toBe('4.1')

    await runInstallation(9_000)
    const finalizing = screen.getByRole('region', { name: 'Installing system update' })
    expect(finalizing).toHaveTextContent('Finishing update')
    expect(within(finalizing).queryByRole('progressbar')).not.toBeInTheDocument()
    // FINALIZING is still installation work, not a fabricated boot screen.
    expect(finalizing.textContent).not.toMatch(/restart|reboot/i)
    expect(phoneHost(canonical()).operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    expect(canonical().remoteSession.active).not.toBeNull()
  })

  it('completes into the new release and resolves it from real Device truth', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = await enterPhone(phoneConnectedState(), userEvent.setup({ advanceTimers: vi.advanceTimersByTime }))
    const update = await openSystemUpdate(user)
    await user.click(within(update).getByRole('button', { name: 'Install 4.2' }))
    await enterPin(user, PHONE_PIN)
    await runInstallation()

    const phone = phoneHost(canonical())
    expect(phone.firmware).toEqual({ id: VEYRA_OS_4_2_FIRMWARE_ID, name: 'VEYRA OS', version: '4.2' })
    expect(phone.firmwareUpdate).toBeUndefined()
    expect(phone.operational).toEqual({ lifecycle: 'SHUTTING_DOWN', connectivity: 'DISCONNECTED' })
    expect(canonical().remoteSession.active).toBeNull()
    expect(screen.queryByLabelText(/personal device environment/)).not.toBeInTheDocument()
  })

  it('moves the phone’s firmware-owned SSH implementation without representing it as installed software', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = await enterPhone(phoneConnectedState(), userEvent.setup({ advanceTimers: vi.advanceTimersByTime }))
    expect(phoneHost(canonical()).services!.find(({ id }) => id === 'service-ssh-003')!.implementation.version).toBe('1.3.2')

    const update = await openSystemUpdate(user)
    await user.click(within(update).getByRole('button', { name: 'Install 4.2' }))
    await enterPin(user, PHONE_PIN)
    await runInstallation()

    const phone = phoneHost(canonical())
    expect(phone.services!.find(({ id }) => id === 'service-ssh-003')!.implementation).toEqual({
      productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.3', buildId: 'build-gate-ssh-1.3.3-v0', name: 'GateSSH', version: '1.3.3',
    })
    expect(phone.installedSoftware).toEqual([])
    expect(phone.filesystem?.files).toEqual([])

    expect(canonical().remoteSession.active).toBeNull()
  })

  it('leaves Wallet protection and the Device PIN behaving exactly as before', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = await enterPhone(phoneConnectedState(), userEvent.setup({ advanceTimers: vi.advanceTimersByTime }))
    await enableWalletProtection(user)

    const update = await openSystemUpdate(user)
    await user.click(within(update).getByRole('button', { name: 'Install 4.2' }))
    await enterPin(user, PHONE_PIN)
    await runInstallation()
    expect(phoneHost(canonical()).security).toEqual({ devicePin: PHONE_PIN, walletProtectionEnabled: true })
    expect(canonical().remoteSession.active).toBeNull()
  })
})
