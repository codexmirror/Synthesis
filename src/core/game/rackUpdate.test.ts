import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { inspectKnownTarget } from './inspect'
import { rememberInspect } from './discovery'
import { scanNetworkTarget } from './scan'
import { rememberScan } from './discovery'
import { submitRackUpdatePackageFromObservation } from './rackUpdate'
import { vulnerabilitiesForService } from './serviceImplementations'

function ready() {
  let state = createInitialGameState()
  const targets = () => ({ localDevice: state.player.localDevice, network: state.world.network })
  state = { ...state, discovery: rememberScan(state.discovery, scanNetworkTarget(targets(), '203.0.113.42'), state.player.localDevice.id) }
  state = { ...state, discovery: rememberInspect(state.discovery, inspectKnownTarget(targets(), state.discovery, '203.0.113.42', 'enhanced'), state.player.localDevice.id) }
  const remotePackage = state.world.network.hosts.find(({ id }) => id === 'host-lan-001')!.filesystem!.files.find(({ id }) => id === 'file-0003')!
  state = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: [...state.player.localDevice.filesystem.files, { ...remotePackage, id: 'file-local-gatessh', path: '/home/user/downloads/gatessh-1.3.2.pkg' }] } } } }
  return state
}

describe('RackUpdate 1.0 public package submission', () => {
  it('atomically rolls the managed GateSSH release back without access, transfer, filesystem, or Discovery consequences', () => {
    const state = ready(); const before = state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    const result = submitRackUpdatePackageFromObservation(state, { targetDeviceId: before.id, serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443', localFileId: 'file-local-gatessh' })
    expect(result.status).toBe('applied')
    const after = result.state.world.network.hosts.find(({ id }) => id === before.id)!
    expect(after.services!.find(({ id }) => id === 'service-ssh-002')).toMatchObject({ id: 'service-ssh-002', port: 22, open: true, implementation: { releaseId: 'gate-ssh-1.3.2' } })
    expect(vulnerabilitiesForService(after.services!.find(({ id }) => id === 'service-ssh-002')!).map(({ id }) => id)).toEqual(['AUTH-017'])
    expect(after.filesystem).toEqual(before.filesystem); expect(result.state.fileTransfer).toEqual(state.fileTransfer)
    expect(result.state.deviceAccess).toEqual(state.deviceAccess); expect(result.state.discovery).toEqual(state.discovery)
    expect(result.state.player.localDevice.filesystem).toEqual(state.player.localDevice.filesystem)
  })

  it('requires stable observed service and file identities and rejects other packages without mutation', () => {
    const state = ready(); const base = { targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', endpoint: '203.0.113.42:8443' }
    expect(submitRackUpdatePackageFromObservation(state, { ...base, localFileId: 'missing' })).toEqual({ status: 'package_unavailable', state })
    expect(submitRackUpdatePackageFromObservation(state, { ...base, serviceId: 'wrong', localFileId: 'file-local-gatessh' })).toEqual({ status: 'observation_required', state })
    expect(submitRackUpdatePackageFromObservation(state, { ...base, localFileId: 'file-0002' })).toEqual({ status: 'package_rejected', state })
  })
})
