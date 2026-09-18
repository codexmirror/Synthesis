import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { canFormCredentialAccessAttempt, GHOSTKEY_PROVIDER_ID } from '../core/game/credentialAccess'
import { resolveServiceEndpoint } from '../core/game/serviceAnalysis'
import { composeCanonicalOperationState } from './bootstrap'
import type { OnlineWorldDocument } from './model'
import { JsonWorldPersistence, ONLINE_GAME_STATE_92_MIGRATION_DESTINATION_VERSION } from './persistence'
import { OnlineWorldStore } from './worldStore'

const directories: string[] = []
async function temporaryPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'synthesis-persistence-'))
  directories.push(directory)
  return join(directory, 'world.json')
}

async function populatedCurrentDocument(path: string): Promise<OnlineWorldDocument> {
  const store = await new OnlineWorldStore(new JsonWorldPersistence(path)).open()
  await store.enter('migration-user', 'correct-horse-1')
  return store.inspectForTests()
}

function version92Fixture(current: OnlineWorldDocument): OnlineWorldDocument {
  const fixture = structuredClone(current) as unknown as Record<string, any>
  fixture.shared.state.version = 92
  fixture.shared.state.world.network.localNetworks.find(({ id }: any) => id === 'network-foreign-001').cidr = '203.0.113.0/24'
  const oldAddresses: Record<string, string> = {
    'host-lan-002': '203.0.113.42', 'host-lan-003': '203.0.113.43',
    'host-phone-001': '198.51.100.61', 'router-foreign-001': '203.0.113.1',
  }
  for (const host of fixture.shared.state.world.network.hosts) {
    if (oldAddresses[host.id]) host.ip = oldAddresses[host.id]
    if (host.deviceType === 'ROUTER') delete host.activityHistory
    if (host.id === 'router-foreign-001') { delete host.publicAddress; delete host.exposures }
  }
  return fixture as unknown as OnlineWorldDocument
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('JsonWorldPersistence version admission and migration', () => {
  it('creates and saves a fresh current document only when the initial read finds no file', async () => {
    const path = await temporaryPath()
    class CountingPersistence extends JsonWorldPersistence {
      saves = 0
      override async save(document: OnlineWorldDocument): Promise<void> { this.saves += 1; await super.save(document) }
    }
    const persistence = new CountingPersistence(path)

    const created = await persistence.loadOrCreate()
    expect(created.shared.state.version).toBe(93)
    expect(persistence.saves).toBe(1)
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(created)
  })

  it('loads a current document without rewriting it', async () => {
    const path = await temporaryPath()
    const current = await populatedCurrentDocument(path)
    class CountingPersistence extends JsonWorldPersistence {
      saves = 0
      override async save(document: OnlineWorldDocument): Promise<void> { this.saves += 1; await super.save(document) }
    }
    const persistence = new CountingPersistence(path)

    expect(await persistence.loadOrCreate()).toEqual(current)
    expect(persistence.saves).toBe(0)
  })

  it('durably migrates the genuine version-92 topology exactly once while preserving private and shared progression', async () => {
    const path = await temporaryPath()
    const current = await populatedCurrentDocument(path)
    const predecessor = version92Fixture(current) as any
    const player = predecessor.players[0]
    const localDevice = predecessor.shared.playerDevices.find(({ id }: any) => id === player.primaryDeviceId)
    const ghostKeyBefore = structuredClone(localDevice.filesystem.files.find(({ id }: any) => id === 'file-0003'))
    player.privateState.discovery.devices = [{
      id: 'host-phone-001', address: '198.51.100.61', scope: 'remote', services: [
        { id: 'service-ssh-003', name: 'SSH', port: 22, protocol: 'TCP', endpoint: '198.51.100.61:22', open: true, inspect: { implementation: { name: 'GateSSH', version: '1.3.2' } }, implementationAnalysisStale: true },
        { id: 'service-fresh-history', name: 'SSH', port: 2229, protocol: 'TCP', endpoint: '198.51.100.61:2229', open: true, inspect: { implementation: { name: 'GateSSH', version: '1.3.2' } } },
      ],
    }]
    player.privateState.knowledge.discoveredVulnerabilities = [{ vulnerabilityId: 'HISTORICAL-001', targetDeviceId: 'host-phone-001' }]
    player.privateState.process.processes = [{ id: 'process-history', kind: 'generic', label: 'HISTORY', status: 'completed', executorDeviceId: player.primaryDeviceId, workRequired: 1, workCompleted: 1, ramRequiredMiB: 1 }]
    predecessor.shared.state.nodeEconomy.accounts[0].balanceNodeUnits = 37
    const preservedPrivate = structuredClone(player.privateState)
    const preservedMail = structuredClone(predecessor.shared.state.mail)
    const preservedEconomy = structuredClone(predecessor.shared.state.nodeEconomy)
    const allocator = predecessor.nextHomeSubnet
    await writeFile(path, `${JSON.stringify(predecessor)}\n`)

    const opened = await new OnlineWorldStore(new JsonWorldPersistence(path)).open()
    const migrated = opened.inspectForTests()
    const durable = JSON.parse(await readFile(path, 'utf8')) as OnlineWorldDocument
    expect(durable).toEqual(migrated)
    expect(ONLINE_GAME_STATE_92_MIGRATION_DESTINATION_VERSION).toBe(93)
    expect(migrated.shared.state.version).toBe(93)
    expect(migrated.nextHomeSubnet).toBe(allocator)
    expect(migrated.accounts).toEqual(predecessor.accounts)
    expect(migrated.sessions).toEqual(predecessor.sessions)
    expect(migrated.players[0].privateState).toEqual(preservedPrivate)
    expect(migrated.shared.state.mail).toEqual(preservedMail)
    expect(migrated.shared.state.nodeEconomy).toEqual(preservedEconomy)

    const foreign = migrated.shared.state.world.network.localNetworks.find(({ id }) => id === 'network-foreign-001')!
    const router = migrated.shared.state.world.network.hosts.find(({ id }) => id === 'router-foreign-001')!
    expect(foreign.cidr).toBe('10.42.0.0/24')
    expect(router).toMatchObject({ ip: '10.42.0.1', publicAddress: '203.0.113.42', activityHistory: { nextId: 1, records: [] } })
    expect(router.exposures).toEqual([
      { protocol: 'TCP', externalPort: 22, targetDeviceId: 'host-lan-002', targetServiceId: 'service-ssh-002' },
      { protocol: 'TCP', externalPort: 8443, targetDeviceId: 'host-lan-002', targetServiceId: 'service-rack-update-002' },
      { protocol: 'TCP', externalPort: 2222, targetDeviceId: 'host-phone-001', targetServiceId: 'service-ssh-003' },
      { protocol: 'TCP', externalPort: 2223, targetDeviceId: 'host-lan-003', targetServiceId: 'service-ssh-004' },
    ])
    for (const id of ['host-lan-002', 'host-lan-003', 'host-phone-001']) {
      expect(migrated.shared.state.world.network.hosts.find((host) => host.id === id)?.ip).toMatch(/^10\.42\.0\./)
    }
    expect(migrated.shared.state.world.network.hosts.find(({ id }) => id === migrated.players[0].gatewayDeviceId)?.activityHistory).toEqual({ nextId: 1, records: [] })

    const composed = composeCanonicalOperationState(migrated.shared, migrated.players[0])
    expect([
      resolveServiceEndpoint(composed, '203.0.113.42:22'),
      resolveServiceEndpoint(composed, '203.0.113.42:8443'),
      resolveServiceEndpoint(composed, '203.0.113.42:2222'),
      resolveServiceEndpoint(composed, '203.0.113.42:2223'),
    ]).toEqual([
      { targetDeviceId: 'host-lan-002', serviceId: 'service-ssh-002' },
      { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002' },
      { targetDeviceId: 'host-phone-001', serviceId: 'service-ssh-003' },
      { targetDeviceId: 'host-lan-003', serviceId: 'service-ssh-004' },
    ])
    const stale = { endpoint: '198.51.100.61:22', targetDeviceId: 'host-phone-001', serviceId: 'service-ssh-003', providerId: GHOSTKEY_PROVIDER_ID }
    const fresh = { endpoint: '198.51.100.61:2229', targetDeviceId: 'host-phone-001', serviceId: 'service-fresh-history', providerId: GHOSTKEY_PROVIDER_ID }
    expect(canFormCredentialAccessAttempt(composed, stale)).toBe(false)
    expect(canFormCredentialAccessAttempt(composed, fresh)).toBe(true)
    const ghostKeys = composed.player.localDevice.filesystem.files.filter((file) => file.kind === 'software_module' && file.moduleId === ghostKeyBefore.moduleId)
    expect(ghostKeys).toEqual([ghostKeyBefore])

    class CountingPersistence extends JsonWorldPersistence {
      saves = 0
      override async save(document: OnlineWorldDocument): Promise<void> { this.saves += 1; await super.save(document) }
    }
    const restartPersistence = new CountingPersistence(path)
    expect((await new OnlineWorldStore(restartPersistence).open()).inspectForTests()).toEqual(migrated)
    expect(restartPersistence.saves).toBe(0)
  })

  it.each([
    ['older game state', (value: any) => { value.shared.state.version = 91 }],
    ['future game state', (value: any) => { value.shared.state.version = 94 }],
    ['old envelope', (value: any) => { value.persistenceVersion = 1 }],
    ['malformed predecessor', (value: any) => { delete value.players[0].privateState.discovery }],
    ['missing stable entity', (value: any) => { value.shared.state.world.network.hosts = value.shared.state.world.network.hosts.filter(({ id }: any) => id !== 'host-lan-002') }],
    ['conflicting destination', (value: any) => { value.shared.state.world.network.hosts.push({ id: 'conflict', ip: '10.42.0.42', operational: { lifecycle: 'RUNNING', connectivity: 'CONNECTED' } }) }],
    ['wrong foreign gateway relationship', (value: any) => { value.shared.state.world.network.localNetworks.find(({ id }: any) => id === 'network-foreign-001').gatewayDeviceId = 'host-lan-002' }],
    ['missing required foreign member', (value: any) => { const network = value.shared.state.world.network.localNetworks.find(({ id }: any) => id === 'network-foreign-001'); network.memberDeviceIds = network.memberDeviceIds.filter((id: string) => id !== 'host-phone-001') }],
  ])('rejects %s without replacing the durable document', async (_name, corrupt) => {
    const path = await temporaryPath()
    const predecessor = version92Fixture(await populatedCurrentDocument(path)) as any
    corrupt(predecessor)
    const original = `${JSON.stringify(predecessor)}\n`
    await writeFile(path, original)
    await expect(new JsonWorldPersistence(path).loadOrCreate()).rejects.toThrow()
    expect(await readFile(path, 'utf8')).toBe(original)
  })

  it('does not publish or replace a migration whose atomic save fails', async () => {
    const path = await temporaryPath()
    const predecessor = version92Fixture(await populatedCurrentDocument(path))
    const original = `${JSON.stringify(predecessor)}\n`
    await writeFile(path, original)
    class FailingMigrationPersistence extends JsonWorldPersistence {
      override async save(): Promise<void> { throw new Error('injected migration save failure') }
    }
    const store = new OnlineWorldStore(new FailingMigrationPersistence(path))
    await expect(store.open()).rejects.toThrow('injected migration save failure')
    expect(store.inspectForTests()).toBeUndefined()
    expect(await readFile(path, 'utf8')).toBe(original)
  })

  it('does not treat ENOENT from migration save as an absent persistence file', async () => {
    const path = await temporaryPath()
    const predecessor = version92Fixture(await populatedCurrentDocument(path))
    const original = `${JSON.stringify(predecessor)}\n`
    await writeFile(path, original)
    class MissingMigrationDestinationPersistence extends JsonWorldPersistence {
      saves = 0
      override async save(): Promise<void> {
        this.saves += 1
        throw Object.assign(new Error('injected missing migration destination'), { code: 'ENOENT' })
      }
    }
    const persistence = new MissingMigrationDestinationPersistence(path)
    const store = new OnlineWorldStore(persistence)
    await expect(store.open()).rejects.toThrow('injected missing migration destination')
    expect(persistence.saves).toBe(1)
    expect(store.inspectForTests()).toBeUndefined()
    expect(await readFile(path, 'utf8')).toBe(original)
  })
})
