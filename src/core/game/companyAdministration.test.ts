import { describe, expect, it } from 'vitest'
import {
  placeBookstoreRestockOrderForDevice,
  placeBookstoreRestockOrderFromOperatedRemoteDevice,
  resolveCompanyAdministrationSession,
} from './companyAdministration'
import {
  ATLAS_DISTRIBUTION_COMPANY_ID,
  ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID,
  BOOKSTORE_BRANCH_ID,
  BOOKSTORE_COMPANY_ID,
  BOOKSTORE_PHONE_ADMINISTRATION_SESSION_ID,
  BOOKSTORE_TREASURY_ACCOUNT_ID,
} from './business'
import { BOOKSTORE_COMPACT_REFILL_OFFER_ID } from './bookstoreRestock'
import { executeBookstoreSale } from './bookstoreSale'
import { connectRemoteFromObservation, disconnectRemoteSession } from './remoteSession'
import { createInitialGameState } from './initialState'
import type { GameState } from './types'

const PHONE_ID = 'host-phone-001'
const OPS_ID = 'host-lan-003'

function earnRestockPrice(state: GameState): GameState {
  let next = state
  for (let index = 0; index < 7; index += 1) {
    const samples = [0, 0.999999]
    const sale = executeBookstoreSale(next, BOOKSTORE_BRANCH_ID, () => samples.shift() ?? 0)
    if (sale.status !== 'sold') throw new Error(`sale ${index} refused: ${sale.status}`)
    next = sale.state
  }
  return next
}

function operating(state: GameState, targetDeviceId: string, viaServiceId: string, address: string): GameState {
  const accessed: GameState = {
    ...state,
    deviceAccess: { nextId: 2, established: [{ id: `access-${targetDeviceId}`, sourceDeviceId: state.player.localDevice.id, targetDeviceId, viaServiceId, privilege: 'USER' }] },
  }
  const connected = connectRemoteFromObservation(accessed, { targetDeviceId, address })
  if (connected.status !== 'connected') throw new Error(`remote connection refused: ${connected.status}`)
  return connected.state
}

function withoutAdministration(state: GameState): GameState {
  return { ...state, business: { ...state.business, administrationSessions: [] } }
}

describe('Company Administration Session', () => {
  it('seeds exactly the phone to Bookstore relationship without Atlas, local-Device, or ops authority', () => {
    const state = createInitialGameState()
    expect(state.business.administrationSessions).toEqual([{
      id: BOOKSTORE_PHONE_ADMINISTRATION_SESSION_ID,
      clientDeviceId: PHONE_ID,
      companyId: BOOKSTORE_COMPANY_ID,
    }])
    expect(resolveCompanyAdministrationSession(state, PHONE_ID, BOOKSTORE_COMPANY_ID)).toBe(state.business.administrationSessions[0])
    expect(resolveCompanyAdministrationSession(state, state.player.localDevice.id, BOOKSTORE_COMPANY_ID)).toBeUndefined()
    expect(resolveCompanyAdministrationSession(state, OPS_ID, BOOKSTORE_COMPANY_ID)).toBeUndefined()
    expect(resolveCompanyAdministrationSession(state, PHONE_ID, ATLAS_DISTRIBUTION_COMPANY_ID)).toBeUndefined()
    expect(state.business.administrationSessions[0]).not.toHaveProperty('accountId')
    expect(state.business.administrationSessions[0]).not.toHaveProperty('role')
  })

  it('fails closed for missing, dangling, duplicated, or structurally ambiguous represented truth', () => {
    const state = createInitialGameState()
    expect(resolveCompanyAdministrationSession(state, 'device-missing', BOOKSTORE_COMPANY_ID)).toBeUndefined()
    expect(resolveCompanyAdministrationSession(state, PHONE_ID, 'company-missing')).toBeUndefined()
    expect(resolveCompanyAdministrationSession(withoutAdministration(state), PHONE_ID, BOOKSTORE_COMPANY_ID)).toBeUndefined()

    const dangling: GameState = { ...state, business: { ...state.business, administrationSessions: [{ id: 'dangling', clientDeviceId: 'device-missing', companyId: BOOKSTORE_COMPANY_ID }] } }
    expect(resolveCompanyAdministrationSession(dangling, 'device-missing', BOOKSTORE_COMPANY_ID)).toBeUndefined()
    const duplicatedSession: GameState = { ...state, business: { ...state.business, administrationSessions: [...state.business.administrationSessions, { id: 'duplicate', clientDeviceId: PHONE_ID, companyId: BOOKSTORE_COMPANY_ID }] } }
    expect(resolveCompanyAdministrationSession(duplicatedSession, PHONE_ID, BOOKSTORE_COMPANY_ID)).toBeUndefined()
    const duplicatedIdentity: GameState = { ...state, business: { ...state.business, administrationSessions: [...state.business.administrationSessions, { id: BOOKSTORE_PHONE_ADMINISTRATION_SESSION_ID, clientDeviceId: OPS_ID, companyId: ATLAS_DISTRIBUTION_COMPANY_ID }] } }
    expect(resolveCompanyAdministrationSession(duplicatedIdentity, PHONE_ID, BOOKSTORE_COMPANY_ID)).toBeUndefined()
    const duplicatedDevice: GameState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, id: PHONE_ID } } }
    expect(resolveCompanyAdministrationSession(duplicatedDevice, PHONE_ID, BOOKSTORE_COMPANY_ID)).toBeUndefined()
    const duplicatedCompany: GameState = { ...state, business: { ...state.business, companies: [...state.business.companies, state.business.companies[0]] } }
    expect(resolveCompanyAdministrationSession(duplicatedCompany, PHONE_ID, BOOKSTORE_COMPANY_ID)).toBeUndefined()
  })

  it('persists independently when the player disconnects the RemoteSession', () => {
    const operated = operating(createInitialGameState(), PHONE_ID, 'service-ssh-003', '198.51.100.61')
    const disconnected = disconnectRemoteSession(operated)
    expect(disconnected.status).toBe('disconnected')
    expect(disconnected.state.business.administrationSessions).toBe(operated.business.administrationSessions)
    expect(resolveCompanyAdministrationSession(disconnected.state, PHONE_ID, BOOKSTORE_COMPANY_ID)).toBeDefined()
  })

  it('authorizes the Bookstore action without a phone FinancialSession and settles only Company Treasuries', () => {
    const earned = earnRestockPrice(createInitialGameState())
    const signedOutPhone: GameState = { ...earned, dollarFinance: { ...earned.dollarFinance, sessions: { ...earned.dollarFinance.sessions, active: earned.dollarFinance.sessions.active.filter(({ clientDeviceId }) => clientDeviceId !== PHONE_ID) } } }
    const phoneBalance = signedOutPhone.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-veyra-phone-v0')!.balanceCents
    const result = placeBookstoreRestockOrderForDevice(signedOutPhone, PHONE_ID, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    expect(result.status).toBe('ordered')
    if (result.status !== 'ordered') throw new Error('expected order')
    expect(result.state.dollarFinance.accounts.find(({ id }) => id === BOOKSTORE_TREASURY_ACCOUNT_ID)?.balanceCents).toBe(0)
    expect(result.state.dollarFinance.accounts.find(({ id }) => id === ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)?.balanceCents).toBe(14_000)
    expect(result.state.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-veyra-phone-v0')?.balanceCents).toBe(phoneBalance)
    expect(result.state.dollarFinance.transactions.records.at(-1)).toMatchObject({ sourceAccountId: BOOKSTORE_TREASURY_ACCOUNT_ID, destinationAccountId: ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID, amountCents: 14_000 })
  })

  it('refuses atomically when administration is absent despite Treasury, phone finance, access, RemoteSession, Network membership, and management authority', () => {
    const earned = earnRestockPrice(createInitialGameState())
    const phoneOperated = operating(withoutAdministration(earned), PHONE_ID, 'service-ssh-003', '198.51.100.61')
    const phoneSnapshot = structuredClone(phoneOperated)
    const phoneResult = placeBookstoreRestockOrderFromOperatedRemoteDevice(phoneOperated, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    expect(phoneResult).toEqual({ status: 'administration_unavailable', state: phoneOperated })
    expect(phoneResult.state).toBe(phoneOperated)
    expect(phoneOperated).toEqual(phoneSnapshot)
    expect(phoneOperated.dollarFinance.sessions.active.some(({ clientDeviceId }) => clientDeviceId === PHONE_ID)).toBe(true)

    const operated = operating(withoutAdministration(earned), OPS_ID, 'service-ssh-004', '203.0.113.43')
    const input: GameState = { ...operated, networkManagement: { ...operated.networkManagement, established: [...operated.networkManagement.established, { id: 'network-management-bookstore-fixture', deviceId: OPS_ID, networkId: 'network-foreign-001' }] } }
    const snapshot = structuredClone(input)
    const result = placeBookstoreRestockOrderFromOperatedRemoteDevice(input, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    expect(result).toEqual({ status: 'administration_unavailable', state: input })
    expect(result.state).toBe(input)
    expect(input).toEqual(snapshot)
  })

  it('uses RemoteSession only to resolve the acting Device and proves the living sales-to-order path', () => {
    const earned = earnRestockPrice(createInitialGameState())
    const transactionsBefore = earned.dollarFinance.transactions.records.length
    const withoutRemote = placeBookstoreRestockOrderFromOperatedRemoteDevice(earned, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    expect(withoutRemote).toEqual({ status: 'session_unavailable', state: earned })

    const operated = operating(earned, PHONE_ID, 'service-ssh-003', '198.51.100.61')
    const result = placeBookstoreRestockOrderFromOperatedRemoteDevice(operated, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID)
    expect(result.status).toBe('ordered')
    if (result.status !== 'ordered') throw new Error('expected order')
    expect(result.state.bookstoreRestock.orders).toHaveLength(1)
    expect(result.state.bookstoreRestock.orders[0].status).toBe('IN_TRANSIT')
    expect(result.state.dollarFinance.transactions.records).toHaveLength(transactionsBefore + 1)
    expect(result.state.remoteSession).toBe(operated.remoteSession)
  })

  it('authorizes another represented Firmware and Device type solely from its explicit Device + Company relationship', () => {
    const earned = earnRestockPrice(createInitialGameState())
    const alternateId = 'host-lan-001'
    const alternate = earned.world.network.hosts.find(({ id }) => id === alternateId)!
    expect(alternate.deviceType).not.toBe('PHONE')
    expect(alternate.firmware?.name).not.toBe('VEYRA OS')
    const represented: GameState = { ...earned, business: { ...earned.business, administrationSessions: [{ id: 'company-administration-session-alternate-v0', clientDeviceId: alternateId, companyId: BOOKSTORE_COMPANY_ID }] } }
    expect(placeBookstoreRestockOrderForDevice(represented, alternateId, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPACT_REFILL_OFFER_ID).status).toBe('ordered')
  })
})
