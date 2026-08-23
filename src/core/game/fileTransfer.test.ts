import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { connectRemoteFromObservation, disconnectRemoteSession, resolveActiveRemoteTarget } from './remoteSession'
import { advanceFileTransfer, deriveDownloadDestinationPath, startRemoteFileDownload } from './fileTransfer'
import { advanceGameState } from './gameAdvancement'
import { deriveEffectiveTransferRateBytesPerSecond } from './networkTransferCapacity'
import { getFilesystemFile } from './filesystem'
import { startProcess } from './processes'
import type { GameState } from './types'

function connectedState(): GameState {
  const base = createInitialGameState()
  const access = { id: 'access-download', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' as const }
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
      ['bytesTotal', 'bytesTransferred', 'destinationDeviceId', 'destinationPath', 'id', 'sessionId', 'sourceDeviceId', 'sourceFileId'].sort(),
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
    const duplicate = startRemoteFileDownload(completed, '/srv/readme.txt')
    expect(duplicate).toEqual({ status: 'destination_exists', state: completed })
  })

  it('preserves exact source failure semantics', () => {
    const state = connectedState()
    expect(startRemoteFileDownload(state, 'relative').status).toBe('invalid_path')
    expect(startRemoteFileDownload(state, '/missing').status).toBe('source_not_found')
    expect(startRemoteFileDownload(state, '/opt').status).toBe('source_not_file')
  })

  it('requires a current resolvable Session', () => {
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
})

describe('session continuity', () => {
  it('aborts without creating a file when the player disconnects, but preserves DeviceAccess', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const disconnected = disconnectRemoteSession(started.state).state
    const advanced = advanceFileTransfer(disconnected, 60_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(advanced.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
    expect(advanced.deviceAccess.established).toEqual(disconnected.deviceAccess.established)
    expect(advanced.deviceAccess.established).toHaveLength(1)
  })

  it('clears the bound transfer immediately as part of disconnect itself, before any advancement runs', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const result = disconnectRemoteSession(started.state)
    expect(result.status).toBe('disconnected')
    expect(result.state.remoteSession.active).toBeNull()
    expect(result.state.fileTransfer.active).toBeNull()
    expect(result.state.deviceAccess.established).toEqual(started.state.deviceAccess.established)
    expect(getFilesystemFile(result.state.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
  })

  it('does not resume the old transfer after reconnecting', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const disconnected = disconnectRemoteSession(started.state).state
    const aborted = advanceFileTransfer(disconnected, 1_000)
    expect(aborted.fileTransfer.active).toBeNull()

    const reconnected = connectRemoteFromObservation(aborted, { targetDeviceId: 'host-lan-001', address: '198.51.100.47' }).state
    expect(reconnected.fileTransfer.active).toBeNull()
    const advanced = advanceFileTransfer(reconnected, 60_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(advanced.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')

    const startedAgain = startRemoteFileDownload(reconnected, NODESCAN_PATH)
    expect(startedAgain.status).toBe('started')
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

  it('aborts safely with no destination artifact if the source can no longer be resolved before completion', () => {
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

describe('re-established RemoteSession authority (Session -> DeviceAccess -> target Device)', () => {
  it('aborts when the DeviceAccess underlying the active Session is removed', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const accessRemoved: GameState = { ...started.state, deviceAccess: { ...started.state.deviceAccess, established: [] } }
    const advanced = advanceFileTransfer(accessRemoved, 60_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(getFilesystemFile(advanced.player.localDevice.filesystem, started.destinationPath).status).toBe('not_found')
  })

  it('aborts when the current Session no longer resolves to the transfer\'s recorded source Device', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    // DeviceAccess now authorizes a different target Device while the Session's accessId is unchanged.
    const retargeted: GameState = {
      ...started.state,
      deviceAccess: {
        ...started.state.deviceAccess,
        established: started.state.deviceAccess.established.map((access) => access.id === 'access-download' ? { ...access, targetDeviceId: 'host-lan-002', viaServiceId: 'service-ssh-002' } : access),
      },
    }
    expect(resolveActiveRemoteTarget(retargeted)?.target.id).toBe('host-lan-002')
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

describe('interaction with Process runtime', () => {
  it('leaves Process CPU/RAM behavior unchanged while a FileTransfer is also active', () => {
    const state = connectedState()
    const started = startRemoteFileDownload(state, NODESCAN_PATH)
    if (started.status !== 'started') throw new Error('expected started')
    const withProcess = startProcess(started.state.process, started.state.player.localDevice.hardware, started.state.player.localDevice.runtime, { label: 'Test work', executorDeviceId: started.state.player.localDevice.id, workRequired: 10, ramRequiredMiB: 100 })
    if (withProcess.status !== 'started') throw new Error('expected process started')
    const combined: GameState = { ...started.state, process: withProcess.state }

    const advanced = advanceGameState(combined, 1_000)
    expect(advanced.process.processes[0].workCompleted).toBeGreaterThan(0)
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
