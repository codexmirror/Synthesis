import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { deriveEffectiveTransferRateBytesPerSecond, isValidNetworkTransferCapacity } from './networkTransferCapacity'

function findHost(state: ReturnType<typeof createInitialGameState>, id: string) {
  return state.world.network.hosts.find((host) => host.id === id)!
}

describe('canonical represented endpoint capacities', () => {
  it('gives node-01 1 MiB/s transmit and 2 MiB/s receive', () => {
    const state = createInitialGameState()
    expect(state.player.localDevice.network.transferCapacity).toEqual({ txBytesPerSecond: 1_048_576, rxBytesPerSecond: 2_097_152 })
  })

  it('gives srv-01 symmetric 8 MiB/s transmit and receive', () => {
    const state = createInitialGameState()
    expect(findHost(state, 'host-lan-001').transferCapacity).toEqual({ txBytesPerSecond: 8_388_608, rxBytesPerSecond: 8_388_608 })
  })

  it('gives srv-02 symmetric 1 MiB/s transmit and receive, distinct from srv-01', () => {
    const state = createInitialGameState()
    expect(findHost(state, 'host-lan-002').transferCapacity).toEqual({ txBytesPerSecond: 1_048_576, rxBytesPerSecond: 1_048_576 })
    expect(findHost(state, 'host-lan-002').transferCapacity).not.toEqual(findHost(state, 'host-lan-001').transferCapacity)
  })

  it('does not deepen the shallow training hosts with an invented capacity', () => {
    const state = createInitialGameState()
    expect(findHost(state, 'host-training-001').transferCapacity).toBeUndefined()
    expect(findHost(state, 'host-training-002').transferCapacity).toBeUndefined()
  })

  it('every canonical initial capacity is itself valid (finite and greater than zero)', () => {
    const state = createInitialGameState()
    expect(isValidNetworkTransferCapacity(state.player.localDevice.network.transferCapacity)).toBe(true)
    expect(isValidNetworkTransferCapacity(findHost(state, 'host-lan-001').transferCapacity!)).toBe(true)
    expect(isValidNetworkTransferCapacity(findHost(state, 'host-lan-002').transferCapacity!)).toBe(true)
  })
})

describe('deriveEffectiveTransferRateBytesPerSecond', () => {
  it('is the narrower of source transmit and destination receive capacity', () => {
    expect(deriveEffectiveTransferRateBytesPerSecond(
      { txBytesPerSecond: 10_485_760, rxBytesPerSecond: 999 },
      { txBytesPerSecond: 999, rxBytesPerSecond: 3_145_728 },
    )).toBe(3_145_728)

    expect(deriveEffectiveTransferRateBytesPerSecond(
      { txBytesPerSecond: 1_048_576, rxBytesPerSecond: 999 },
      { txBytesPerSecond: 999, rxBytesPerSecond: 9_437_184 },
    )).toBe(1_048_576)
  })

  it('derives the canonical srv-01 -> node-01 rate as node-01\'s narrower receive capacity', () => {
    const state = createInitialGameState()
    const rate = deriveEffectiveTransferRateBytesPerSecond(
      findHost(state, 'host-lan-001').transferCapacity!,
      state.player.localDevice.network.transferCapacity,
    )
    expect(rate).toBe(2_097_152)
  })

  it('derives the canonical node-01 -> srv-01 rate as node-01\'s narrower transmit capacity', () => {
    const state = createInitialGameState()
    const rate = deriveEffectiveTransferRateBytesPerSecond(
      state.player.localDevice.network.transferCapacity,
      findHost(state, 'host-lan-001').transferCapacity!,
    )
    expect(rate).toBe(1_048_576)
  })

  it('derives the canonical srv-02 -> node-01 rate as srv-02\'s narrower transmit capacity', () => {
    const state = createInitialGameState()
    const rate = deriveEffectiveTransferRateBytesPerSecond(
      findHost(state, 'host-lan-002').transferCapacity!,
      state.player.localDevice.network.transferCapacity,
    )
    expect(rate).toBe(1_048_576)
  })

  it('deterministically rejects zero, negative, and non-finite capacity values', () => {
    const valid = { txBytesPerSecond: 1_048_576, rxBytesPerSecond: 1_048_576 }
    for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => deriveEffectiveTransferRateBytesPerSecond({ ...valid, txBytesPerSecond: invalid }, valid)).toThrow(RangeError)
      expect(() => deriveEffectiveTransferRateBytesPerSecond(valid, { ...valid, rxBytesPerSecond: invalid })).toThrow(RangeError)
    }
    expect(isValidNetworkTransferCapacity({ txBytesPerSecond: 0, rxBytesPerSecond: 1 })).toBe(false)
    expect(isValidNetworkTransferCapacity({ txBytesPerSecond: -1, rxBytesPerSecond: 1 })).toBe(false)
    expect(isValidNetworkTransferCapacity({ txBytesPerSecond: Number.NaN, rxBytesPerSecond: 1 })).toBe(false)
    expect(isValidNetworkTransferCapacity({ txBytesPerSecond: Number.POSITIVE_INFINITY, rxBytesPerSecond: 1 })).toBe(false)
  })

  it('does not depend on IP, Device ID, Session, file kind, filename, or Process state; only the two capacity values', () => {
    expect(deriveEffectiveTransferRateBytesPerSecond(
      { txBytesPerSecond: 4_000_000, rxBytesPerSecond: 1 },
      { txBytesPerSecond: 1, rxBytesPerSecond: 2_000_000 },
    )).toBe(2_000_000)
  })
})

describe('availability remains distinct from capacity', () => {
  it('an offline represented host still carries its normal, non-zeroed transfer capacity', () => {
    const state = createInitialGameState()
    const host = findHost(state, 'host-lan-001')
    const offlineButCapable = { ...host, online: false }
    expect(offlineButCapable.transferCapacity).toEqual({ txBytesPerSecond: 8_388_608, rxBytesPerSecond: 8_388_608 })
    expect(offlineButCapable.transferCapacity!.txBytesPerSecond).not.toBe(0)
    expect(offlineButCapable.transferCapacity!.rxBytesPerSecond).not.toBe(0)
  })

  it('online remains a separate boolean attribute unaffected by reading capacity', () => {
    const state = createInitialGameState()
    const host = findHost(state, 'host-lan-002')
    expect(host.online).toBe(true)
    expect(host).not.toHaveProperty('transferCapacity.online')
  })
})
