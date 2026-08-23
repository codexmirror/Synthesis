import type { GameState } from './types'

export const GAME_STATE_VERSION = 25

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
          nextFileId: 2,
          files: [{ kind: 'text', id: 'file-0001', path: '/home/user/welcome.txt', content: 'Welcome to your local filesystem.' }],
        },
        network: { ip: '198.51.100.23', transferCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 2_097_152 } },
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
          { id: 'nodescan', releaseId: 'nodescan-1.0-standard', name: 'NodeScan', version: '1.0', channel: 'standard' },
          { id: 'basic-credential-toolkit', releaseId: 'basic-credential-toolkit-1.0', name: 'Basic Credential Toolkit', version: '1.0' },
        ],
      },
    },
    wallet: {
      balance: 1250,
    },
    nodeWallet: {
      id: 'wallet-node-local-v0',
      address: 'node-wallet-addr-0001',
      balanceNode: 0,
    },
    process: { nextId: 1, processes: [] },
    knowledge: { discoveredVulnerabilities: [] },
    discovery: { networks: [], devices: [], networkDeviceRelations: [] },
    deviceAccess: { nextId: 1, established: [] },
    remoteSession: { nextId: 1, active: null },
    fileTransfer: { nextId: 1, active: null },
    world: {
      network: {
        localNetworks: [
          { id: 'network-local-001', name: 'home-net', memberDeviceIds: ['device-local-v0', 'host-lan-001', 'host-lan-002'] },
        ],
        hosts: [
          {
            id: 'host-lan-001',
            displayName: 'srv-01',
            ip: '198.51.100.47',
            online: true,
            role: 'server',
            transferCapacity: { uploadBytesPerSecond: 8_388_608, downloadBytesPerSecond: 8_388_608 },
            firmware: { id: 'firmware-rack-os-v1', name: 'RACK-OS', version: '1.0' },
            hardware: { cpu: { name: 'Server CPU', computeCapacity: 160 }, ram: { name: '8 GB', capacityMiB: 8192 } },
            runtime: { baselineCpuLoad: 12, baselineRamUsage: 18 },
            filesystem: { nextFileId: 4, files: [
              { kind: 'text', id: 'file-0001', path: '/srv/readme.txt', content: 'Service workspace.' },
              { kind: 'software_package', id: 'file-0002', path: '/opt/packages/nodescan-exp-1.1.pkg', releaseId: 'nodescan-1.1-experimental', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 18_400_000 },
              { kind: 'executable', id: 'file-0003', path: '/opt/releases/node-miner-1.0.bin', programId: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 },
            ] },
            services: [
              { id: 'service-ssh-001', name: 'SSH', port: 22, protocol: 'TCP', open: true, credentialAccess: { privilege: 'USER' }, vulnerabilities: [{ id: 'vulnerability-ssh-001', label: 'Weak authentication configuration' }] },
              { id: 'service-http-001', name: 'HTTP', port: 80, protocol: 'TCP', open: true, vulnerabilities: [] },
            ],
            authenticationHistory: { nextId: 1, records: [] },
          },
          {
            id: 'host-lan-002',
            displayName: 'srv-02',
            ip: '198.51.100.53',
            online: true,
            role: 'server',
            transferCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 1_048_576 },
            firmware: { id: 'firmware-rack-os-v1', name: 'RACK-OS', version: '1.0' },
            hardware: { cpu: { name: 'Server CPU', computeCapacity: 120 }, ram: { name: '8 GB', capacityMiB: 8192 } },
            runtime: { baselineCpuLoad: 9, baselineRamUsage: 16 },
            filesystem: { nextFileId: 2, files: [
              { kind: 'text', id: 'file-0001', path: '/srv/backup-manifest.txt', content: 'Backup manifest for srv-02.' },
            ] },
            services: [
              { id: 'service-ssh-002', name: 'SSH', port: 22, protocol: 'TCP', open: true, credentialAccess: { privilege: 'USER' }, vulnerabilities: [{ id: 'vulnerability-ssh-002', label: 'Weak authentication configuration' }] },
            ],
            authenticationHistory: { nextId: 1, records: [] },
          },
          { id: 'host-training-001', ip: '203.0.113.42', online: true },
          { id: 'host-training-002', ip: '203.0.113.99', online: false },
        ],
      },
    },
  }
}
