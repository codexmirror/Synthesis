import { describe, expect, it } from 'vitest'
import { createInitialGameState, GAME_STATE_VERSION } from '../core/game/initialState'
import { NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS } from '../core/game/nodeMiner'
import { VEYRA_OS_FIRMWARE_ID } from '../core/game/firmwareIdentity'
import { resolveDollarAccountForDevice } from '../core/game/dollarFinance'
import { AUTH_017, vulnerabilitiesForService } from '../core/game/serviceImplementations'
import { isValidNetworkTransferCapacity } from '../core/game/networkTransferCapacity'

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
    expect(first.dollarFinance).not.toBe(second.dollarFinance)
    expect(first.mail).not.toBe(second.mail)
    expect(first.mail.messages).not.toBe(second.mail.messages)
    expect(first.mail.threads).not.toBe(second.mail.threads)
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

  it('separates identities and seeds canonical local-device state in schema version 41', () => {
    const state = createInitialGameState()
    expect(GAME_STATE_VERSION).toBe(43)
    expect(state.remoteSession).toEqual({ nextId: 1, active: null })
    expect(state.fileTransfer).toEqual({ nextId: 1, active: null })
    expect(state.recentActivity).toEqual({ entries: [] })
    expect(state.version).toBe(43)
    expect(state.dollarFinance.accounts[0].balanceCents).toBe(125_000)
    expect(state.nodeWallet).toEqual({ id: 'wallet-node-local-v0', address: 'node-wallet-addr-0001', balanceNodeUnits: 0, activity: { nextId: 1, records: [] } })
    // The one represented NODE recipient besides the local Wallet: the unofficial Miner release's own developer account, starting empty.
    expect(state.nodeEconomy).toEqual({ accounts: [{ id: 'node-account-nm-dev-v0', address: NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS, balanceNodeUnits: 0 }] })
    expect(state.nodeEconomy.accounts[0].address).not.toBe(state.nodeWallet.address)
    // The mailbox is owned by the player's represented mail identity, not by the local Device or NODE-OS.
    expect(state.mail.account).toEqual({ id: 'mail-account-player-v0', address: 'user@node.mail' })
    expect(state.mail.account.id).not.toBe(state.player.id)
    expect(state.mail.account.id).not.toBe(state.player.localDevice.id)
    expect(state.mail.threads.map((thread) => thread.id)).toEqual(['mail-thread-welcome', 'mail-thread-mira-staging'])
    expect(state.mail.nextMessageId).toBe(3)
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
    expect(state.player.localDevice.installedSoftware).not.toContainEqual(expect.objectContaining({ id: 'gate-ssh' }))
    expect(state.player.localDevice).not.toHaveProperty('tools')
    expect(state.process).toEqual({ nextId: 1, processes: [] })
    expect(state.knowledge).toEqual({ discoveredVulnerabilities: [] })
    expect(state.world.network.hosts.map(({ id, ip }) => ({ id, ip }))).toEqual([
      { id: 'host-lan-001', ip: '198.51.100.47' },
      { id: 'host-lan-002', ip: '203.0.113.42' },
      { id: 'host-phone-001', ip: '198.51.100.61' },
      { id: 'host-training-002', ip: '203.0.113.99' },
    ])
    expect(state.world.network.localNetworks).toEqual([
      { id: 'network-local-001', name: 'home-net', memberDeviceIds: [state.player.localDevice.id, 'host-lan-001'], transferCapacity: { uploadBytesPerSecond: 16_777_216, downloadBytesPerSecond: 16_777_216 }, activityHistory: { nextId: 1, records: [] } },
      { id: 'network-foreign-001', name: 'remote-segment-01', memberDeviceIds: ['host-phone-001', 'host-lan-002'], transferCapacity: { uploadBytesPerSecond: 8_388_608, downloadBytesPerSecond: 8_388_608 }, activityHistory: { nextId: 1, records: [] } },
    ])
    for (const localNetwork of state.world.network.localNetworks) {
      expect(isValidNetworkTransferCapacity(localNetwork.transferCapacity)).toBe(true)
    }
    expect(state.world.network.localNetworks[0].id).not.toBe(state.world.network.localNetworks[0].name)
    expect(state.player.localDevice).not.toHaveProperty('networkId')
  })

  it('preserves the existing LAN host as the canonical server and gives it two owned services and vulnerability truth', () => {
    const state = createInitialGameState()
    const server = state.world.network.hosts.find(({ id }) => id === 'host-lan-001')

    expect(server).toMatchObject({ id: 'host-lan-001', ip: '198.51.100.47', role: 'server' })
    expect(server).toMatchObject({ displayName: 'srv-01', firmware: { id: 'firmware-rack-os-v1', name: 'RACK-OS', version: '1.0' }, filesystem: { nextFileId: 4, files: [
      { kind: 'text', id: 'file-0001', path: '/srv/readme.txt', content: 'Service workspace.' },
      { kind: 'software_package', id: 'file-0002', path: '/opt/packages/nodescan-exp-1.1.pkg', releaseId: 'nodescan-1.1-experimental', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 18_400_000 },
      { kind: 'software_package', id: 'file-0003', path: '/opt/packages/gatessh-1.3.2.pkg', releaseId: 'gate-ssh-1.3.2', productId: 'gate-ssh', name: 'GateSSH', version: '1.3.2', channel: 'stable', publisher: 'rack-systems', sizeBytes: 6_400_000 },
    ] } })
    expect(server?.filesystem?.files.some((file) => file.kind === 'executable')).toBe(false)
    // The operable server owns the same semantic concern as node-01 and starts with nothing installed on it.
    expect(server?.installedSoftware).toEqual([])
    expect(server?.installedSoftware).not.toBe(state.player.localDevice.installedSoftware)
    const concreteHostIds = ['host-lan-001', 'host-lan-002', 'host-phone-001']
    const shallowTrainingHosts = state.world.network.hosts.filter(({ id }) => !concreteHostIds.includes(id))
    expect(shallowTrainingHosts.length).toBeGreaterThan(0)
    expect(shallowTrainingHosts.every((host) => !host.displayName && !host.firmware && !host.filesystem && !host.hardware && !host.runtime)).toBe(true)
    // Shallow hosts are deliberately shallow: no fabricated inventory to make the shapes uniform.
    expect(shallowTrainingHosts.every((host) => host.installedSoftware === undefined)).toBe(true)
    expect(state.world.network.localNetworks[0].memberDeviceIds).toContain(server?.id)
    expect(server?.services).toEqual([
      { id: 'service-ssh-001', name: 'SSH', port: 22, protocol: 'TCP', open: true, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', name: 'GateSSH', version: '1.3.2' }, credentialAccess: { privilege: 'USER' } },
      { id: 'service-http-001', name: 'HTTP', port: 80, protocol: 'TCP', open: true, implementation: { productId: 'basic-http', releaseId: 'basic-http-1.0', name: 'Basic HTTP', version: '1.0' } },
    ])
  })

  it('gives the second LAN server its own independent identity, firmware, filesystem, and vulnerability truth', () => {
    const state = createInitialGameState()
    const server = state.world.network.hosts.find(({ id }) => id === 'host-lan-002')

    expect(server).toMatchObject({ id: 'host-lan-002', ip: '203.0.113.42', role: 'server' })
    expect(server).toMatchObject({ displayName: 'srv-02', firmware: { id: 'firmware-rack-os-v1', name: 'RACK-OS', version: '1.0' }, filesystem: { nextFileId: 2, files: [{ kind: 'text', id: 'file-0001', path: '/srv/backup-manifest.txt', content: 'Backup manifest for srv-02.' }] } })
    expect(state.world.network.localNetworks[0].memberDeviceIds).not.toContain(server?.id)
    expect(server?.services).toEqual([
      { id: 'service-ssh-002', name: 'SSH', port: 22, protocol: 'TCP', open: true, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.3', name: 'GateSSH', version: '1.3.3' }, credentialAccess: { privilege: 'USER' } },
      { id: 'service-rack-update-002', name: 'RackUpdate', port: 8443, protocol: 'TCP', open: true, implementation: { productId: 'rack-update', releaseId: 'rack-update-1.0', name: 'RackUpdate', version: '1.0' } },
    ])
    expect(server?.id).not.toBe('host-lan-001')
    expect(server?.installedSoftware).toEqual([])
    expect(server?.installedSoftware).not.toBe(state.world.network.hosts.find(({ id }) => id === 'host-lan-001')?.installedSoftware)
    expect(server?.filesystem).not.toEqual(state.world.network.hosts.find(({ id }) => id === 'host-lan-001')?.filesystem)
  })

  it('seeds srv-01 vulnerable, srv-02 patched, and the phone vulnerable GateSSH release identities', () => {
    const ssh = createInitialGameState().world.network.hosts.flatMap((host) => host.services ?? []).filter((service) => service.name === 'SSH')
    expect(ssh).toHaveLength(3)
    expect(ssh.map(({ implementation }) => implementation)).toEqual([
      { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', name: 'GateSSH', version: '1.3.2' },
      { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.3', name: 'GateSSH', version: '1.3.3' },
      { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', name: 'GateSSH', version: '1.3.2' },
    ])
  })

  /*
   * The first concrete ordinary personal Device. Everything asserted here is
   * what the existing access loop and the existing finance domain actually
   * need, and nothing else: no phone model, no owner entity, no invented
   * personal content, and no phone-specific access mechanic.
   */
  it('seeds one concrete VEYRA phone reachable through the existing credential-access loop', () => {
    const state = createInitialGameState()
    const phone = state.world.network.hosts.find(({ id }) => id === 'host-phone-001')

    expect(phone).toMatchObject({
      id: 'host-phone-001',
      displayName: 'Petra\u2019s Phone',
      ip: '198.51.100.61',
      online: true,
      firmware: { id: VEYRA_OS_FIRMWARE_ID, name: 'VEYRA OS', version: '4.1' },
      hardware: { cpu: { name: 'Mobile CPU', computeCapacity: 70 }, ram: { name: '6 GB', capacityMiB: 6144 } },
      runtime: { baselineCpuLoad: 6, baselineRamUsage: 34 },
      transferCapacity: { uploadBytesPerSecond: 2_097_152, downloadBytesPerSecond: 4_194_304 },
    })
    // An ordinary personal Device, not a server: it carries no server role.
    expect(phone?.role).toBeUndefined()
    // Represented like any other concretely operable Device, and empty rather than filled with invented personal content.
    expect(phone?.installedSoftware).toEqual([])
    expect(phone?.filesystem).toEqual({ nextFileId: 1, files: [] })
    // Reachable through the same represented weakness the existing loop already resolves.
    expect(phone?.services).toEqual([
      { id: 'service-ssh-003', name: 'SSH', port: 22, protocol: 'TCP', open: true, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', name: 'GateSSH', version: '1.3.2' }, credentialAccess: { privilege: 'USER' } },
    ])
    expect(vulnerabilitiesForService(phone!.services![0])).toEqual([AUTH_017])
    // Directly discoverable by the existing Scan grammar, but not leaked by SELF's temporary Network topology.
    expect(state.world.network.localNetworks[0].memberDeviceIds).not.toContain('host-phone-001')
    expect(phone?.authenticationHistory).toEqual({ nextId: 1, records: [] })
  })

  it('gives the VEYRA phone its own Civic Dollar Account through its own Device-bound Financial Session', () => {
    const state = createInitialGameState()
    const local = state.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-local-v0')
    const phone = state.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-veyra-phone-v0')

    // One Provider, two ordinary Accounts. VEYRA owns neither.
    expect(state.dollarFinance.provider).toEqual({ id: 'dollar-provider-civic-v0', displayName: 'Civic Dollar' })
    expect(phone).toEqual({ id: 'dollar-account-veyra-phone-v0', accountReference: 'CD-3318-2204', balanceCents: 34_250 })
    expect(phone?.accountReference).not.toBe(local?.accountReference)
    expect(local?.balanceCents).toBe(125_000)
    // The phone resolves its own Account, and only through its own Session.
    expect(resolveDollarAccountForDevice(state, 'host-phone-001')).toEqual(phone)
    expect(resolveDollarAccountForDevice(state, state.player.localDevice.id)).toEqual(local)
    expect(state.dollarFinance.sessions.active).toEqual([
      { id: 'dollar-session-0001', accountId: 'dollar-account-local-v0', clientDeviceId: 'device-local-v0' },
      { id: 'dollar-session-0002', accountId: 'dollar-account-veyra-phone-v0', clientDeviceId: 'host-phone-001' },
    ])
    // Nothing has moved in the represented world yet.
    expect(state.dollarFinance.transactions).toEqual({ nextId: 1, records: [] })
    // The phone stores no sign-in of its own: a Session is not saved material.
    expect(phone).not.toHaveProperty('savedDollarSignIn')
  })
})
