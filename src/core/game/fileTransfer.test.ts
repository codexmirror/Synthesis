import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { connectRemoteFromObservation, disconnectRemoteSession } from './remoteSession'
import { advanceFileTransfer, cancelFileTransfer, deriveDownloadDestinationPath, resolveFileTransferSource, startRemoteFileDownload } from './fileTransfer'
import { advanceGameState } from './gameAdvancement'
import { deriveEffectiveTransferRateBytesPerSecond } from './networkTransferCapacity'
import { getFilesystemFile } from './filesystem'
import { startProcess } from './processes'
import type { GameState } from './types'

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
      ['accessId', 'bytesTotal', 'bytesTransferred', 'destinationDeviceId', 'destinationPath', 'id', 'sourceDeviceId', 'sourceFileId'].sort(),
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
    expect(completed.recentActivity.entries.at(-1)).toMatchObject({ kind: 'file_transfer', id: first.transferId, transfer: { bytesTransferred: first.state.fileTransfer.active!.bytesTotal }, sourcePath: '/srv/readme.txt', route: 'srv-01 → node-01' })
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
    const reconnectedElsewhere = connectRemoteFromObservation(withOtherAccess, { targetDeviceId: 'host-lan-002', address: '198.51.100.53' }).state
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

describe('deriveDownloadDestinationPath', () => {
  it('shares the exact destination policy used by the canonical operation', () => {
    expect(deriveDownloadDestinationPath('/opt/packages/nodescan-exp-1.1.pkg')).toBe('/home/user/downloads/nodescan-exp-1.1.pkg')
  })
})
