import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { AUTH_017, vulnerabilitiesForService } from './serviceImplementations'

describe('GateSSH release vulnerability truth', () => {
  it('derives the shared AUTH-017 identity for both GateSSH 1.3.2 instances', () => {
    const services = createInitialGameState().world.network.hosts.flatMap((host) => host.services ?? []).filter((service) => service.implementation.productId === 'gate-ssh')
    expect(services).toHaveLength(2)
    expect(services.map(vulnerabilitiesForService)).toEqual([[AUTH_017], [AUTH_017]])
  })

  it('does not expose AUTH-017 from a GateSSH 1.4.0 fixture', () => {
    const service = createInitialGameState().world.network.hosts[0].services![0]
    const fixed = { ...service, implementation: { ...service.implementation, releaseId: 'gate-ssh-1.4.0', version: '1.4.0' } }
    expect(vulnerabilitiesForService(fixed)).toEqual([])
  })
})
