import { describe, expect, it } from 'vitest'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import { NODE_MINER_INSTALLED_EXECUTABLE_PATH } from './nodeMiner'
import { deriveResourceUsage } from './processes'
import { installLocalSoftwarePackage, resolveCompletedSoftwareInstallations, SOFTWARE_INSTALLATION_RAM_REQUIRED_MIB } from './softwareInstallation'
import type { ExecutableFile, GameState, SoftwareInstallationProcess, SoftwarePackageFile } from './types'

const path = '/home/user/downloads/nodescan.weird'
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
  it.each([
    ['relative.pkg', 'invalid_path'],
    ['/missing.pkg', 'package_not_found'],
    ['/home', 'package_not_file'],
  ] as const)('returns %s without mutation', (requestedPath, status) => {
    const state = withFiles([{ kind: 'text', id: 'file-fixture-text', path: '/home/user/readme.txt', content: '' }])
    expect(installLocalSoftwarePackage(state, requestedPath)).toEqual({ status, state })
  })

  it('validates canonical file kind and product identity rather than filename or display name', () => {
    const text = withFiles([{ kind: 'text', id: 'file-fixture-text', path: '/home/user/nodescan.pkg', content: '' }])
    expect(installLocalSoftwarePackage(text, '/home/user/nodescan.pkg')).toEqual({ status: 'not_software_package', state: text })
    const unsupportedFile = { ...packageFile, productId: 'other-product' }
    const unsupported = withFiles([unsupportedFile])
    expect(installLocalSoftwarePackage(unsupported, path)).toEqual({ status: 'unsupported_package', state: unsupported })
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
