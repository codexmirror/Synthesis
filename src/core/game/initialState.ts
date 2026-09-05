import { NODE_OS_FIRMWARE_ID, RACK_OS_FIRMWARE_ID, VEYRA_OS_4_1_FIRMWARE_ID } from './firmwareIdentity'
import { createInitialMailState } from './mail'
import { createInitialPetraCompanyChatState } from './petraCompanyChat'
import { MARKET_OPERATOR_SETTLEMENT_ADDRESS, createInitialMarketState } from './market'
import { NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS } from './nodeMiner'
import { NODESCAN_1_0_STANDARD, NODESCAN_1_1_EXPERIMENTAL, NODESCAN_1_2_STANDARD, NODE_MINER_1_0 } from './softwareReleaseContent'
import { CREDENTIAL_ACCESS_MODULE_1_0 } from './flipper'
import { DEAUTH_EXTENSION } from './deauth'
import { BASIC_HTTP_1_0_BUILD_ID, GATE_SSH_1_3_2_BUILD_ID, GATE_SSH_1_3_3_BUILD_ID, RACK_UPDATE_1_0_BUILD_ID } from './serviceImplementations'
import type { GameState } from './types'
import { AUTH_GUARD_1_0_BUILD_ID, AUTH_GUARD_1_0_INSTALLATION, AUTH_GUARD_1_0_RELEASE_ID, AUTH_GUARD_PRODUCT_ID } from './authGuard'
import { NODE_1_DEVICE_MODEL, RACK_CORE_120_DEVICE_MODEL, RACK_CORE_160_DEVICE_MODEL } from './deviceModelIdentity'
import { BRANCH_OPS_INSTALLATION, createInitialBookstoreBranchState } from './bookstoreBranch'

export const GAME_STATE_VERSION = 68

export function createInitialGameState(): GameState {
  return {
    version: GAME_STATE_VERSION,
    player: {
      id: 'player-local-v0',
      localDevice: {
        id: 'device-local-v0',
        displayName: 'node-01',
        deviceType: 'NODE',
        deviceModel: NODE_1_DEVICE_MODEL,
        firmware: { id: NODE_OS_FIRMWARE_ID, name: 'NODE-OS', version: '1.0' },
        filesystem: {
          nextFileId: 6,
          files: [
            { kind: 'text', id: 'file-0001', path: '/home/user/welcome.txt', content: 'Welcome to your local filesystem.' },
            { kind: 'software_package', id: 'file-0002', path: '/home/user/downloads/node-miner-1.0.pkg', releaseId: NODE_MINER_1_0.releaseId, buildId: NODE_MINER_1_0.buildId, productId: NODE_MINER_1_0.productId, name: NODE_MINER_1_0.name, version: NODE_MINER_1_0.version, channel: NODE_MINER_1_0.channel, publisher: NODE_MINER_1_0.publisher, sizeBytes: 3_400_000 },
            { kind: 'software_module', id: 'file-0003', path: '/home/user/downloads/credential-access-1.0.mod', ...CREDENTIAL_ACCESS_MODULE_1_0 },
            { kind: 'deauth_extension', id: 'file-0004', path: '/home/user/downloads/deauth.ext', ...DEAUTH_EXTENSION },
            { kind: 'software_package', id: 'file-0005', path: '/home/user/downloads/nodescan-1.2.pkg', releaseId: NODESCAN_1_2_STANDARD.releaseId, buildId: NODESCAN_1_2_STANDARD.buildId, productId: NODESCAN_1_2_STANDARD.productId, name: NODESCAN_1_2_STANDARD.name, version: NODESCAN_1_2_STANDARD.version, channel: NODESCAN_1_2_STANDARD.channel, sizeBytes: 19_200_000 },
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
        },
        operational: { lifecycle: 'RUNNING', connectivity: 'CONNECTED' },
        installedSoftware: [
          { id: NODESCAN_1_0_STANDARD.productId, releaseId: NODESCAN_1_0_STANDARD.releaseId, buildId: NODESCAN_1_0_STANDARD.buildId, name: NODESCAN_1_0_STANDARD.name, version: NODESCAN_1_0_STANDARD.version, channel: NODESCAN_1_0_STANDARD.channel },
          { id: 'keyprobe', releaseId: 'keyprobe-1.0', buildId: 'build-keyprobe-1.0-v0', name: 'KeyProbe', version: '1.0', publisher: 'Neutral Systems' },
          // Flipper is acquired later. The initial standalone Credential Access Module in Files supplies the first AUTH-017 opportunity directly.
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
        // A neutral payment-clearing source exists only to make the authored historical sale a real, balanced money movement. It has no Credential, Session, Device, or customer identity.
        { id: 'dollar-account-retail-clearing-v0', accountReference: 'CD-9000-2000', balanceCents: 80_000 },
      ],
      credentials: [{ id: 'dollar-credential-local-v0', accountId: 'dollar-account-local-v0', loginIdentifier: 'local.civic', password: 'violet-orbit-7' }],
      sessions: { nextId: 3, active: [
        { id: 'dollar-session-0001', accountId: 'dollar-account-local-v0', clientDeviceId: 'device-local-v0' },
        // The phone is already signed in to its own Account, which is what makes a consumer Wallet openable on it. It authorizes exactly that Account for exactly that Device.
        { id: 'dollar-session-0002', accountId: 'dollar-account-veyra-phone-v0', clientDeviceId: 'host-phone-001' },
      ] },
      // Authored initial finance truth for the branch's one completed historical sale.
      transactions: { nextId: 2, records: [{
        id: 'dollar-transaction-0001',
        sourceAccountId: 'dollar-account-retail-clearing-v0',
        destinationAccountId: 'dollar-account-veyra-phone-v0',
        amountCents: 2_000,
        sourceAccountReference: 'CD-9000-2000',
        destinationAccountReference: 'CD-3318-2204',
      }] },
    },
    bookstoreBranch: createInitialBookstoreBranchState(),
    nodeWallet: {
      id: 'wallet-node-local-v0',
      address: 'node-wallet-addr-0001',
      balanceNodeUnits: 0,
      activity: { nextId: 1, records: [] },
    },
    // The represented NODE recipients that exist besides the local Wallet: the account the unofficial NODE Miner 1.0 build pays itself into, and the account the represented Market operator settles software purchases into.
    nodeEconomy: {
      accounts: [
        { id: 'node-account-nm-dev-v0', address: NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS, balanceNodeUnits: 0 },
        { id: 'node-account-opx-v0', address: MARKET_OPERATOR_SETTLEMENT_ADDRESS, balanceNodeUnits: 0 },
      ],
    },
    // The represented broad/open software Market the local Device can reach. NODE-OS supplies only the client that presents it.
    market: createInitialMarketState(),
    process: { nextId: 1, processes: [] },
    knowledge: { discoveredVulnerabilities: [], knownDevicePins: [] },
    discovery: { networks: [], devices: [], networkDeviceRelations: [] },
    deviceAccess: { nextId: 1, established: [] },
    // The local Device's explicit legitimate management authority over home-net; not derived from its Network membership.
    networkManagement: { nextId: 2, established: [
      { id: 'network-management-0001', deviceId: 'device-local-v0', networkId: 'network-local-001' },
    ] },
    remoteSession: { nextId: 1, active: null },
    fileTransfer: { nextId: 1, active: null },
    rackUpdate: { access: { nextId: 1, established: [] }, submission: { nextId: 1, active: null, outcome: null } },
    // The player's represented in-world mailbox, owned by their mail identity rather than by node-01 or NODE-OS.
    mail: createInitialMailState(),
    // Foreign work communication belongs to Petra's represented Company Chat, never the player's NodeMail account.
    petraCompanyChat: createInitialPetraCompanyChatState(),
    technicianReaction: { pending: null },
    recentActivity: { entries: [] },
    world: {
      network: {
        localNetworks: [
          // External connectivity capacity, deliberately well above every member Device's own endpoint capacity so it is never the bottleneck for the currently authored same-Network home-net route.
          { id: 'network-local-001', name: 'home-net', memberDeviceIds: ['device-local-v0', 'host-lan-001'], transferCapacity: { uploadBytesPerSecond: 16_777_216, downloadBytesPerSecond: 16_777_216 }, activityHistory: { nextId: 1, records: [] } },
          // srv-02's and the phone's shared external uplink/downlink; deliberately the cross-Network route node-01 actually exercises.
          { id: 'network-foreign-001', name: 'remote-segment-01', memberDeviceIds: ['host-phone-001', 'host-lan-002'], transferCapacity: { uploadBytesPerSecond: 8_388_608, downloadBytesPerSecond: 8_388_608 }, activityHistory: { nextId: 1, records: [] } },
        ],
        hosts: [
          {
            id: 'host-lan-001',
            displayName: 'srv-01',
            deviceType: 'SERVER',
            deviceModel: RACK_CORE_160_DEVICE_MODEL,
            ip: '198.51.100.47',
            operational: { lifecycle: 'RUNNING', connectivity: 'CONNECTED' },
            role: 'server',
            transferCapacity: { uploadBytesPerSecond: 8_388_608, downloadBytesPerSecond: 8_388_608 },
            firmware: { id: RACK_OS_FIRMWARE_ID, name: 'RACK-OS', version: '1.0' },
            hardware: { cpu: { name: 'Server CPU', computeCapacity: 160 }, ram: { name: '8 GB', capacityMiB: 8192 } },
            runtime: { baselineCpuLoad: 12, baselineRamUsage: 18 },
            // Device-owned inventory coherently represents the managed GateSSH release without conflating it with the Service implementation.
            installedSoftware: [{ id: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID, name: 'GateSSH', version: '1.3.2', channel: 'stable', publisher: 'rack-systems' }],
            filesystem: { nextFileId: 4, files: [
              { kind: 'text', id: 'file-0001', path: '/srv/readme.txt', content: 'Service workspace.' },
              { kind: 'software_package', id: 'file-0002', path: '/opt/packages/nodescan-exp-1.1.pkg', releaseId: NODESCAN_1_1_EXPERIMENTAL.releaseId, buildId: NODESCAN_1_1_EXPERIMENTAL.buildId, productId: NODESCAN_1_1_EXPERIMENTAL.productId, name: NODESCAN_1_1_EXPERIMENTAL.name, version: NODESCAN_1_1_EXPERIMENTAL.version, channel: NODESCAN_1_1_EXPERIMENTAL.channel, sizeBytes: 18_400_000 },
              { kind: 'software_package', id: 'file-0003', path: '/opt/packages/gatessh-1.3.2.pkg', releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID, productId: 'gate-ssh', name: 'GateSSH', version: '1.3.2', channel: 'stable', publisher: 'rack-systems', sizeBytes: 6_400_000 },
            ] },
            services: [
              { id: 'service-ssh-001', name: 'SSH', port: 22, protocol: 'TCP', open: true, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID, name: 'GateSSH', version: '1.3.2' }, credentialAccess: { privilege: 'USER' } },
              { id: 'service-http-001', name: 'HTTP', port: 80, protocol: 'TCP', open: true, implementation: { productId: 'basic-http', releaseId: 'basic-http-1.0', buildId: BASIC_HTTP_1_0_BUILD_ID, name: 'Basic HTTP', version: '1.0' } },
            ],
            authenticationHistory: { nextId: 1, records: [] },
          },
          {
            id: 'host-lan-002',
            displayName: 'srv-02',
            deviceType: 'SERVER',
            deviceModel: RACK_CORE_120_DEVICE_MODEL,
            ip: '203.0.113.42',
            operational: { lifecycle: 'RUNNING', connectivity: 'CONNECTED' },
            // This concrete srv-02's own represented recovery behavior for this precedent: it reboots on connectivity loss. Device-owned configuration, not a universal "every RACK-OS reboots" rule.
            connectivityRecoveryBehavior: 'REBOOT_ON_DISCONNECT',
            role: 'server',
            transferCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 1_048_576 },
            firmware: { id: RACK_OS_FIRMWARE_ID, name: 'RACK-OS', version: '1.0' },
            hardware: { cpu: { name: 'Server CPU', computeCapacity: 120 }, ram: { name: '8 GB', capacityMiB: 8192 } },
            runtime: { baselineCpuLoad: 9, baselineRamUsage: 16 },
            installedSoftware: [{ id: 'gate-ssh', releaseId: 'gate-ssh-1.3.3', buildId: GATE_SSH_1_3_3_BUILD_ID, name: 'GateSSH', version: '1.3.3' }, AUTH_GUARD_1_0_INSTALLATION, BRANCH_OPS_INSTALLATION],
            filesystem: { nextFileId: 3, files: [
              { kind: 'text', id: 'file-0001', path: '/srv/backup-manifest.txt', content: 'Backup manifest for srv-02.' },
              { kind: 'software_package', id: 'file-0002', path: '/opt/packages/authguard-1.0.pkg', releaseId: AUTH_GUARD_1_0_RELEASE_ID, buildId: AUTH_GUARD_1_0_BUILD_ID, productId: AUTH_GUARD_PRODUCT_ID, name: 'AuthGuard', version: '1.0', publisher: 'rack-systems', sizeBytes: 4_800_000 },
            ] },
            services: [
              { id: 'service-ssh-002', name: 'SSH', port: 22, protocol: 'TCP', open: true, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.3', buildId: GATE_SSH_1_3_3_BUILD_ID, name: 'GateSSH', version: '1.3.3' }, credentialAccess: { privilege: 'USER' } },
              { id: 'service-rack-update-002', name: 'RackUpdate', port: 8443, protocol: 'TCP', open: true, implementation: { productId: 'rack-update', releaseId: 'rack-update-1.0', buildId: RACK_UPDATE_1_0_BUILD_ID, name: 'RackUpdate', version: '1.0' } },
            ],
            authenticationHistory: { nextId: 1, records: [] },
          },
          {
            id: 'host-phone-001',
            displayName: 'Petra’s Phone',
            deviceType: 'PHONE',
            ip: '198.51.100.61',
            operational: { lifecycle: 'RUNNING', connectivity: 'CONNECTED' },
            // This concrete phone's own represented recovery behavior for this precedent: it reconnects on connectivity loss without ever rebooting. Device-owned configuration, not a universal "every VEYRA OS Device reconnects" rule.
            connectivityRecoveryBehavior: 'RECONNECT',
            // Concretely represented like the other operable Devices, so an existing transfer to it is refused on real grounds rather than for want of a represented capability.
            transferCapacity: { uploadBytesPerSecond: 2_097_152, downloadBytesPerSecond: 4_194_304 },
            firmware: { id: VEYRA_OS_4_1_FIRMWARE_ID, name: 'VEYRA OS', version: '4.1' },
            hardware: { cpu: { name: 'Mobile CPU', computeCapacity: 70 }, ram: { name: '6 GB', capacityMiB: 6144 } },
            runtime: { baselineCpuLoad: 6, baselineRamUsage: 34 },
            // Represented like any other concretely operable Device: it owns a software inventory and a filesystem, both of which are simply empty rather than filled with invented personal content.
            installedSoftware: [],
            filesystem: { nextFileId: 1, files: [] },
            services: [
              // The same concrete vulnerable GateSSH release the existing access loop already resolves. The phone is reachable through that represented weakness, not through a phone-specific mechanic.
              { id: 'service-ssh-003', name: 'SSH', port: 22, protocol: 'TCP', open: true, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID, name: 'GateSSH', version: '1.3.2' }, credentialAccess: { privilege: 'USER' } },
            ],
            authenticationHistory: { nextId: 1, records: [] },
            // Petra's own secret Device PIN and Wallet-protection setting. The PIN is never Player Knowledge merely from DeviceAccess, a Remote Session, or opening Settings; Wallet protection starts OFF.
            security: { devicePin: '7042', walletProtectionEnabled: false },
          },
          // Deliberately shallow: operational truth is independent of hardware/runtime representation, so this unreachable training host needs no fabricated resource state to participate in it.
          { id: 'host-training-002', ip: '203.0.113.99', operational: { lifecycle: 'RUNNING', connectivity: 'DISCONNECTED' } },
        ],
      },
    },
  }
}
