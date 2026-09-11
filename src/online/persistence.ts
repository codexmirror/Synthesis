import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createInitialGameState } from '../core/game/initialState'
import type { OnlineWorldDocument } from './model'
import { ONLINE_PERSISTENCE_VERSION } from './model'

export class JsonWorldPersistence {
  constructor(readonly path: string) {}

  async loadOrCreate(): Promise<OnlineWorldDocument> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.path, 'utf8'))
      if (!parsed || typeof parsed !== 'object' || (parsed as { persistenceVersion?: unknown }).persistenceVersion !== ONLINE_PERSISTENCE_VERSION) {
        throw new Error(`Unsupported online persistence version in ${this.path}. Refusing to reset canonical world.`)
      }
      return parsed as OnlineWorldDocument
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      const initial = createInitialGameState()
      const home = initial.world.network.localNetworks.find(({ id }) => id === 'network-local-001')
      const personalIds = new Set(home?.memberDeviceIds ?? [])
      const document: OnlineWorldDocument = {
        persistenceVersion: ONLINE_PERSISTENCE_VERSION, nextHomeSubnet: 1,
        sharedState: { ...initial, world: { network: {
          localNetworks: initial.world.network.localNetworks.filter(({ id }) => id !== 'network-local-001'),
          hosts: initial.world.network.hosts.filter(({ id }) => !personalIds.has(id)),
        } } },
        accounts: [], sessions: [], players: [],
      }
      await this.save(document)
      return document
    }
  }

  async save(document: OnlineWorldDocument): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    const temporary = `${this.path}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify(document)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, this.path)
  }
}
