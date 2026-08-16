import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { scanNetworkTarget } from './scan'

const network = createInitialGameState().world.network

describe('scanNetworkTarget', () => {
  it('returns the stable entity identity separately from the online host address', () => {
    expect(scanNetworkTarget(network, '203.0.113.42')).toEqual({
      status: 'reachable',
      targetId: 'host-training-001',
      address: '203.0.113.42',
    })
  })

  it('makes known offline and valid unknown targets observationally identical', () => {
    expect(scanNetworkTarget(network, '203.0.113.99')).toEqual({
      status: 'no_response', address: '203.0.113.99',
    })
    expect(scanNetworkTarget(network, '192.0.2.10')).toEqual({
      status: 'no_response', address: '192.0.2.10',
    })
  })

  it.each(['garbage', '999.999.999.999', '1.2.3', '01.2.3.4'])(
    'rejects invalid IPv4 target %s',
    (input) => expect(scanNetworkTarget(network, input)).toEqual({ status: 'invalid_target', input }),
  )
})
