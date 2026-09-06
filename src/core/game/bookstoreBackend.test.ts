import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_BRANCH_ID } from './business'
import { BOOKSTORE_BACKEND_DEVICE_ID, BOOKSTORE_BACKEND_SERVICE_ID, resolveBookstoreBackendForBranch } from './bookstoreBackend'

describe('bookstore backend initial truth', () => {
  it('seeds one concrete branch-linked backend record referencing the generic Branch and the real srv-02 Device/Service by stable ID', () => {
    const state = createInitialGameState()
    expect(state.bookstoreBackend.records).toEqual([{
      branchId: BOOKSTORE_BRANCH_ID,
      deviceId: BOOKSTORE_BACKEND_DEVICE_ID,
      serviceId: BOOKSTORE_BACKEND_SERVICE_ID,
    }])
    expect(BOOKSTORE_BACKEND_DEVICE_ID).toBe('host-lan-002')
  })

  it('represents the backend as a real Device-owned Service on srv-02, not a fabricated Business server', () => {
    const state = createInitialGameState()
    const host = state.world.network.hosts.find(({ id }) => id === BOOKSTORE_BACKEND_DEVICE_ID)
    const service = host?.services?.find(({ id }) => id === BOOKSTORE_BACKEND_SERVICE_ID)
    expect(service).toMatchObject({
      name: 'Bookstore Backend',
      open: true,
      implementation: { name: 'Bookstore Backend', version: '1.0' },
    })
    // No credential-based access, and no derived vulnerability — this slice represents the technical surface only.
    expect(service?.credentialAccess).toBeUndefined()
  })
})

describe('resolveBookstoreBackendForBranch', () => {
  it('resolves the seeded backend as ONLINE while srv-02 is running and connected with the Service open', () => {
    const state = createInitialGameState()
    const backend = resolveBookstoreBackendForBranch(state, BOOKSTORE_BRANCH_ID)
    expect(backend).toEqual({
      deviceId: BOOKSTORE_BACKEND_DEVICE_ID,
      serviceId: BOOKSTORE_BACKEND_SERVICE_ID,
      name: 'Bookstore Backend',
      version: '1.0',
      available: true,
    })
  })

  it('resolves undefined for a Branch with no represented backend record — a legitimate structural state, not a defect', () => {
    const state = createInitialGameState()
    expect(resolveBookstoreBackendForBranch(state, 'branch-with-no-backend')).toBeUndefined()
  })

  it('resolves independently of commerce and operations: a Branch may have a backend without either', () => {
    const initial = createInitialGameState()
    const state = {
      ...initial,
      business: { ...initial.business, branches: [...initial.business.branches, { id: 'branch-fixture-backend-only', displayName: 'Fixture Backend-Only Branch', companyId: initial.business.companies[0].id, networkId: 'network-foreign-001' }] },
      bookstoreBackend: { records: [...initial.bookstoreBackend.records, { branchId: 'branch-fixture-backend-only', deviceId: BOOKSTORE_BACKEND_DEVICE_ID, serviceId: BOOKSTORE_BACKEND_SERVICE_ID }] },
    }
    expect(resolveBookstoreBackendForBranch(state, 'branch-fixture-backend-only')).toEqual({
      deviceId: BOOKSTORE_BACKEND_DEVICE_ID, serviceId: BOOKSTORE_BACKEND_SERVICE_ID, name: 'Bookstore Backend', version: '1.0', available: true,
    })
    expect(state.bookstoreCommerce.records.some((record) => record.branchId === 'branch-fixture-backend-only')).toBe(false)
    expect(state.bookstoreOperations.records.some((record) => record.branchId === 'branch-fixture-backend-only')).toBe(false)
  })

  it('resolves a differently configured Branch through an alternate Device/Service fixture, proving resolution is data-driven rather than dispatched on the seeded literal identity', () => {
    const initial = createInitialGameState()
    const state = {
      ...initial,
      business: { ...initial.business, branches: [...initial.business.branches, { id: 'branch-fixture-alt', displayName: 'Fixture Alt Branch', companyId: initial.business.companies[0].id, networkId: 'network-local-001' }] },
      bookstoreBackend: { records: [...initial.bookstoreBackend.records, { branchId: 'branch-fixture-alt', deviceId: 'host-lan-001', serviceId: 'service-http-001' }] },
    }
    // Neither `host-lan-001` nor `service-http-001` is the seeded bookstore-backend device/service, and this Branch is not `bookstore-branch-01` — the resolver still follows the record's own stable references.
    expect(resolveBookstoreBackendForBranch(state, 'branch-fixture-alt')).toEqual({
      deviceId: 'host-lan-001', serviceId: 'service-http-001', name: 'Basic HTTP', version: '1.0', available: true,
    })
    // The originally seeded Branch backend is unaffected by the alternate fixture.
    expect(resolveBookstoreBackendForBranch(state, BOOKSTORE_BRANCH_ID)).toEqual({
      deviceId: BOOKSTORE_BACKEND_DEVICE_ID, serviceId: BOOKSTORE_BACKEND_SERVICE_ID, name: 'Bookstore Backend', version: '1.0', available: true,
    })
  })

  it('derives OFFLINE from the referenced Device no longer being network-usable, rather than a stored status', () => {
    const initial = createInitialGameState()
    const state = {
      ...initial,
      world: {
        network: {
          ...initial.world.network,
          hosts: initial.world.network.hosts.map((host) => host.id === BOOKSTORE_BACKEND_DEVICE_ID
            ? { ...host, operational: { lifecycle: 'BOOTING' as const, connectivity: 'DISCONNECTED' as const } }
            : host),
        },
      },
    }
    expect(resolveBookstoreBackendForBranch(state, BOOKSTORE_BRANCH_ID)).toMatchObject({ available: false })
  })

  it('derives OFFLINE from the referenced Service being closed, rather than a stored status', () => {
    const initial = createInitialGameState()
    const state = {
      ...initial,
      world: {
        network: {
          ...initial.world.network,
          hosts: initial.world.network.hosts.map((host) => host.id === BOOKSTORE_BACKEND_DEVICE_ID
            ? { ...host, services: host.services?.map((service) => service.id === BOOKSTORE_BACKEND_SERVICE_ID ? { ...service, open: false } : service) }
            : host),
        },
      },
    }
    expect(resolveBookstoreBackendForBranch(state, BOOKSTORE_BRANCH_ID)).toMatchObject({ available: false })
  })

  it('resolves undefined where the referenced Device no longer exists, rather than fabricating an OFFLINE backend', () => {
    const initial = createInitialGameState()
    const state = {
      ...initial,
      world: { network: { ...initial.world.network, hosts: initial.world.network.hosts.filter(({ id }) => id !== BOOKSTORE_BACKEND_DEVICE_ID) } },
    }
    expect(resolveBookstoreBackendForBranch(state, BOOKSTORE_BRANCH_ID)).toBeUndefined()
  })

  it('resolves undefined where the referenced Service no longer exists on that Device, rather than fabricating an OFFLINE backend', () => {
    const initial = createInitialGameState()
    const state = {
      ...initial,
      world: {
        network: {
          ...initial.world.network,
          hosts: initial.world.network.hosts.map((host) => host.id === BOOKSTORE_BACKEND_DEVICE_ID
            ? { ...host, services: host.services?.filter(({ id }) => id !== BOOKSTORE_BACKEND_SERVICE_ID) }
            : host),
        },
      },
    }
    expect(resolveBookstoreBackendForBranch(state, BOOKSTORE_BRANCH_ID)).toBeUndefined()
  })

  it('generic Business resolution stays independent of backend presence: removing the backend record leaves the Branch resolvable', () => {
    const initial = createInitialGameState()
    const state = { ...initial, bookstoreBackend: { records: [] } }
    expect(resolveBookstoreBackendForBranch(state, BOOKSTORE_BRANCH_ID)).toBeUndefined()
    expect(state.business.branches.some(({ id }) => id === BOOKSTORE_BRANCH_ID)).toBe(true)
  })
})
