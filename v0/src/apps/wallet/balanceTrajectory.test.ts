import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../../core/game/initialState'
import { projectDollarAccountActivity, transferDollars } from '../../core/game/dollarFinance'
import type { GameState } from '../../core/game/types'
import { deriveDollarBalanceTrajectory, dollarTrajectoryPolylinePoints } from './balanceTrajectory'

const ACCOUNT = 'dollar-account-local-v0'
const OTHER = { id: 'dollar-account-other', accountReference: 'CD-2000-0002', balanceCents: 4_000 }
const OTHER_CREDENTIAL = { id: 'dollar-credential-other', accountId: OTHER.id, loginIdentifier: 'other.civic', password: 'other-secret' }

function worldWithSecondAccount(): GameState {
  const base = createInitialGameState()
  return { ...base, dollarFinance: { ...base.dollarFinance, accounts: [...base.dollarFinance.accounts, OTHER], credentials: [...base.dollarFinance.credentials, OTHER_CREDENTIAL] } }
}

/** Moves money through the canonical operation, so the fixture's Transactions are real ones. */
function sent(state: GameState, recipientReference: string, amountCents: number): GameState {
  const result = transferDollars(state, state.player.localDevice.id, recipientReference, amountCents)
  if (result.status !== 'transferred') throw new Error(result.status)
  return result.state
}

describe('Dollar balance trajectory', () => {
  it('is a single represented state when the Account has no Transactions', () => {
    const state = createInitialGameState()
    expect(deriveDollarBalanceTrajectory(125_000, projectDollarAccountActivity(state, ACCOUNT))).toEqual([125_000])
  })

  it('reconstructs the two represented states either side of one Transaction', () => {
    const state = sent(worldWithSecondAccount(), OTHER.accountReference, 2_550)
    const account = state.dollarFinance.accounts.find(({ id }) => id === ACCOUNT)!
    expect(account.balanceCents).toBe(122_450)
    expect(deriveDollarBalanceTrajectory(account.balanceCents, projectDollarAccountActivity(state, ACCOUNT))).toEqual([125_000, 122_450])
  })

  it('walks mixed incoming and outgoing Transactions back to the Account opening balance', () => {
    let state = sent(worldWithSecondAccount(), OTHER.accountReference, 10_000)
    // The other Account sends some back, so the sequence contains both directions.
    state = sent({ ...state, dollarFinance: { ...state.dollarFinance, sessions: { ...state.dollarFinance.sessions, active: [{ id: 'dollar-session-other', accountId: OTHER.id, clientDeviceId: state.player.localDevice.id }] } } }, 'CD-1042-7781', 2_500)
    state = { ...state, dollarFinance: { ...state.dollarFinance, sessions: { ...state.dollarFinance.sessions, active: [{ id: 'dollar-session-0001', accountId: ACCOUNT, clientDeviceId: state.player.localDevice.id }] } } }
    state = sent(state, OTHER.accountReference, 500)

    const account = state.dollarFinance.accounts.find(({ id }) => id === ACCOUNT)!
    expect(account.balanceCents).toBe(117_000)
    expect(deriveDollarBalanceTrajectory(account.balanceCents, projectDollarAccountActivity(state, ACCOUNT)))
      .toEqual([125_000, 115_000, 117_500, 117_000])
  })

  it('follows the canonical balance rather than a remembered one', () => {
    // The same activity against a different current balance describes a different past.
    const state = sent(worldWithSecondAccount(), OTHER.accountReference, 2_550)
    const activity = projectDollarAccountActivity(state, ACCOUNT)
    expect(deriveDollarBalanceTrajectory(500_000, activity)).toEqual([502_550, 500_000])
  })
})

describe('Dollar trajectory geometry', () => {
  it('draws nothing from a single represented balance state', () => {
    expect(dollarTrajectoryPolylinePoints([125_000], 100, 34)).toBeUndefined()
    expect(dollarTrajectoryPolylinePoints([], 100, 34)).toBeUndefined()
  })

  it('spans the box from the lowest to the highest represented state, oldest first', () => {
    expect(dollarTrajectoryPolylinePoints([100, 300, 200], 100, 34)).toBe('0,34 50,0 100,17')
  })

  it('renders a flat series as a flat line rather than a division by zero', () => {
    expect(dollarTrajectoryPolylinePoints([100, 100], 100, 34)).toBe('0,17 100,17')
  })
})
