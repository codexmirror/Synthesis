import { describe, expect, it } from 'vitest'
import {
  NETWORK_ACTIVITY_HISTORY_CAPACITY,
  appendNetworkConnectionAttemptEvidence,
  appendNetworkFileTransferEvidence,
  resolveDeviceLocalNetworkMembership,
  resolveNetworkActivityPlacements,
} from './networkActivityHistory'
import { createInitialGameState } from './initialState'
import type { WorldState } from './types'

const HOME_NET_ID = 'network-local-001'
const REMOTE_NET_ID = 'network-foreign-001'

const connectionObservation = {
  sourceDeviceId: 'device-local-v0', targetDeviceId: 'host-lan-001',
  sourceAddress: '198.51.100.23', targetAddress: '198.51.100.47',
  serviceId: 'service-ssh-001', serviceName: 'SSH', result: 'SUCCESS' as const,
}

const transferObservation = {
  sourceDeviceId: 'host-lan-001', destinationDeviceId: 'device-local-v0',
  sourceAddress: '198.51.100.47', destinationAddress: '198.51.100.23',
  bytesTransferred: 1234, result: 'COMPLETED' as const,
}

function findNetwork(world: WorldState, id: string) {
  return world.network.localNetworks.find((network) => network.id === id)
}

describe('resolveDeviceLocalNetworkMembership', () => {
  it('distinguishes none, unique, and ambiguous membership', () => {
    const world = createInitialGameState().world
    expect(resolveDeviceLocalNetworkMembership(world.network, 'host-training-002')).toEqual({ kind: 'none' })
    expect(resolveDeviceLocalNetworkMembership(world.network, 'device-local-v0')).toMatchObject({ kind: 'unique', network: { id: HOME_NET_ID } })
    const ambiguousNetworks = { ...world.network, localNetworks: [...world.network.localNetworks, { ...world.network.localNetworks[0], id: 'network-shadow', memberDeviceIds: ['device-local-v0'] }] }
    expect(resolveDeviceLocalNetworkMembership(ambiguousNetworks, 'device-local-v0')).toEqual({ kind: 'ambiguous' })
  })
})

describe('resolveNetworkActivityPlacements', () => {
  it('places one internal record when both endpoints resolve to the same unique Network', () => {
    const world = createInitialGameState().world
    expect(resolveNetworkActivityPlacements(world.network, 'device-local-v0', 'host-lan-001')).toEqual([{ networkId: HOME_NET_ID, perspective: 'internal' }])
  })

  it('places distinct outbound/inbound records for two different unique Networks', () => {
    const world = createInitialGameState().world
    expect(resolveNetworkActivityPlacements(world.network, 'device-local-v0', 'host-lan-002')).toEqual([
      { networkId: HOME_NET_ID, perspective: 'outbound' },
      { networkId: REMOTE_NET_ID, perspective: 'inbound' },
    ])
  })

  it('places only the legitimately resolved side when the other endpoint has zero membership, never fabricating the other side', () => {
    const world = createInitialGameState().world
    expect(resolveNetworkActivityPlacements(world.network, 'device-local-v0', 'host-training-002')).toEqual([{ networkId: HOME_NET_ID, perspective: 'outbound' }])
    expect(resolveNetworkActivityPlacements(world.network, 'host-training-002', 'device-local-v0')).toEqual([{ networkId: HOME_NET_ID, perspective: 'inbound' }])
  })

  it('never selects an ambiguous side by array order, in either order', () => {
    const world = createInitialGameState().world
    const shadow = { ...world.network.localNetworks[1], id: 'network-shadow', memberDeviceIds: ['host-lan-002'] }
    const appended = { ...world.network, localNetworks: [...world.network.localNetworks, shadow] }
    const prepended = { ...world.network, localNetworks: [shadow, ...world.network.localNetworks] }
    // host-lan-002 is now ambiguous (remote-segment-01 and network-shadow); only the local side is legitimate.
    expect(resolveNetworkActivityPlacements(appended, 'device-local-v0', 'host-lan-002')).toEqual([{ networkId: HOME_NET_ID, perspective: 'outbound' }])
    expect(resolveNetworkActivityPlacements(prepended, 'device-local-v0', 'host-lan-002')).toEqual([{ networkId: HOME_NET_ID, perspective: 'outbound' }])
  })

  it('places nothing when both endpoints have zero membership', () => {
    const world = createInitialGameState().world
    const noMembership = { ...world.network, localNetworks: world.network.localNetworks.map((network) => ({ ...network, memberDeviceIds: [] })) }
    expect(resolveNetworkActivityPlacements(noMembership, 'device-local-v0', 'host-lan-002')).toEqual([])
  })
})

describe('appendNetworkConnectionAttemptEvidence', () => {
  it('appends one internal record to the shared Network for a same-Network attempt', () => {
    const world = createInitialGameState().world
    const updated = appendNetworkConnectionAttemptEvidence(world, connectionObservation)
    expect(findNetwork(updated, HOME_NET_ID)?.activityHistory.records).toEqual([
      { id: 'net-activity-0001', kind: 'connection_attempt', perspective: 'internal', ...connectionObservation },
    ])
    expect(findNetwork(updated, REMOTE_NET_ID)?.activityHistory.records).toEqual([])
  })

  it('appends distinct source-side and destination-side records for a cross-Network attempt', () => {
    const world = createInitialGameState().world
    const crossObservation = { ...connectionObservation, targetDeviceId: 'host-lan-002', targetAddress: '203.0.113.42' }
    const updated = appendNetworkConnectionAttemptEvidence(world, crossObservation)
    expect(findNetwork(updated, HOME_NET_ID)?.activityHistory.records).toEqual([
      { id: 'net-activity-0001', kind: 'connection_attempt', perspective: 'outbound', ...crossObservation },
    ])
    expect(findNetwork(updated, REMOTE_NET_ID)?.activityHistory.records).toEqual([
      { id: 'net-activity-0001', kind: 'connection_attempt', perspective: 'inbound', ...crossObservation },
    ])
  })

  it('creates no fabricated record for an unresolved/no-Network endpoint', () => {
    const world = createInitialGameState().world
    const fromTrainingHost = { ...connectionObservation, sourceDeviceId: 'host-training-002', targetDeviceId: 'device-local-v0', sourceAddress: '203.0.113.99' }
    const updated = appendNetworkConnectionAttemptEvidence(world, fromTrainingHost)
    // Only home-net (the local Device's own unique Network) legitimately observes this; the training host has no represented membership.
    expect(findNetwork(updated, HOME_NET_ID)?.activityHistory.records).toHaveLength(1)
    expect(findNetwork(updated, REMOTE_NET_ID)?.activityHistory.records).toEqual([])
  })

  it('never stores Player, toolkit, vulnerability, or attack-label identity', () => {
    const world = createInitialGameState().world
    const updated = appendNetworkConnectionAttemptEvidence(world, connectionObservation)
    const record = findNetwork(updated, HOME_NET_ID)?.activityHistory.records[0]
    expect(Object.keys(record!).sort()).toEqual(['id', 'kind', 'perspective', 'result', 'serviceId', 'serviceName', 'sourceAddress', 'sourceDeviceId', 'targetAddress', 'targetDeviceId'].sort())
  })

  it('leaves unrelated Networks untouched', () => {
    const world = createInitialGameState().world
    const updated = appendNetworkConnectionAttemptEvidence(world, connectionObservation)
    expect(findNetwork(updated, REMOTE_NET_ID)).toBe(findNetwork(world, REMOTE_NET_ID))
  })
})

describe('appendNetworkFileTransferEvidence', () => {
  it('appends one internal record for a same-Network terminal transfer, preserving the exact terminal result and bytesTransferred', () => {
    const world = createInitialGameState().world
    const updated = appendNetworkFileTransferEvidence(world, transferObservation)
    expect(findNetwork(updated, HOME_NET_ID)?.activityHistory.records).toEqual([
      { id: 'net-activity-0001', kind: 'file_transfer', perspective: 'internal', ...transferObservation },
    ])
  })

  it('records CANCELLED and INTERRUPTED results with their own bytesTransferred snapshot', () => {
    const world = createInitialGameState().world
    const cancelled = appendNetworkFileTransferEvidence(world, { ...transferObservation, result: 'CANCELLED', bytesTransferred: 0 })
    expect(findNetwork(cancelled, HOME_NET_ID)?.activityHistory.records[0]).toMatchObject({ result: 'CANCELLED', bytesTransferred: 0 })
    const interrupted = appendNetworkFileTransferEvidence(world, { ...transferObservation, result: 'INTERRUPTED', bytesTransferred: 512 })
    expect(findNetwork(interrupted, HOME_NET_ID)?.activityHistory.records[0]).toMatchObject({ result: 'INTERRUPTED', bytesTransferred: 512 })
  })

  it('appends distinct source-side and destination-side records for a cross-Network transfer', () => {
    const world = createInitialGameState().world
    const crossObservation = { ...transferObservation, sourceDeviceId: 'host-lan-002', sourceAddress: '203.0.113.42' }
    const updated = appendNetworkFileTransferEvidence(world, crossObservation)
    expect(findNetwork(updated, REMOTE_NET_ID)?.activityHistory.records).toEqual([
      { id: 'net-activity-0001', kind: 'file_transfer', perspective: 'outbound', ...crossObservation },
    ])
    expect(findNetwork(updated, HOME_NET_ID)?.activityHistory.records).toEqual([
      { id: 'net-activity-0001', kind: 'file_transfer', perspective: 'inbound', ...crossObservation },
    ])
  })

  it('never stores filesystem path, filename, or file contents', () => {
    const world = createInitialGameState().world
    const updated = appendNetworkFileTransferEvidence(world, transferObservation)
    const record = findNetwork(updated, HOME_NET_ID)?.activityHistory.records[0]
    expect(Object.keys(record!).sort()).toEqual(['bytesTransferred', 'destinationAddress', 'destinationDeviceId', 'id', 'kind', 'perspective', 'result', 'sourceAddress', 'sourceDeviceId'].sort())
  })
})

describe('retention', () => {
  it('bounds retention at a fixed V1 capacity, evicting the oldest record while per-Network identity never rewinds', () => {
    let world = createInitialGameState().world
    for (let index = 0; index < NETWORK_ACTIVITY_HISTORY_CAPACITY + 5; index += 1) {
      world = appendNetworkConnectionAttemptEvidence(world, connectionObservation)
    }
    const history = findNetwork(world, HOME_NET_ID)?.activityHistory
    expect(history?.records).toHaveLength(NETWORK_ACTIVITY_HISTORY_CAPACITY)
    expect(history?.records[0]?.id).toBe('net-activity-0006')
    expect(history?.records.at(-1)?.id).toBe(`net-activity-${String(NETWORK_ACTIVITY_HISTORY_CAPACITY + 5).padStart(4, '0')}`)
    expect(history?.nextId).toBe(NETWORK_ACTIVITY_HISTORY_CAPACITY + 6)
  })

  it('keeps home-net and remote-segment-01 histories independent', () => {
    const world = createInitialGameState().world
    const crossObservation = { ...connectionObservation, targetDeviceId: 'host-lan-002', targetAddress: '203.0.113.42' }
    const updated = appendNetworkConnectionAttemptEvidence(world, crossObservation)
    expect(findNetwork(updated, HOME_NET_ID)?.activityHistory.records).toHaveLength(1)
    expect(findNetwork(updated, REMOTE_NET_ID)?.activityHistory.records).toHaveLength(1)
    expect(findNetwork(updated, HOME_NET_ID)?.activityHistory.nextId).toBe(2)
    expect(findNetwork(updated, REMOTE_NET_ID)?.activityHistory.nextId).toBe(2)
  })
})
