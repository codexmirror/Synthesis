import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import {
  ATLAS_DISTRIBUTION_COMPANY_ID,
  ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID,
  BOOKSTORE_BRANCH_ID,
  BOOKSTORE_TREASURY_ACCOUNT_ID,
  NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID,
} from '../../core/game/business'
import { executeBookstoreSale } from '../../core/game/bookstoreSale'
import { BUSINESS_PRODUCT_ID } from '../../core/game/businessSoftware'
import { createInitialGameState } from '../../core/game/initialState'
import { connectRemoteFromObservation, resolveActiveRemoteTarget } from '../../core/game/remoteSession'
import { Shell } from '../../shell/Shell'
import { VeyraOS } from './VeyraOS'
import type { GameState } from '../../core/game/types'
import type { EditingViewportState } from '../../shell/useEditingViewport'
import { withoutBookstoreCadenceTiming } from '../../test/canonicalSnapshot'

let viewport: EditingViewportState
const endEditing = vi.fn()
vi.mock('../../shell/useEditingViewport', () => ({
  useEditingViewport: () => ({ ...viewport, endEditing }),
}))

const PHONE_DEVICE_ID = 'host-phone-001'
const PHONE_ADDRESS = '198.51.100.61'
const PHONE_ACCOUNT_ID = 'dollar-account-veyra-phone-v0'

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

/** Real represented Bookstore sales — the way this Company actually comes to have money. */
function earnRestockPrice(state: GameState, sales = 7): GameState {
  let next = state
  for (let index = 0; index < sales; index += 1) {
    const samples = [0, 0.999999]
    const sale = executeBookstoreSale(next, BOOKSTORE_BRANCH_ID, () => samples.shift() ?? 0)
    if (sale.status !== 'sold') throw new Error(`sale ${index} refused: ${sale.status}`)
    next = sale.state
  }
  return next
}

function State() {
  return <output data-testid="state">{JSON.stringify(useGameState())}</output>
}

const canonical = (): GameState => JSON.parse(screen.getByTestId('state').textContent ?? '')
/**
 * The same canonical state with only Sales Cadence's continuously advancing
 * countdown normalized, for the "this interaction changed nothing else"
 * comparisons: that field legitimately moves under GameProvider's own
 * advancement while a test runs.
 */
const canonicalSettled = (): GameState => withoutBookstoreCadenceTiming(canonical())
const balance = (state: GameState, accountId: string) => state.dollarFinance.accounts.find(({ id }) => id === accountId)!.balanceCents
const totalStock = (state: GameState) => state.bookstoreOperations.records
  .find((record) => record.branchId === BOOKSTORE_BRANCH_ID)!.stock.reduce((sum, entry) => sum + entry.quantity, 0)

async function openBusiness(state = phoneConnectedState(), user = userEvent.setup()) {
  render(<GameProvider initialState={state}><Shell /><State /></GameProvider>)
  await user.click(screen.getByRole('button', { name: 'ENTER VEYRA OS →' }))
  await user.click(screen.getByRole('button', { name: 'Business' }))
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

describe('VEYRA Business presence', () => {
  it('follows the represented installation, not Company authority or Firmware', async () => {
    const user = userEvent.setup()
    const withoutSoftware = phoneConnectedState()
    const uninstalled: GameState = { ...withoutSoftware, world: { ...withoutSoftware.world, network: { ...withoutSoftware.world.network,
      hosts: withoutSoftware.world.network.hosts.map((host) => host.id === PHONE_DEVICE_ID ? { ...host, installedSoftware: [] } : host) } } }
    render(<GameProvider initialState={uninstalled}><Shell /><State /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ENTER VEYRA OS →' }))

    const home = screen.getByRole('region', { name: 'Home' })
    expect(within(home).queryByRole('button', { name: 'Business' })).toBeNull()
    // The Company Administration truth underneath is untouched by removing the software.
    expect(canonical().business.administrationSessions).toEqual(uninstalled.business.administrationSessions)
  })

  it('stays on Home while the Device holds no Company authority at all', async () => {
    const connected = phoneConnectedState()
    const withoutAuthority: GameState = { ...connected, business: { ...connected.business, administrationSessions: [] } }
    await openBusiness(withoutAuthority)

    const business = screen.getByRole('region', { name: 'Business' })
    expect(business).toHaveTextContent('No company access available.')
    // No Company truth and no action are exposed.
    expect(business.textContent).not.toContain('Bookstore')
    expect(business.textContent).not.toContain('Atlas')
    expect(within(business).queryByRole('button')).toBeNull()
  })

  it('refuses to choose when the Device administers several Companies', async () => {
    const connected = phoneConnectedState()
    const both: GameState = { ...connected, business: { ...connected.business, administrationSessions: [
      ...connected.business.administrationSessions,
      { id: 'company-administration-session-atlas-phone-v0', clientDeviceId: PHONE_DEVICE_ID, companyId: ATLAS_DISTRIBUTION_COMPANY_ID },
    ] } }
    await openBusiness(both)

    const business = screen.getByRole('region', { name: 'Business' })
    expect(business).toHaveTextContent('more than one company')
    expect(business.textContent).not.toContain('Compact Shelf Refill')
  })

  it('stops presenting Business if the installation stops being represented while it is open', async () => {
    // The same mounted phone throughout, so the open Business surface — not a
    // fresh one — is what loses the software underneath it.
    const state = phoneConnectedState()
    const context = resolveActiveRemoteTarget(state)!
    const user = userEvent.setup()
    const props = { hidden: false, onReturnLocal: () => {}, editingRecoveryReady: true, onEndEditing: () => {} }
    const { rerender } = render(<GameProvider initialState={state}><VeyraOS context={context} {...props} /><State /></GameProvider>)

    await user.click(screen.getByRole('button', { name: 'Business' }))
    expect(screen.getByRole('region', { name: 'Business' })).toBeInTheDocument()

    const uninstalled = { ...context, target: { ...context.target, installedSoftware: [] } }
    rerender(<GameProvider initialState={state}><VeyraOS context={uninstalled} {...props} /><State /></GameProvider>)
    expect(screen.queryByRole('region', { name: 'Business' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Home' })).toBeInTheDocument()
    // Losing the client software is not losing the Company relationship.
    expect(canonical().business.administrationSessions).toEqual(state.business.administrationSessions)
  })
})

describe('VEYRA Business surface', () => {
  it('presents Company, Branch, funds, inventory, supply and orders from represented truth', async () => {
    const user = await openBusiness(phoneConnectedState(earnRestockPrice(createInitialGameState())))
    const business = screen.getByRole('region', { name: 'Business' })
    const state = canonical()

    expect(business).toHaveTextContent('Bookstore')
    expect(business).toHaveTextContent('Bookstore Branch 01')
    expect(business).toHaveTextContent('18 Mercer Street')
    // Company funds are the Company Treasury balance, never the phone's own Account.
    expect(business).toHaveTextContent(`$${(balance(state, BOOKSTORE_TREASURY_ACCOUNT_ID) / 100).toFixed(2)}`)
    expect(business.textContent).not.toContain('CD-3318-2204')
    expect(business).not.toHaveTextContent('Night Transit')
    await user.click(within(business).getByRole('button', { name: /View inventory/i }))
    expect(screen.getByRole('region', { name: 'Inventory' })).toHaveTextContent('Night Transit')
    expect(business).toHaveTextContent('Compact Shelf Refill')
    expect(business).toHaveTextContent('Atlas Distribution')
    expect(business).toHaveTextContent('$140.00')
    expect(business).toHaveTextContent('30 minutes')
    expect(business).toHaveTextContent('Standard Shelf Refill')
    expect(business).toHaveTextContent('$340.00')

    // No invented metric of any kind.
    expect(business.textContent).not.toMatch(/health|efficiency|forecast|projected|profit|margin|rating|valuation|recommend/i)
    // No technical or authority context.
    expect(business.textContent).not.toContain(PHONE_DEVICE_ID)
    expect(business.textContent).not.toContain(PHONE_ADDRESS)
    expect(business.textContent).not.toContain('company-administration-session')
  })

  it('presents funds as unavailable rather than substituting an Account', async () => {
    const connected = phoneConnectedState(earnRestockPrice(createInitialGameState()))
    const undesignated: GameState = { ...connected, business: { ...connected.business,
      treasuryDesignations: connected.business.treasuryDesignations.filter(({ companyId }) => companyId !== 'company-bookstore-01') } }
    await openBusiness(undesignated)

    const business = screen.getByRole('region', { name: 'Business' })
    expect(business).toHaveTextContent('Unavailable')
    expect(business.textContent).not.toContain(`$${(balance(undesignated, PHONE_ACCOUNT_ID) / 100).toFixed(2)}`)
  })

  it('reviews an offer without mutating any canonical state', async () => {
    const user = await openBusiness(phoneConnectedState(earnRestockPrice(createInitialGameState())))
    const before = canonicalSettled()

    await user.click(screen.getByRole('button', { name: /Compact Shelf Refill/ }))
    const review = screen.getByRole('region', { name: 'Review order' })
    expect(review).toHaveTextContent('Atlas Distribution')
    expect(review).toHaveTextContent('$140.00')
    expect(review).toHaveTextContent('16 units')
    expect(review).toHaveTextContent('30 minutes')
    expect(review).toHaveTextContent('Night Transit')
    expect(canonicalSettled()).toEqual(before)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('region', { name: 'Business' })).toBeInTheDocument()
    expect(canonicalSettled()).toEqual(before)

    await user.click(screen.getByRole('button', { name: /New Titles Pack/ }))
    const northlineReview = screen.getByRole('region', { name: 'Review order' })
    expect(northlineReview).toHaveTextContent('Northline Book Supply')
    expect(northlineReview).toHaveTextContent('$120.00')
    expect(northlineReview).toHaveTextContent('12 units')
    expect(northlineReview).toHaveTextContent('45 minutes')
    for (const title of ['Terminal Light', 'Red Harbor', 'Field Notes', 'Borrowed Signal']) {
      expect(northlineReview).toHaveTextContent(title)
    }
    expect(northlineReview).not.toHaveTextContent('Winter Circuit')
    expect(canonicalSettled()).toEqual(before)
  })

  it('refuses honestly and changes nothing when the Company cannot pay', async () => {
    // No sales have happened, so the Bookstore Treasury is empty.
    const user = await openBusiness()
    await user.click(screen.getByRole('button', { name: /Compact Shelf Refill/ }))
    const before = canonical()

    await user.click(screen.getByRole('button', { name: 'Place order' }))
    expect(screen.getByRole('alert')).toHaveTextContent('The payment for this order was refused.')
    const after = canonical()
    expect(after.bookstoreRestock.orders).toEqual([])
    expect(after.dollarFinance.transactions.records).toEqual(before.dollarFinance.transactions.records)
    expect(balance(after, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(balance(before, BOOKSTORE_TREASURY_ACCOUNT_ID))
    expect(balance(after, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)).toBe(balance(before, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID))
    expect(totalStock(after)).toBe(totalStock(before))
  })

  it('exposes no management truth or action once Company authority is gone', async () => {
    const connected = phoneConnectedState(earnRestockPrice(createInitialGameState()))
    const withoutAuthority: GameState = { ...connected, business: { ...connected.business, administrationSessions: [] } }
    await openBusiness(withoutAuthority)

    const business = screen.getByRole('region', { name: 'Business' })
    expect(business).toHaveTextContent('No company access available.')
    expect(business.textContent).not.toContain('Compact Shelf Refill')
    // Wallet, whose basis is the untouched Financial Session, is still on Home.
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
  })

  it('runs the whole represented Northline loop through the authorized Business path', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const funded = earnRestockPrice(createInitialGameState())
      const user = await openBusiness(phoneConnectedState(funded), userEvent.setup({ advanceTimers: vi.advanceTimersByTime }))
      const before = canonical()
      expect(balance(before, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBeGreaterThanOrEqual(12_000)
      const phoneBefore = balance(before, PHONE_ACCOUNT_ID)
      const stockBefore = totalStock(before)

      await user.click(screen.getByRole('button', { name: /New Titles Pack/ }))
      await user.click(screen.getByRole('button', { name: 'Place order' }))

      // The order exists, the Bookstore Treasury paid Northline exactly, and the phone Account funded nothing.
      const placed = canonical()
      expect(placed.bookstoreRestock.orders).toHaveLength(1)
      expect(placed.bookstoreRestock.orders[0].status).toBe('IN_TRANSIT')
      expect(balance(placed, BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(balance(before, BOOKSTORE_TREASURY_ACCOUNT_ID) - 12_000)
      expect(balance(placed, NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID)).toBe(balance(before, NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID) + 12_000)
      expect(balance(placed, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)).toBe(balance(before, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID))
      expect(balance(placed, PHONE_ACCOUNT_ID)).toBe(phoneBefore)
      expect(placed.dollarFinance.transactions.records.at(-1)).toMatchObject({
        sourceAccountId: BOOKSTORE_TREASURY_ACCOUNT_ID, destinationAccountId: NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID, amountCents: 12_000,
      })
      // Paid for is not yet sellable.
      expect(totalStock(placed)).toBe(stockBefore)

      const ordered = screen.getByRole('region', { name: 'Business' })
      expect(ordered).toHaveTextContent('Order placed with Northline Book Supply.')
      expect(ordered).toHaveTextContent('In transit')
      expect(ordered).toHaveTextContent('New Titles Pack')

      // Canonical advancement alone delivers it; the client causes nothing.
      await act(async () => { vi.advanceTimersByTime(2_700_000) })
      const delivered = canonical()
      expect(delivered.bookstoreRestock.orders[0].status).toBe('DELIVERED')
      expect(screen.getByRole('region', { name: 'Business' })).toHaveTextContent('Delivered')
      // Delivery landed in Bookstore Operations, which ordinary sales then keep consuming.
      expect(delivered.bookstoreRestock.orders[0].lines.reduce((sum, line) => sum + line.quantity, 0)).toBe(12)
      expect(delivered.bookstoreCommerce.records[0].assortment).toHaveLength(12)
      expect(totalStock(delivered)).toBeGreaterThan(stockBefore - 12)
    } finally {
      vi.useRealTimers()
    }
  })

  it('never gives the client a way to name money, an Account or a Company', async () => {
    await openBusiness(phoneConnectedState(earnRestockPrice(createInitialGameState())))
    const business = screen.getByRole('region', { name: 'Business' })

    // No transfer, sign-in or arbitrary-amount affordance exists anywhere on this surface.
    expect(within(business).queryByRole('textbox')).toBeNull()
    expect(within(business).queryByRole('button', { name: /send|receive|transfer|sign in/i })).toBeNull()
    expect(business.textContent).not.toContain(BOOKSTORE_TREASURY_ACCOUNT_ID)
    expect(business.textContent).not.toContain('CD-4827-6109')
    // Opening Business creates no Financial Session of any kind.
    expect(canonical().dollarFinance.sessions.active.map(({ clientDeviceId }) => clientDeviceId)).toEqual(['device-local-v0', PHONE_DEVICE_ID])
    expect(canonical().dollarFinance.sessions.active.every(({ accountId }) => accountId !== BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(true)
    expect(BUSINESS_PRODUCT_ID).toBe('business')
  })
})
