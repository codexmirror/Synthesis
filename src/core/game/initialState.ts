import { NODE_OS_FIRMWARE_ID, RACK_OS_FIRMWARE_ID, VEYRA_OS_FIRMWARE_ID } from './firmwareIdentity'
import { createInitialMailState } from './mail'
import { NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS } from './nodeMiner'
import { BASIC_CREDENTIAL_TOOLKIT_1_0, NODESCAN_1_0_STANDARD, NODESCAN_1_1_EXPERIMENTAL, NODE_MINER_1_0 } from './softwareReleaseContent'
import type { GameState } from './types'

export const GAME_STATE_VERSION = 41

export function createInitialGameState(): GameState {
  return {
    version: GAME_STATE_VERSION,
    player: {
      id: 'player-local-v0',
      localDevice: {
        id: 'device-local-v0',
        displayName: 'node-01',
        firmware: { id: NODE_OS_FIRMWARE_ID, name: 'NODE-OS', version: '1.0' },
        filesystem: {
          nextFileId: 3,
          files: [
            { kind: 'text', id: 'file-0001', path: '/home/user/welcome.txt', content: 'Welcome to your local filesystem.' },
            { kind: 'software_package', id: 'file-0002', path: '/home/user/downloads/node-miner-1.0.pkg', releaseId: NODE_MINER_1_0.releaseId, productId: NODE_MINER_1_0.productId, name: NODE_MINER_1_0.name, version: NODE_MINER_1_0.version, channel: NODE_MINER_1_0.channel, publisher: NODE_MINER_1_0.publisher, sizeBytes: 3_400_000 },
          ],
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
          { id: NODESCAN_1_0_STANDARD.productId, releaseId: NODESCAN_1_0_STANDARD.releaseId, name: NODESCAN_1_0_STANDARD.name, version: NODESCAN_1_0_STANDARD.version, channel: NODESCAN_1_0_STANDARD.channel },
          { id: BASIC_CREDENTIAL_TOOLKIT_1_0.productId, releaseId: BASIC_CREDENTIAL_TOOLKIT_1_0.releaseId, name: BASIC_CREDENTIAL_TOOLKIT_1_0.name, version: BASIC_CREDENTIAL_TOOLKIT_1_0.version },
        ],
        // The Device's own saved copy of the player's Dollar sign-in. It begins with the same literal values as the Provider Credential and is separate state that can go stale independently of it.
        savedDollarSignIn: { id: 'device-saved-dollar-sign-in-v0', accountId: 'dollar-account-local-v0', loginIdentifier: 'local.civic', password: 'violet-orbit-7' },
      },
    },
    dollarFinance: {
      provider: { id: 'dollar-provider-civic-v0', displayName: 'Civic Dollar' },
      accounts: [
        { id: 'dollar-account-local-v0', accountReference: 'CD-1042-7781', balanceCents: 125_000 },
        // The Account the represented VEYRA phone is signed in to. It is an ordinary Civic Dollar Account like the player's, owned by the Provider rather than by VEYRA or by that Device.
        { id: 'dollar-account-veyra-phone-v0', accountReference: 'CD-3318-2204', balanceCents: 34_250 },
      ],
      credentials: [{ id: 'dollar-credential-local-v0', accountId: 'dollar-account-local-v0', loginIdentifier: 'local.civic', password: 'violet-orbit-7' }],
      sessions: { nextId: 3, active: [
        { id: 'dollar-session-0001', accountId: 'dollar-account-local-v0', clientDeviceId: 'device-local-v0' },
        // The phone is already signed in to its own Account, which is what makes a consumer Wallet openable on it. It authorizes exactly that Account for exactly that Device.
        { id: 'dollar-session-0002', accountId: 'dollar-account-veyra-phone-v0', clientDeviceId: 'host-phone-001' },
      ] },
      // No Dollar transfer has happened in the represented world yet, so there is no Transaction to represent.
      transactions: { nextId: 1, records: [] },
    },
    nodeWallet: {
      id: 'wallet-node-local-v0',
      address: 'node-wallet-addr-0001',
      balanceNodeUnits: 0,
      activity: { nextId: 1, records: [] },
    },
    // The one represented NODE recipient that currently exists besides the local Wallet: the account the unofficial NODE Miner 1.0 build pays itself into.
    nodeEconomy: {
      accounts: [
        { id: 'node-account-nm-dev-v0', address: NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS, balanceNodeUnits: 0 },
      ],
    },
    process: { nextId: 1, processes: [] },
    knowledge: { discoveredVulnerabilities: [] },
    discovery: { networks: [], devices: [], networkDeviceRelations: [] },
    deviceAccess: { nextId: 1, established: [] },
    remoteSession: { nextId: 1, active: null },
    fileTransfer: { nextId: 1, active: null },
    // The player's represented in-world mailbox, owned by their mail identity rather than by node-01 or NODE-OS.
    mail: createInitialMailState(),
    recentActivity: { entries: [] },
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
            transferCapacity: { uploadBytesPerSecond: 8_388_608, downloadBytesPerSecond: 8_388_608 },
            firmware: { id: RACK_OS_FIRMWARE_ID, name: 'RACK-OS', version: '1.0' },
            hardware: { cpu: { name: 'Server CPU', computeCapacity: 160 }, ram: { name: '8 GB', capacityMiB: 8192 } },
            runtime: { baselineCpuLoad: 12, baselineRamUsage: 18 },
            // Device-owned and entirely independent of node-01's inventory: srv-01 currently has no software installed on it.
            installedSoftware: [],
            filesystem: { nextFileId: 4, files: [
              { kind: 'text', id: 'file-0001', path: '/srv/readme.txt', content: 'Service workspace.' },
              { kind: 'software_package', id: 'file-0002', path: '/opt/packages/nodescan-exp-1.1.pkg', releaseId: NODESCAN_1_1_EXPERIMENTAL.releaseId, productId: NODESCAN_1_1_EXPERIMENTAL.productId, name: NODESCAN_1_1_EXPERIMENTAL.name, version: NODESCAN_1_1_EXPERIMENTAL.version, channel: NODESCAN_1_1_EXPERIMENTAL.channel, sizeBytes: 18_400_000 },
              { kind: 'software_package', id: 'file-0003', path: '/opt/packages/gatessh-1.3.2.pkg', releaseId: 'gate-ssh-1.3.2', productId: 'gate-ssh', name: 'GateSSH', version: '1.3.2', channel: 'stable', publisher: 'rack-systems', sizeBytes: 6_400_000 },
            ] },
            services: [
              { id: 'service-ssh-001', name: 'SSH', port: 22, protocol: 'TCP', open: true, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', name: 'GateSSH', version: '1.3.2' }, credentialAccess: { privilege: 'USER' } },
              { id: 'service-http-001', name: 'HTTP', port: 80, protocol: 'TCP', open: true, implementation: { productId: 'basic-http', releaseId: 'basic-http-1.0', name: 'Basic HTTP', version: '1.0' } },
            ],
            authenticationHistory: { nextId: 1, records: [] },
          },
          {
            id: 'host-lan-002',
            displayName: 'srv-02',
            ip: '203.0.113.42',
            online: true,
            role: 'server',
            transferCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 1_048_576 },
            firmware: { id: RACK_OS_FIRMWARE_ID, name: 'RACK-OS', version: '1.0' },
            hardware: { cpu: { name: 'Server CPU', computeCapacity: 120 }, ram: { name: '8 GB', capacityMiB: 8192 } },
            runtime: { baselineCpuLoad: 9, baselineRamUsage: 16 },
            installedSoftware: [],
            filesystem: { nextFileId: 2, files: [
              { kind: 'text', id: 'file-0001', path: '/srv/backup-manifest.txt', content: 'Backup manifest for srv-02.' },
            ] },
            services: [
              { id: 'service-ssh-002', name: 'SSH', port: 22, protocol: 'TCP', open: true, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.3', name: 'GateSSH', version: '1.3.3' }, credentialAccess: { privilege: 'USER' } },
              { id: 'service-rack-update-002', name: 'RackUpdate', port: 8443, protocol: 'TCP', open: true, implementation: { productId: 'rack-update', releaseId: 'rack-update-1.0', name: 'RackUpdate', version: '1.0' } },
            ],
            authenticationHistory: { nextId: 1, records: [] },
          },
          {
            id: 'host-phone-001',
            displayName: 'Petra’s Phone',
            ip: '198.51.100.61',
            online: true,
            // Concretely represented like the other operable Devices, so an existing transfer to it is refused on real grounds rather than for want of a represented capability.
            transferCapacity: { uploadBytesPerSecond: 2_097_152, downloadBytesPerSecond: 4_194_304 },
            firmware: { id: VEYRA_OS_FIRMWARE_ID, name: 'VEYRA OS', version: '4.1' },
            hardware: { cpu: { name: 'Mobile CPU', computeCapacity: 70 }, ram: { name: '6 GB', capacityMiB: 6144 } },
            runtime: { baselineCpuLoad: 6, baselineRamUsage: 34 },
            // Represented like any other concretely operable Device: it owns a software inventory and a filesystem, both of which are simply empty rather than filled with invented personal content.
            installedSoftware: [],
            filesystem: { nextFileId: 1, files: [] },
            services: [
              // The same concrete vulnerable GateSSH release the existing access loop already resolves. The phone is reachable through that represented weakness, not through a phone-specific mechanic.
              { id: 'service-ssh-003', name: 'SSH', port: 22, protocol: 'TCP', open: true, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', name: 'GateSSH', version: '1.3.2' }, credentialAccess: { privilege: 'USER' } },
            ],
            authenticationHistory: { nextId: 1, records: [] },
          },
          { id: 'host-training-002', ip: '203.0.113.99', online: false },
        ],
      },
    },
  }
}
