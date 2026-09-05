import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import {
  BOOKSTORE_BRANCH_NETWORK_ID,
  BOOKSTORE_COMPANY_ID,
  resolveBusinessOperatingContext,
} from './business'

const HOME_NET_ID = 'network-local-001'
const NODE_01_ID = 'device-local-v0'
const SRV_01_ID = 'host-lan-001'
const SRV_02_ID = 'host-lan-002'

describe('business domain initial truth', () => {
  it('keeps one stable Company independent from Branch, Network, Device and any commerce subsystem', () => {
    const state = createInitialGameState()
    expect(state.business.companies).toEqual([{ id: BOOKSTORE_COMPANY_ID, displayName: 'Bookstore' }])
    expect(state.business.companies[0].id).not.toBe(BOOKSTORE_BRANCH_NETWORK_ID)
    expect(state.business.companies[0].id).not.toBe(SRV_02_ID)
  })

  it('keeps one stable generic Branch with explicit Company and Network relationships and no embedded commerce fields', () => {
    const state = createInitialGameState()
    expect(state.business.branches).toHaveLength(1)
    const branch = state.business.branches[0]
    // Generic Branch identity is exactly this shape — nothing more.
    expect(branch).toEqual({
      id: 'bookstore-branch-01', displayName: 'Bookstore Branch 01',
      companyId: BOOKSTORE_COMPANY_ID, networkId: BOOKSTORE_BRANCH_NETWORK_ID,
    })
    expect(branch.id).not.toBe(branch.companyId)
    expect(branch.id).not.toBe(branch.networkId)
    expect(branch.id).not.toBe(state.player.id)
    // No operationsDeviceId dependency, and no commerce/finance fields embedded on generic Branch identity.
    expect(branch).not.toHaveProperty('operationsDeviceId')
    expect(branch).not.toHaveProperty('settlementAccountId')
    expect(branch).not.toHaveProperty('completedSales')
  })
})

describe('resolveBusinessOperatingContext', () => {
  it('resolves the represented bookstore Branch structurally for a Device whose Network membership matches the explicit Branch → Network relationship, with no operationsDeviceId involved', () => {
    const state = createInitialGameState()
    const context = resolveBusinessOperatingContext(state, SRV_02_ID)
    expect(context.networks.map(({ id }) => id)).toEqual([BOOKSTORE_BRANCH_NETWORK_ID])
    expect(context.branches).toHaveLength(1)
    const resolved = context.branches[0]
    expect(resolved.branch.id).toBe('bookstore-branch-01')
    expect(resolved.company).toEqual({ id: BOOKSTORE_COMPANY_ID, displayName: 'Bookstore' })
    expect(resolved.network.id).toBe(BOOKSTORE_BRANCH_NETWORK_ID)
    // Structural resolution carries no commerce/finance projection of its own.
    expect(resolved).not.toHaveProperty('settlementAccount')
    expect(resolved).not.toHaveProperty('sales')
  })

  it('resolves a structurally valid Branch with no bookstore-commerce record at all, independent of Civic Dollar', () => {
    const initial = createInitialGameState()
    const noCommerceBranch = { id: 'branch-fixture-no-commerce', displayName: 'Fixture Hosting Branch', companyId: BOOKSTORE_COMPANY_ID, networkId: HOME_NET_ID }
    // Even with every Civic Dollar Account removed, structural resolution must still succeed:
    // it never depends on finance to answer the structural Company/Branch/Network question.
    const state = {
      ...initial,
      business: { ...initial.business, branches: [...initial.business.branches, noCommerceBranch] },
      dollarFinance: { ...initial.dollarFinance, accounts: [] },
    }
    const context = resolveBusinessOperatingContext(state, NODE_01_ID)
    expect(context.branches).toHaveLength(1)
    expect(context.branches[0].branch.id).toBe('branch-fixture-no-commerce')
    expect(context.branches[0].company.displayName).toBe('Bookstore')
    expect(context.branches[0].network.id).toBe(HOME_NET_ID)
  })

  it('resolves zero Business Branches for a Device on a Network with none — a legitimate state, not an error', () => {
    const state = createInitialGameState()
    // node-01 and srv-01 are both members of home-net, which has no associated Business Branch.
    const nodeContext = resolveBusinessOperatingContext(state, NODE_01_ID)
    expect(nodeContext.networks.map(({ id }) => id)).toEqual([HOME_NET_ID])
    expect(nodeContext.branches).toEqual([])
    const srv01Context = resolveBusinessOperatingContext(state, SRV_01_ID)
    expect(srv01Context.networks.map(({ id }) => id)).toEqual([HOME_NET_ID])
    expect(srv01Context.branches).toEqual([])
  })

  it('resolves no Network context at all for a Device with no represented Network membership', () => {
    const state = createInitialGameState()
    const context = resolveBusinessOperatingContext(state, 'host-training-002')
    expect(context.networks).toEqual([])
    expect(context.branches).toEqual([])
  })

  it('grants no NetworkManagementAuthority, DeviceAccess, or ownership merely from Network membership', () => {
    const state = createInitialGameState()
    const before = { networkManagement: state.networkManagement, deviceAccess: state.deviceAccess, discovery: state.discovery, knowledge: state.knowledge }
    resolveBusinessOperatingContext(state, SRV_02_ID)
    // Reading is non-mutating; nothing about it could have changed these, but assert the domains explicitly stay separate concerns.
    expect(state.networkManagement).toEqual(before.networkManagement)
    expect(state.deviceAccess).toEqual(before.deviceAccess)
    expect(state.discovery).toEqual(before.discovery)
    expect(state.knowledge).toEqual(before.knowledge)
    // srv-02's Network has no explicit NetworkManagementAuthority relationship at all.
    expect(state.networkManagement.established.some((authority) => authority.networkId === BOOKSTORE_BRANCH_NETWORK_ID)).toBe(false)
  })

  it('multiplicity: two Branches may reference the same Network without identity collision, a Company may own more than one Branch, and resolution returns every relevant Branch rather than assuming one', () => {
    const initial = createInitialGameState()
    const secondCompanyId = 'company-fixture-second'
    const secondBranchOnSameNetwork = { id: 'branch-fixture-second', displayName: 'Fixture Branch Two', companyId: secondCompanyId, networkId: BOOKSTORE_BRANCH_NETWORK_ID }
    const secondBranchOfSameCompany = { id: 'branch-fixture-third', displayName: 'Fixture Branch Three', companyId: BOOKSTORE_COMPANY_ID, networkId: HOME_NET_ID }
    const state = {
      ...initial,
      business: {
        companies: [...initial.business.companies, { id: secondCompanyId, displayName: 'Fixture Co' }],
        branches: [...initial.business.branches, secondBranchOnSameNetwork, secondBranchOfSameCompany],
      },
    }

    // Two Branches on the same Network resolve independently, with no overwrite.
    const context = resolveBusinessOperatingContext(state, SRV_02_ID)
    expect(context.branches.map((resolved) => resolved.branch.id).sort()).toEqual(['bookstore-branch-01', 'branch-fixture-second'])
    expect(context.branches.find((resolved) => resolved.branch.id === 'branch-fixture-second')?.company.displayName).toBe('Fixture Co')
    expect(context.branches.find((resolved) => resolved.branch.id === 'bookstore-branch-01')?.company.displayName).toBe('Bookstore')

    // The original Company now owns two Branches on two different Networks.
    expect(state.business.branches.filter((branch) => branch.companyId === BOOKSTORE_COMPANY_ID).map(({ id }) => id).sort())
      .toEqual(['bookstore-branch-01', 'branch-fixture-third'])

    // A Device on home-net resolves the fixture Branch placed there, unaffected by the other Network's Branches.
    const homeContext = resolveBusinessOperatingContext(state, NODE_01_ID)
    expect(homeContext.branches.map((resolved) => resolved.branch.id)).toEqual(['branch-fixture-third'])
  })
})
