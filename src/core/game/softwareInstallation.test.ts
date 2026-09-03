import { describe, expect, it } from 'vitest'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { NODE_MINER_INSTALLED_EXECUTABLE_PATH, RACK_OS_NODE_MINER_INSTALLED_EXECUTABLE_PATH, startNodeMiner } from './nodeMiner'
import { cancelLocalProcess, deriveResourceUsage } from './processes'
import { installLocalSoftwarePackage, installRemoteSoftwarePackage, isRecognizedSoftwarePackagePath, resolveCompletedSoftwareInstallations, SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB } from './softwareInstallation'
import { advanceFileTransfer, startRemoteFileDownload } from './fileTransfer'
import { connectRemoteFromObservation, disconnectRemoteSession } from './remoteSession'
import { clearRecentActivity } from './recentActivity'
import { FLIPPER_1_0, NODESCAN_1_0_STANDARD, NODESCAN_1_2_STANDARD, NODE_MINER_1_0 } from './softwareReleaseContent'
import { findInstalledNodeScan, nodeScanSupportsInspect, nodeScanSupportsIntegratedIntelligence, nodeScanSupportsLiveTopology } from './software'
import type { ExecutableFile, GameState, NetworkHost, SoftwareInstallationProcess, SoftwarePackageFile } from './types'

const path = '/home/user/downloads/nodescan-build.pkg'
const packageFile: SoftwarePackageFile = { kind: 'software_package', id: 'file-package', path, releaseId: 'build-a91f7', buildId: 'build-fixture-v0', productId: 'nodescan', name: 'Canonical Scanner', version: '1.1', channel: 'experimental', sizeBytes: 1_000 }

function withFiles(files: GameState['player']['localDevice']['filesystem']['files']): GameState {
  const state = createInitialGameState()
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 50, files } } } }
}

/** Drives a started installation to completion using the canonical advancement boundary. Local Device: 100 compute, 18% baseline -> 82 available. */
function completeInstallation(state: GameState): GameState { return advanceGameState(state, 20_000) }

function installation(process: GameState['process']['processes'][number]): SoftwareInstallationProcess {
  if (process.kind !== 'software_installation') throw new Error('expected software_installation')
  return process
}

describe('installLocalSoftwarePackage', () => {
  it('cancels partial installation without mutating software, files, package, or filesystem identity', () => {
    const initial = withFiles([packageFile])
    const started = installLocalSoftwarePackage(initial, path)
    if (started.status !== 'started') throw new Error(started.status)
    const partial = advanceGameState(started.state, 3000)
    const result = cancelLocalProcess(partial, started.processId)
    expect(result.status).toBe('cancelled')
    const muchLater = advanceGameState(result.state, 60_000)
    expect(muchLater.player.localDevice.installedSoftware).toEqual(initial.player.localDevice.installedSoftware)
    expect(muchLater.player.localDevice.filesystem).toEqual(initial.player.localDevice.filesystem)
    expect(muchLater.player.localDevice.filesystem.nextFileId).toBe(50)
    expect(muchLater.player.localDevice.filesystem.files).toContainEqual(packageFile)
    expect(muchLater.recentActivity.entries[0]).toMatchObject({ termination: 'cancelled', process: { kind: 'software_installation' } })
  })
  it.each([
    ['relative.pkg', 'invalid_path'],
    ['/missing.pkg', 'package_not_found'],
    ['/home', 'package_not_file'],
  ] as const)('returns %s without mutation', (requestedPath, status) => {
    const state = withFiles([{ kind: 'text', id: 'file-fixture-text', path: '/home/user/readme.txt', content: '' }])
    expect(installLocalSoftwarePackage(state, requestedPath)).toEqual({ status, state })
  })

  it('validates canonical file kind while admitting an ordinary package from its artifact identity', () => {
    const text = withFiles([{ kind: 'text', id: 'file-fixture-text', path: '/home/user/nodescan.pkg', content: '' }])
    expect(installLocalSoftwarePackage(text, '/home/user/nodescan.pkg')).toEqual({ status: 'not_software_package', state: text })
    const ordinary = withFiles([{ ...packageFile, productId: 'packet-viewer', releaseId: 'packet-viewer-1.0', buildId: 'build-fixture-v0', name: 'Packet Viewer' }])
    expect(installLocalSoftwarePackage(ordinary, path)).toMatchObject({ status: 'started', productId: 'packet-viewer' })
  })

  it('starts one running software-installation Process, reserving RAM and requiring shared Device CPU, without touching InstalledSoftware or the package', () => {
    const state = withFiles([packageFile])
    const result = installLocalSoftwarePackage(state, path)
    expect(result).toMatchObject({ status: 'started', processId: 'process-0001', productId: 'nodescan', name: 'Canonical Scanner', version: '1.1', channel: 'experimental' })
    if (result.status !== 'started') throw new Error(result.status)
    expect(result.state).not.toBe(state)

    // Admission starts work, not installation truth: nothing about InstalledSoftware or the package changes yet.
    expect(result.state.player.localDevice.installedSoftware).toEqual(state.player.localDevice.installedSoftware)
    expect(result.state.player.localDevice.filesystem).toBe(state.player.localDevice.filesystem)
    expect(result.state.world).toBe(state.world)

    const process = installation(result.state.process.processes[0])
    expect(process).toMatchObject({ kind: 'software_installation', status: 'running', productId: 'nodescan', releaseId: 'build-a91f7', buildId: 'build-fixture-v0', name: 'Canonical Scanner', version: '1.1', channel: 'experimental', executorDeviceId: state.player.localDevice.id, ramRequiredMiB: SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB })
    expect(process.result).toBeUndefined()
    expect(deriveResourceUsage(result.state.player.localDevice, result.state.process).processRamMiB).toBe(SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB)
  })

  it('shares real CPU with another running local Process', () => {
    const state = withFiles([packageFile, { ...packageFile, id: 'file-package-2', path: '/home/user/downloads/node-miner-second.pkg', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', productId: 'node-miner', name: 'NODE Miner', version: '1.0', channel: 'unofficial' }])
    const first = installLocalSoftwarePackage(state, path)
    if (first.status !== 'started') throw new Error(first.status)
    const second = installLocalSoftwarePackage(first.state, '/home/user/downloads/node-miner-second.pkg')
    if (second.status !== 'started') throw new Error(second.status)

    const usage = deriveResourceUsage(second.state.player.localDevice, second.state.process)
    expect(usage.cpuAllocationByProcess['process-0001']).toBeCloseTo(41)
    expect(usage.cpuAllocationByProcess['process-0002']).toBeCloseTo(41)
    expect(usage.processRamMiB).toBe(SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB * 2)

    const advanced = advanceGameState(second.state, 1000)
    expect(installation(advanced.process.processes[0]).workCompleted).toBeGreaterThan(0)
    expect(installation(advanced.process.processes[1]).workCompleted).toBeGreaterThan(0)
  })

  it('rejects a second concurrent installation of the same product while the first is still running', () => {
    const state = withFiles([packageFile])
    const first = installLocalSoftwarePackage(state, path)
    if (first.status !== 'started') throw new Error(first.status)
    expect(installLocalSoftwarePackage(first.state, path)).toEqual({ status: 'already_installing', state: first.state })
  })

  it('uses concrete build identity for sameness and replaces another build without version ordering', () => {
    const same = withFiles([{ ...packageFile, releaseId: 'nodescan-1.0-standard', buildId: NODESCAN_1_0_STANDARD.buildId, name: 'Malformed Metadata', version: '99' }])
    expect(installLocalSoftwarePackage(same, path)).toEqual({ status: 'already_installed', state: same })
    const lowerLooking = withFiles([{ ...packageFile, releaseId: 'nodescan-1.0-standard', buildId: 'build-nodescan-synthetic-alternate', version: '0.1', channel: 'modified' }])
    const started = installLocalSoftwarePackage(lowerLooking, path)
    if (started.status !== 'started') throw new Error(started.status)
    expect(installation(started.state.process.processes[0])).toMatchObject({ releaseId: 'nodescan-1.0-standard', buildId: 'build-nodescan-synthetic-alternate', version: '0.1', channel: 'modified' })
    const completed = completeInstallation(started.state)
    expect(completed.player.localDevice.installedSoftware.filter(({ id }) => id === 'nodescan')).toEqual([
      expect.objectContaining({ releaseId: 'nodescan-1.0-standard', buildId: 'build-nodescan-synthetic-alternate' }),
    ])
  })

  it('cannot install a package that exists only on a remote filesystem', () => {
    const state = createInitialGameState()
    const remotePath = '/opt/packages/nodescan-exp-1.1.pkg'
    expect(state.world.network.hosts[0].filesystem?.files.some(({ path }) => path === remotePath)).toBe(true)
    expect(installLocalSoftwarePackage(state, remotePath)).toEqual({ status: 'package_not_found', state })
  })
})

describe('software installation completion: ordinary products', () => {
  const ordinaryPath = '/home/user/downloads/packet-viewer.pkg'
  const ordinaryPackage: SoftwarePackageFile = {
    kind: 'software_package', id: 'file-packet-viewer-1', path: ordinaryPath,
    productId: 'packet-viewer', releaseId: 'packet-viewer-1.0', buildId: 'build-fixture-v0', name: 'Packet Viewer',
    version: '1.0', channel: 'standard', publisher: 'test-publisher', sizeBytes: 2_048,
  }

  it('preserves arbitrary package identity through Process admission and completion without creating an executable', () => {
    const initial = withFiles([ordinaryPackage])
    const initialSoftware = initial.player.localDevice.installedSoftware
    const started = installLocalSoftwarePackage(initial, ordinaryPath)
    expect(started).toMatchObject({ status: 'started', productId: 'packet-viewer' })
    if (started.status !== 'started') throw new Error(started.status)
    expect(installation(started.state.process.processes[0])).toMatchObject({
      productId: 'packet-viewer', releaseId: 'packet-viewer-1.0', buildId: 'build-fixture-v0', name: 'Packet Viewer',
      version: '1.0', channel: 'standard', publisher: 'test-publisher', status: 'running',
    })
    expect(started.state.player.localDevice.installedSoftware).toEqual(initialSoftware)
    expect(started.state.player.localDevice.filesystem.files).toContainEqual(ordinaryPackage)

    const completed = completeInstallation(started.state)
    expect(completed.player.localDevice.installedSoftware).toEqual([
      ...initialSoftware,
      { id: 'packet-viewer', releaseId: 'packet-viewer-1.0', buildId: 'build-fixture-v0', name: 'Packet Viewer', version: '1.0', channel: 'standard', publisher: 'test-publisher' },
    ])
    expect(completed.player.localDevice.filesystem.files).toContainEqual(ordinaryPackage)
    expect(completed.player.localDevice.filesystem.files.some((file) => file.kind === 'executable' && file.programId === 'packet-viewer')).toBe(false)
  })

  it('replaces only the matching ordinary product when another release completes', () => {
    const first = installLocalSoftwarePackage(withFiles([ordinaryPackage]), ordinaryPath)
    if (first.status !== 'started') throw new Error(first.status)
    const installed = completeInstallation(first.state)
    const nextPackage: SoftwarePackageFile = { ...ordinaryPackage, id: 'file-packet-viewer-2', path: '/home/user/downloads/packet-viewer-1.1.pkg', releaseId: 'packet-viewer-1.1', buildId: 'build-packet-viewer-1.1', version: '1.1', channel: 'experimental', publisher: 'next-publisher' }
    const withNextPackage: GameState = {
      ...installed,
      player: { ...installed.player, localDevice: { ...installed.player.localDevice, filesystem: { ...installed.player.localDevice.filesystem, files: [...installed.player.localDevice.filesystem.files, nextPackage] } } },
    }
    const second = installLocalSoftwarePackage(withNextPackage, nextPackage.path)
    if (second.status !== 'started') throw new Error(second.status)
    const updated = completeInstallation(second.state)
    expect(updated.player.localDevice.installedSoftware.filter(({ id }) => id === 'packet-viewer')).toEqual([
      { id: 'packet-viewer', releaseId: 'packet-viewer-1.1', buildId: 'build-packet-viewer-1.1', name: 'Packet Viewer', version: '1.1', channel: 'experimental', publisher: 'next-publisher' },
    ])
    expect(updated.player.localDevice.installedSoftware.filter(({ id }) => id !== 'packet-viewer')).toEqual(
      installed.player.localDevice.installedSoftware.filter(({ id }) => id !== 'packet-viewer'),
    )
  })
})

describe('software installation completion: NodeScan', () => {
  it('installs the initial local NodeScan 1.2 package through ordinary replacement and withdraws capabilities after replacement', () => {
    const initial = createInitialGameState()
    expect(findInstalledNodeScan(initial.player.localDevice)?.releaseId).toBe(NODESCAN_1_0_STANDARD.releaseId)
    const packages = initial.player.localDevice.filesystem.files.filter((file) => file.kind === 'software_package' && file.releaseId === NODESCAN_1_2_STANDARD.releaseId)
    expect(packages).toEqual([expect.objectContaining({ path: '/home/user/downloads/nodescan-1.2.pkg', buildId: NODESCAN_1_2_STANDARD.buildId })])

    const started = installLocalSoftwarePackage(initial, packages[0].path)
    if (started.status !== 'started') throw new Error(started.status)
    const installed = completeInstallation(started.state)
    const nodeScan12 = findInstalledNodeScan(installed.player.localDevice)!
    expect(nodeScan12).toEqual(expect.objectContaining({ releaseId: NODESCAN_1_2_STANDARD.releaseId, buildId: NODESCAN_1_2_STANDARD.buildId, version: '1.2', channel: 'standard' }))
    expect(nodeScanSupportsInspect(nodeScan12)).toBe(true)
    expect(nodeScanSupportsLiveTopology(nodeScan12)).toBe(true)
    expect(nodeScanSupportsIntegratedIntelligence(nodeScan12)).toBe(true)

    const baselinePackage: SoftwarePackageFile = { kind: 'software_package', id: 'file-baseline', path: '/home/user/downloads/nodescan-1.0.pkg', productId: NODESCAN_1_0_STANDARD.productId, releaseId: NODESCAN_1_0_STANDARD.releaseId, buildId: NODESCAN_1_0_STANDARD.buildId, name: NODESCAN_1_0_STANDARD.name, version: NODESCAN_1_0_STANDARD.version, channel: NODESCAN_1_0_STANDARD.channel, sizeBytes: 18_000_000 }
    const withBaseline = { ...installed, player: { ...installed.player, localDevice: { ...installed.player.localDevice, filesystem: { ...installed.player.localDevice.filesystem, files: [...installed.player.localDevice.filesystem.files, baselinePackage] } } } }
    const replacement = installLocalSoftwarePackage(withBaseline, baselinePackage.path)
    if (replacement.status !== 'started') throw new Error(replacement.status)
    const downgraded = completeInstallation(replacement.state)
    const baseline = findInstalledNodeScan(downgraded.player.localDevice)!
    expect(nodeScanSupportsInspect(baseline)).toBe(false)
    expect(nodeScanSupportsLiveTopology(baseline)).toBe(false)
    expect(nodeScanSupportsIntegratedIntelligence(baseline)).toBe(false)
  })

  it('applies the InstalledSoftware consequence only once the Process completes', () => {
    const state = withFiles([packageFile])
    const started = installLocalSoftwarePackage(state, path)
    if (started.status !== 'started') throw new Error(started.status)
    const done = completeInstallation(started.state)
    const process = installation(done.process.processes.find(({ id }) => id === started.processId)!)
    expect(process).toMatchObject({ status: 'completed', result: { status: 'installed' } })
    expect(done.player.localDevice.installedSoftware).toContainEqual({ id: 'nodescan', releaseId: 'build-a91f7', buildId: 'build-fixture-v0', name: 'Canonical Scanner', version: '1.1', channel: 'experimental' })
    expect(done.player.localDevice.filesystem.files[0]).toBe(packageFile)
  })

  it('appends NodeScan when absent while preserving unrelated software', () => {
    const base = withFiles([packageFile])
    const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: base.player.localDevice.installedSoftware.filter(({ id }) => id !== 'nodescan') } } }
    const started = installLocalSoftwarePackage(state, path)
    if (started.status !== 'started') throw new Error(started.status)
    const done = completeInstallation(started.state)
    expect(done.player.localDevice.installedSoftware).toContainEqual(expect.objectContaining({ id: 'nodescan', releaseId: 'build-a91f7' }))
    expect(done.player.localDevice.installedSoftware.filter(({ id }) => id !== 'nodescan')).toEqual(state.player.localDevice.installedSoftware)
    expect(done.player.localDevice.installedSoftware).toHaveLength(state.player.localDevice.installedSoftware.length + 1)
  })

  it('a local installation on the player Device does not imply installation on a remote Device', () => {
    const state = withFiles([packageFile])
    const started = installLocalSoftwarePackage(state, path)
    if (started.status !== 'started') throw new Error(started.status)
    const done = completeInstallation(started.state)
    expect(done.world).toBe(started.state.world)
  })
})

describe('software installation completion: NODE Miner', () => {
  const packagePath = '/home/user/downloads/node-miner-1.0.pkg'

  it('remains uninstalled with no executable while running, then installs and creates exactly one concrete executable only at completion', () => {
    const state = createInitialGameState()
    const started = installLocalSoftwarePackage(state, packagePath)
    if (started.status !== 'started') throw new Error(started.status)

    // Running: SOFTWARE PACKAGE -> INSTALL admitted work only. Neither InstalledSoftware nor the executable exist yet.
    expect(started.state.player.localDevice.installedSoftware.find(({ id }) => id === 'node-miner')).toBeUndefined()
    expect(started.state.player.localDevice.filesystem.files.some((file) => file.path === NODE_MINER_INSTALLED_EXECUTABLE_PATH)).toBe(false)

    const done = completeInstallation(started.state)
    const process = installation(done.process.processes.find(({ id }) => id === started.processId)!)
    expect(process).toMatchObject({ status: 'completed', result: { status: 'installed' } })
    expect(done.player.localDevice.installedSoftware).toContainEqual({ id: 'node-miner', releaseId: 'node-miner-1.0', buildId: NODE_MINER_1_0.buildId, name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev' })

    const executables = done.player.localDevice.filesystem.files.filter((file): file is ExecutableFile => file.kind === 'executable')
    expect(executables).toHaveLength(1)
    expect(executables[0]).toMatchObject({ path: NODE_MINER_INSTALLED_EXECUTABLE_PATH, programId: 'node-miner', releaseId: 'node-miner-1.0', buildId: NODE_MINER_1_0.buildId, name: 'NODE Miner', version: '1.0' })
    expect(done.player.localDevice.filesystem.files.some((file) => file.path === packagePath)).toBe(true)

    // Installation applies InstalledSoftware and the executable; it never automatically RUNs anything.
    expect(done.process.processes.every((candidate) => candidate.kind !== 'node_miner')).toBe(true)
  })

  it('is already_installed on a second identical install attempt and never creates a duplicate executable', () => {
    const state = createInitialGameState()
    const first = installLocalSoftwarePackage(state, packagePath)
    if (first.status !== 'started') throw new Error(first.status)
    const done = completeInstallation(first.state)
    const second = installLocalSoftwarePackage(done, packagePath)
    expect(second).toEqual({ status: 'already_installed', state: done })
    const executables = second.state.player.localDevice.filesystem.files.filter((file) => file.kind === 'executable')
    expect(executables).toHaveLength(1)
  })

  it('rejects admission when an unrelated artifact already occupies the deterministic installation path', () => {
    const state = createInitialGameState()
    const occupied: GameState = {
      ...state,
      player: {
        ...state.player,
        localDevice: {
          ...state.player.localDevice,
          filesystem: {
            ...state.player.localDevice.filesystem,
            files: [...state.player.localDevice.filesystem.files, { kind: 'text', id: 'file-occupant', path: NODE_MINER_INSTALLED_EXECUTABLE_PATH, content: 'not NODE Miner' }],
          },
        },
      },
    }
    const result = installLocalSoftwarePackage(occupied, packagePath)
    expect(result).toEqual({ status: 'install_path_occupied', state: occupied })
    expect(occupied.player.localDevice.installedSoftware).not.toContainEqual(expect.objectContaining({ id: 'node-miner' }))
    expect(occupied.process.processes).toEqual([])
  })

  it('does not overwrite an artifact that occupies the destination after admission but before completion, retaining a truthful failed result', () => {
    const state = createInitialGameState()
    const started = installLocalSoftwarePackage(state, packagePath)
    if (started.status !== 'started') throw new Error(started.status)
    const occupiedWhileRunning: GameState = {
      ...started.state,
      player: {
        ...started.state.player,
        localDevice: {
          ...started.state.player.localDevice,
          filesystem: {
            ...started.state.player.localDevice.filesystem,
            files: [...started.state.player.localDevice.filesystem.files, { kind: 'text', id: 'file-occupant', path: NODE_MINER_INSTALLED_EXECUTABLE_PATH, content: 'raced in' }],
          },
        },
      },
    }
    const done = completeInstallation(occupiedWhileRunning)
    const process = installation(done.process.processes.find(({ id }) => id === started.processId)!)
    expect(process.result).toEqual({ status: 'install_path_occupied' })
    expect(done.player.localDevice.installedSoftware.find(({ id }) => id === 'node-miner')).toBeUndefined()
    expect(done.player.localDevice.filesystem.files.filter((file) => file.kind === 'executable')).toHaveLength(0)
    expect(done.player.localDevice.filesystem.files.find(({ path }) => path === NODE_MINER_INSTALLED_EXECUTABLE_PATH)).toMatchObject({ id: 'file-occupant' })
  })
})

describe('software installation completion idempotency', () => {
  it('resolves exactly once: repeated advancement never duplicates InstalledSoftware, the executable, or filesystem IDs', () => {
    const state = createInitialGameState()
    const started = installLocalSoftwarePackage(state, '/home/user/downloads/node-miner-1.0.pkg')
    if (started.status !== 'started') throw new Error(started.status)
    const once = completeInstallation(started.state)
    const twice = resolveCompletedSoftwareInstallations(once)
    expect(twice).toBe(once)
    expect(advanceGameState(once, 20_000)).toBe(once)

    const executables = once.player.localDevice.filesystem.files.filter((file) => file.kind === 'executable')
    expect(executables).toHaveLength(1)
    expect(once.player.localDevice.installedSoftware.filter(({ id }) => id === 'node-miner')).toHaveLength(1)
  })
})

describe('normal package recognition of the current path', () => {
  const UNRECOGNIZED = ['/home/user/downloads/node-miner-1.0.pk', '/home/user/downloads/node-miner-1.0.pkd', '/home/user/downloads/node-miner-1.0.123', '/home/user/downloads/node-miner-1.0.PKG']

  it('recognizes only a current path ending in .pkg, case-sensitively', () => {
    expect(isRecognizedSoftwarePackagePath('/home/user/downloads/node-miner-1.0.pkg')).toBe(true)
    for (const candidate of UNRECOGNIZED) expect(isRecognizedSoftwarePackagePath(candidate)).toBe(false)
  })

  it('admits the recognized .pkg package and rejects the same intrinsic artifact at an unrecognized path without mutating it', () => {
    const recognized = withFiles([{ ...packageFile, id: 'file-miner', path: '/home/user/downloads/node-miner-1.0.pkg', productId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev', sizeBytes: 3_400_000 }])
    expect(installLocalSoftwarePackage(recognized, '/home/user/downloads/node-miner-1.0.pkg').status).toBe('started')

    for (const unrecognizedPath of UNRECOGNIZED) {
      const source = recognized.player.localDevice.filesystem.files[0] as SoftwarePackageFile
      const renamed: SoftwarePackageFile = { ...source, path: unrecognizedPath }
      const state = withFiles([renamed])
      expect(installLocalSoftwarePackage(state, unrecognizedPath)).toEqual({ status: 'unrecognized_package_extension', state })

      // Recognition is not identity: the artifact keeps its intrinsic package truth exactly.
      const current = state.player.localDevice.filesystem.files[0]
      expect(current.kind).toBe('software_package')
      expect(current).toMatchObject({ productId: source.productId, releaseId: source.releaseId, buildId: 'build-fixture-v0', name: source.name, version: source.version, sizeBytes: source.sizeBytes })
      expect(current).toEqual({ ...source, path: unrecognizedPath })
    }
  })

  it('rejects an unrecognized path before represented product support, and without a Process or installed software', () => {
    const state = withFiles([{ ...packageFile, productId: 'other-product', path: '/home/user/downloads/nodescan-build.pk' }])
    const result = installLocalSoftwarePackage(state, '/home/user/downloads/nodescan-build.pk')
    expect(result.status).toBe('unrecognized_package_extension')
    expect(result.state).toBe(state)
    expect(result.state.process.processes).toEqual([])
    expect(result.state.player.localDevice.installedSoftware).toEqual(state.player.localDevice.installedSoftware)
  })

  it('lets a real FileTransfer produce an unrecognized local package name that keeps intrinsic truth but is not normally installable', () => {
    const base = createInitialGameState()
    const host = base.world.network.hosts[0]
    const remoteSource = host.filesystem!.files.find((file): file is SoftwarePackageFile => file.kind === 'software_package')!
    const renamedRemote: SoftwarePackageFile = { ...remoteSource, path: '/opt/packages/nodescan-exp-1.1.pkd' }
    const access = { id: 'access-recognition', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: 'service-ssh-001', privilege: 'USER' as const }
    const authorized: GameState = {
      ...base,
      deviceAccess: { nextId: 2, established: [access] },
      world: { ...base.world, network: { ...base.world.network, hosts: [{ ...host, filesystem: { ...host.filesystem!, files: host.filesystem!.files.map((file) => file.id === remoteSource.id ? renamedRemote : file) } }, ...base.world.network.hosts.slice(1)] } },
    }
    const connected = connectRemoteFromObservation(authorized, { targetDeviceId: host.id, address: '198.51.100.47' }).state
    const started = startRemoteFileDownload(connected, renamedRemote.path)
    if (started.status !== 'started') throw new Error(started.status)
    const downloaded = advanceFileTransfer(started.state, 60_000)

    const copy = downloaded.player.localDevice.filesystem.files.find(({ path: candidate }) => candidate === started.destinationPath)!
    expect(started.destinationPath).toBe('/home/user/downloads/nodescan-exp-1.1.pkd')
    expect(copy.kind).toBe('software_package')
    expect(copy).toMatchObject({ productId: remoteSource.productId, releaseId: remoteSource.releaseId, buildId: remoteSource.buildId, name: remoteSource.name, version: remoteSource.version })
    expect(installLocalSoftwarePackage(downloaded, started.destinationPath).status).toBe('unrecognized_package_extension')
  })
})

/**
 * Remote installation on the Device the player is currently operating.
 *
 * srv-01 (`host-lan-001`) owns 160 compute against a 12% baseline, so 140.8
 * work/s: the shared 600-unit installation completes in about 4.3 s of its
 * own runtime, entirely independently of node-01's scheduler.
 */
describe('installRemoteSoftwarePackage', () => {
  const REMOTE_PACKAGE_PATH = '/opt/packages/packet-viewer-1.0.pkg'
  const REMOTE_MINER_PATH = '/opt/packages/node-miner-1.0.pkg'
  const LOCAL_MINER_PATH = '/home/user/downloads/node-miner-1.0.pkg'

  const remoteMinerPackage: SoftwarePackageFile = {
    kind: 'software_package', id: 'file-remote-miner', path: REMOTE_MINER_PATH,
    productId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner',
    version: '1.0', channel: 'unofficial', publisher: 'nm-dev', sizeBytes: 3_400_000,
  }

  const remoteOrdinaryPackage: SoftwarePackageFile = {
    kind: 'software_package', id: 'file-remote-ordinary-baseline', path: REMOTE_PACKAGE_PATH,
    productId: 'packet-viewer', releaseId: 'packet-viewer-1.0', buildId: 'build-fixture-v0', name: 'Packet Viewer',
    version: '1.0', channel: 'standard', publisher: 'test-publisher', sizeBytes: 2_048,
  }

  /** An authorized, currently operated RACK-OS context over srv-01, optionally altering that Device first. */
  function operating(alter?: (host: NetworkHost) => NetworkHost): GameState {
    const base = createInitialGameState()
    const authored = base.world.network.hosts[0]
    const withOrdinary = { ...authored, filesystem: { ...authored.filesystem!, files: [...authored.filesystem!.files, remoteOrdinaryPackage] } }
    const target = alter ? alter(withOrdinary) : withOrdinary
    const authorized: GameState = {
      ...base,
      deviceAccess: { nextId: 2, established: [{ id: 'access-remote-install', sourceDeviceId: base.player.localDevice.id, targetDeviceId: target.id, viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
      world: { ...base.world, network: { ...base.world.network, hosts: [target, ...base.world.network.hosts.slice(1)] } },
    }
    return connectRemoteFromObservation(authorized, { targetDeviceId: target.id, address: target.ip }).state
  }

  function withRemoteFiles(files: readonly SoftwarePackageFile[]) {
    return (host: NetworkHost): NetworkHost => ({ ...host, filesystem: { nextFileId: 90, files: [...host.filesystem!.files, ...files] } })
  }

  function target(state: GameState): NetworkHost {
    return state.world.network.hosts.find(({ id }) => id === 'host-lan-001')!
  }

  it('requires a current remote operating context, an online target, and a target that represents installable software state', () => {
    const base = createInitialGameState()
    expect(installRemoteSoftwarePackage(base, REMOTE_PACKAGE_PATH)).toEqual({ status: 'session_unavailable', state: base })

    // DeviceAccess alone is not an operating context: the Session is what admits the command.
    const accessOnly: GameState = { ...base, deviceAccess: { nextId: 2, established: [{ id: 'access-only', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] } }
    expect(installRemoteSoftwarePackage(accessOnly, REMOTE_PACKAGE_PATH)).toEqual({ status: 'session_unavailable', state: accessOnly })

    // A target that went offline while the Session was live is reported truthfully.
    const connected = operating()
    const offline: GameState = { ...connected, world: { ...connected.world, network: { ...connected.world.network, hosts: connected.world.network.hosts.map((host) => host.id === 'host-lan-001' ? { ...host, operational: { lifecycle: 'RUNNING', connectivity: 'DISCONNECTED' } } : host) } } }
    expect(installRemoteSoftwarePackage(offline, REMOTE_PACKAGE_PATH)).toEqual({ status: 'target_offline', state: offline })

    // A Device that represents no software inventory is not given a fabricated one to make it installable.
    const withoutInventory = operating((host) => ({ ...host, installedSoftware: undefined }))
    expect(installRemoteSoftwarePackage(withoutInventory, REMOTE_PACKAGE_PATH)).toEqual({ status: 'target_not_installable', state: withoutInventory })
    const withoutHardware = operating((host) => ({ ...host, hardware: undefined }))
    expect(installRemoteSoftwarePackage(withoutHardware, REMOTE_PACKAGE_PATH)).toEqual({ status: 'target_not_installable', state: withoutHardware })
  })

  it('resolves the package from the target filesystem, snapshots its exact concrete metadata, and admits work owned by that Device', () => {
    const state = operating()
    const remotePackage = target(state).filesystem!.files.find((file): file is SoftwarePackageFile => file.kind === 'software_package' && file.path === REMOTE_PACKAGE_PATH)!
    const result = installRemoteSoftwarePackage(state, REMOTE_PACKAGE_PATH)
    expect(result).toMatchObject({ status: 'started', processId: 'process-0001', productId: 'packet-viewer', name: 'Packet Viewer', version: '1.0', channel: 'standard' })
    if (result.status !== 'started') throw new Error(result.status)

    const process = installation(result.state.process.processes[0])
    expect(process).toMatchObject({
      kind: 'software_installation', status: 'running', executorDeviceId: 'host-lan-001',
      productId: remotePackage.productId, releaseId: remotePackage.releaseId, buildId: 'build-fixture-v0', name: remotePackage.name,
      version: remotePackage.version, channel: remotePackage.channel, ramRequiredMiB: SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB,
    })
    expect(process.result).toBeUndefined()
    // No cross-Device authority is retained: unlike FileTransfer this runtime spans no route.
    expect(process).not.toHaveProperty('accessId')
    expect(process).not.toHaveProperty('sessionId')

    // Admission starts work, not installation truth, and reserves the target's own RAM.
    expect(target(result.state).installedSoftware).toEqual([expect.objectContaining({ id: 'gate-ssh', releaseId: 'gate-ssh-1.3.2' })])
    expect(target(result.state).filesystem).toBe(target(state).filesystem)
    expect(result.state.player.localDevice).toBe(state.player.localDevice)
    expect(deriveResourceUsage({ id: 'host-lan-001', hardware: target(result.state).hardware!, runtime: target(result.state).runtime! }, result.state.process).processRamMiB).toBe(SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB)
    expect(deriveResourceUsage(result.state.player.localDevice, result.state.process).processRamMiB).toBe(0)
  })

  it('does not resolve packages from the player local filesystem', () => {
    const state = operating()
    expect(state.player.localDevice.filesystem.files.some(({ path }) => path === LOCAL_MINER_PATH)).toBe(true)
    expect(installRemoteSoftwarePackage(state, LOCAL_MINER_PATH)).toEqual({ status: 'package_not_found', state })
  })

  it('applies normal package recognition to the target artifact path without rewriting it', () => {
    const unrecognized: SoftwarePackageFile = { ...remoteMinerPackage, path: '/opt/packages/node-miner-1.0.pkd' }
    const state = operating(withRemoteFiles([unrecognized]))
    expect(installRemoteSoftwarePackage(state, unrecognized.path)).toEqual({ status: 'unrecognized_package_extension', state })
    expect(target(state).filesystem!.files).toContainEqual(unrecognized)
  })

  it('scopes already-installed and already-installing checks to the target Device', () => {
    const state = operating()
    // node-01 already runs NodeScan 1.0 Standard; that says nothing about srv-01.
    expect(state.player.localDevice.installedSoftware.find(({ id }) => id === 'nodescan')).toBeDefined()

    const installedRemotely = operating((host) => ({ ...host, installedSoftware: [...host.installedSoftware!, { id: 'packet-viewer', releaseId: 'packet-viewer-1.0', buildId: 'build-fixture-v0', name: 'Packet Viewer', version: '1.0', channel: 'standard' }] }))
    expect(installRemoteSoftwarePackage(installedRemotely, REMOTE_PACKAGE_PATH)).toEqual({ status: 'already_installed', state: installedRemotely })

    // A different release of the same product installed there is a replacement, not a block.
    const otherRelease = operating((host) => ({ ...host, installedSoftware: [...host.installedSoftware!, { id: 'packet-viewer', releaseId: 'packet-viewer-0.9', buildId: 'build-packet-viewer-0.9', name: 'Packet Viewer', version: '0.9' }] }))
    expect(installRemoteSoftwarePackage(otherRelease, REMOTE_PACKAGE_PATH)).toMatchObject({ status: 'started', productId: 'packet-viewer' })

    const started = installRemoteSoftwarePackage(state, REMOTE_PACKAGE_PATH)
    if (started.status !== 'started') throw new Error(started.status)
    expect(installRemoteSoftwarePackage(started.state, REMOTE_PACKAGE_PATH)).toEqual({ status: 'already_installing', state: started.state })
  })

  it('keeps local and remote installation work independent per executor Device', () => {
    const state = operating(withRemoteFiles([remoteMinerPackage]))
    const local = installLocalSoftwarePackage(state, LOCAL_MINER_PATH)
    if (local.status !== 'started') throw new Error(local.status)
    // The same product installing on node-01 must not block it on srv-01.
    const remote = installRemoteSoftwarePackage(local.state, REMOTE_MINER_PATH)
    if (remote.status !== 'started') throw new Error(remote.status)
    expect(remote.state.process.processes.map(({ id, executorDeviceId }) => [id, executorDeviceId])).toEqual([
      ['process-0001', 'device-local-v0'],
      ['process-0002', 'host-lan-001'],
    ])
    // Each executor allocates its own full headroom rather than sharing one pool.
    const usage = deriveResourceUsage(remote.state.player.localDevice, remote.state.process)
    expect(usage.cpuAllocationByProcess['process-0001']).toBeCloseTo(82)
    expect(usage.cpuAllocationByProcess['process-0002']).toBeUndefined()
  })

  it('admits against the target Device RAM', () => {
    const state = operating((host) => ({ ...host, hardware: { ...host.hardware!, ram: { name: '256 MB', capacityMiB: 256 } } }))
    expect(installRemoteSoftwarePackage(state, REMOTE_PACKAGE_PATH)).toMatchObject({ status: 'insufficient_memory', requiredMiB: SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB })
    // node-01 has ample RAM: the rejection is the target's, not the player Device's.
    expect(deriveResourceUsage(state.player.localDevice, state.process).availableRamMiB).toBeGreaterThan(SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB)
  })

  it('checks the NODE Miner installation path against the target filesystem', () => {
    const occupied = operating((host) => ({ ...host, filesystem: { nextFileId: 90, files: [...host.filesystem!.files, remoteMinerPackage, { kind: 'text', id: 'file-remote-occupant', path: RACK_OS_NODE_MINER_INSTALLED_EXECUTABLE_PATH, content: 'not NODE Miner' }] } }))
    expect(installRemoteSoftwarePackage(occupied, REMOTE_MINER_PATH)).toEqual({ status: 'install_path_occupied', state: occupied })

    // The same path being free on srv-01 while occupied on node-01 must not block the remote install.
    const localOccupied: GameState = (() => {
      const state = operating(withRemoteFiles([remoteMinerPackage]))
      return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: [...state.player.localDevice.filesystem.files, { kind: 'text', id: 'file-local-occupant', path: NODE_MINER_INSTALLED_EXECUTABLE_PATH, content: 'local occupant' }] } } } }
    })()
    expect(installRemoteSoftwarePackage(localOccupied, REMOTE_MINER_PATH)).toMatchObject({ status: 'started', productId: 'node-miner' })
  })

  it('continues Device-owned work after DISCONNECT and completes on the target alone', () => {
    const state = operating()
    const started = installRemoteSoftwarePackage(state, REMOTE_PACKAGE_PATH)
    if (started.status !== 'started') throw new Error(started.status)

    const disconnected = disconnectRemoteSession(started.state)
    expect(disconnected.status).toBe('disconnected')
    expect(disconnected.state.remoteSession.active).toBeNull()
    // Disconnect ends observation, never admitted Device-owned work, and never the access relationship.
    expect(disconnected.state.process.processes).toEqual(started.state.process.processes)
    expect(disconnected.state.deviceAccess).toBe(started.state.deviceAccess)

    const running = advanceGameState(disconnected.state, 1_000)
    expect(installation(running.process.processes[0])).toMatchObject({ status: 'running' })
    expect(installation(running.process.processes[0]).workCompleted).toBeCloseTo(140.8)

    const done = advanceGameState(running, 20_000)
    expect(target(done).installedSoftware).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'gate-ssh', releaseId: 'gate-ssh-1.3.2' }),
      expect.objectContaining({ id: 'packet-viewer', releaseId: 'packet-viewer-1.0' }),
    ]))
    // Ordinary completion is InstalledSoftware only: no executable appears merely because software exists.
    expect(target(done).filesystem!.files.some((file) => file.kind === 'executable')).toBe(false)
    expect(target(done).filesystem!.files).toContainEqual(target(state).filesystem!.files[1])
    // node-01 keeps its own independent inventory and filesystem throughout.
    expect(done.player.localDevice).toBe(state.player.localDevice)
  })

  it('creates the NODE Miner managed executable in the target filesystem and never locally', () => {
    const state = operating(withRemoteFiles([remoteMinerPackage]))
    const started = installRemoteSoftwarePackage(state, REMOTE_MINER_PATH)
    if (started.status !== 'started') throw new Error(started.status)
    const done = advanceGameState(started.state, 20_000)

    expect(target(done).installedSoftware).toEqual([
      expect.objectContaining({ id: 'gate-ssh', releaseId: 'gate-ssh-1.3.2' }),
      { id: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev' },
    ])
    const remoteExecutables = target(done).filesystem!.files.filter((file): file is ExecutableFile => file.kind === 'executable')
    expect(remoteExecutables).toHaveLength(1)
    expect(remoteExecutables[0]).toMatchObject({ path: RACK_OS_NODE_MINER_INSTALLED_EXECUTABLE_PATH, programId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0' })
    expect(target(done).filesystem!.files).toContainEqual(remoteMinerPackage)

    // node-01 gains no installed software, no executable, and no filesystem identity.
    expect(done.player.localDevice.filesystem).toBe(state.player.localDevice.filesystem)
    expect(done.player.localDevice.installedSoftware.some(({ id }) => id === 'node-miner')).toBe(false)

    // INSTALLATION is not EXECUTION: no Process was started, and RUN still resolves only local artifacts.
    expect(done.process.processes.every((process) => process.kind !== 'node_miner')).toBe(true)
    expect(startNodeMiner(done, NODE_MINER_INSTALLED_EXECUTABLE_PATH, 'node-wallet-addr-0001')).toMatchObject({ status: 'source_not_found' })
  })

  it('installs an ordinary product with no represented mechanics through the same default path', () => {
    const ordinary: SoftwarePackageFile = {
      kind: 'software_package', id: 'file-remote-ordinary', path: '/opt/packages/packet-viewer-1.0.pkg',
      productId: 'packet-viewer', releaseId: 'packet-viewer-1.0', buildId: 'build-fixture-v0', name: 'Packet Viewer',
      version: '1.0', channel: 'standard', publisher: 'test-publisher', sizeBytes: 2_048,
    }
    const started = installRemoteSoftwarePackage(operating(withRemoteFiles([ordinary])), ordinary.path)
    if (started.status !== 'started') throw new Error(started.status)
    const done = advanceGameState(started.state, 20_000)
    expect(target(done).installedSoftware).toEqual([
      expect.objectContaining({ id: 'gate-ssh', releaseId: 'gate-ssh-1.3.2' }),
      { id: 'packet-viewer', releaseId: 'packet-viewer-1.0', buildId: 'build-fixture-v0', name: 'Packet Viewer', version: '1.0', channel: 'standard', publisher: 'test-publisher' },
    ])
    expect(target(done).filesystem!.files.some((file) => file.kind === 'executable')).toBe(false)
  })

  it('replaces only the matching product on the target and leaves its unrelated software alone', () => {
    const state = operating((host) => ({ ...host, installedSoftware: [
      ...host.installedSoftware!,
      { id: 'packet-viewer', releaseId: 'packet-viewer-0.9', buildId: 'build-packet-viewer-0.9', name: 'Packet Viewer', version: '0.9' },
      { id: 'flipper', releaseId: 'flipper-1.0', buildId: 'build-fixture-v0', name: 'Flipper', version: '1.0', integratedModules: ['credential-access'], sizeBytes: 5_600_000 },
    ] }))
    const started = installRemoteSoftwarePackage(state, REMOTE_PACKAGE_PATH)
    if (started.status !== 'started') throw new Error(started.status)
    expect(target(advanceGameState(started.state, 20_000)).installedSoftware).toEqual([
      expect.objectContaining({ id: 'gate-ssh', releaseId: 'gate-ssh-1.3.2' }),
      { id: 'packet-viewer', releaseId: 'packet-viewer-1.0', buildId: 'build-fixture-v0', name: 'Packet Viewer', version: '1.0', channel: 'standard', publisher: 'test-publisher' },
      { id: 'flipper', releaseId: 'flipper-1.0', buildId: 'build-fixture-v0', name: 'Flipper', version: '1.0', integratedModules: ['credential-access'], sizeBytes: 5_600_000 },
    ])
  })

  it('resolves a target that stopped representing an installable inventory as a truthful failure rather than an unresolvable Process', () => {
    const started = installRemoteSoftwarePackage(operating(), REMOTE_PACKAGE_PATH)
    if (started.status !== 'started') throw new Error(started.status)
    const withoutInventory: GameState = { ...started.state, world: { ...started.state.world, network: { ...started.state.world.network, hosts: started.state.world.network.hosts.map((host) => host.id === 'host-lan-001' ? { ...host, installedSoftware: undefined } : host) } } }
    const done = advanceGameState(withoutInventory, 20_000)
    expect(done.process.processes).toEqual([])
    expect(target(done).installedSoftware).toBeUndefined()
  })

  it('rejects NodeScan on RACK-OS without mutation while local NODE-OS admits it', () => {
    const remote = operating()
    const nodeScanPath = '/opt/packages/nodescan-exp-1.1.pkg'
    expect(installRemoteSoftwarePackage(remote, nodeScanPath)).toEqual({ status: 'incompatible_firmware', state: remote })
    expect(remote.process.processes).toEqual([])
    const localPackage = { ...packageFile, path: '/home/user/downloads/nodescan-1.1.pkg' }
    expect(installLocalSoftwarePackage(withFiles([localPackage]), localPackage.path).status).toBe('started')
  })

  it('rejects a Flipper package on RACK-OS as requiring NODE-OS before any Process starts, while local NODE-OS admits it', () => {
    const flipperPackage: SoftwarePackageFile = {
      kind: 'software_package', id: 'file-flipper-package', path: '/opt/packages/flipper-1.0.pkg',
      productId: FLIPPER_1_0.productId, releaseId: FLIPPER_1_0.releaseId, buildId: FLIPPER_1_0.buildId,
      name: FLIPPER_1_0.name, version: FLIPPER_1_0.version, channel: FLIPPER_1_0.channel, publisher: FLIPPER_1_0.publisher, sizeBytes: 4_000_000,
    }
    const remote = operating(withRemoteFiles([flipperPackage]))
    expect(installRemoteSoftwarePackage(remote, flipperPackage.path)).toEqual({ status: 'incompatible_firmware', state: remote })
    expect(remote.process.processes).toEqual([])
    // Firmware incompatibility restricts installation only: the package remains a real transferable artifact on the target's own filesystem.
    expect(target(remote).filesystem!.files).toContainEqual(flipperPackage)
    expect(target(remote).installedSoftware!.some(({ id }) => id === FLIPPER_1_0.productId)).toBe(false)

    const localPackage = { ...flipperPackage, id: 'file-flipper-local', path: '/home/user/downloads/flipper-1.0.pkg' }
    expect(installLocalSoftwarePackage(withFiles([localPackage]), localPackage.path).status).toBe('started')
  })

  it('rejects seeded same-release GateSSH and atomically upgrades then downgrades its managed release', () => {
    const gatePath = '/opt/packages/gatessh-1.3.2.pkg'
    const initial = operating()
    expect(installRemoteSoftwarePackage(initial, gatePath)).toEqual({ status: 'already_installed', state: initial })
    const newer: SoftwarePackageFile = { kind: 'software_package', id: 'gate-new', path: '/opt/packages/gatessh-1.3.3.pkg', productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.3', buildId: 'build-fixture-v0', name: 'GateSSH', version: '1.3.3', sizeBytes: 6_400_000 }
    const upgrade = installRemoteSoftwarePackage(operating(withRemoteFiles([newer])), newer.path)
    if (upgrade.status !== 'started') throw new Error(upgrade.status)
    const upgraded = advanceGameState(upgrade.state, 20_000)
    expect(target(upgraded).installedSoftware!.find(({ id }) => id === 'gate-ssh')?.releaseId).toBe('gate-ssh-1.3.3')
    expect(target(upgraded).services!.find(({ implementation }) => implementation.productId === 'gate-ssh')?.implementation.releaseId).toBe('gate-ssh-1.3.3')
    expect(target(upgraded).installedSoftware!.find(({ id }) => id === 'gate-ssh')?.buildId).toBe(newer.buildId)
    expect(target(upgraded).services!.find(({ implementation }) => implementation.productId === 'gate-ssh')?.implementation.buildId).toBe(newer.buildId)
    const downgrade = installRemoteSoftwarePackage(upgraded, gatePath)
    if (downgrade.status !== 'started') throw new Error(downgrade.status)
    const downgraded = advanceGameState(downgrade.state, 20_000)
    expect(target(downgraded).installedSoftware!.find(({ id }) => id === 'gate-ssh')?.releaseId).toBe('gate-ssh-1.3.2')
    expect(target(downgraded).services!.find(({ implementation }) => implementation.productId === 'gate-ssh')?.implementation.releaseId).toBe('gate-ssh-1.3.2')
  })

  it('applies neither GateSSH half if the managed Service disappears before completion', () => {
    const newer: SoftwarePackageFile = { kind: 'software_package', id: 'gate-missing-service', path: '/opt/packages/gatessh-1.3.3.pkg', productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.3', buildId: 'build-fixture-v0', name: 'GateSSH', version: '1.3.3', sizeBytes: 1 }
    const original = operating(withRemoteFiles([newer]))
    const started = installRemoteSoftwarePackage(original, newer.path)
    if (started.status !== 'started') throw new Error(started.status)
    const completedProcess = { ...installation(started.state.process.processes[0]), status: 'completed' as const, workCompleted: installation(started.state.process.processes[0]).workRequired }
    const missing: GameState = { ...started.state, process: { ...started.state.process, processes: [completedProcess] }, world: { ...started.state.world, network: { ...started.state.world.network, hosts: started.state.world.network.hosts.map((host) => host.id === target(original).id ? { ...host, services: host.services!.filter(({ implementation }) => implementation.productId !== 'gate-ssh') } : host) } } }
    const done = resolveCompletedSoftwareInstallations(missing)
    expect(target(done).installedSoftware).toEqual(target(original).installedSoftware)
    expect(installation(done.process.processes[0]).result).toEqual({ status: 'target_unavailable' })
  })

})

describe('completed installation history stays the local Device\'s own observation', () => {
  const REMOTE_PACKAGE_PATH = '/opt/packages/history-viewer.pkg'

  function operating(): GameState {
    const base = createInitialGameState()
    const authored = base.world.network.hosts[0]
    const pkg: SoftwarePackageFile = { kind: 'software_package', id: 'history-viewer', path: REMOTE_PACKAGE_PATH, productId: 'history-viewer', releaseId: 'history-viewer-1.0', buildId: 'build-fixture-v0', name: 'History Viewer', version: '1.0', sizeBytes: 10 }
    const host = { ...authored, filesystem: { ...authored.filesystem!, files: [...authored.filesystem!.files, pkg] } }
    const authorized: GameState = { ...base, world: { ...base.world, network: { ...base.world.network, hosts: [host, ...base.world.network.hosts.slice(1)] } }, deviceAccess: { nextId: 2, established: [{ id: 'access-history', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: 'service-ssh-001', privilege: 'USER' }] } }
    return connectRemoteFromObservation(authorized, { targetDeviceId: host.id, address: host.ip }).state
  }

  it('archives local installation exactly as before', () => {
    const started = installLocalSoftwarePackage(createInitialGameState(), '/home/user/downloads/node-miner-1.0.pkg')
    if (started.status !== 'started') throw new Error(started.status)
    const done = advanceGameState(started.state, 20_000)
    expect(done.recentActivity.entries).toEqual([{ kind: 'process', id: started.processId, process: expect.objectContaining({ kind: 'software_installation', result: { status: 'installed' } }) }])
    expect(done.process.processes.map(({ id }) => id)).toEqual([started.processId])
  })

  it('leaves other non-local Process kinds' + '\u2019' + ' lifecycle untouched: this slice owns only remote software installation', () => {
    // A hypothetical non-local Process of another kind keeps whatever lifecycle it
    // already had. Deciding what those kinds do when they end is their own
    // mechanic's job, not this one's.
    const base = createInitialGameState()
    const remoteGeneric = { kind: 'generic' as const, id: 'process-0001', label: 'SERVER WORK', executorDeviceId: 'host-lan-001', status: 'running' as const, workRequired: 100, workCompleted: 0, ramRequiredMiB: 64 }
    const done = advanceGameState({ ...base, process: { nextId: 2, processes: [remoteGeneric] } }, 20_000)
    expect(done.process.processes).toEqual([expect.objectContaining({ id: 'process-0001', kind: 'generic', status: 'completed' })])
    expect(done.recentActivity.entries.map(({ id }) => id)).toEqual(['process-0001'])
  })

  it('never turns a completed remote installation into invisible local Recent Activity or retained hidden Process history', () => {
    // One real local observation first, so eviction pressure would be visible.
    const local = installLocalSoftwarePackage(operating(), '/home/user/downloads/node-miner-1.0.pkg')
    if (local.status !== 'started') throw new Error(local.status)
    const withLocalHistory = advanceGameState(local.state, 20_000)
    expect(withLocalHistory.recentActivity.entries).toHaveLength(1)

    const remote = installRemoteSoftwarePackage(withLocalHistory, REMOTE_PACKAGE_PATH)
    if (remote.status !== 'started') throw new Error(remote.status)
    const running = advanceGameState(remote.state, 1_000)
    // Running remote work stays canonical while it is genuinely running.
    expect(running.process.processes.map(({ id, executorDeviceId }) => [id, executorDeviceId])).toEqual([
      [local.processId, 'device-local-v0'],
      [remote.processId, 'host-lan-001'],
    ])

    const done = advanceGameState(running, 20_000)
    expect(done.recentActivity.entries.map(({ id }) => id)).toEqual([local.processId])
    expect(done.process.processes.map(({ id }) => id)).toEqual([local.processId])
    // The consequence still landed on the Device that did the work.
    expect(done.world.network.hosts[0].installedSoftware).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'history-viewer', releaseId: 'history-viewer-1.0' })]))
    // Local history remains fully clearable: nothing inaccessible is left behind.
    expect(clearRecentActivity(done, done.player.localDevice.id).recentActivity.entries).toEqual([])
    expect(clearRecentActivity(done, done.player.localDevice.id).process.processes).toEqual([])
  })
})
