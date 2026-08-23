import { describe, expect, it } from 'vitest'
import { AUTHENTICATION_HISTORY_CAPACITY, appendAuthenticationHistoryForHost } from './authenticationHistory'
import { createInitialGameState } from './initialState'

const observation = { serviceId: 'service-ssh-001', serviceName: 'SSH', sourceAddress: '198.51.100.23', result: 'SUCCESS' as const }

describe('Authentication history', () => {
  it('starts empty and appends deterministically ordered, monotonically identified records', () => {
    const world = createInitialGameState().world
    const first = appendAuthenticationHistoryForHost(world, 'host-lan-001', observation)
    const second = appendAuthenticationHistoryForHost(first, 'host-lan-001', { ...observation, result: 'FAILURE' })
    const records = second.network.hosts.find(({ id }) => id === 'host-lan-001')?.authenticationHistory?.records
    expect(records).toEqual([
      { id: 'auth-0001', ...observation },
      { id: 'auth-0002', ...observation, result: 'FAILURE' },
    ])
  })

  it('keeps srv-01 and srv-02 authentication history independent', () => {
    const world = createInitialGameState().world
    const withA = appendAuthenticationHistoryForHost(world, 'host-lan-001', observation)
    const withBoth = appendAuthenticationHistoryForHost(withA, 'host-lan-002', { ...observation, sourceAddress: '198.51.100.99' })
    const srv01 = withBoth.network.hosts.find(({ id }) => id === 'host-lan-001')
    const srv02 = withBoth.network.hosts.find(({ id }) => id === 'host-lan-002')
    expect(srv01?.authenticationHistory?.records).toEqual([{ id: 'auth-0001', ...observation }])
    expect(srv02?.authenticationHistory?.records).toEqual([{ id: 'auth-0001', ...observation, sourceAddress: '198.51.100.99' }])
  })

  it('bounds retention at a fixed V1 capacity, evicting the oldest record while the per-Device identity never rewinds', () => {
    let world = createInitialGameState().world
    for (let index = 0; index < AUTHENTICATION_HISTORY_CAPACITY + 5; index += 1) {
      world = appendAuthenticationHistoryForHost(world, 'host-lan-001', observation)
    }
    const history = world.network.hosts.find(({ id }) => id === 'host-lan-001')?.authenticationHistory
    expect(history?.records).toHaveLength(AUTHENTICATION_HISTORY_CAPACITY)
    // The oldest 5 records (auth-0001..auth-0005) were evicted; the retained window starts at auth-0006.
    expect(history?.records[0]?.id).toBe('auth-0006')
    expect(history?.records.at(-1)?.id).toBe(`auth-${String(AUTHENTICATION_HISTORY_CAPACITY + 5).padStart(4, '0')}`)
    // Record identity keeps climbing past capacity; it never rewinds back down.
    expect(history?.nextId).toBe(AUTHENTICATION_HISTORY_CAPACITY + 6)

    const next = appendAuthenticationHistoryForHost(world, 'host-lan-001', observation)
    const nextHistory = next.network.hosts.find(({ id }) => id === 'host-lan-001')?.authenticationHistory
    expect(nextHistory?.records).toHaveLength(AUTHENTICATION_HISTORY_CAPACITY)
    expect(nextHistory?.records.at(-1)?.id).toBe(`auth-${String(AUTHENTICATION_HISTORY_CAPACITY + 6).padStart(4, '0')}`)
  })

  it('leaves other hosts untouched', () => {
    const world = createInitialGameState().world
    const updated = appendAuthenticationHistoryForHost(world, 'host-lan-001', observation)
    for (const host of updated.network.hosts) {
      if (host.id !== 'host-lan-001') expect(host).toBe(world.network.hosts.find(({ id }) => id === host.id))
    }
  })
})
