import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { createRattlerPayload, RATTLER_BUILD_ID, RATTLER_INSTALLED_EXECUTABLE_PATH, RATTLER_RELEASE_ID } from './rattler'
import { installLocalSoftwarePackage } from './softwareInstallation'
import { advanceGameState } from './gameAdvancement'
import type { GameState, SoftwarePackageFile } from './types'

const packageFile: SoftwarePackageFile = { kind: 'software_package', id: 'rattler-package', path: '/home/user/downloads/rattler-1.0.pkg', productId: 'rattler', releaseId: RATTLER_RELEASE_ID, buildId: RATTLER_BUILD_ID, name: 'RATTLER', version: '1.0', channel: 'unofficial', publisher: 'NULL//WORKS', sizeBytes: 5_200_000 }

function installed(): GameState {
  const base = createInitialGameState()
  const prepared = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, packageFile] } } } }
  const started = installLocalSoftwarePackage(prepared, packageFile.path)
  if (started.status !== 'started') throw new Error(started.status)
  return advanceGameState(started.state, 20_000)
}

describe('RATTLER 1.0', () => {
  it('installs atomically with its one managed executable', () => {
    const state = installed()
    expect(state.player.localDevice.installedSoftware).toContainEqual(expect.objectContaining({ id: 'rattler', releaseId: RATTLER_RELEASE_ID, buildId: RATTLER_BUILD_ID, publisher: 'NULL//WORKS' }))
    expect(state.player.localDevice.filesystem.files.filter((file) => file.kind === 'executable' && file.path === RATTLER_INSTALLED_EXECUTABLE_PATH)).toHaveLength(1)
  })

  it('resolves only remembered Discovery and binds the artifact to stable Device identity', () => {
    const state = installed()
    const hiddenAddress = state.world.network.hosts[0].ip
    expect(createRattlerPayload(state, hiddenAddress)).toEqual({ status: 'unknown_target', state })
    const known = { ...state, discovery: { ...state.discovery, devices: [{ id: 'host-lan-001', address: hiddenAddress, scope: 'lan' as const, servicesObserved: false, services: [] }] } }
    const result = createRattlerPayload(known, hiddenAddress)
    expect(result.status).toBe('created')
    if (result.status !== 'created') throw new Error(result.status)
    expect(result.file).toMatchObject({ kind: 'rattler_payload', path: '/opt/rattler/payload-host-lan-001.rpl', targetDeviceId: 'host-lan-001', targetAddressSnapshot: hiddenAddress, releaseId: RATTLER_RELEASE_ID, buildId: RATTLER_BUILD_ID })
    expect(createRattlerPayload(result.state, hiddenAddress)).toEqual({ status: 'destination_exists', state: result.state })
  })
})
