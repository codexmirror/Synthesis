import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { connectRemoteFromObservation } from './remoteSession'
import { deriveDownloadDestinationPath, downloadRemoteFile } from './remoteDownload'
import type { GameState } from './types'

function connectedState(): GameState {
  const base = createInitialGameState()
  const access = { id: 'access-download', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' as const }
  const authorized = { ...base, deviceAccess: { nextId: 2, established: [access] } }
  return connectRemoteFromObservation(authorized, { targetDeviceId: access.targetDeviceId, address: '198.51.100.47' }).state
}

describe('remote download', () => {
  it('shares the exact destination policy used by the canonical operation', () => {
    expect(deriveDownloadDestinationPath('/opt/packages/nodescan-exp-1.1.pkg')).toBe('/home/user/downloads/nodescan-exp-1.1.pkg')
    const result = downloadRemoteFile(connectedState(), '/opt/packages/nodescan-exp-1.1.pkg')
    expect(result.status).toBe('downloaded')
    if (result.status !== 'downloaded') throw new Error('expected download')
    expect(result.destinationPath).toBe(deriveDownloadDestinationPath(result.sourcePath))
  })

  it('requires a current resolvable Session and resolves its target by stable access identity', () => {
    const base = createInitialGameState()
    expect(downloadRemoteFile(base, '/srv/readme.txt')).toEqual({ status: 'session_unavailable', state: base })
    const connected = connectedState()
    const staleAddress = { ...connected, remoteSession: { ...connected.remoteSession, active: { ...connected.remoteSession.active!, connectedAddress: '203.0.113.250' } } }
    expect(downloadRemoteFile(staleAddress, '/srv/readme.txt').status).toBe('downloaded')
    const removedAccess = { ...connected, deviceAccess: { ...connected.deviceAccess, established: [] } }
    expect(downloadRemoteFile(removedAccess, '/srv/readme.txt')).toEqual({ status: 'session_unavailable', state: removedAccess })
  })

  it('copies the canonical NodeScan release locally without moving, installing, or creating a Process', () => {
    const state = connectedState(); const sourceFilesystem = state.world.network.hosts[0].filesystem; const installed = state.player.localDevice.installedSoftware; const process = state.process
    const result = downloadRemoteFile(state, '/opt/packages/nodescan-exp-1.1.pkg')
    expect(result.status).toBe('downloaded')
    if (result.status !== 'downloaded') throw new Error('expected download')
    expect(result.destinationPath).toBe('/home/user/downloads/nodescan-exp-1.1.pkg')
    expect(result.state.player.localDevice.filesystem.files.at(-1)).toEqual({ ...sourceFilesystem!.files[1], path: result.destinationPath })
    expect(result.state.world.network.hosts[0].filesystem).toBe(sourceFilesystem)
    expect(result.state.player.localDevice.installedSoftware).toBe(installed)
    expect(result.state.player.localDevice.installedSoftware[0]).toMatchObject({ version: '1.0', channel: 'standard' })
    expect(result.state.process).toBe(process)
  })

  it('preserves exact source failures and refuses duplicate destinations', () => {
    const state = connectedState()
    expect(downloadRemoteFile(state, 'relative').status).toBe('invalid_path')
    expect(downloadRemoteFile(state, '/missing').status).toBe('source_not_found')
    expect(downloadRemoteFile(state, '/opt').status).toBe('source_not_file')
    const first = downloadRemoteFile(state, '/srv/readme.txt')
    if (first.status !== 'downloaded') throw new Error('expected download')
    const duplicate = downloadRemoteFile(first.state, '/srv/readme.txt')
    expect(duplicate).toEqual({ status: 'destination_exists', state: first.state })
  })
})
