import { describe, expect, it } from 'vitest'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { NODE_MINER_INSTALLED_EXECUTABLE_PATH } from './nodeMiner'
import { deriveResourceUsage, startProcess } from './processes'
import { installLocalSoftwarePackage, SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB } from './softwareInstallation'
import type { GameState, SoftwarePackageFile } from './types'
import { deriveActivityMonitor } from '../../apps/processes/activityMonitor'

const nodeScanPath = '/home/user/downloads/nodescan.pkg'
const nodeScanPackage: SoftwarePackageFile = { kind: 'software_package', id: 'file-package', path: nodeScanPath, releaseId: 'build-a91f7', productId: 'nodescan', name: 'Canonical Scanner', version: '1.1', channel: 'experimental', sizeBytes: 1_000 }

function withNodeScan(): GameState {
  const state = createInitialGameState()
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: [...state.player.localDevice.filesystem.files, nodeScanPackage] } } } }
}

function admit(state: GameState, path: string) {
  const result = installLocalSoftwarePackage(state, path)
  if (result.status !== 'started') throw new Error(result.status)
  return result
}

describe('finite software installation', () => {
  it('validates local package artifacts and rejects unsupported packages', () => {
    const state = createInitialGameState()
    expect(installLocalSoftwarePackage(state, 'relative.pkg').status).toBe('invalid_path')
    expect(installLocalSoftwarePackage(state, '/missing.pkg').status).toBe('package_not_found')
    const unsupported = { ...nodeScanPackage, productId: 'other' }
    const fixture = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 50, files: [unsupported] } } } }
    expect(installLocalSoftwarePackage(fixture, nodeScanPath).status).toBe('unsupported_package')
  })

  it('starts normal shared work from a package snapshot without installing early and rejects a concurrent product install', () => {
    const state = withNodeScan()
    const result = admit(state, nodeScanPath)
    expect(result).toMatchObject({ processId: 'process-0001', productId: 'nodescan' })
    expect(result.state.player.localDevice.installedSoftware[0]).toBe(state.player.localDevice.installedSoftware[0])
    expect(result.state.process.processes[0]).toMatchObject({ kind: 'software_installation', status: 'running', sourceFileId: nodeScanPackage.id, sourcePath: nodeScanPath, name: 'Canonical Scanner', releaseId: 'build-a91f7', ramRequiredMiB: SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB })
    expect(installLocalSoftwarePackage(result.state, nodeScanPath)).toEqual({ status: 'already_installing', state: result.state })
  })

  it('uses real CPU/RAM allocation and contends with other running Process work', () => {
    const state = withNodeScan()
    const generic = startProcess(state.process, state.player.localDevice, { label: 'OTHER', workRequired: 10_000, ramRequiredMiB: 256 })
    if (generic.status !== 'started') throw new Error(generic.status)
    const admitted = admit({ ...state, process: generic.state }, nodeScanPath)
    const usage = deriveResourceUsage(state.player.localDevice, admitted.state.process)
    expect(usage.cpuAllocationByProcess[generic.processId]).toBe(41)
    expect(usage.cpuAllocationByProcess[admitted.processId]).toBe(41)
    expect(usage.processRamMiB).toBe(768)
    const advanced = advanceGameState(admitted.state, 1_000)
    expect(advanced.process.processes.map((process) => process.kind === 'node_miner' ? 0 : process.workCompleted)).toEqual([41, 41])
  })

  it('installs NodeScan only at completion and archives the resolved Process', () => {
    const admitted = admit(withNodeScan(), nodeScanPath)
    expect(deriveActivityMonitor(admitted.state).activities[0]).toMatchObject({ kindLabel: 'SOFTWARE INSTALLATION', title: 'Canonical Scanner 1.1', status: 'running' })
    const completed = advanceGameState(admitted.state, 10_000)
    expect(completed.player.localDevice.installedSoftware[0]).toEqual({ id: 'nodescan', releaseId: 'build-a91f7', name: 'Canonical Scanner', version: '1.1', channel: 'experimental' })
    expect(completed.process.processes[0]).toMatchObject({ status: 'completed', result: { status: 'installed' } })
    expect(completed.recentActivity.entries[0]).toMatchObject({ kind: 'process', id: admitted.processId })
    expect(deriveActivityMonitor(completed).activities[0]).toMatchObject({ kindLabel: 'SOFTWARE INSTALLATION', title: 'Canonical Scanner 1.1', status: 'recent', outcome: { headline: 'INSTALLED' } })
  })

  it('creates NODE Miner installed software and executable exactly once after completion', () => {
    const state = createInitialGameState()
    const admitted = admit(state, '/home/user/downloads/node-miner-1.0.pkg')
    expect(admitted.state.player.localDevice.installedSoftware.some(({ id }) => id === 'node-miner')).toBe(false)
    expect(admitted.state.player.localDevice.filesystem.files.some(({ path }) => path === NODE_MINER_INSTALLED_EXECUTABLE_PATH)).toBe(false)
    const completed = advanceGameState(admitted.state, 10_000)
    expect(completed.player.localDevice.installedSoftware.filter(({ id }) => id === 'node-miner')).toHaveLength(1)
    expect(completed.player.localDevice.filesystem.files.filter(({ path }) => path === NODE_MINER_INSTALLED_EXECUTABLE_PATH)).toHaveLength(1)
    const repeated = advanceGameState(completed, 10_000)
    expect(repeated.player.localDevice.installedSoftware.filter(({ id }) => id === 'node-miner')).toHaveLength(1)
    expect(repeated.player.localDevice.filesystem.files.filter(({ path }) => path === NODE_MINER_INSTALLED_EXECUTABLE_PATH)).toHaveLength(1)
  })

  it('fails safely if the NODE Miner destination becomes occupied during work', () => {
    const admitted = admit(createInitialGameState(), '/home/user/downloads/node-miner-1.0.pkg')
    const occupied = { ...admitted.state, player: { ...admitted.state.player, localDevice: { ...admitted.state.player.localDevice, filesystem: { ...admitted.state.player.localDevice.filesystem, files: [...admitted.state.player.localDevice.filesystem.files, { kind: 'text' as const, id: 'occupant', path: NODE_MINER_INSTALLED_EXECUTABLE_PATH, content: 'truth' }] } } } }
    const completed = advanceGameState(occupied, 10_000)
    expect(completed.process.processes[0]).toMatchObject({ result: { status: 'install_path_occupied' } })
    expect(completed.player.localDevice.installedSoftware.some(({ id }) => id === 'node-miner')).toBe(false)
    expect(completed.player.localDevice.filesystem.files.find(({ id }) => id === 'occupant')).toMatchObject({ content: 'truth' })
  })
})
