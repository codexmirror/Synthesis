import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { AUTH_017, AUTH_031, vulnerabilitiesForService } from './serviceImplementations'

describe('GateSSH release vulnerability truth', () => {
  it('derives each authored weakness from its owning GateSSH release', () => {
    const services = createInitialGameState().world.network.hosts.flatMap((host) => host.services ?? []).filter((service) => service.implementation.productId === 'gate-ssh')
    expect(services).toHaveLength(3)

    const gateSsh132Services = services.filter((service) => service.implementation.releaseId === 'gate-ssh-1.3.2')
    const gateSsh133Services = services.filter((service) => service.implementation.releaseId === 'gate-ssh-1.3.3')

    expect(gateSsh132Services).toHaveLength(2)
    expect(gateSsh132Services.map(vulnerabilitiesForService)).toEqual([[AUTH_017], [AUTH_017]])
    expect(gateSsh133Services).toHaveLength(1)
    expect(vulnerabilitiesForService(gateSsh133Services[0])).toEqual([AUTH_031])
  })

  it('does not expose either authored weakness from a GateSSH 1.4.0 fixture', () => {
    const service = createInitialGameState().world.network.hosts[0].services![0]
    const fixed = { ...service, implementation: { ...service.implementation, releaseId: 'gate-ssh-1.4.0', version: '1.4.0' } }
    expect(vulnerabilitiesForService(fixed)).toEqual([])
  })
})
