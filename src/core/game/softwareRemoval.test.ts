import { describe, expect, it } from 'vitest'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { inspectKnownTarget } from './inspect'
import { rememberInspect, rememberScan } from './discovery'
import { scanNetworkTarget } from './scan'
import { NODE_MINER_INSTALLED_EXECUTABLE_PATH, findRunningLocalNodeMiner, startNodeMiner, stopNodeMiner } from './nodeMiner'
import { deriveResourceUsage } from './processes'
import { findInstalledNodeScan, nodeScanSupportsEnhancedInspect } from './software'
import { installLocalSoftwarePackage } from './softwareInstallation'
import { removeInstalledSoftware, resolveCompletedSoftwareRemovals, SOFTWARE_REMOVAL_RAM_REQUIRED_MIB } from './softwareRemoval'
import type { GameState, SoftwareRemovalProcess } from './types'

/** Drives a started removal to completion using the canonical advancement boundary. Local Device: 100 compute, 18% baseline -> 82 available. */
function completeRemoval(state: GameState): GameState { return advanceGameState(state, 20_000) }

function removal(process: GameState['process']['processes'][number]): SoftwareRemovalProcess {
  if (process.kind !== 'software_removal') throw new Error('expected software_removal')
  return process
}

/** Installs NodeScan 1.1 Experimental as the active release, replacing the NodeScan 1.0 baseline, then clears the resulting Process history. */
function withNodeScan11(): GameState {
  const state = createInitialGameState()
  const packageFile = { kind: 'software_package' as const, id: 'file-fixture-nodescan-11', path: '/home/user/downloads/nodescan-exp-1.1.pkg', releaseId: 'nodescan-1.1-experimental', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 18_400_000 }
  const withPackage = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: [...state.player.localDevice.filesystem.files, packageFile] } } } }
  const install = installLocalSoftwarePackage(withPackage, packageFile.path)
  if (install.status !== 'started') throw new Error(install.status)
  const done = advanceGameState(install.state, 20_000)
  return { ...done, process: { nextId: 1, processes: [] } }
}

describe('removeInstalledSoftware: admission', () => {
  it('rejects removal when the product is not installed and starts no Process', () => {
    const state = createInitialGameState()
    expect(removeInstalledSoftware(state, 'node-miner')).toEqual({ status: 'not_installed', state })
    expect(state.process.processes).toEqual([])
  })

  it('rejects removal of the protected NodeScan 1.0 Standard baseline and starts no Process', () => {
    const state = createInitialGameState()
    expect(findInstalledNodeScan(state.player.localDevice)?.releaseId).toBe('nodescan-1.0-standard')
    expect(removeInstalledSoftware(state, 'nodescan')).toEqual({ status: 'protected_baseline', state })
    expect(state.process.processes).toEqual([])
  })

  it('rejects Basic Credential Toolkit removal as unsupported in V1 without treating it as a protected baseline', () => {
    const state = createInitialGameState()
    const result = removeInstalledSoftware(state, 'basic-credential-toolkit')
    expect(result).toEqual({ status: 'unsupported_in_v1', state })
    expect(result.status).not.toBe('protected_baseline')
  })

  it('starts one running software-removal Process for NodeScan 1.1 Experimental, reserving RAM and requiring shared Device CPU, without touching InstalledSoftware', () => {
    const state = withNodeScan11()
    const result = removeInstalledSoftware(state, 'nodescan')
    expect(result).toMatchObject({ status: 'started', processId: 'process-0001', productId: 'nodescan', releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental' })
    if (result.status !== 'started') throw new Error(result.status)
    expect(result.state).not.toBe(state)
    expect(result.state.player.localDevice.installedSoftware).toEqual(state.player.localDevice.installedSoftware)

    const process = removal(result.state.process.processes[0])
    expect(process).toMatchObject({ kind: 'software_removal', label: 'SOFTWARE REMOVAL', status: 'running', productId: 'nodescan', releaseId: 'nodescan-1.1-experimental', executorDeviceId: state.player.localDevice.id, ramRequiredMiB: SOFTWARE_REMOVAL_RAM_REQUIRED_MIB })
    expect(process.result).toBeUndefined()
    expect(deriveResourceUsage(result.state.player.localDevice, result.state.process).processRamMiB).toBe(SOFTWARE_REMOVAL_RAM_REQUIRED_MIB)
  })

  it('starts one running software-removal Process for NODE Miner', () => {
    const state = createInitialGameState()
    const started = installLocalSoftwarePackage(state, '/home/user/downloads/node-miner-1.0.pkg')
    if (started.status !== 'started') throw new Error(started.status)
    const done = advanceGameState(started.state, 20_000)
    const result = removeInstalledSoftware(done, 'node-miner')
    expect(result).toMatchObject({ status: 'started', productId: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', channel: 'unofficial' })
  })

  it('rejects a second concurrent removal of the same product while the first is still running', () => {
    const state = withNodeScan11()
    const first = removeInstalledSoftware(state, 'nodescan')
    if (first.status !== 'started') throw new Error(first.status)
    expect(removeInstalledSoftware(first.state, 'nodescan')).toEqual({ status: 'already_removing', state: first.state })
  })

  it('rejects removal admission when insufficient RAM is available', () => {
    const state = withNodeScan11()
    const saturated: GameState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, runtime: { ...state.player.localDevice.runtime, baselineRamUsage: 100 } } } }
    const result = removeInstalledSoftware(saturated, 'nodescan')
    expect(result).toMatchObject({ status: 'insufficient_memory', requiredMiB: SOFTWARE_REMOVAL_RAM_REQUIRED_MIB })
    expect(saturated.process.processes).toEqual([])
  })

  it('shares real CPU with another running local Process', () => {
    const state = withNodeScan11()
    const removalResult = removeInstalledSoftware(state, 'nodescan')
    if (removalResult.status !== 'started') throw new Error(removalResult.status)
    const installResult = installLocalSoftwarePackage(removalResult.state, '/home/user/downloads/node-miner-1.0.pkg')
    if (installResult.status !== 'started') throw new Error(installResult.status)

    const usage = deriveResourceUsage(installResult.state.player.localDevice, installResult.state.process)
    expect(usage.cpuAllocationByProcess['process-0001']).toBeCloseTo(41)
    expect(usage.cpuAllocationByProcess['process-0002']).toBeCloseTo(41)
  })
})

describe('software removal: NodeScan stays active while running', () => {
  it('keeps the installed release and its Enhanced Inspect capability active while removal is running', () => {
    const state = withNodeScan11()
    const started = removeInstalledSoftware(state, 'nodescan')
    if (started.status !== 'started') throw new Error(started.status)
    const stillRunning = advanceGameState(started.state, 3000)

    const nodeScan = findInstalledNodeScan(stillRunning.player.localDevice)!
    expect(nodeScan.releaseId).toBe('nodescan-1.1-experimental')
    expect(nodeScanSupportsEnhancedInspect(nodeScan)).toBe(true)
    expect(removal(stillRunning.process.processes[0]).status).toBe('running')
  })
})

describe('software removal completion: NodeScan', () => {
  it('restores the concrete protected NodeScan 1.0 Standard baseline exactly once', () => {
    const state = withNodeScan11()
    const started = removeInstalledSoftware(state, 'nodescan')
    if (started.status !== 'started') throw new Error(started.status)
    const done = completeRemoval(started.state)

    const process = removal(done.process.processes.find(({ id }) => id === started.processId)!)
    expect(process).toMatchObject({ status: 'completed', result: { status: 'baseline_restored' } })
    expect(findInstalledNodeScan(done.player.localDevice)).toEqual({ id: 'nodescan', releaseId: 'nodescan-1.0-standard', name: 'NodeScan', version: '1.0', channel: 'standard' })

    // Idempotent: repeated resolution/advancement never restores twice or mutates further.
    const twice = resolveCompletedSoftwareRemovals(done)
    expect(twice).toBe(done)
    expect(advanceGameState(done, 20_000)).toBe(done)
  })

  it('leaves NEW Inspect shallow after restoration while a previously stored Enhanced Inspect Discovery snapshot remains untouched', () => {
    const state = withNodeScan11()
    // Populate Discovery with a positive scan + Enhanced Inspect observation of host-lan-001 while NodeScan 1.1 is active.
    const scanResult = scanNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, '198.51.100.47')
    const afterScan = { ...state, discovery: rememberScan(state.discovery, scanResult, state.player.localDevice.id) }
    const enhancedInspect = inspectKnownTarget({ localDevice: afterScan.player.localDevice, network: afterScan.world.network }, afterScan.discovery, '198.51.100.47', 'enhanced')
    expect(enhancedInspect.status).toBe('device')
    const withDiscovery = { ...afterScan, discovery: rememberInspect(afterScan.discovery, enhancedInspect, afterScan.player.localDevice.id) }
    const storedSnapshot = withDiscovery.discovery.devices.find((device) => device.address === '198.51.100.47')
    expect(storedSnapshot?.inspect?.enhanced).toBeDefined()

    const started = removeInstalledSoftware(withDiscovery, 'nodescan')
    if (started.status !== 'started') throw new Error(started.status)
    const done = completeRemoval(started.state)
    expect(findInstalledNodeScan(done.player.localDevice)?.releaseId).toBe('nodescan-1.0-standard')

    // Removal never touches Discovery/Knowledge: the previously stored Enhanced Inspect snapshot survives byte-for-byte.
    expect(done.discovery).toBe(started.state.discovery)
    expect(done.discovery.devices.find((device) => device.address === '198.51.100.47')?.inspect?.enhanced).toEqual(storedSnapshot?.inspect?.enhanced)

    // A NEW Inspect performed after restoration is shallow again: NodeScan 1.0 grants no Enhanced Inspect depth.
    const nodeScanAfter = findInstalledNodeScan(done.player.localDevice)!
    const depth = nodeScanSupportsEnhancedInspect(nodeScanAfter) ? 'enhanced' : 'shallow'
    expect(depth).toBe('shallow')
    const newInspect = inspectKnownTarget({ localDevice: done.player.localDevice, network: done.world.network }, done.discovery, '198.51.100.47', depth)
    expect(newInspect.status).toBe('device')
    expect(newInspect).not.toHaveProperty('enhanced')
  })

  it('resolves as a truthful not_installed failure, rather than reverting a newer release, when the installed release changed before completion', () => {
    const state = withNodeScan11()
    const started = removeInstalledSoftware(state, 'nodescan')
    if (started.status !== 'started') throw new Error(started.status)
    const racedRelease = { id: 'nodescan' as const, releaseId: 'nodescan-2.0-future', name: 'NodeScan', version: '2.0', channel: 'standard' }
    const racedState: GameState = {
      ...started.state,
      player: { ...started.state.player, localDevice: { ...started.state.player.localDevice, installedSoftware: started.state.player.localDevice.installedSoftware.map((software) => software.id === 'nodescan' ? racedRelease : software) } },
    }
    const done = completeRemoval(racedState)
    const process = removal(done.process.processes.find(({ id }) => id === started.processId)!)
    expect(process.result).toEqual({ status: 'not_installed' })
    expect(findInstalledNodeScan(done.player.localDevice)).toEqual(racedRelease)
  })
})

describe('software removal completion: NODE Miner', () => {
  const packagePath = '/home/user/downloads/node-miner-1.0.pkg'

  function withInstalledMiner(): GameState {
    const state = createInitialGameState()
    const started = installLocalSoftwarePackage(state, packagePath)
    if (started.status !== 'started') throw new Error(started.status)
    return advanceGameState(started.state, 20_000)
  }

  it('remains installed with its executable present while removal is running', () => {
    const state = withInstalledMiner()
    const started = removeInstalledSoftware(state, 'node-miner')
    if (started.status !== 'started') throw new Error(started.status)
    const stillRunning = advanceGameState(started.state, 3000)

    expect(stillRunning.player.localDevice.installedSoftware).toContainEqual(expect.objectContaining({ id: 'node-miner' }))
    expect(stillRunning.player.localDevice.filesystem.files.some((file) => file.path === NODE_MINER_INSTALLED_EXECUTABLE_PATH)).toBe(true)
    expect(removal(stillRunning.process.processes.find(({ id }) => id === started.processId)!).status).toBe('running')
  })

  it('removes InstalledSoftware and the matching executable at completion, while the downloaded package remains', () => {
    const state = withInstalledMiner()
    const started = removeInstalledSoftware(state, 'node-miner')
    if (started.status !== 'started') throw new Error(started.status)
    const done = completeRemoval(started.state)

    const process = removal(done.process.processes.find(({ id }) => id === started.processId)!)
    expect(process).toMatchObject({ status: 'completed', result: { status: 'removed' } })
    expect(done.player.localDevice.installedSoftware.find(({ id }) => id === 'node-miner')).toBeUndefined()
    expect(done.player.localDevice.filesystem.files.some((file) => file.path === NODE_MINER_INSTALLED_EXECUTABLE_PATH)).toBe(false)
    expect(done.player.localDevice.filesystem.files.some((file) => file.path === packagePath)).toBe(true)
  })

  it('never deletes an unrelated or replaced artifact occupying the canonical installed path', () => {
    const state = withInstalledMiner()
    const started = removeInstalledSoftware(state, 'node-miner')
    if (started.status !== 'started') throw new Error(started.status)
    const replaced: GameState = {
      ...started.state,
      player: {
        ...started.state.player,
        localDevice: {
          ...started.state.player.localDevice,
          filesystem: {
            ...started.state.player.localDevice.filesystem,
            files: started.state.player.localDevice.filesystem.files.map((file) => file.path === NODE_MINER_INSTALLED_EXECUTABLE_PATH
              ? { kind: 'text' as const, id: file.id, path: NODE_MINER_INSTALLED_EXECUTABLE_PATH, content: 'unrelated replacement artifact' }
              : file),
          },
        },
      },
    }
    const done = completeRemoval(replaced)
    const process = removal(done.process.processes.find(({ id }) => id === started.processId)!)
    expect(process.result).toEqual({ status: 'removed' })
    expect(done.player.localDevice.installedSoftware.find(({ id }) => id === 'node-miner')).toBeUndefined()
    expect(done.player.localDevice.filesystem.files.find(({ path }) => path === NODE_MINER_INSTALLED_EXECUTABLE_PATH)).toMatchObject({ kind: 'text', content: 'unrelated replacement artifact' })
  })

  it('lets an already-running NodeMinerProcess survive removal completion and keep functioning, until STOP ends it', () => {
    const state = withInstalledMiner()
    const run = startNodeMiner(state, NODE_MINER_INSTALLED_EXECUTABLE_PATH, state.nodeWallet.address)
    if (run.status !== 'started') throw new Error(run.status)

    const started = removeInstalledSoftware(run.state, 'node-miner')
    if (started.status !== 'started') throw new Error(started.status)
    const done = completeRemoval(started.state)

    // InstalledSoftware and the executable are gone, but the already-running Miner Process is untouched and keeps producing.
    expect(done.player.localDevice.installedSoftware.find(({ id }) => id === 'node-miner')).toBeUndefined()
    const runningMiner = findRunningLocalNodeMiner(done)
    expect(runningMiner).toBeDefined()
    expect(runningMiner!.id).toBe(run.processId)
    expect(runningMiner!.producedNodeUnits).toBeGreaterThan(0)

    const furtherAdvanced = advanceGameState(done, 5000)
    const stillRunningMiner = findRunningLocalNodeMiner(furtherAdvanced)
    expect(stillRunningMiner!.producedNodeUnits).toBeGreaterThan(runningMiner!.producedNodeUnits)

    const stopped = stopNodeMiner(furtherAdvanced, run.processId)
    expect(stopped.status).toBe('stopped')
    expect(findRunningLocalNodeMiner(stopped.state)).toBeUndefined()
  })
})

describe('software removal completion idempotency', () => {
  it('resolves exactly once: repeated advancement never duplicates filesystem IDs or removal results', () => {
    const state = createInitialGameState()
    const started = installLocalSoftwarePackage(state, '/home/user/downloads/node-miner-1.0.pkg')
    if (started.status !== 'started') throw new Error(started.status)
    const installed = advanceGameState(started.state, 20_000)
    const removalStarted = removeInstalledSoftware(installed, 'node-miner')
    if (removalStarted.status !== 'started') throw new Error(removalStarted.status)
    const once = completeRemoval(removalStarted.state)
    const twice = resolveCompletedSoftwareRemovals(once)
    expect(twice).toBe(once)
    expect(advanceGameState(once, 20_000)).toBe(once)
    expect(once.player.localDevice.filesystem.files.filter((file) => file.kind === 'executable')).toHaveLength(0)
  })
})
