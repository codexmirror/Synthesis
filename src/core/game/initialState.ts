import type { GameState } from './types'

export const GAME_STATE_VERSION = 15

export function createInitialGameState(): GameState {
  return {
    version: GAME_STATE_VERSION,
    player: {
      id: 'player-local-v0',
      localDevice: {
        id: 'device-local-v0',
        displayName: 'node-01',
        firmware: { id: 'firmware-node-os-v1', name: 'NODE-OS', version: '1.0' },
        filesystem: {
          files: [{ kind: 'text', path: '/home/user/welcome.txt', content: 'Welcome to your local filesystem.' }],
        },
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
        installedSoftware: [
          { id: 'nodescan', name: 'NodeScan', version: '1.0', channel: 'standard' },
          { id: 'basic-credential-toolkit', name: 'Basic Credential Toolkit', version: '1.0' },
        ],
      },
    },
    wallet: {
      balance: 1250,
    },
    process: { nextId: 1, processes: [] },
    knowledge: { discoveredVulnerabilities: [] },
    discovery: { networks: [], devices: [], networkDeviceRelations: [] },
    deviceAccess: { nextId: 1, established: [] },
    remoteSession: { nextId: 1, active: null },
    world: {
      network: {
        localNetworks: [
          { id: 'network-local-001', name: 'home-net', memberDeviceIds: ['device-local-v0', 'host-lan-001'] },
        ],
        hosts: [
          {
            id: 'host-lan-001',
            displayName: 'srv-01',
            ip: '198.51.100.47',
            online: true,
            role: 'server',
            firmware: { id: 'firmware-rack-os-v1', name: 'RACK-OS', version: '1.0' },
            filesystem: { files: [
              { kind: 'text', path: '/srv/readme.txt', content: 'Service workspace.' },
              { kind: 'software_package', path: '/opt/packages/nodescan-exp-1.1.pkg', packageId: 'nodescan-exp-1.1', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental' },
            ] },
            services: [
              { id: 'service-ssh-001', name: 'SSH', port: 22, protocol: 'TCP', open: true, credentialAccess: { privilege: 'USER' }, vulnerabilities: [{ id: 'vulnerability-ssh-001', label: 'Weak authentication configuration' }] },
              { id: 'service-http-001', name: 'HTTP', port: 80, protocol: 'TCP', open: true, vulnerabilities: [] },
            ],
          },
          { id: 'host-training-001', ip: '203.0.113.42', online: true },
          { id: 'host-training-002', ip: '203.0.113.99', online: false },
        ],
      },
    },
  }
}
