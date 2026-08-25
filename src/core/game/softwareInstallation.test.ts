import { describe, expect, it } from 'vitest'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { NODE_MINER_INSTALLED_EXECUTABLE_PATH } from './nodeMiner'
import { cancelLocalProcess, deriveResourceUsage } from './processes'
import { installLocalSoftwarePackage, isRecognizedSoftwarePackagePath, resolveCompletedSoftwareInstallations, SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB } from './softwareInstallation'
import { advanceFileTransfer, startRemoteFileDownload } from './fileTransfer'
import { connectRemoteFromObservation } from './remoteSession'
import type { ExecutableFile, GameState, SoftwareInstallationProcess, SoftwarePackageFile } from './types'

const path = '/home/user/downloads/nodescan-build.pkg'
const packageFile: SoftwarePackageFile = { kind: 'software_package', id: 'file-package', path, releaseId: 'build-a91f7', productId: 'nodescan', name: 'Canonical Scanner', version: '1.1', channel: 'experimental', sizeBytes: 1_000 }

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
    const ordinary = withFiles([{ ...packageFile, productId: 'packet-viewer', releaseId: 'packet-viewer-1.0', name: 'Packet Viewer' }])
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
    expect(process).toMatchObject({ kind: 'software_installation', status: 'running', productId: 'nodescan', releaseId: 'build-a91f7', name: 'Canonical Scanner', version: '1.1', channel: 'experimental', executorDeviceId: state.player.localDevice.id, ramRequiredMiB: SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB })
    expect(process.result).toBeUndefined()
    expect(deriveResourceUsage(result.state.player.localDevice, result.state.process).processRamMiB).toBe(SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB)
  })

  it('shares real CPU with another running local Process', () => {
    const state = withFiles([packageFile, { ...packageFile, id: 'file-package-2', path: '/home/user/downloads/node-miner-second.pkg', releaseId: 'node-miner-1.0', productId: 'node-miner', name: 'NODE Miner', version: '1.0', channel: 'unofficial' }])
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

  it('uses releaseId alone for sameness and replaces any different release without version ordering', () => {
    const same = withFiles([{ ...packageFile, releaseId: 'nodescan-1.0-standard', name: 'Malformed Metadata', version: '99' }])
    expect(installLocalSoftwarePackage(same, path)).toEqual({ status: 'already_installed', state: same })
    const lowerLooking = withFiles([{ ...packageFile, releaseId: 'different-build', version: '0.1', channel: 'modified' }])
    const started = installLocalSoftwarePackage(lowerLooking, path)
    if (started.status !== 'started') throw new Error(started.status)
    expect(installation(started.state.process.processes[0])).toMatchObject({ releaseId: 'different-build', version: '0.1', channel: 'modified' })
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
    productId: 'packet-viewer', releaseId: 'packet-viewer-1.0', name: 'Packet Viewer',
    version: '1.0', channel: 'standard', publisher: 'test-publisher', sizeBytes: 2_048,
  }

  it('preserves arbitrary package identity through Process admission and completion without creating an executable', () => {
    const initial = withFiles([ordinaryPackage])
    const initialSoftware = initial.player.localDevice.installedSoftware
    const started = installLocalSoftwarePackage(initial, ordinaryPath)
    expect(started).toMatchObject({ status: 'started', productId: 'packet-viewer' })
    if (started.status !== 'started') throw new Error(started.status)
    expect(installation(started.state.process.processes[0])).toMatchObject({
      productId: 'packet-viewer', releaseId: 'packet-viewer-1.0', name: 'Packet Viewer',
      version: '1.0', channel: 'standard', publisher: 'test-publisher', status: 'running',
    })
    expect(started.state.player.localDevice.installedSoftware).toEqual(initialSoftware)
    expect(started.state.player.localDevice.filesystem.files).toContainEqual(ordinaryPackage)

    const completed = completeInstallation(started.state)
    expect(completed.player.localDevice.installedSoftware).toEqual([
      ...initialSoftware,
      { id: 'packet-viewer', releaseId: 'packet-viewer-1.0', name: 'Packet Viewer', version: '1.0', channel: 'standard', publisher: 'test-publisher' },
    ])
    expect(completed.player.localDevice.filesystem.files).toContainEqual(ordinaryPackage)
    expect(completed.player.localDevice.filesystem.files.some((file) => file.kind === 'executable' && file.programId === 'packet-viewer')).toBe(false)
  })

  it('replaces only the matching ordinary product when another release completes', () => {
    const first = installLocalSoftwarePackage(withFiles([ordinaryPackage]), ordinaryPath)
    if (first.status !== 'started') throw new Error(first.status)
    const installed = completeInstallation(first.state)
    const nextPackage: SoftwarePackageFile = { ...ordinaryPackage, id: 'file-packet-viewer-2', path: '/home/user/downloads/packet-viewer-1.1.pkg', releaseId: 'packet-viewer-1.1', version: '1.1', channel: 'experimental', publisher: 'next-publisher' }
    const withNextPackage: GameState = {
      ...installed,
      player: { ...installed.player, localDevice: { ...installed.player.localDevice, filesystem: { ...installed.player.localDevice.filesystem, files: [...installed.player.localDevice.filesystem.files, nextPackage] } } },
    }
    const second = installLocalSoftwarePackage(withNextPackage, nextPackage.path)
    if (second.status !== 'started') throw new Error(second.status)
    const updated = completeInstallation(second.state)
    expect(updated.player.localDevice.installedSoftware.filter(({ id }) => id === 'packet-viewer')).toEqual([
      { id: 'packet-viewer', releaseId: 'packet-viewer-1.1', name: 'Packet Viewer', version: '1.1', channel: 'experimental', publisher: 'next-publisher' },
    ])
    expect(updated.player.localDevice.installedSoftware.filter(({ id }) => id !== 'packet-viewer')).toEqual(
      installed.player.localDevice.installedSoftware.filter(({ id }) => id !== 'packet-viewer'),
    )
  })
})

describe('software installation completion: NodeScan', () => {
  it('applies the InstalledSoftware consequence only once the Process completes', () => {
    const state = withFiles([packageFile])
    const started = installLocalSoftwarePackage(state, path)
    if (started.status !== 'started') throw new Error(started.status)
    const done = completeInstallation(started.state)
    const process = installation(done.process.processes.find(({ id }) => id === started.processId)!)
    expect(process).toMatchObject({ status: 'completed', result: { status: 'installed' } })
    expect(done.player.localDevice.installedSoftware).toContainEqual({ id: 'nodescan', releaseId: 'build-a91f7', name: 'Canonical Scanner', version: '1.1', channel: 'experimental' })
    expect(done.player.localDevice.filesystem.files[0]).toBe(packageFile)
  })

  it('appends NodeScan when absent while preserving unrelated software', () => {
    const base = withFiles([packageFile])
    const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: base.player.localDevice.installedSoftware.filter(({ id }) => id !== 'nodescan') } } }
    const started = installLocalSoftwarePackage(state, path)
    if (started.status !== 'started') throw new Error(started.status)
    const done = completeInstallation(started.state)
    expect(done.player.localDevice.installedSoftware).toEqual([base.player.localDevice.installedSoftware[1], expect.objectContaining({ id: 'nodescan', releaseId: 'build-a91f7' })])
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
    expect(done.player.localDevice.installedSoftware).toContainEqual({ id: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev' })

    const executables = done.player.localDevice.filesystem.files.filter((file): file is ExecutableFile => file.kind === 'executable')
    expect(executables).toHaveLength(1)
    expect(executables[0]).toMatchObject({ path: NODE_MINER_INSTALLED_EXECUTABLE_PATH, programId: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0' })
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
    const recognized = withFiles([{ ...packageFile, id: 'file-miner', path: '/home/user/downloads/node-miner-1.0.pkg', productId: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev', sizeBytes: 3_400_000 }])
    expect(installLocalSoftwarePackage(recognized, '/home/user/downloads/node-miner-1.0.pkg').status).toBe('started')

    for (const unrecognizedPath of UNRECOGNIZED) {
      const source = recognized.player.localDevice.filesystem.files[0] as SoftwarePackageFile
      const renamed: SoftwarePackageFile = { ...source, path: unrecognizedPath }
      const state = withFiles([renamed])
      expect(installLocalSoftwarePackage(state, unrecognizedPath)).toEqual({ status: 'unrecognized_package_extension', state })

      // Recognition is not identity: the artifact keeps its intrinsic package truth exactly.
      const current = state.player.localDevice.filesystem.files[0]
      expect(current.kind).toBe('software_package')
      expect(current).toMatchObject({ productId: source.productId, releaseId: source.releaseId, name: source.name, version: source.version, sizeBytes: source.sizeBytes })
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
    expect(copy).toMatchObject({ productId: remoteSource.productId, releaseId: remoteSource.releaseId, name: remoteSource.name, version: remoteSource.version })
    expect(installLocalSoftwarePackage(downloaded, started.destinationPath).status).toBe('unrecognized_package_extension')
  })
})
