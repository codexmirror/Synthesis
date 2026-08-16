import type { GameState } from './types'

export const GAME_STATE_VERSION = 6

export function createInitialGameState(): GameState {
  return {
    version: GAME_STATE_VERSION,
    player: {
      id: 'player-local-v0',
      localDevice: {
        id: 'device-local-v0',
        network: { ip: '198.51.100.23' },
        hardware: {
          cpu: { name: 'Basic CPU', computeCapacity: 100 },
          ram: { name: '4 GB', capacityMiB: 4096 },
        },
        runtime: {
          baselineCpuLoad: 18,
          baselineRamUsage: 23,
          networkStatus: 'ONLINE',
        },
      },
    },
    wallet: {
      balance: 1250,
    },
    process: { nextId: 1, processes: [] },
    world: {
      network: {
        localNetworks: [
          { id: 'network-local-001', name: 'home-net', memberDeviceIds: ['device-local-v0', 'host-lan-001'] },
        ],
        hosts: [
          {
            id: 'host-lan-001',
            ip: '198.51.100.47',
            online: true,
            role: 'server',
            services: [{ id: 'service-ssh-001', name: 'SSH', port: 22, protocol: 'TCP', open: true }],
          },
          { id: 'host-training-001', ip: '203.0.113.42', online: true },
          { id: 'host-training-002', ip: '203.0.113.99', online: false },
        ],
      },
    },
  }
}
