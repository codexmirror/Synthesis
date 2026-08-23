import { describe, expect, it } from 'vitest'
import { createInitialGameState, GAME_STATE_VERSION } from '../core/game/initialState'
import { NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS } from '../core/game/nodeMiner'

describe('createInitialGameState', () => {
  it('creates an independent local-device and world graph for every session', () => {
    const first = createInitialGameState()
    const second = createInitialGameState()

    expect(first).not.toBe(second)
    expect(first.player).not.toBe(second.player)
    expect(first.player.localDevice).not.toBe(second.player.localDevice)
    expect(first.player.localDevice.firmware).not.toBe(second.player.localDevice.firmware)
    expect(first.player.localDevice.filesystem).not.toBe(second.player.localDevice.filesystem)
    expect(first.player.localDevice.filesystem.files).not.toBe(second.player.localDevice.filesystem.files)
    expect(first.player.localDevice.network).not.toBe(second.player.localDevice.network)
    expect(first.player.localDevice.hardware).not.toBe(second.player.localDevice.hardware)
    expect(first.player.localDevice.runtime).not.toBe(second.player.localDevice.runtime)
    expect(first.wallet).not.toBe(second.wallet)
    expect(first.world).not.toBe(second.world)
    expect(first.world.network).not.toBe(second.world.network)
    expect(first.world.network.localNetworks).not.toBe(second.world.network.localNetworks)
    expect(first.world.network.localNetworks[0]).not.toBe(second.world.network.localNetworks[0])
    expect(first.world.network.localNetworks[0].memberDeviceIds).not.toBe(second.world.network.localNetworks[0].memberDeviceIds)
    expect(first.world.network.hosts).not.toBe(second.world.network.hosts)
    expect(first.world.network.hosts[0]).not.toBe(second.world.network.hosts[0])
    expect(first.world.network.hosts[0].services).not.toBe(second.world.network.hosts[0].services)
    expect(first.world.network.hosts[0].services?.[0]).not.toBe(second.world.network.hosts[0].services?.[0])
    expect(first).toEqual(second)
  })

  it('separates identities and seeds canonical local-device state in schema version 27', () => {
    const state = createInitialGameState()
    expect(GAME_STATE_VERSION).toBe(27)
    expect(state.remoteSession).toEqual({ nextId: 1, active: null })
    expect(state.fileTransfer).toEqual({ nextId: 1, active: null })
    expect(state.version).toBe(27)
    expect(state.wallet).toEqual({ balance: 1250 })
    expect(state.nodeWallet).toEqual({ id: 'wallet-node-local-v0', address: 'node-wallet-addr-0001', balanceNodeUnits: 0, activity: { nextId: 1, records: [] } })
    // The one represented NODE recipient besides the local Wallet: the unofficial Miner release's own developer account, starting empty.
    expect(state.nodeEconomy).toEqual({ accounts: [{ id: 'node-account-nm-dev-v0', address: NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS, balanceNodeUnits: 0 }] })
    expect(state.nodeEconomy.accounts[0].address).not.toBe(state.nodeWallet.address)
    expect(state.player.id).toBe('player-local-v0')
    expect(state.player.localDevice.id).toBe('device-local-v0')
    expect(state.player.id).not.toBe(state.player.localDevice.id)
    expect(state.player.localDevice).toMatchObject({
      displayName: 'node-01',
      firmware: { id: 'firmware-node-os-v1', name: 'NODE-OS', version: '1.0' },
      network: { ip: '198.51.100.23', transferCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 2_097_152 } },
      hardware: { cpu: { name: 'Basic CPU', computeCapacity: 100 }, ram: { name: '4 GB', capacityMiB: 4096 } },
      runtime: { baselineCpuLoad: 18, baselineRamUsage: 23, networkStatus: 'ONLINE' },
    })
    expect(state.player.localDevice.filesystem).toEqual({
      nextFileId: 3,
      files: [
        { kind: 'text', id: 'file-0001', path: '/home/user/welcome.txt', content: 'Welcome to your local filesystem.' },
        { kind: 'software_package', id: 'file-0002', path: '/home/user/downloads/node-miner-1.0.pkg', releaseId: 'node-miner-1.0', productId: 'node-miner', name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev', sizeBytes: 3_400_000 },
      ],
    })
    expect(state.player.localDevice.installedSoftware).toEqual([
      { id: 'nodescan', releaseId: 'nodescan-1.0-standard', name: 'NodeScan', version: '1.0', channel: 'standard' },
      { id: 'basic-credential-toolkit', releaseId: 'basic-credential-toolkit-1.0', name: 'Basic Credential Toolkit', version: '1.0' },
    ])
    expect(state.player.localDevice.installedSoftware).not.toContainEqual(expect.objectContaining({ id: 'node-miner' }))
    expect(state.player.localDevice).not.toHaveProperty('tools')
    expect(state.process).toEqual({ nextId: 1, processes: [] })
    expect(state.knowledge).toEqual({ discoveredVulnerabilities: [] })
    expect(state.world.network.hosts).toEqual([
      {
        id: 'host-lan-001', displayName: 'srv-01', ip: '198.51.100.47', online: true, role: 'server',
        transferCapacity: { uploadBytesPerSecond: 8_388_608, downloadBytesPerSecond: 8_388_608 },
        firmware: { id: 'firmware-rack-os-v1', name: 'RACK-OS', version: '1.0' },
        hardware: { cpu: { name: 'Server CPU', computeCapacity: 160 }, ram: { name: '8 GB', capacityMiB: 8192 } },
        runtime: { baselineCpuLoad: 12, baselineRamUsage: 18 },
        filesystem: { nextFileId: 3, files: [
          { kind: 'text', id: 'file-0001', path: '/srv/readme.txt', content: 'Service workspace.' },
          { kind: 'software_package', id: 'file-0002', path: '/opt/packages/nodescan-exp-1.1.pkg', releaseId: 'nodescan-1.1-experimental', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 18_400_000 },
        ] },
        services: [
          { id: 'service-ssh-001', name: 'SSH', port: 22, protocol: 'TCP', open: true, credentialAccess: { privilege: 'USER' }, vulnerabilities: [{ id: 'vulnerability-ssh-001', label: 'Weak authentication configuration' }] },
          { id: 'service-http-001', name: 'HTTP', port: 80, protocol: 'TCP', open: true, vulnerabilities: [] },
        ],
        authenticationHistory: { nextId: 1, records: [] },
      },
      {
        id: 'host-lan-002', displayName: 'srv-02', ip: '198.51.100.53', online: true, role: 'server',
        transferCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 1_048_576 },
        firmware: { id: 'firmware-rack-os-v1', name: 'RACK-OS', version: '1.0' },
        hardware: { cpu: { name: 'Server CPU', computeCapacity: 120 }, ram: { name: '8 GB', capacityMiB: 8192 } },
        runtime: { baselineCpuLoad: 9, baselineRamUsage: 16 },
        filesystem: { nextFileId: 2, files: [{ kind: 'text', id: 'file-0001', path: '/srv/backup-manifest.txt', content: 'Backup manifest for srv-02.' }] },
        services: [
          { id: 'service-ssh-002', name: 'SSH', port: 22, protocol: 'TCP', open: true, credentialAccess: { privilege: 'USER' }, vulnerabilities: [{ id: 'vulnerability-ssh-002', label: 'Weak authentication configuration' }] },
        ],
        authenticationHistory: { nextId: 1, records: [] },
      },
      { id: 'host-training-001', ip: '203.0.113.42', online: true },
      { id: 'host-training-002', ip: '203.0.113.99', online: false },
    ])
    expect(state.world.network.hosts).not.toContainEqual(expect.objectContaining({ id: state.player.localDevice.id }))
    expect(state.world.network.localNetworks).toEqual([
      { id: 'network-local-001', name: 'home-net', memberDeviceIds: [state.player.localDevice.id, 'host-lan-001', 'host-lan-002'] },
    ])
    expect(state.world.network.localNetworks[0].id).not.toBe(state.world.network.localNetworks[0].name)
    expect(state.player.localDevice).not.toHaveProperty('networkId')
  })

  it('preserves the existing LAN host as the canonical server and gives it two owned services and vulnerability truth', () => {
    const state = createInitialGameState()
    const server = state.world.network.hosts.find(({ id }) => id === 'host-lan-001')

    expect(server).toMatchObject({ id: 'host-lan-001', ip: '198.51.100.47', role: 'server' })
    expect(server).toMatchObject({ displayName: 'srv-01', firmware: { id: 'firmware-rack-os-v1', name: 'RACK-OS', version: '1.0' }, filesystem: { nextFileId: 3, files: [
      { kind: 'text', id: 'file-0001', path: '/srv/readme.txt', content: 'Service workspace.' },
      { kind: 'software_package', id: 'file-0002', path: '/opt/packages/nodescan-exp-1.1.pkg', releaseId: 'nodescan-1.1-experimental', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 18_400_000 },
    ] } })
    expect(server?.filesystem?.files.some((file) => file.kind === 'executable')).toBe(false)
    const shallowTrainingHosts = state.world.network.hosts.filter(({ id }) => id !== 'host-lan-001' && id !== 'host-lan-002')
    expect(shallowTrainingHosts.length).toBeGreaterThan(0)
    expect(shallowTrainingHosts.every((host) => !host.displayName && !host.firmware && !host.filesystem && !host.hardware && !host.runtime)).toBe(true)
    expect(state.world.network.localNetworks[0].memberDeviceIds).toContain(server?.id)
    expect(server?.services).toEqual([
      { id: 'service-ssh-001', name: 'SSH', port: 22, protocol: 'TCP', open: true, credentialAccess: { privilege: 'USER' }, vulnerabilities: [{ id: 'vulnerability-ssh-001', label: 'Weak authentication configuration' }] },
      { id: 'service-http-001', name: 'HTTP', port: 80, protocol: 'TCP', open: true, vulnerabilities: [] },
    ])
  })

  it('gives the second LAN server its own independent identity, firmware, filesystem, and vulnerability truth', () => {
    const state = createInitialGameState()
    const server = state.world.network.hosts.find(({ id }) => id === 'host-lan-002')

    expect(server).toMatchObject({ id: 'host-lan-002', ip: '198.51.100.53', role: 'server' })
    expect(server).toMatchObject({ displayName: 'srv-02', firmware: { id: 'firmware-rack-os-v1', name: 'RACK-OS', version: '1.0' }, filesystem: { nextFileId: 2, files: [{ kind: 'text', id: 'file-0001', path: '/srv/backup-manifest.txt', content: 'Backup manifest for srv-02.' }] } })
    expect(state.world.network.localNetworks[0].memberDeviceIds).toContain(server?.id)
    expect(server?.services).toEqual([
      { id: 'service-ssh-002', name: 'SSH', port: 22, protocol: 'TCP', open: true, credentialAccess: { privilege: 'USER' }, vulnerabilities: [{ id: 'vulnerability-ssh-002', label: 'Weak authentication configuration' }] },
    ])
    expect(server?.id).not.toBe('host-lan-001')
    expect(server?.filesystem).not.toEqual(state.world.network.hosts.find(({ id }) => id === 'host-lan-001')?.filesystem)
  })
})
