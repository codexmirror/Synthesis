import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { connectRemoteFromObservation, disconnectRemoteSession } from './remoteSession'
import { advanceFileTransfer, cancelFileTransfer, deriveDownloadDestinationPath, deriveFileTransferDirection, resolveFileTransferSource, startMarketPackageDownload, startRemoteFileDownload, startRemoteFileUpload } from './fileTransfer'
import { findMarketOffer, purchaseMarketOffer, MARKET_V1_OFFER_PRICE_NODE_UNITS } from './market'
import { advanceGameState } from './gameAdvancement'
import { deriveEffectiveTransferRateBytesPerSecond } from './networkTransferCapacity'
import { getFilesystemFile } from './filesystem'
import { startProcess } from './processes'
import type { DeviceAccessFileTransfer, GameState } from './types'

const ACCESS_ID = 'access-download'

function connectedState(): GameState {
  const base = createInitialGameState()
  const access = { id: ACCESS_ID, sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' as const }
  const authorized = { ...base, deviceAccess: { nextId: 2, established: [access] } }
  return connectRemoteFromObservation(authorized, { targetDeviceId: access.targetDeviceId, address: '198.51.100.47' }).state
}

const NODESCAN_PATH = '/opt/packages/nodescan-exp-1.1.pkg'
const NODESCAN_BYTES = 18_400_000
const NODESCAN_RATE = 2_097_152 // min(srv-01 upload 8 MiB/s, node-01 download 2 MiB/s)
const NODESCAN_COMPLETE_MS = (NODESCAN_BYTES / NODESCAN_RATE) * 1000 // ~8.77s, derived rather than hardcoded

describe('starting a remote Download', () => {
  it('starts exactly one active FileTransfer for a valid srv-01 -> node-01 request', () => {
    const state = connectedState()
    const result = startRemoteFileDownload(state, NODESCAN_PATH)
    expect(result.status).toBe('started')
    if (result.status !== 'started') throw new Error('expected started')
    expect(result.state.fileTransfer.active).toMatchObject({ id: result.transferId, bytesTransferred: 0 })
  })

  it('creates no destination artifact and does not increment local nextFileId', () => {
    const state = connectedState()
    const before = state.player.localDevice.filesystem
    const result = startRemoteFileDownload(state, NODESCAN_PATH)
    if (result.status !== 'started') throw new Error('expected started')
    expect(result.state.player.localDevice.filesystem).toBe(before)
    expect(result.state.player.localDevice.filesystem.nextFileId).toBe(before.nextFileId)
    expect(getFilesystemFile(result.state.player.localDevice.filesystem, result.destinationPath).status).toBe('not_found')
  })

  it('creates no GameProcess', () => {
    const state = connectedState()
    const result = startRemoteFileDownload(state, NODESCAN_PATH)
    if (result.status !== 'started') throw new Error('expected started')
    expect(result.state.process).toBe(state.process)
  })

  it('records the admitting DeviceAccess identity rather than a sessionId', () => {
    const state = connectedState()
    const result = startRemoteFileDownload(state, NODESCAN_PATH)
    if (result.status !== 'started') throw new Error('expected started')
    expect(result.state.fileTransfer.active).toMatchObject({ accessId: ACCESS_ID })
    expect(result.state.fileTransfer.active).not.toHaveProperty('sessionId')
  })

  it('records stable sourceDeviceId and sourceFileId rather than path or IP', () => {
    const state = connectedState()
    const result = startRemoteFileDownload(state, NODESCAN_PATH)
    if (result.status !== 'started') throw new Error('expected started')
    expect(result.state.fileTransfer.active).toMatchObject({ sourceDeviceId: 'host-lan-001', sourceFileId: 'file-0002' })
    expect(result.state.fileTransfer.active).not.toHaveProperty('sourcePath')
    expect(result.state.fileTransfer.active).not.toHaveProperty('sourceIp')
  })

  it('records stable destinationDeviceId and destinationPath', () => {
    const state = connectedState()
    const result = startRemoteFileDownload(state, NODESCAN_PATH)
    if (result.status !== 'started') throw new Error('expected started')
    expect(result.state.fileTransfer.active).toMatchObject({ destinationDeviceId: state.player.localDevice.id, destinationPath: '/home/user/downloads/nodescan-exp-1.1.pkg' })
  })

  it('derives bytesTotal from existing filesystem-size semantics', () => {
    const state = connectedState()
    const result = startRemoteFileDownload(state, NODESCAN_PATH)
    if (result.status !== 'started') throw new Error('expected started')
    expect(result.state.fileTransfer.active?.bytesTotal).toBe(NODESCAN_BYTES)
  })

  it('never stores effective transfer rate on the canonical FileTransfer', () => {
    const state = connectedState()
    const result = startRemoteFileDownload(state, NODESCAN_PATH)
    if (result.status !== 'started') throw new Error('expected started')
    expect(Object.keys(result.state.fileTransfer.active!).sort()).toEqual(
      ['origin', 'accessId', 'bytesTotal', 'bytesTransferred', 'destinationDeviceId', 'destinationPath', 'id', 'sourceDeviceId', 'sourceFileId'].sort(),
    )
  })

  it('rejects a second Download while one is active with transfer_in_progress', () => {
    const state = connectedState()
    const first = startRemoteFileDownload(state, NODESCAN_PATH)
    if (first.status !== 'started') throw new Error('expected started')
    const second = startRemoteFileDownload(first.state, '/srv/readme.txt')
    expect(second).toEqual({ status: 'transfer_in_progress', state: first.state })
  })

  it('still refuses an occupied destination at start', () => {
    const state = connectedState()
    const first = startRemoteFileDownload(state, '/srv/readme.txt')
    if (first.status !== 'started') throw new Error('expected started')
    const completed = advanceFileTransfer(first.state, 60_000)
    expect(completed.fileTransfer.active).toBeNull()
    expect(completed.recentActivity.entries.at(-1)).toMatchObject({ kind: 'file_transfer', id: first.transferId, transfer: { bytesTransferred: first.state.fileTransfer.active!.bytesTotal }, sourcePath: '/srv/readme.txt', route: '198.51.100.47 → node-01' })
    const duplicate = startRemoteFileDownload(completed, '/srv/readme.txt')
    expect(duplicate).toEqual({ status: 'destination_exists', state: completed })
  })

  it('preserves exact source failure semantics', () => {
    const state = connectedState()
    expect(startRemoteFileDownload(state, 'relative').status).toBe('invalid_path')
    expect(startRemoteFileDownload(state, '/missing').status).toBe('source_not_found')
    expect(startRemoteFileDownload(state, '/opt').status).toBe('source_not_file')
  })

  it('requires a current resolvable Session to start', () => {
    const base = createInitialGameState()
    expect(startRemoteFileDownload(base, '/srv/readme.txt')).toEqual({ status: 'session_unavailable', state: base })
  })
})

describe('elapsed advancement', () => {
  it('increases bytesTransferred from partial elapsed time without creating a destination artifact', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const advanced = advanceFileTransfer(started.state, 2_000)
    expect(advanced.fileTransfer.active?.bytesTransferred).toBeGreaterThan(0)
    expect(advanced.fileTransfer.active?.bytesTransferred).toBeLessThan(NODESCAN_BYTES)
    expect(getFilesystemFile(advanced.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
  })

  it('completes the canonical NodeScan Download after its derived required elapsed time, not a hardcoded duration', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const rate = deriveEffectiveTransferRateBytesPerSecond(
      state.world.network.hosts[0].transferCapacity!,
      state.player.localDevice.network.transferCapacity,
    )
    expect(rate).toBe(NODESCAN_RATE)
    const requiredMs = (NODESCAN_BYTES / rate) * 1000
    expect(requiredMs).toBeCloseTo(NODESCAN_COMPLETE_MS, 5)

    const stillRunning = advanceFileTransfer(started.state, requiredMs - 500)
    expect(stillRunning.fileTransfer.active).not.toBeNull()

    const completed = advanceFileTransfer(stillRunning, 500)
    expect(completed.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(completed.player.localDevice.filesystem, started.destinationPath)).toMatchObject({ status: 'ok', file: { kind: 'software_package', releaseId: 'nodescan-1.1-experimental' } })
  })

  it('creates exactly one local destination artifact and allocates exactly one destination file ID on completion', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, '/srv/readme.txt')
    if (started.status !== 'started') throw new Error('expected started')
    const before = state.player.localDevice.filesystem.nextFileId
    const completed = advanceFileTransfer(started.state, 60_000)
    expect(completed.player.localDevice.filesystem.files.filter((file) => file.path === started.destinationPath)).toHaveLength(1)
    expect(completed.player.localDevice.filesystem.nextFileId).toBe(before + 1)
  })

  it('leaves the remote source file unchanged', () => {
    const state = connectedState()
    const sourceFilesystem = state.world.network.hosts[0].filesystem
    const started = startRemoteFileDownload(state, '/srv/readme.txt')
    if (started.status !== 'started') throw new Error('expected started')
    const completed = advanceFileTransfer(started.state, 60_000)
    expect(completed.world.network.hosts[0].filesystem).toBe(sourceFilesystem)
  })

  it('clears the active transfer on successful completion while keeping nextId monotonic', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, '/srv/readme.txt')
    if (started.status !== 'started') throw new Error('expected started')
    const nextIdAfterStart = started.state.fileTransfer.nextId
    const completed = advanceFileTransfer(started.state, 60_000)
    expect(completed.fileTransfer.active).toBeNull()
    expect(completed.fileTransfer.nextId).toBe(nextIdAfterStart)

    const startedAgain = startRemoteFileDownload(completed, NODESCAN_PATH)
    if (startedAgain.status !== 'started') throw new Error('expected started')
    expect(startedAgain.state.fileTransfer.nextId).toBe(nextIdAfterStart + 1)
    expect(startedAgain.transferId).not.toBe(started.transferId)
  })

  it('uses the existing derived UTF-8 byte size for a tiny TextFile transfer', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, '/srv/readme.txt')
    if (started.status !== 'started') throw new Error('expected started')
    expect(started.state.fileTransfer.active?.bytesTotal).toBe(new TextEncoder().encode('Service workspace.').byteLength)
  })

  it('derives the effective rate fresh from current capacities on every advancement, so a capacity change changes throughput', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const throttled: GameState = { ...started.state, player: { ...started.state.player, localDevice: { ...started.state.player.localDevice, network: { ...started.state.player.localDevice.network, transferCapacity: { ...started.state.player.localDevice.network.transferCapacity, downloadBytesPerSecond: 1_048_576 } } } } }
    const advanced = advanceFileTransfer(throttled, 1_000)
    expect(advanced.fileTransfer.active?.bytesTransferred).toBeCloseTo(1_048_576, 0)
    expect(advanced.fileTransfer.active?.bytesTransferred).toBeLessThan(NODESCAN_RATE)
  })
})

describe('continuity across the interactive RemoteSession lifecycle', () => {
  it('preserves the active transfer across disconnect and advances it with no RemoteSession present', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const disconnected = disconnectRemoteSession(started.state)
    expect(disconnected.status).toBe('disconnected')
    expect(disconnected.state.remoteSession.active).toBeNull()
    expect(disconnected.state.fileTransfer.active?.id).toBe(started.transferId)

    const advanced = advanceFileTransfer(disconnected.state, 2_000)
    expect(advanced.fileTransfer.active?.bytesTransferred).toBeGreaterThan(0)
  })

  it('preserves DeviceAccess across disconnect while the transfer remains active', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const disconnected = disconnectRemoteSession(started.state).state
    expect(disconnected.deviceAccess.established).toEqual(started.state.deviceAccess.established)
    expect(disconnected.deviceAccess.established).toHaveLength(1)
  })

  it('completes successfully after disconnect, allocating exactly one destination artifact and file ID', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const disconnected = disconnectRemoteSession(started.state).state
    const beforeId = disconnected.player.localDevice.filesystem.nextFileId
    const completed = advanceFileTransfer(disconnected, NODESCAN_COMPLETE_MS + 1_000)
    expect(completed.fileTransfer.active).toBeNull()
    expect(completed.player.localDevice.filesystem.files.filter((file) => file.path === started.destinationPath)).toHaveLength(1)
    expect(completed.player.localDevice.filesystem.nextFileId).toBe(beforeId + 1)
  })

  it('is unaffected by a later different RemoteSession connecting to another target', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const disconnected = disconnectRemoteSession(started.state).state

    const otherAccess = { id: 'access-other', sourceDeviceId: disconnected.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-ssh-002', privilege: 'USER' as const }
    const withOtherAccess = { ...disconnected, deviceAccess: { nextId: 3, established: [...disconnected.deviceAccess.established, otherAccess] } }
    const reconnectedElsewhere = connectRemoteFromObservation(withOtherAccess, { targetDeviceId: 'host-lan-002', address: '203.0.113.42' }).state
    expect(reconnectedElsewhere.remoteSession.active?.accessId).toBe('access-other')
    expect(reconnectedElsewhere.fileTransfer.active?.id).toBe(started.transferId)

    const advanced = advanceFileTransfer(reconnectedElsewhere, 2_000)
    expect(advanced.fileTransfer.active?.bytesTransferred).toBeGreaterThan(0)
  })
})

describe('endpoint availability', () => {
  it('aborts without creating a file when the local Device goes OFFLINE', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const offline: GameState = { ...started.state, player: { ...started.state.player, localDevice: { ...started.state.player.localDevice, runtime: { ...started.state.player.localDevice.runtime, networkStatus: 'OFFLINE' } } } }
    const advanced = advanceFileTransfer(offline, 60_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(advanced.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
  })

  it('aborts without creating a file when the remote source host goes offline', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const host = started.state.world.network.hosts[0]
    const offlineHost: GameState = { ...started.state, world: { network: { ...started.state.world.network, hosts: [{ ...host, online: false }, ...started.state.world.network.hosts.slice(1)] } } }
    const advanced = advanceFileTransfer(offlineHost, 60_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(advanced.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
  })

  it('does not retarget an active transfer when the source Device IP or display name changes', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, '/srv/readme.txt')
    if (started.status !== 'started') throw new Error('expected started')
    const host = started.state.world.network.hosts[0]
    const renamed: GameState = { ...started.state, world: { network: { ...started.state.world.network, hosts: [{ ...host, ip: '203.0.113.250', displayName: 'renamed-host' }, ...started.state.world.network.hosts.slice(1)] } } }
    const completed = advanceFileTransfer(renamed, 60_000)
    expect(completed.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(completed.player.localDevice.filesystem, started.destinationPath)).toMatchObject({ status: 'ok', file: { content: 'Service workspace.' } })
  })

  it('does not retarget an active transfer when the source file path changes while its stable ID remains', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, '/srv/readme.txt')
    if (started.status !== 'started') throw new Error('expected started')
    const host = started.state.world.network.hosts[0]
    const moved: GameState = { ...started.state, world: { network: { ...started.state.world.network, hosts: [{ ...host, filesystem: { ...host.filesystem!, files: host.filesystem!.files.map((file) => file.id === 'file-0001' ? { ...file, path: '/srv/moved-readme.txt' } : file) } }, ...started.state.world.network.hosts.slice(1)] } } }
    const completed = advanceFileTransfer(moved, 60_000)
    expect(completed.fileTransfer.active).toBeNull()
    // The already-snapshotted destinationPath is kept even though the source moved.
    expect(getFilesystemFile(completed.player.localDevice.filesystem, started.destinationPath)).toMatchObject({ status: 'ok', file: { content: 'Service workspace.' } })
  })

  it('aborts safely with no destination artifact if the source file is removed before completion', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, '/srv/readme.txt')
    if (started.status !== 'started') throw new Error('expected started')
    const host = started.state.world.network.hosts[0]
    const sourceRemoved: GameState = { ...started.state, world: { network: { ...started.state.world.network, hosts: [{ ...host, filesystem: { ...host.filesystem!, files: host.filesystem!.files.filter((file) => file.id !== 'file-0001') } }, ...started.state.world.network.hosts.slice(1)] } } }
    const advanced = advanceFileTransfer(sourceRemoved, 60_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(advanced.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
  })

  it('does not overwrite when the destination becomes occupied before completion', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, '/srv/readme.txt')
    if (started.status !== 'started') throw new Error('expected started')
    const blocking = { kind: 'text' as const, id: 'file-blocking', path: started.destinationPath, content: 'Occupied while the transfer was running.' }
    const occupied: GameState = { ...started.state, player: { ...started.state.player, localDevice: { ...started.state.player.localDevice, filesystem: { ...started.state.player.localDevice.filesystem, files: [...started.state.player.localDevice.filesystem.files, blocking] } } } }
    const advanced = advanceFileTransfer(occupied, 60_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(advanced.player.localDevice.filesystem.files.filter((file) => file.path === started.destinationPath)).toEqual([blocking])
  })
})

describe('DeviceAccess authority (accessId -> DeviceAccess -> source Device)', () => {
  it('aborts when the admitting DeviceAccess is removed/revoked', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const accessRemoved: GameState = { ...started.state, deviceAccess: { ...started.state.deviceAccess, established: [] } }
    expect(resolveFileTransferSource(accessRemoved, accessRemoved.fileTransfer.active!)).toBeUndefined()
    const advanced = advanceFileTransfer(accessRemoved, 60_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(advanced.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
  })

  it('aborts when the DeviceAccess no longer matches the transfer\'s recorded source/destination identities', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const retargeted: GameState = {
      ...started.state,
      deviceAccess: {
        ...started.state.deviceAccess,
        established: started.state.deviceAccess.established.map((access) => access.id === ACCESS_ID ? { ...access, targetDeviceId: 'host-lan-002', viaServiceId: 'service-ssh-002' } : access),
      },
    }
    expect(resolveFileTransferSource(retargeted, retargeted.fileTransfer.active!)).toBeUndefined()
    const advanced = advanceFileTransfer(retargeted, 60_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(advanced.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
  })

  it('aborts safely when the destination Device identity no longer matches the transfer\'s recorded destinationDeviceId', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    expect(started.state.fileTransfer.active?.destinationDeviceId).toBe(state.player.localDevice.id)
    const rehomed: GameState = { ...started.state, player: { ...started.state.player, localDevice: { ...started.state.player.localDevice, id: 'device-local-different' } } }
    const advanced = advanceFileTransfer(rehomed, 60_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(advanced.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
  })
})

describe('cancelFileTransfer', () => {
  it('clears the active transfer for the correct active transfer ID', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const result = cancelFileTransfer(started.state, started.transferId)
    expect(result.status).toBe('cancelled')
    expect(result.state.fileTransfer.active).toBeNull()
    expect(result.state.recentActivity.entries).toHaveLength(1)
    expect(result.state.recentActivity.entries[0]).toMatchObject({ kind: 'file_transfer', id: started.transferId, transfer: { bytesTransferred: 0, destinationPath: '/home/user/downloads/nodescan-exp-1.1.pkg' } })
  })

  it('is a no-op for an unknown or stale transfer ID', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    expect(cancelFileTransfer(started.state, 'transfer-9999')).toEqual({ status: 'not_found', state: started.state })
    expect(cancelFileTransfer(state, started.transferId)).toEqual({ status: 'not_found', state })
  })

  it('does not create a destination file or consume the filesystem nextFileId', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const beforeNextFileId = started.state.player.localDevice.filesystem.nextFileId
    const result = cancelFileTransfer(started.state, started.transferId)
    expect(result.state.player.localDevice.filesystem).toBe(started.state.player.localDevice.filesystem)
    expect(result.state.player.localDevice.filesystem.nextFileId).toBe(beforeNextFileId)
    expect(getFilesystemFile(result.state.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
  })

  it('preserves FileTransferState.nextId', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const result = cancelFileTransfer(started.state, started.transferId)
    expect(result.state.fileTransfer.nextId).toBe(started.state.fileTransfer.nextId)
  })

  it('preserves DeviceAccess and RemoteSession untouched', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const result = cancelFileTransfer(started.state, started.transferId)
    expect(result.state.deviceAccess).toBe(started.state.deviceAccess)
    expect(result.state.remoteSession).toBe(started.state.remoteSession)
  })

  it('creates no GameProcess and no completion history', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const result = cancelFileTransfer(started.state, started.transferId)
    expect(result.state.process).toBe(started.state.process)
    expect(result.state.process.processes).toEqual([])
  })

  it('cancelling after disconnect still works because the transfer no longer depends on the Session', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const disconnected = disconnectRemoteSession(started.state).state
    const result = cancelFileTransfer(disconnected, started.transferId)
    expect(result.status).toBe('cancelled')
    expect(result.state.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(result.state.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
  })
})

describe('interaction with Process runtime', () => {
  it('leaves Process CPU/RAM behavior unchanged while a FileTransfer is also active', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const withProcess = startProcess(started.state.process, started.state.player.localDevice, { label: 'Test work', workRequired: 10, ramRequiredMiB: 100 })
    if (withProcess.status !== 'started') throw new Error('expected process started')
    const combined: GameState = { ...started.state, process: withProcess.state }

    const advanced = advanceGameState(combined, 1_000)
    const process = advanced.process.processes[0]
    if (process.kind === 'node_miner') throw new Error('unexpected node_miner process')
    expect(process.workCompleted).toBeGreaterThan(0)
    expect(advanced.fileTransfer.active?.bytesTransferred).toBeGreaterThan(0)
  })

  it('progresses FileTransfer through advanceGameState even when no GameProcess is running or changing', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    expect(started.state.process.processes).toEqual([])
    const advanced = advanceGameState(started.state, 1_000)
    expect(advanced.fileTransfer.active?.bytesTransferred).toBeGreaterThan(0)
  })

  it('progresses FileTransfer through advanceGameState with no RemoteSession present', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const disconnected = disconnectRemoteSession(started.state).state
    const advanced = advanceGameState(disconnected, 1_000)
    expect(advanced.remoteSession.active).toBeNull()
    expect(advanced.fileTransfer.active?.bytesTransferred).toBeGreaterThan(0)
  })

  it('keeps FileTransfer state entirely outside GameProcess', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    expect(started.state.process.processes).toEqual([])
    for (const process of started.state.process.processes) {
      expect(process).not.toHaveProperty('bytesTotal')
      expect(process).not.toHaveProperty('bytesTransferred')
    }
  })
})

describe('Network activity evidence', () => {
  it('appends one internal COMPLETED Network record with final bytesTransferred for a same-Network Download completion', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, '/srv/readme.txt')
    if (started.status !== 'started') throw new Error('expected started')
    const bytesTotal = started.state.fileTransfer.active!.bytesTotal
    const completed = advanceFileTransfer(started.state, 60_000)
    const homeNet = completed.world.network.localNetworks.find(({ id }) => id === 'network-local-001')
    expect(homeNet?.activityHistory.records).toEqual([{
      id: 'net-activity-0001', kind: 'file_transfer', perspective: 'internal',
      sourceDeviceId: 'host-lan-001', destinationDeviceId: completed.player.localDevice.id,
      sourceAddress: '198.51.100.47', destinationAddress: completed.player.localDevice.network.ip,
      bytesTransferred: bytesTotal, result: 'COMPLETED',
    }])
  })

  it('appends one CANCELLED record with the bytes actually transferred at cancellation, not bytesTotal', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const partial = advanceFileTransfer(started.state, 2_000)
    const bytesAtCancel = partial.fileTransfer.active!.bytesTransferred
    expect(bytesAtCancel).toBeGreaterThan(0)
    const cancelled = cancelFileTransfer(partial, started.transferId)
    const homeNet = cancelled.state.world.network.localNetworks.find(({ id }) => id === 'network-local-001')
    expect(homeNet?.activityHistory.records).toEqual([expect.objectContaining({ result: 'CANCELLED', bytesTransferred: bytesAtCancel })])
  })

  it('appends one INTERRUPTED record with the bytes transferred so far, and creates no destination artifact, when an endpoint becomes unavailable mid-transfer', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const partial = advanceFileTransfer(started.state, 2_000)
    const bytesAtInterruption = partial.fileTransfer.active!.bytesTransferred
    const offline: GameState = { ...partial, player: { ...partial.player, localDevice: { ...partial.player.localDevice, runtime: { ...partial.player.localDevice.runtime, networkStatus: 'OFFLINE' } } } }
    const interrupted = advanceFileTransfer(offline, 60_000)
    expect(getFilesystemFile(interrupted.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
    const homeNet = interrupted.world.network.localNetworks.find(({ id }) => id === 'network-local-001')
    expect(homeNet?.activityHistory.records).toEqual([expect.objectContaining({ result: 'INTERRUPTED', bytesTransferred: bytesAtInterruption })])
  })

  it('does not append one record per advancement tick: exactly one record exists after several partial advances plus completion', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, '/srv/readme.txt')
    if (started.status !== 'started') throw new Error('expected started')
    let running = started.state
    for (let tick = 0; tick < 5; tick += 1) running = advanceFileTransfer(running, 1)
    const completed = advanceFileTransfer(running, 60_000)
    const homeNet = completed.world.network.localNetworks.find(({ id }) => id === 'network-local-001')
    expect(homeNet?.activityHistory.records).toHaveLength(1)
  })

  it('appends distinct source-side and destination-side records for a completed cross-Network transfer', () => {
    const base = createInitialGameState()
    const srv02 = base.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    const bigFile = { kind: 'text' as const, id: 'file-large', path: '/srv/large-file.bin', content: 'x'.repeat(1000) }
    const hosts = base.world.network.hosts.map((host) => host.id === srv02.id ? { ...host, filesystem: { ...host.filesystem!, files: [...host.filesystem!.files, bigFile] } } : host)
    const withBigFile: GameState = { ...base, world: { ...base.world, network: { ...base.world.network, hosts } } }
    const access = { id: 'access-cross-net', sourceDeviceId: withBigFile.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-ssh-002', privilege: 'USER' as const }
    const authorized = { ...withBigFile, deviceAccess: { nextId: 2, established: [access] } }
    const connected = connectRemoteFromObservation(authorized, { targetDeviceId: access.targetDeviceId, address: '203.0.113.42' }).state
    const started = startRemoteFileDownload(connected, '/srv/large-file.bin')
    if (started.status !== 'started') throw new Error('expected started')
    const completed = advanceFileTransfer(started.state, 60_000)
    const homeNet = completed.world.network.localNetworks.find(({ id }) => id === 'network-local-001')
    const foreignNet = completed.world.network.localNetworks.find(({ id }) => id === 'network-foreign-001')
    expect(homeNet?.activityHistory.records).toEqual([expect.objectContaining({ perspective: 'inbound', result: 'COMPLETED', sourceDeviceId: 'host-lan-002' })])
    expect(foreignNet?.activityHistory.records).toEqual([expect.objectContaining({ perspective: 'outbound', result: 'COMPLETED', sourceDeviceId: 'host-lan-002' })])
  })

  it('never stores filesystem path, filename, or file contents on the Network record', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, '/srv/readme.txt')
    if (started.status !== 'started') throw new Error('expected started')
    const completed = advanceFileTransfer(started.state, 60_000)
    const record = completed.world.network.localNetworks.find(({ id }) => id === 'network-local-001')?.activityHistory.records[0]
    expect(JSON.stringify(record)).not.toContain('readme')
    expect(JSON.stringify(record)).not.toContain('Service workspace')
    expect(record).not.toHaveProperty('destinationPath')
  })
})

describe('deriveDownloadDestinationPath', () => {
  it('shares the exact destination policy used by the canonical operation', () => {
    expect(deriveDownloadDestinationPath('/opt/packages/nodescan-exp-1.1.pkg')).toBe('/home/user/downloads/nodescan-exp-1.1.pkg')
  })
})

describe('bidirectional Upload core', () => {
  const SOURCE = '/home/user/downloads/node-miner-1.0.pkg'
  const DESTINATION = '/home/user/node-miner-1.0.pkg'

  it('rejects admission when the Session access is not sourced from the local Device', () => {
    const state = connectedState()
    const invalid: GameState = {
      ...state,
      deviceAccess: { ...state.deviceAccess, established: state.deviceAccess.established.map((access) => ({ ...access, sourceDeviceId: 'host-lan-002' })) },
    }
    const result = startRemoteFileUpload(invalid, SOURCE, DESTINATION)
    expect(result).toEqual({ status: 'session_unavailable', state: invalid })
    expect(result.state.fileTransfer.active).toBeNull()
    expect(result.state.fileTransfer.nextId).toBe(invalid.fileTransfer.nextId)
  })

  it('admits the exact local artifact and explicit remote destination without mutating either filesystem', () => {
    const state = connectedState()
    const localBefore = state.player.localDevice.filesystem
    const remoteBefore = state.world.network.hosts[0].filesystem!
    const result = startRemoteFileUpload(state, SOURCE, DESTINATION)
    if (result.status !== 'started') throw new Error('expected started')
    expect(result.state.fileTransfer.active).toMatchObject({
      accessId: ACCESS_ID, sourceDeviceId: state.player.localDevice.id, sourceFileId: 'file-0002',
      destinationDeviceId: 'host-lan-001', destinationPath: DESTINATION, bytesTransferred: 0,
    })
    expect(deriveFileTransferDirection(state.player.localDevice.id, result.state.fileTransfer.active!)).toBe('upload')
    expect(result.state.player.localDevice.filesystem).toBe(localBefore)
    expect(result.state.world.network.hosts[0].filesystem).toBe(remoteBefore)
    expect(remoteBefore.nextFileId).toBe(result.state.world.network.hosts[0].filesystem!.nextFileId)
    expect(getFilesystemFile(remoteBefore, DESTINATION).status).toBe('not_found')
  })

  it('rejects a trailing-slash remote file destination without normalizing or mutating state', () => {
    const state = connectedState()
    const remoteBefore = state.world.network.hosts[0].filesystem
    const result = startRemoteFileUpload(state, SOURCE, '/home/user/tool.pkg/')
    expect(result).toEqual({ status: 'invalid_path', state })
    expect(result.state.fileTransfer.active).toBeNull()
    expect(result.state.fileTransfer.nextId).toBe(state.fileTransfer.nextId)
    expect(result.state.world.network.hosts[0].filesystem).toBe(remoteBefore)
  })

  it('keeps a normal explicit destination identical on the transfer and completed artifact', () => {
    const state = connectedState()
    const result = startRemoteFileUpload(state, SOURCE, '/home/user/tool.pkg')
    if (result.status !== 'started') throw new Error('expected started')
    const destinationPath = result.state.fileTransfer.active!.destinationPath
    const completed = advanceFileTransfer(result.state, 60_000)
    expect(getFilesystemFile(completed.world.network.hosts[0].filesystem!, destinationPath)).toMatchObject({
      status: 'ok', file: { path: destinationPath },
    })
  })

  it('uses local upload and remote download capacities through the existing elapsed clock', () => {
    const state = connectedState()
    const result = startRemoteFileUpload(state, SOURCE, DESTINATION)
    if (result.status !== 'started') throw new Error('expected started')
    const advanced = advanceGameState(result.state, 1_000)
    expect(advanced.fileTransfer.active?.bytesTransferred).toBe(1_048_576)
  })

  it.each([
    { kind: 'text' as const, id: 'upload-text', path: '/home/user/upload.txt', content: 'upload semantics' },
    { kind: 'software_package' as const, id: 'upload-package', path: '/home/user/upload.pkg', productId: 'tool', releaseId: 'tool-2', buildId: 'build-fixture-v0', name: 'Tool', version: '2', channel: 'stable', publisher: 'Publisher', sizeBytes: 1024 },
    { kind: 'executable' as const, id: 'upload-executable', path: '/home/user/upload.bin', programId: 'tool', releaseId: 'tool-2', buildId: 'build-fixture-v0', name: 'Tool', version: '2', sizeBytes: 1024 },
  ])('copies $kind semantics exactly once while retaining the local source', (file) => {
    const base = connectedState()
    const state: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, file] } } } }
    const remoteBefore = state.world.network.hosts[0].filesystem!
    const destination = `/home/user/copied-${file.kind}`
    const result = startRemoteFileUpload(state, file.path, destination)
    if (result.status !== 'started') throw new Error('expected started')
    const completed = advanceFileTransfer(result.state, 60_000)
    const copied = getFilesystemFile(completed.world.network.hosts[0].filesystem!, destination)
    expect(copied).toMatchObject({ status: 'ok', file: { ...file, id: `file-${String(remoteBefore.nextFileId).padStart(4, '0')}`, path: destination } })
    expect(completed.world.network.hosts[0].filesystem!.files.filter(({ path }) => path === destination)).toHaveLength(1)
    expect(completed.world.network.hosts[0].filesystem!.nextFileId).toBe(remoteBefore.nextFileId + 1)
    expect(getFilesystemFile(completed.player.localDevice.filesystem, file.path)).toMatchObject({ status: 'ok', file })
  })

  it('survives disconnect and an unrelated later Session because stored DeviceAccess remains authoritative', () => {
    const state = connectedState()
    const result = startRemoteFileUpload(state, SOURCE, DESTINATION)
    if (result.status !== 'started') throw new Error('expected started')
    const disconnected = disconnectRemoteSession(result.state).state
    const otherAccess = { id: 'access-other', sourceDeviceId: state.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-ssh-002', privilege: 'USER' as const }
    const changedSession = connectRemoteFromObservation({ ...disconnected, deviceAccess: { ...disconnected.deviceAccess, established: [...disconnected.deviceAccess.established, otherAccess] } }, { targetDeviceId: 'host-lan-002', address: '203.0.113.42' }).state
    const completed = advanceFileTransfer(changedSession, 60_000)
    expect(getFilesystemFile(completed.world.network.hosts[0].filesystem!, DESTINATION).status).toBe('ok')
    expect(getFilesystemFile(completed.world.network.hosts[1].filesystem!, DESTINATION).status).toBe('not_found')
  })

  it.each(['local offline', 'remote offline', 'access removed', 'access mismatch', 'source removed', 'invalid local-local endpoints', 'invalid remote-remote endpoints'])('aborts safely when %s', (condition) => {
    const state = connectedState()
    const result = startRemoteFileUpload(state, SOURCE, DESTINATION)
    if (result.status !== 'started') throw new Error('expected started')
    const host = result.state.world.network.hosts[0]
    let invalid = result.state
    if (condition === 'local offline') invalid = { ...invalid, player: { ...invalid.player, localDevice: { ...invalid.player.localDevice, runtime: { ...invalid.player.localDevice.runtime, networkStatus: 'OFFLINE' } } } }
    if (condition === 'remote offline') invalid = { ...invalid, world: { ...invalid.world, network: { ...invalid.world.network, hosts: [{ ...host, online: false }, ...invalid.world.network.hosts.slice(1)] } } }
    if (condition === 'access removed') invalid = { ...invalid, deviceAccess: { ...invalid.deviceAccess, established: [] } }
    if (condition === 'access mismatch') invalid = { ...invalid, deviceAccess: { ...invalid.deviceAccess, established: invalid.deviceAccess.established.map((access) => ({ ...access, targetDeviceId: 'host-lan-002' })) } }
    if (condition === 'source removed') invalid = { ...invalid, player: { ...invalid.player, localDevice: { ...invalid.player.localDevice, filesystem: { ...invalid.player.localDevice.filesystem, files: invalid.player.localDevice.filesystem.files.filter(({ id }) => id !== 'file-0002') } } } }
    const admitted = invalid.fileTransfer.active as DeviceAccessFileTransfer
    if (condition === 'invalid local-local endpoints') invalid = { ...invalid, fileTransfer: { ...invalid.fileTransfer, active: { ...admitted, destinationDeviceId: invalid.player.localDevice.id } } }
    if (condition === 'invalid remote-remote endpoints') invalid = { ...invalid, fileTransfer: { ...invalid.fileTransfer, active: { ...admitted, sourceDeviceId: 'host-lan-002' } } }
    const remoteBefore = invalid.world.network.hosts[0].filesystem!
    const advanced = advanceFileTransfer(invalid, 60_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(advanced.world.network.hosts[0].filesystem!, DESTINATION).status).toBe('not_found')
    expect(advanced.world.network.hosts[0].filesystem!.nextFileId).toBe(remoteBefore.nextFileId)
  })

  it('does not retarget to a replacement artifact at the admitted source path', () => {
    const result = startRemoteFileUpload(connectedState(), SOURCE, DESTINATION)
    if (result.status !== 'started') throw new Error('expected started')
    const filesystem = result.state.player.localDevice.filesystem
    const replacement = { ...filesystem.files.find(({ id }) => id === 'file-0002')!, id: 'file-replacement' }
    const replaced: GameState = { ...result.state, player: { ...result.state.player, localDevice: { ...result.state.player.localDevice, filesystem: { ...filesystem, files: [...filesystem.files.filter(({ id }) => id !== 'file-0002'), replacement] } } } }
    expect(advanceFileTransfer(replaced, 60_000).fileTransfer.active).toBeNull()
    expect(getFilesystemFile(replaced.world.network.hosts[0].filesystem!, DESTINATION).status).toBe('not_found')
  })

  it('rejects unsafe placement and revalidates it without consuming an ID at completion', () => {
    const state = connectedState()
    expect(startRemoteFileUpload(state, SOURCE, '/srv/readme.txt').status).toBe('destination_exists')
    expect(startRemoteFileUpload(state, SOURCE, 'relative').status).toBe('invalid_path')
    const result = startRemoteFileUpload(state, SOURCE, DESTINATION)
    if (result.status !== 'started') throw new Error('expected started')
    const host = result.state.world.network.hosts[0]
    const blocking = { kind: 'text' as const, id: 'blocking', path: DESTINATION, content: 'occupied' }
    const occupied: GameState = { ...result.state, world: { ...result.state.world, network: { ...result.state.world.network, hosts: [{ ...host, filesystem: { ...host.filesystem!, files: [...host.filesystem!.files, blocking] } }, ...result.state.world.network.hosts.slice(1)] } } }
    const beforeId = occupied.world.network.hosts[0].filesystem!.nextFileId
    const completed = advanceFileTransfer(occupied, 60_000)
    expect(completed.world.network.hosts[0].filesystem!.files.filter(({ path }) => path === DESTINATION)).toEqual([blocking])
    expect(completed.world.network.hosts[0].filesystem!.nextFileId).toBe(beforeId)
  })

  it('enforces one transfer total in both directions and cancellation preserves all gameplay truth', () => {
    const upload = startRemoteFileUpload(connectedState(), SOURCE, DESTINATION)
    if (upload.status !== 'started') throw new Error('expected started')
    expect(startRemoteFileDownload(upload.state, '/srv/readme.txt').status).toBe('transfer_in_progress')
    expect(startRemoteFileUpload(upload.state, SOURCE, '/home/user/other.pkg').status).toBe('transfer_in_progress')
    const remoteBefore = upload.state.world.network.hosts[0].filesystem
    const cancelled = cancelFileTransfer(upload.state, upload.transferId)
    expect(cancelled.state.world.network.hosts[0].filesystem).toBe(remoteBefore)
    expect(cancelled.state.player.localDevice.filesystem).toBe(upload.state.player.localDevice.filesystem)
    expect(cancelled.state.deviceAccess).toBe(upload.state.deviceAccess)
    expect(cancelled.state.remoteSession).toBe(upload.state.remoteSession)
    expect(cancelled.state.process).toBe(upload.state.process)
    expect(cancelled.state.recentActivity.entries.at(-1)).toMatchObject({ sourcePath: SOURCE, route: 'node-01 → 198.51.100.47' })
  })

  it.each(['upload', 'download'] as const)('does not recover changed hidden World route truth after a disconnected %s', (direction) => {
    const state = connectedState()
    const started = direction === 'upload'
      ? startRemoteFileUpload(state, SOURCE, DESTINATION)
      : startRemoteFileDownload(state, '/srv/readme.txt')
    if (started.status !== 'started') throw new Error('expected started')
    const disconnected = disconnectRemoteSession(started.state).state
    const host = disconnected.world.network.hosts[0]
    const changed: GameState = {
      ...disconnected,
      world: { ...disconnected.world, network: { ...disconnected.world.network, hosts: [{ ...host, displayName: 'unseen-renamed-host', ip: '203.0.113.250' }, ...disconnected.world.network.hosts.slice(1)] } },
    }
    const completed = advanceFileTransfer(changed, 60_000)
    const activity = completed.recentActivity.entries.at(-1)
    expect(activity).not.toHaveProperty('route')
    expect(JSON.stringify(activity)).not.toContain('unseen-renamed-host')
    expect(JSON.stringify(activity)).not.toContain('203.0.113.250')
  })
})

describe('cross-Network vs same-Network transfer capacity', () => {
  const CROSS_ACCESS_ID = 'access-cross'
  const HOME_NET_ID = 'network-local-001'
  const REMOTE_NET_ID = 'network-foreign-001'
  const BIG_FILE_PATH = '/srv/large-file.bin'
  const BIG_FILE_BYTES = 50_000

  // srv-02 (host-lan-002, remote-segment-01) is on a different LocalNetwork than node-01 (home-net), so this is the concrete cross-Network route.
  function connectedStateToSrv02(fileBytes: number = BIG_FILE_BYTES): GameState {
    const base = createInitialGameState()
    const host = base.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    const bigFile = { kind: 'text' as const, id: 'file-large', path: BIG_FILE_PATH, content: 'x'.repeat(fileBytes) }
    const withBigFile: GameState = {
      ...base,
      world: { ...base.world, network: { ...base.world.network, hosts: base.world.network.hosts.map((candidate) => candidate.id === host.id ? { ...candidate, filesystem: { ...candidate.filesystem!, files: [...candidate.filesystem!.files, bigFile] } } : candidate) } },
    }
    const access = { id: CROSS_ACCESS_ID, sourceDeviceId: withBigFile.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-ssh-002', privilege: 'USER' as const }
    const authorized = { ...withBigFile, deviceAccess: { nextId: 2, established: [access] } }
    return connectRemoteFromObservation(authorized, { targetDeviceId: access.targetDeviceId, address: '203.0.113.42' }).state
  }

  function withNetworkCapacity(state: GameState, networkId: string, transferCapacity: { uploadBytesPerSecond: number; downloadBytesPerSecond: number }): GameState {
    return { ...state, world: { ...state.world, network: { ...state.world.network, localNetworks: state.world.network.localNetworks.map((network) => network.id === networkId ? { ...network, transferCapacity } : network) } } }
  }

  function withHostUploadCapacity(state: GameState, hostId: string, uploadBytesPerSecond: number): GameState {
    return { ...state, world: { ...state.world, network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === hostId ? { ...host, transferCapacity: { ...host.transferCapacity!, uploadBytesPerSecond } } : host) } } }
  }

  function withLocalDownloadCapacity(state: GameState, downloadBytesPerSecond: number): GameState {
    return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, network: { ...state.player.localDevice.network, transferCapacity: { ...state.player.localDevice.network.transferCapacity, downloadBytesPerSecond } } } } }
  }

  it('limits a cross-Network Download by source Device upload capacity when it is the narrowest bottleneck', () => {
    const state = withHostUploadCapacity(connectedStateToSrv02(), 'host-lan-002', 10_000)
    const started = startRemoteFileDownload(state, BIG_FILE_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const advanced = advanceFileTransfer(started.state, 1_000)
    expect(advanced.fileTransfer.active?.bytesTransferred).toBe(10_000)
  })

  it('limits a cross-Network Download by source Network upload capacity when it is the narrowest bottleneck', () => {
    const state = withNetworkCapacity(connectedStateToSrv02(), REMOTE_NET_ID, { uploadBytesPerSecond: 20_000, downloadBytesPerSecond: 20_000 })
    const started = startRemoteFileDownload(state, BIG_FILE_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const advanced = advanceFileTransfer(started.state, 1_000)
    expect(advanced.fileTransfer.active?.bytesTransferred).toBe(20_000)
  })

  it('limits a cross-Network Download by destination Network download capacity when it is the narrowest bottleneck', () => {
    const state = withNetworkCapacity(connectedStateToSrv02(), HOME_NET_ID, { uploadBytesPerSecond: 30_000, downloadBytesPerSecond: 30_000 })
    const started = startRemoteFileDownload(state, BIG_FILE_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const advanced = advanceFileTransfer(started.state, 1_000)
    expect(advanced.fileTransfer.active?.bytesTransferred).toBe(30_000)
  })

  it('limits a cross-Network Download by destination Device download capacity when it is the narrowest bottleneck', () => {
    const state = withLocalDownloadCapacity(connectedStateToSrv02(), 40_000)
    const started = startRemoteFileDownload(state, BIG_FILE_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const advanced = advanceFileTransfer(started.state, 1_000)
    expect(advanced.fileTransfer.active?.bytesTransferred).toBe(40_000)
  })

  it('ignores collapsed LocalNetwork capacity for a same-Network transfer and uses endpoint capacities only', () => {
    const state = withNetworkCapacity(connectedState(), HOME_NET_ID, { uploadBytesPerSecond: 1, downloadBytesPerSecond: 1 })
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const advanced = advanceFileTransfer(started.state, 1_000)
    // Still node-01's ordinary 2 MiB/s download capacity, unaffected by home-net's collapsed capacity.
    expect(advanced.fileTransfer.active?.bytesTransferred).toBe(2_097_152)
  })

  it('changes subsequent active-transfer advancement when a participating Network\'s capacity changes, without mutating Device capacity', () => {
    const started = startRemoteFileDownload(connectedStateToSrv02(2_000_000), BIG_FILE_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const localCapacityBefore = started.state.player.localDevice.network.transferCapacity
    const remoteCapacityBefore = started.state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.transferCapacity

    const baseline = advanceFileTransfer(started.state, 1_000)
    expect(baseline.fileTransfer.active?.bytesTransferred).toBe(1_048_576) // srv-02's own 1 MiB/s upload is the default narrowest bottleneck here

    const throttled = withNetworkCapacity(started.state, REMOTE_NET_ID, { uploadBytesPerSecond: 5_000, downloadBytesPerSecond: 5_000 })
    const throttledAdvanced = advanceFileTransfer(throttled, 1_000)
    expect(throttledAdvanced.fileTransfer.active?.bytesTransferred).toBe(5_000)

    expect(throttled.player.localDevice.network.transferCapacity).toBe(localCapacityBefore)
    expect(throttled.world.network.hosts.find(({ id }) => id === 'host-lan-002')!.transferCapacity).toBe(remoteCapacityBefore)
  })

  it('aborts an active cross-Network transfer without creating a destination artifact when a participating Network capacity becomes invalid', () => {
    const started = startRemoteFileDownload(connectedStateToSrv02(), BIG_FILE_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const invalidated = withNetworkCapacity(started.state, REMOTE_NET_ID, { uploadBytesPerSecond: 0, downloadBytesPerSecond: 8_388_608 })
    const advanced = advanceFileTransfer(invalidated, 1_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(advanced.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
  })

  describe('LocalNetwork membership resolution: none vs. unique vs. ambiguous', () => {
    // Distinct from remote-segment-01's own 8 MiB/s and from node-01/srv-02's endpoint capacities, so a wrongly picked Network would be visible in the resulting rate.
    const SHADOW_NETWORK = { id: 'network-shadow-test', name: 'shadow-net', memberDeviceIds: ['host-lan-002'], transferCapacity: { uploadBytesPerSecond: 3_000_000, downloadBytesPerSecond: 3_000_000 }, activityHistory: { nextId: 1, records: [] } }
    // srv-02's own 1 MiB/s upload is the narrowest bottleneck when no LocalNetwork capacity is contributed (the zero-membership fallback).
    const ENDPOINT_ONLY_RATE = 1_048_576

    function withoutMembership(state: GameState, deviceId: string): GameState {
      return { ...state, world: { ...state.world, network: { ...state.world.network, localNetworks: state.world.network.localNetworks.map((network) => ({ ...network, memberDeviceIds: network.memberDeviceIds.filter((id) => id !== deviceId) })) } } }
    }

    function withShadowMembership(state: GameState, position: 'append' | 'prepend'): GameState {
      const localNetworks = position === 'append' ? [...state.world.network.localNetworks, SHADOW_NETWORK] : [SHADOW_NETWORK, ...state.world.network.localNetworks]
      return { ...state, world: { ...state.world, network: { ...state.world.network, localNetworks } } }
    }

    it('1. falls back to endpoint-only capacity when an endpoint has zero represented LocalNetwork memberships', () => {
      const state = withoutMembership(connectedStateToSrv02(2_000_000), 'host-lan-002')
      const started = startRemoteFileDownload(state, BIG_FILE_PATH)
      if (started.status !== 'started') throw new Error('expected started')
      const advanced = advanceFileTransfer(started.state, 1_000)
      expect(advanced.fileTransfer.active?.bytesTransferred).toBe(ENDPOINT_ONLY_RATE)
    })

    it('2. resolves normally and applies cross-Network composition when an endpoint has exactly one represented LocalNetwork membership', () => {
      const started = startRemoteFileDownload(connectedStateToSrv02(2_000_000), BIG_FILE_PATH)
      if (started.status !== 'started') throw new Error('expected started')
      const advanced = advanceFileTransfer(started.state, 1_000)
      expect(advanced.fileTransfer.active?.bytesTransferred).toBe(ENDPOINT_ONLY_RATE)
    })

    it('3. does not select either candidate LocalNetwork by array order when an endpoint belongs to two', () => {
      for (const position of ['append', 'prepend'] as const) {
        const state = withShadowMembership(connectedStateToSrv02(2_000_000), position)
        const started = startRemoteFileDownload(state, BIG_FILE_PATH)
        if (started.status !== 'started') throw new Error('expected started')
        const advanced = advanceFileTransfer(started.state, 1_000)
        // Aborted rather than proceeding at either remote-segment-01's 8 MiB/s or the shadow Network's 3,000,000 B/s.
        expect(advanced.fileTransfer.active).toBeNull()
      }
    })

    it('4. does not fall back to endpoint-only throughput when an endpoint\'s membership is ambiguous', () => {
      // The zero-membership case (test 1) advances normally at ENDPOINT_ONLY_RATE with a non-null active transfer.
      // Ambiguous represented topology is a distinct, unresolved-route condition and must not be silently treated the same way.
      const state = withShadowMembership(connectedStateToSrv02(2_000_000), 'append')
      const started = startRemoteFileDownload(state, BIG_FILE_PATH)
      if (started.status !== 'started') throw new Error('expected started')
      const advanced = advanceFileTransfer(started.state, 1_000)
      expect(advanced.fileTransfer.active).toBeNull()
      expect(getFilesystemFile(advanced.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
    })

    it('5. has no semantic effect from reordering the ambiguous LocalNetworks: both orders abort identically', () => {
      const appended = withShadowMembership(connectedStateToSrv02(2_000_000), 'append')
      const prepended = withShadowMembership(connectedStateToSrv02(2_000_000), 'prepend')
      const startedAppended = startRemoteFileDownload(appended, BIG_FILE_PATH)
      const startedPrepended = startRemoteFileDownload(prepended, BIG_FILE_PATH)
      if (startedAppended.status !== 'started' || startedPrepended.status !== 'started') throw new Error('expected started')
      expect(advanceFileTransfer(startedAppended.state, 1_000).fileTransfer.active).toBeNull()
      expect(advanceFileTransfer(startedPrepended.state, 1_000).fileTransfer.active).toBeNull()
    })

    it('6. terminates an already active transfer through the existing interruption/archive path once its membership becomes ambiguous, creating no destination artifact', () => {
      const started = startRemoteFileDownload(connectedStateToSrv02(2_000_000), BIG_FILE_PATH)
      if (started.status !== 'started') throw new Error('expected started')
      // Still unambiguous and running normally before the second membership appears.
      const partway = advanceFileTransfer(started.state, 1_000)
      expect(partway.fileTransfer.active?.bytesTransferred).toBe(ENDPOINT_ONLY_RATE)

      const madeAmbiguous = withShadowMembership(partway, 'append')
      const advanced = advanceFileTransfer(madeAmbiguous, 1_000)
      expect(advanced.fileTransfer.active).toBeNull()
      expect(advanced.recentActivity.entries.at(-1)).toMatchObject({ kind: 'file_transfer', id: started.transferId })
      expect(getFilesystemFile(advanced.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
    })

    it('7. leaves every currently authored, unambiguously routed transfer unchanged', () => {
      // srv-01 (home-net, same Network as node-01): unaffected by ambiguity handling, still endpoint-only.
      const sameNetwork = startRemoteFileDownload(connectedState(), NODESCAN_PATH)
      if (sameNetwork.status !== 'started') throw new Error('expected started')
      expect(advanceFileTransfer(sameNetwork.state, 1_000).fileTransfer.active?.bytesTransferred).toBe(NODESCAN_RATE)

      // srv-02 (remote-segment-01, cross-Network from node-01/home-net): unambiguous single membership on both sides, still applies cross-Network composition.
      const crossNetwork = startRemoteFileDownload(connectedStateToSrv02(2_000_000), BIG_FILE_PATH)
      if (crossNetwork.status !== 'started') throw new Error('expected started')
      expect(advanceFileTransfer(crossNetwork.state, 1_000).fileTransfer.active?.bytesTransferred).toBe(ENDPOINT_ONLY_RATE)
    })
  })
})


describe('Market distribution Download', () => {
  const OFFER_ID = 'market-offer-nodescan-1.1-experimental'
  const MARKET_DESTINATION = '/home/user/downloads/nodescan-exp-1.1.pkg'
  // min(Market distribution upload 4 MiB/s, node-01 download 2 MiB/s), derived rather than assumed.
  const MARKET_RATE = 2_097_152
  const MARKET_BYTES = 18_400_000

  function purchased(base: GameState = createInitialGameState(), offerId: string = OFFER_ID): GameState {
    const funded = { ...base, nodeWallet: { ...base.nodeWallet, balanceNodeUnits: 5 * MARKET_V1_OFFER_PRICE_NODE_UNITS } }
    const result = purchaseMarketOffer(funded, offerId)
    if (result.status !== 'purchased') throw new Error('expected purchased')
    return result.state
  }

  it('refuses to start without a purchase entitlement, and starts once one exists', () => {
    const unpurchased = createInitialGameState()
    const refused = startMarketPackageDownload(unpurchased, OFFER_ID)
    expect(refused).toEqual({ status: 'not_purchased', state: unpurchased })
    expect(refused.state.fileTransfer.active).toBeNull()

    const result = startMarketPackageDownload(purchased(), OFFER_ID)
    expect(result.status).toBe('started')
  })

  it('rejects an unknown offering', () => {
    const state = purchased()
    expect(startMarketPackageDownload(state, 'market-offer-nonexistent').status).toBe('unknown_offer')
  })

  it('admits one canonical FileTransfer with entitlement authority and no Device route', () => {
    const state = purchased()
    const result = startMarketPackageDownload(state, OFFER_ID)
    if (result.status !== 'started') throw new Error('expected started')
    const active = result.state.fileTransfer.active!
    expect(active).toEqual({
      id: result.transferId, origin: 'market_distribution', offerId: OFFER_ID,
      destinationDeviceId: state.player.localDevice.id, destinationPath: MARKET_DESTINATION,
      bytesTotal: MARKET_BYTES, bytesTransferred: 0,
    })
    expect(active).not.toHaveProperty('accessId')
    expect(active).not.toHaveProperty('sourceDeviceId')
    expect(active).not.toHaveProperty('sessionId')
    // No DeviceAccess or RemoteSession is created or required by a legitimate Market download.
    expect(result.state.deviceAccess).toBe(state.deviceAccess)
    expect(result.state.remoteSession).toBe(state.remoteSession)
    expect(deriveFileTransferDirection(state.player.localDevice.id, active)).toBe('download')
    expect(resolveFileTransferSource(result.state, active)).toBeUndefined()
  })

  it('creates no destination artifact, no allocated file ID and no Process at admission', () => {
    const state = purchased()
    const before = state.player.localDevice.filesystem
    const result = startMarketPackageDownload(state, OFFER_ID)
    if (result.status !== 'started') throw new Error('expected started')
    expect(result.state.player.localDevice.filesystem).toBe(before)
    expect(getFilesystemFile(result.state.player.localDevice.filesystem, MARKET_DESTINATION).status).toBe('not_found')
    expect(result.state.process).toBe(state.process)
  })

  it('is real elapsed runtime at the represented distribution rate rather than an immediate copy', () => {
    const state = purchased()
    const started = startMarketPackageDownload(state, OFFER_ID)
    if (started.status !== 'started') throw new Error('expected started')
    expect(deriveEffectiveTransferRateBytesPerSecond(state.market.distributionCapacity, state.player.localDevice.network.transferCapacity)).toBe(MARKET_RATE)

    const midway = advanceGameState(started.state, 4_000)
    expect(midway.fileTransfer.active!.bytesTransferred).toBe(4 * MARKET_RATE)
    expect(getFilesystemFile(midway.player.localDevice.filesystem, MARKET_DESTINATION).status).toBe('not_found')

    const completed = advanceGameState(midway, (MARKET_BYTES / MARKET_RATE) * 1000)
    expect(completed.fileTransfer.active).toBeNull()
    const written = getFilesystemFile(completed.player.localDevice.filesystem, MARKET_DESTINATION)
    if (written.status !== 'ok' || written.file.kind !== 'software_package') throw new Error('expected a package artifact')
    const { artifact, filename, ...release } = findMarketOffer(state.market, OFFER_ID)!.distribution
    expect(written.file).toMatchObject(release)
    expect(written.file.kind).toBe(artifact)
    expect(written.file.id).toBe('file-0003')
    expect(completed.player.localDevice.filesystem.files.filter(({ path }) => path === MARKET_DESTINATION)).toHaveLength(1)
  })

  it('slows with the represented distribution capacity rather than a fixed Market rate', () => {
    const base = purchased()
    const slow: GameState = { ...base, market: { ...base.market, distributionCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 1_048_576 } } }
    const started = startMarketPackageDownload(slow, OFFER_ID)
    if (started.status !== 'started') throw new Error('expected started')
    expect(advanceGameState(started.state, 1_000).fileTransfer.active!.bytesTransferred).toBe(1_048_576)
  })

  it('creates no software installation of its own', () => {
    const state = purchased()
    const started = startMarketPackageDownload(state, OFFER_ID)
    if (started.status !== 'started') throw new Error('expected started')
    const completed = advanceGameState(started.state, 60_000)
    expect(completed.player.localDevice.installedSoftware).toEqual(state.player.localDevice.installedSoftware)
    expect(completed.process.processes).toEqual([])
  })

  it('participates in the single active FileTransfer constraint in both directions', () => {
    const connected = connectedState()
    const state = purchased(connected)
    const remote = startRemoteFileDownload(state, NODESCAN_PATH)
    if (remote.status !== 'started') throw new Error('expected started')
    expect(startMarketPackageDownload(remote.state, OFFER_ID).status).toBe('transfer_in_progress')

    const market = startMarketPackageDownload(state, OFFER_ID)
    if (market.status !== 'started') throw new Error('expected started')
    expect(startRemoteFileDownload(market.state, '/srv/readme.txt').status).toBe('transfer_in_progress')
  })

  it('cancels through the existing transfer cancellation semantics, keeping the entitlement', () => {
    const state = purchased()
    const started = startMarketPackageDownload(state, OFFER_ID)
    if (started.status !== 'started') throw new Error('expected started')
    const running = advanceGameState(started.state, 3_000)
    const cancelled = cancelFileTransfer(running, started.transferId)
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.state.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(cancelled.state.player.localDevice.filesystem, MARKET_DESTINATION).status).toBe('not_found')
    expect(cancelled.state.player.localDevice.filesystem.nextFileId).toBe(state.player.localDevice.filesystem.nextFileId)
    expect(cancelled.state.market.purchases.entitlements).toEqual(state.market.purchases.entitlements)

    // The entitlement still admits the same download again.
    expect(startMarketPackageDownload(cancelled.state, OFFER_ID).status).toBe('started')
  })

  it('interrupts safely without a partial artifact when the local Device goes offline', () => {
    const state = purchased()
    const started = startMarketPackageDownload(state, OFFER_ID)
    if (started.status !== 'started') throw new Error('expected started')
    const running = advanceGameState(started.state, 3_000)
    const offline: GameState = { ...running, player: { ...running.player, localDevice: { ...running.player.localDevice, runtime: { ...running.player.localDevice.runtime, networkStatus: 'OFFLINE' } } } }
    const advanced = advanceFileTransfer(offline, 60_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(advanced.player.localDevice.filesystem, MARKET_DESTINATION).status).toBe('not_found')
    expect(advanced.market.purchases.entitlements).toHaveLength(1)
  })

  it('appends no Network-owned evidence, because a Market distribution is not a represented Device', () => {
    const state = purchased()
    const started = startMarketPackageDownload(state, OFFER_ID)
    if (started.status !== 'started') throw new Error('expected started')
    const completed = advanceGameState(started.state, 60_000)
    expect(completed.world.network.localNetworks.map(({ activityHistory }) => activityHistory))
      .toEqual(state.world.network.localNetworks.map(({ activityHistory }) => activityHistory))
  })

  it('archives the finished transfer as the real Download it was, routed from the represented operator', () => {
    const state = purchased()
    const started = startMarketPackageDownload(state, OFFER_ID)
    if (started.status !== 'started') throw new Error('expected started')
    const completed = advanceGameState(started.state, 60_000)
    const entry = completed.recentActivity.entries.find(({ kind }) => kind === 'file_transfer')
    expect(entry).toMatchObject({ kind: 'file_transfer', id: started.transferId, route: 'Open Package Exchange → node-01' })
    if (entry?.kind !== 'file_transfer') throw new Error('expected a transfer entry')
    expect(entry.transfer.bytesTransferred).toBe(MARKET_BYTES)
    expect(entry.sourcePath).toBeUndefined()
  })

  it('never overwrites an artifact already occupying the V1 destination', () => {
    const base = createInitialGameState()
    const occupied: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: {
      nextFileId: 4,
      files: [...base.player.localDevice.filesystem.files, { kind: 'text', id: 'file-0003', path: MARKET_DESTINATION, content: 'not a package' }],
    } } } }
    const state = purchased(occupied)
    const result = startMarketPackageDownload(state, OFFER_ID)
    expect(result.status).toBe('destination_exists')
    expect(result.state.player.localDevice.filesystem.files).toHaveLength(3)
  })

  it('re-downloads after a local copy is lost, from the surviving entitlement alone', () => {
    const state = purchased(createInitialGameState(), 'market-offer-node-miner-1.0')
    // The seeded package still occupies the V1 destination.
    expect(startMarketPackageDownload(state, 'market-offer-node-miner-1.0').status).toBe('destination_exists')

    const lost: GameState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: {
      ...state.player.localDevice.filesystem,
      files: state.player.localDevice.filesystem.files.filter(({ path }) => path !== '/home/user/downloads/node-miner-1.0.pkg'),
    } } } }
    const restarted = startMarketPackageDownload(lost, 'market-offer-node-miner-1.0')
    if (restarted.status !== 'started') throw new Error('expected started')
    const completed = advanceGameState(restarted.state, 60_000)
    expect(getFilesystemFile(completed.player.localDevice.filesystem, '/home/user/downloads/node-miner-1.0.pkg').status).toBe('ok')
  })

  it('refuses to advance once the entitlement it was admitted against no longer exists', () => {
    const state = purchased()
    const started = startMarketPackageDownload(state, OFFER_ID)
    if (started.status !== 'started') throw new Error('expected started')
    const revoked: GameState = { ...started.state, market: { ...started.state.market, purchases: { ...started.state.market.purchases, entitlements: [] } } }
    const advanced = advanceFileTransfer(revoked, 60_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(advanced.player.localDevice.filesystem, MARKET_DESTINATION).status).toBe('not_found')
  })

  it('rejects admission while the local Device is offline', () => {
    const base = purchased()
    const offline: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, runtime: { ...base.player.localDevice.runtime, networkStatus: 'OFFLINE' } } } }
    expect(startMarketPackageDownload(offline, OFFER_ID).status).toBe('local_offline')
  })

  it('rejects admission when a represented capacity is unusable', () => {
    const base = purchased()
    const broken: GameState = { ...base, market: { ...base.market, distributionCapacity: { uploadBytesPerSecond: 0, downloadBytesPerSecond: 0 } } }
    expect(startMarketPackageDownload(broken, OFFER_ID).status).toBe('capacity_unavailable')
  })
})
