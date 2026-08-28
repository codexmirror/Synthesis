import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GameProvider } from '../../app/GameContext'
import { advanceGameState } from '../../core/game/gameAdvancement'
import { createInitialGameState } from '../../core/game/initialState'
import { NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS, startNodeMiner } from '../../core/game/nodeMiner'
import type { ExecutableFile, GameState } from '../../core/game/types'
import { Wallet } from './Wallet'

/** A local Device mining with the Wallet's own address configured, so the Wallet really receives NODE. */
function minedState(elapsedMs: number): GameState {
  const base = createInitialGameState()
  const minerFile: ExecutableFile = { kind: 'executable', id: 'file-fixture-miner', path: '/home/user/node-miner-1.0.bin', programId: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
  const withFile: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { nextFileId: 50, files: [...base.player.localDevice.filesystem.files, minerFile] }, runtime: { ...base.player.localDevice.runtime, baselineCpuLoad: 0 } } } }
  const started = startNodeMiner(withFile, minerFile.path, withFile.nodeWallet.address)
  if (started.status !== 'started') throw new Error(started.status)
  return advanceGameState(started.state, elapsedMs)
}

/**
 * A second represented Account, in the test fixture only: the production world
 * still contains exactly the player's own Account, so SEND has no valid foreign
 * recipient there until gameplay introduces one.
 */
const RECIPIENT = { id: 'dollar-account-fixture-b', accountReference: 'CD-2000-0002', balanceCents: 4_000 }
const RECIPIENT_CREDENTIAL = { id: 'dollar-credential-fixture-b', accountId: RECIPIENT.id, loginIdentifier: 'second.civic', password: 'second-secret' }

function withRecipient(state = createInitialGameState()): GameState {
  return { ...state, dollarFinance: { ...state.dollarFinance, accounts: [...state.dollarFinance.accounts, RECIPIENT], credentials: [...state.dollarFinance.credentials, RECIPIENT_CREDENTIAL] } }
}

const signedOut = (state = createInitialGameState()): GameState => ({ ...state, dollarFinance: { ...state.dollarFinance, sessions: { ...state.dollarFinance.sessions, active: [] } } })

async function send(user: ReturnType<typeof userEvent.setup>, recipient: string, amount: string) {
  await user.click(screen.getByRole('button', { name: 'SEND' }))
  await user.type(screen.getByLabelText('TO ACCOUNT'), recipient)
  await user.type(screen.getByLabelText('AMOUNT'), amount)
  await user.click(screen.getByRole('button', { name: 'REVIEW' }))
}

/** Review's confirm control. It is deliberately not named SEND: opening the flow and moving the money are different acts. */
const confirmSend = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'CONFIRM & SEND' }))

describe('Wallet dashboard', () => {
  it('leads with the Session-authorized Dollar balance and account context, and presents NODE as a separate system', () => {
    render(<GameProvider><Wallet /></GameProvider>)
    expect(screen.getByText('Civic Dollar')).toBeInTheDocument()
    expect(screen.getByText('$1,250.00')).toBeInTheDocument()
    expect(screen.getByText('CD-1042-7781')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SEND' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ACCOUNT' })).toBeInTheDocument()
    expect(within(screen.getByLabelText('NODE wallet')).getByText('0 NODE')).toBeInTheDocument()
    expect(screen.getByText('node-wallet-addr-0001')).toBeInTheDocument()
  })

  it('derives every balance and reference from canonical GameState rather than owning presentation truth', () => {
    const base = createInitialGameState()
    const state: GameState = {
      ...base,
      dollarFinance: { ...base.dollarFinance, provider: { ...base.dollarFinance.provider, displayName: 'Meridian Dollar' }, accounts: base.dollarFinance.accounts.map((account) => ({ ...account, accountReference: 'CD-5555-0001', balanceCents: 4_200 })) },
      nodeWallet: { ...base.nodeWallet, balanceNodeUnits: 7 },
    }
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    expect(screen.getByText('$42.00')).toBeInTheDocument()
    expect(screen.getByText('CD-5555-0001')).toBeInTheDocument()
    expect(screen.getByText('Meridian Dollar')).toBeInTheDocument()
    expect(screen.getByText('0.000007 NODE')).toBeInTheDocument()
    expect(screen.queryByText('$1,250.00')).not.toBeInTheDocument()
  })

  it('presents only the Account reached by the local Device Session', () => {
    const base = createInitialGameState(); const unrelated = { id: 'unrelated-account', accountReference: 'CD-OTHER', balanceCents: 9_999_999 }
    const state: GameState = { ...base, dollarFinance: { ...base.dollarFinance, accounts: [unrelated, ...base.dollarFinance.accounts] } }
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    expect(screen.getByText('$1,250.00')).toBeInTheDocument(); expect(screen.queryByText('$99,999.99')).not.toBeInTheDocument(); expect(screen.queryByText('CD-OTHER')).not.toBeInTheDocument()
  })

  it('shows a clean empty activity state rather than inventing Dollar history', () => {
    render(<GameProvider initialState={minedState(10_000)}><Wallet /></GameProvider>)
    expect(screen.getByText('NO ACTIVITY YET')).toBeInTheDocument()
    expect(screen.queryByText(/^[−+]\$/)).not.toBeInTheDocument()
    expect(screen.getByText('$1,250.00')).toBeInTheDocument()
  })

  it('keeps Dollar and NODE visually distinguishable', () => {
    const base = createInitialGameState()
    const state: GameState = { ...base, dollarFinance: { ...base.dollarFinance, accounts: base.dollarFinance.accounts.map((account) => ({ ...account, balanceCents: 4200 })) }, nodeWallet: { ...base.nodeWallet, balanceNodeUnits: 7 } }
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    expect(screen.getByText('$42.00').className).not.toBe(screen.getByText('0.000007 NODE').className)
  })
})

describe('Wallet NODE section', () => {
  it('formats the canonical integer atomic NODE balance without floating-point loss', () => {
    const base = createInitialGameState()
    render(<GameProvider initialState={{ ...base, nodeWallet: { ...base.nodeWallet, balanceNodeUnits: 4_281 } }}><Wallet /></GameProvider>)
    expect(screen.getByText('0.004281 NODE')).toBeInTheDocument()
  })

  it('presents a balance of exactly whole NODE without a spurious fraction', () => {
    const base = createInitialGameState()
    render(<GameProvider initialState={{ ...base, nodeWallet: { ...base.nodeWallet, balanceNodeUnits: 2_000_000 } }}><Wallet /></GameProvider>)
    expect(screen.getByText('2 NODE')).toBeInTheDocument()
  })

  it('presents the real NODE this Wallet received rather than an empty state', () => {
    render(<GameProvider initialState={minedState(10_000)}><Wallet /></GameProvider>)
    expect(screen.getByText('NODE ACTIVITY')).toBeInTheDocument()
    expect(screen.getByText('+670 units')).toBeInTheDocument()
    expect(screen.getByText('MINING PAYOUT')).toBeInTheDocument()
    expect(screen.queryByText('NO NODE ACTIVITY')).not.toBeInTheDocument()
  })

  it('derives NODE activity from canonical Wallet state, newest first', () => {
    const state = advanceGameState(minedState(10_000), 20_000)
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    expect(state.nodeWallet.activity.records.map(({ amountNodeUnits }) => amountNodeUnits)).toEqual([670, 670, 670])
    expect(screen.getAllByText(/^\+[\d,]+ units$/).map((element) => element.textContent)).toEqual(['+670 units', '+670 units', '+670 units'])
  })

  it('reports no NODE activity when this Wallet has received nothing', () => {
    render(<GameProvider><Wallet /></GameProvider>)
    expect(screen.getByText('NO NODE ACTIVITY')).toBeInTheDocument()
  })

  it('never reveals the hidden developer destination or claims anything about what a payer kept', () => {
    const state = minedState(10_000)
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    const wallet = document.querySelector('.wallet-app') as HTMLElement
    expect(state.nodeEconomy.accounts[0].balanceNodeUnits).toBe(330)
    expect(wallet.textContent).not.toContain(NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS)
    expect(wallet.textContent).not.toMatch(/DEVELOPER|FEE|STOLEN|1,000 units/i)
  })

  it('puts NODE away while a focused Dollar task is open and brings it back afterwards', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)
    expect(screen.getByLabelText('NODE wallet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'SEND' }))
    expect(screen.queryByLabelText('NODE wallet')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← BACK' }))
    expect(screen.getByLabelText('NODE wallet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ACCOUNT' }))
    expect(screen.queryByLabelText('NODE wallet')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← BACK' }))
    expect(screen.getByLabelText('NODE wallet')).toBeInTheDocument()
  })

  it('leaves NODE untouched when Dollars move', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient(minedState(10_000))}><Wallet /></GameProvider>)
    await send(user, RECIPIENT.accountReference, '25.00')
    await confirmSend(user)
    expect(screen.getByText('+670 units')).toBeInTheDocument()
    expect(within(screen.getByLabelText('NODE wallet')).getByText('0.00067 NODE')).toBeInTheDocument()
  })
})

describe('Wallet SEND', () => {
  it('reviews the exact formatted amount and recipient before any money moves', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)
    await send(user, RECIPIENT.accountReference, '25.5')

    expect(screen.getByLabelText('Review transfer')).toBeInTheDocument()
    expect(screen.getByText('$25.50')).toBeInTheDocument()
    const review = screen.getByLabelText('Review transfer')
    expect(within(review).getByText('TO').closest('div')).toHaveTextContent(RECIPIENT.accountReference)
    expect(within(review).getByText('FROM').closest('div')).toHaveTextContent('CD-1042-7781')
    // Nothing has been transferred yet.
    expect(screen.queryByText('$1,224.50')).not.toBeInTheDocument()
  })

  it('performs the canonical transfer on confirmation, updating the balance and activity from Account state', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)
    await send(user, RECIPIENT.accountReference, '25.50')
    await confirmSend(user)

    expect(screen.getByText('$1,224.50')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Sent $25.50 to CD-2000-0002.')
    const activity = screen.getByText('−$25.50').closest('.node-row') as HTMLElement
    expect(within(activity).getByText('CD-2000-0002')).toBeInTheDocument()
    expect(within(activity).getByText('SENT')).toBeInTheDocument()
    expect(screen.queryByText('NO ACTIVITY YET')).not.toBeInTheDocument()
    // The recipient's own balance is never exposed to the sender.
    expect(screen.queryByText('$65.50')).not.toBeInTheDocument()
  })

  it.each([
    ['an unknown recipient', 'CD-0000-0000', '25.00', 'No account matches that number.'],
    ['the acting Account itself', 'CD-1042-7781', '25.00', 'You cannot send to this account.'],
    ['more than the balance', 'CD-2000-0002', '9999.00', 'Not enough money in this account.'],
  ])('refuses %s with product wording and moves no money', async (_label, recipient, amount, message) => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)
    await send(user, recipient, amount)
    await confirmSend(user)

    expect(screen.getByRole('alert')).toHaveTextContent(message)
    await user.click(screen.getByRole('button', { name: '← BACK' }))
    expect(screen.getByText('$1,250.00')).toBeInTheDocument()
    expect(screen.getByText('NO ACTIVITY YET')).toBeInTheDocument()
  })

  it.each([['abc'], ['12.345'], ['0'], ['-5']])('refuses the amount %s at the input boundary without reaching review', async (amount) => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)
    await send(user, RECIPIENT.accountReference, amount)

    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount like 25.00.')
    expect(screen.queryByLabelText('Review transfer')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← BACK' }))
    expect(screen.getByText('$1,250.00')).toBeInTheDocument()
  })

  it('requires a recipient before review', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'SEND' }))
    await user.type(screen.getByLabelText('AMOUNT'), '10')
    await user.click(screen.getByRole('button', { name: 'REVIEW' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the account you are sending to.')
  })

  it('lets review be abandoned without mutating anything', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)
    await send(user, RECIPIENT.accountReference, '25.00')
    await user.click(screen.getByRole('button', { name: '← BACK' }))
    await user.click(screen.getByRole('button', { name: '← BACK' }))
    expect(screen.getByText('$1,250.00')).toBeInTheDocument()
    expect(screen.getByText('NO ACTIVITY YET')).toBeInTheDocument()
  })
})

describe('Wallet ACCOUNT', () => {
  it('offers no redundant return-to-personal action while the saved Account is already current', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ACCOUNT' }))

    expect(screen.getByText('CURRENT ACCOUNT')).toBeInTheDocument()
    expect(screen.getByText('CD-1042-7781')).toBeInTheDocument()
    expect(screen.getByText(/Personal account/)).toBeInTheDocument()
    // Continuing into the Account this Device is already using is not an action.
    expect(screen.queryByRole('button', { name: 'CONTINUE' })).not.toBeInTheDocument()
    expect(screen.queryByText('PERSONAL ACCOUNT')).not.toBeInTheDocument()
    // Everything else the surface owns stays available.
    expect(screen.getByRole('form', { name: 'Dollar account sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('PASSWORD')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'SIGN OUT' })).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('violet-orbit-7')
  })

  it('derives that from stable Account identity rather than the current account reference or login', async () => {
    const user = userEvent.setup()
    const base = withRecipient()
    // Same Account, renamed; the saved sign-in still points at its stable ID.
    const renamed: GameState = { ...base, dollarFinance: { ...base.dollarFinance, accounts: base.dollarFinance.accounts.map((account) => account.id === 'dollar-account-local-v0' ? { ...account, accountReference: 'CD-7777-0007' } : account) } }
    render(<GameProvider initialState={renamed}><Wallet /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ACCOUNT' }))
    expect(screen.getByText('CD-7777-0007')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'CONTINUE' })).not.toBeInTheDocument()
  })

  it('offers the saved personal path from Device state while another Account is current', async () => {
    const user = userEvent.setup()
    const base = withRecipient()
    const state: GameState = {
      ...base,
      // The Device is signed in to the other Account, and saved different login material for its own.
      dollarFinance: { ...base.dollarFinance, sessions: { nextId: 3, active: [{ id: 'dollar-session-0002', accountId: RECIPIENT.id, clientDeviceId: base.player.localDevice.id }] } },
      player: { ...base.player, localDevice: { ...base.player.localDevice, savedDollarSignIn: { id: 'saved-fixture', accountId: 'dollar-account-local-v0', loginIdentifier: 'renamed.civic', password: 'violet-orbit-7' } } },
    }
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ACCOUNT' }))

    expect(screen.getByText('CD-2000-0002')).toBeInTheDocument()
    expect(screen.getByText('PERSONAL ACCOUNT')).toBeInTheDocument()
    expect(screen.getByText('renamed.civic')).toBeInTheDocument()
    expect(screen.queryByText('local.civic')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeInTheDocument()
  })

  it('switches to another Account through manual sign-in and back through the saved personal sign-in', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)

    await user.click(screen.getByRole('button', { name: 'ACCOUNT' }))
    await user.type(screen.getByLabelText('LOGIN ID'), RECIPIENT_CREDENTIAL.loginIdentifier)
    await user.type(screen.getByLabelText('PASSWORD'), RECIPIENT_CREDENTIAL.password)
    await user.click(screen.getByRole('button', { name: 'SIGN IN' }))

    expect(screen.getByText('$40.00')).toBeInTheDocument()
    expect(screen.getByText('CD-2000-0002')).toBeInTheDocument()
    expect(screen.queryByText('$1,250.00')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ACCOUNT' }))
    await user.click(screen.getByRole('button', { name: 'CONTINUE' }))

    expect(screen.getByText('$1,250.00')).toBeInTheDocument()
    expect(screen.getByText('CD-1042-7781')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('second-secret')
  })

  it('reports a stale saved sign-in instead of silently signing in with current Provider truth', async () => {
    const user = userEvent.setup()
    const base = signedOut()
    const rotated: GameState = { ...base, dollarFinance: { ...base.dollarFinance, credentials: base.dollarFinance.credentials.map((credential) => ({ ...credential, password: 'rotated-secret' })) } }
    render(<GameProvider initialState={rotated}><Wallet /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'CONTINUE' }))

    expect(screen.getByRole('alert')).toHaveTextContent("This device's saved sign-in no longer works.")
    expect(screen.queryByText('$1,250.00')).not.toBeInTheDocument()
  })

  it('signs out through the canonical operation, keeping the saved personal path available', async () => {
    const user = userEvent.setup()
    render(<GameProvider><Wallet /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ACCOUNT' }))
    await user.click(screen.getByRole('button', { name: 'SIGN OUT' }))

    expect(screen.getByLabelText('Dollar account signed out')).toBeInTheDocument()
    expect(screen.queryByText('$1,250.00')).not.toBeInTheDocument()
    expect(screen.queryByText('CD-1042-7781')).not.toBeInTheDocument()
    // NODE is a separate domain and is unaffected by Dollar authority.
    expect(screen.getByText('node-wallet-addr-0001')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'CONTINUE' }))
    expect(screen.getByText('$1,250.00')).toBeInTheDocument()
  })
})

describe('Wallet signed out', () => {
  it('leaks no Account truth and offers both the saved and manual paths', () => {
    render(<GameProvider initialState={signedOut()}><Wallet /></GameProvider>)
    expect(screen.getByText('Signed out')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CONTINUE' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Dollar account sign in' })).toBeInTheDocument()
    expect(screen.queryByText('$1,250.00')).not.toBeInTheDocument()
    expect(screen.queryByText('CD-1042-7781')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'SEND' })).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('violet-orbit-7')
  })

  it('offers no saved path on a Device that saved nothing, and still allows manual sign-in', async () => {
    const user = userEvent.setup()
    const base = signedOut()
    const state: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, savedDollarSignIn: undefined } } }
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    expect(screen.queryByRole('button', { name: 'CONTINUE' })).not.toBeInTheDocument()
    expect(screen.queryByText('PERSONAL ACCOUNT')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('LOGIN ID'), 'local.civic')
    await user.type(screen.getByLabelText('PASSWORD'), 'violet-orbit-7')
    await user.click(screen.getByRole('button', { name: 'SIGN IN' }))
    expect(screen.getByText('$1,250.00')).toBeInTheDocument()
  })

  it('leaves invalid manual credentials signed out', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={signedOut()}><Wallet /></GameProvider>)
    await user.type(screen.getByLabelText('LOGIN ID'), 'local.civic')
    await user.type(screen.getByLabelText('PASSWORD'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'SIGN IN' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid login ID or password.')
    expect(screen.queryByText('$1,250.00')).not.toBeInTheDocument()
  })
})

describe('Wallet action strip', () => {
  it('offers exactly the three Dollar surfaces that exist, and nothing the world does not represent', () => {
    render(<GameProvider><Wallet /></GameProvider>)
    const strip = document.querySelector('.dollar-actions') as HTMLElement
    expect([...strip.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['SEND', 'RECEIVE', 'ACCOUNT'])
    // There is no represented finance scanner, payment request or QR identity,
    // so the Wallet must not offer a control that implies one.
    expect(screen.queryByRole('button', { name: 'SCAN' })).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/SCAN|QR|REQUEST|INVOICE/i)
  })

  it('labels every action in text rather than relying on its icon alone', () => {
    render(<GameProvider><Wallet /></GameProvider>)
    for (const name of ['SEND', 'RECEIVE', 'ACCOUNT']) {
      const action = screen.getByRole('button', { name })
      expect(action).toHaveAccessibleName(name)
      expect(action.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }
  })
})

describe('Wallet RECEIVE', () => {
  it('presents the authorized Account reference and no receiving mechanic at all', async () => {
    const user = userEvent.setup()
    render(<GameProvider><Wallet /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'RECEIVE' }))

    const receive = screen.getByLabelText('Receive money')
    expect(within(receive).getByText('CD-1042-7781')).toBeInTheDocument()
    expect(within(receive).getByText('Civic Dollar')).toBeInTheDocument()
    expect(within(receive).getByRole('button', { name: 'Copy account number CD-1042-7781' })).toBeInTheDocument()
    // Nothing here creates or promises money.
    expect(receive.querySelector('canvas, img')).toBeNull()
    expect(receive.textContent).not.toMatch(/QR|REQUEST|INVOICE|AMOUNT|ARRIV|SETTLE|GUARANTEE/i)
    expect(within(receive).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows only the Account the Device Session actually reaches', async () => {
    const user = userEvent.setup()
    const base = createInitialGameState()
    const unrelated = { id: 'unrelated-account', accountReference: 'CD-OTHER-0009', balanceCents: 100 }
    render(<GameProvider initialState={{ ...base, dollarFinance: { ...base.dollarFinance, accounts: [unrelated, ...base.dollarFinance.accounts] } }}><Wallet /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'RECEIVE' }))
    expect(screen.getByText('CD-1042-7781')).toBeInTheDocument()
    expect(screen.queryByText('CD-OTHER-0009')).not.toBeInTheDocument()
  })

  it('changes no canonical state by being opened and left', async () => {
    const user = userEvent.setup()
    const before = withRecipient(minedState(10_000))
    render(<GameProvider initialState={before}><Wallet /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'RECEIVE' }))
    expect(screen.queryByLabelText('NODE wallet')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '← BACK' }))

    expect(screen.getByText('$1,250.00')).toBeInTheDocument()
    expect(screen.getByText('NO ACTIVITY YET')).toBeInTheDocument()
    expect(screen.getByLabelText('NODE wallet')).toBeInTheDocument()
    expect(before.dollarFinance.transactions.records).toEqual([])
    expect(before.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-local-v0')?.balanceCents).toBe(125_000)
  })
})

describe('Wallet balance trajectory', () => {
  const trajectory = () => document.querySelector('.dollar-trajectory polyline')
  const vertices = () => trajectory()?.getAttribute('points')?.trim().split(/\s+/) ?? []

  it('draws no history for an Account that has none', () => {
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)
    expect(screen.getByText('$1,250.00')).toBeInTheDocument()
    expect(trajectory()).toBeNull()
  })

  it('draws exactly the two represented balance states after one real transfer', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)
    await send(user, RECIPIENT.accountReference, '25.50')
    await confirmSend(user)

    expect(screen.getByText('$1,224.50')).toBeInTheDocument()
    expect(vertices()).toHaveLength(2)
  })

  it('reconstructs the whole sequence from canonical Transactions and the canonical balance', () => {
    const base = withRecipient()
    const local = 'dollar-account-local-v0'
    const state: GameState = {
      ...base,
      dollarFinance: {
        ...base.dollarFinance,
        // $1,250.00 → −$100.00 → +$25.00 → −$5.00 = $1,170.00, exactly as canonical state says.
        accounts: base.dollarFinance.accounts.map((account) => account.id === local ? { ...account, balanceCents: 117_000 } : account),
        transactions: { nextId: 4, records: [
          { id: 'dollar-transaction-0001', sourceAccountId: local, destinationAccountId: RECIPIENT.id, amountCents: 10_000, sourceAccountReference: 'CD-1042-7781', destinationAccountReference: RECIPIENT.accountReference },
          { id: 'dollar-transaction-0002', sourceAccountId: RECIPIENT.id, destinationAccountId: local, amountCents: 2_500, sourceAccountReference: RECIPIENT.accountReference, destinationAccountReference: 'CD-1042-7781' },
          { id: 'dollar-transaction-0003', sourceAccountId: local, destinationAccountId: RECIPIENT.id, amountCents: 500, sourceAccountReference: 'CD-1042-7781', destinationAccountReference: RECIPIENT.accountReference },
        ] },
      },
    }
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)

    expect(screen.getByText('$1,170.00')).toBeInTheDocument()
    // Four represented balance states for three Transactions, oldest first, and
    // the opening state ($1,250.00) is the highest of them.
    const points = vertices().map((point) => point.split(',').map(Number))
    expect(points).toHaveLength(4)
    expect(points[0]).toEqual([0, 0])
    expect(points[3][0]).toBe(100)
    expect(points[1][1]).toBeGreaterThan(points[2][1])
  })

  it('keeps no derived trajectory in canonical state', () => {
    const state = withRecipient()
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    expect(Object.keys(state.dollarFinance)).toEqual(['provider', 'accounts', 'credentials', 'sessions', 'transactions'])
    expect(JSON.stringify(state)).not.toMatch(/trajectory|balanceHistory|sparkline/i)
  })
})

describe('Wallet activity presentation', () => {
  it('states direction, counterparty and signed amount, and invents nothing beside them', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)
    await send(user, RECIPIENT.accountReference, '25.50')
    await confirmSend(user)

    const row = screen.getByText('−$25.50').closest('.node-row') as HTMLElement
    expect(within(row).getByText('CD-2000-0002')).toBeInTheDocument()
    expect(within(row).getByText('SENT')).toBeInTheDocument()
    expect(row.querySelector('.dollar-activity-mark--outgoing')).not.toBeNull()
    // No time, no category, no counterparty name, no status, no memo.
    expect(row.textContent).toBe('CD-2000-0002SENT−$25.50')
  })
})

describe('Wallet SEND composition', () => {
  it('leads with the amount and states the source Account without adding transfer mechanics', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'SEND' }))

    const entry = screen.getByLabelText('Send money')
    const fields = [...entry.querySelectorAll('.node-field > span')].map((label) => label.textContent)
    expect(fields).toEqual(['AMOUNT', 'TO ACCOUNT'])
    expect(within(entry).getByText('AVAILABLE').closest('div')).toHaveTextContent('$1,250.00')
    expect(within(entry).getByText('FROM').closest('div')).toHaveTextContent('CD-1042-7781')
    expect(entry.textContent).not.toMatch(/ARRIV|SETTLE|SPEED|SECURE|GUARANTEE|NETWORK/i)
  })

  it('makes review the consequential step and carries no unrepresented transfer facts', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={withRecipient()}><Wallet /></GameProvider>)
    await send(user, RECIPIENT.accountReference, '700')

    const review = screen.getByLabelText('Review transfer')
    expect(within(review).getByText('$700.00')).toBeInTheDocument()
    expect(within(review).getByRole('button', { name: 'CONFIRM & SEND' })).toBeInTheDocument()
    expect(review.textContent).not.toMatch(/ARRIV|SETTLE|TOTAL|SPEED|SECURE|GUARANTEE|PENDING/i)
    // Still nothing has moved.
    expect(screen.queryByText('$550.00')).not.toBeInTheDocument()
  })
})

describe('Wallet ACCOUNT composition', () => {
  it('presents the current Account as one identity module derived from canonical state', async () => {
    const user = userEvent.setup()
    const base = createInitialGameState()
    const state: GameState = { ...base, dollarFinance: { ...base.dollarFinance, provider: { ...base.dollarFinance.provider, displayName: 'Meridian Dollar' } } }
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ACCOUNT' }))

    const card = document.querySelector('.dollar-identity-card') as HTMLElement
    expect(within(card).getByText('CD-1042-7781')).toBeInTheDocument()
    expect(within(card).getByText('Meridian Dollar')).toBeInTheDocument()
    // The monogram is a projection of the represented provider name, not a brand.
    expect(within(card).getByText('MD')).toBeInTheDocument()
    expect(within(card).getByText('BALANCE').closest('div')).toHaveTextContent('$1,250.00')
  })

  it('keeps SIGN OUT secondary and destructive rather than a primary finance action', async () => {
    const user = userEvent.setup()
    render(<GameProvider><Wallet /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ACCOUNT' }))

    const signOut = screen.getByRole('button', { name: 'SIGN OUT' })
    expect(signOut.className).toContain('node-action--destructive')
    expect(signOut.className).not.toContain('dollar-primary')
    // The saved personal path is the primary one wherever it is offered.
    expect(screen.queryByRole('button', { name: 'CONTINUE' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SIGN IN' }).className).not.toContain('dollar-primary')
  })

  it('never renders saved or submitted password material in the signed-in DOM', async () => {
    const user = userEvent.setup()
    render(<GameProvider><Wallet /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ACCOUNT' }))
    await user.type(screen.getByLabelText('PASSWORD'), 'violet-orbit-7')

    expect(screen.getByLabelText('PASSWORD')).toHaveAttribute('type', 'password')
    expect(document.body.textContent).not.toContain('violet-orbit-7')
    expect(document.querySelector('[type="text"][name="password"]')).toBeNull()
  })
})

describe('Wallet signed out composition', () => {
  it('stays a composed financial surface and still exposes no Account truth', () => {
    render(<GameProvider initialState={signedOut()}><Wallet /></GameProvider>)
    const surface = screen.getByLabelText('Dollar account signed out')
    expect(surface.querySelector('.dollar-hero')).not.toBeNull()
    expect(within(surface).getByText('Civic Dollar')).toBeInTheDocument()
    expect(within(surface).getByText('Signed out')).toBeInTheDocument()
    expect(within(surface).getByText('PERSONAL ACCOUNT')).toBeInTheDocument()
    expect(within(surface).getByText('local.civic')).toBeInTheDocument()
    expect(surface.querySelector('.dollar-trajectory')).toBeNull()
    expect(surface.textContent).not.toContain('$')
    expect(surface.textContent).not.toContain('CD-1042-7781')
  })
})
