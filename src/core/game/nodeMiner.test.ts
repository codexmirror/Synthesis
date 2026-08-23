import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { advanceGameState } from './gameAdvancement'
import { deriveResourceUsage } from './processes'
import { installLocalSoftwarePackage } from './softwareInstallation'
import {
  findNodeMinerExecutable, isNodeMinerAvailable, NODE_MINER_INSTALLED_EXECUTABLE_PATH,
  NODE_MINER_RAM_REQUIRED_MIB, NODE_UNITS_PER_NODE, startNodeMiner, stopNodeMiner,
} from './nodeMiner'
import type { DiscoveredDeviceSnapshot, ExecutableFile, GameState, NodeMinerProcess } from './types'

const LOCAL_MINER_PATH = '/home/user/downloads/node-miner-1.0.bin'

/**
 * A local Device that already owns a downloaded NODE Miner copy (independent
 * of the canonical installed package/executable flow exercised elsewhere),
 * with baseline CPU load forced to zero so allocated-compute arithmetic in
 * these tests lands on clean whole numbers.
 */
function readyState(): GameState {
  const base = createInitialGameState()
  const minerFile: ExecutableFile = { kind: 'executable', id: 'file-0003', path: LOCAL_MINER_PATH, programId: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
  return {
    ...base,
    player: {
      ...base.player,
      localDevice: {
        ...base.player.localDevice,
        filesystem: { nextFileId: 4, files: [...base.player.localDevice.filesystem.files, minerFile] },
        runtime: { ...base.player.localDevice.runtime, baselineCpuLoad: 0 },
      },
    },
  }
}

function run(state: GameState, payoutAddress: string = state.nodeWallet.address) {
  const result = startNodeMiner(state, LOCAL_MINER_PATH, payoutAddress)
  if (result.status !== 'started') throw new Error(result.status)
  return result
}

describe('NODE Miner execution admission', () => {
  it('rejects missing, wrong-kind, and directory paths rather than conjuring a Process', () => {
    const state = readyState()
    expect(startNodeMiner(state, '/home/user/downloads/missing.bin', 'addr').status).toBe('source_not_found')
    expect(startNodeMiner(state, '/home/user/welcome.txt', 'addr').status).toBe('not_executable')
    expect(startNodeMiner(state, '/home/user', 'addr').status).toBe('source_not_file')
    expect(state.process.processes).toHaveLength(0)
  })

  it('rejects an executable that is not the supported NODE Miner program', () => {
    const state = readyState()
    const other = { kind: 'executable' as const, id: 'file-0004', path: '/home/user/downloads/other.bin', programId: 'other-program', releaseId: 'other-1.0', name: 'Other Tool', version: '1.0', sizeBytes: 100 }
    const withOther: GameState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 5, files: [...state.player.localDevice.filesystem.files, other] } } } }
    const result = startNodeMiner(withOther, other.path, 'addr')
    expect(result.status).toBe('unsupported_program')
    expect(result.state.process.processes).toHaveLength(0)
  })

  it('rejects an unknown release that shares the NODE Miner program identity', () => {
    const state = readyState()
    const future = { kind: 'executable' as const, id: 'file-0004', path: '/home/user/downloads/node-miner-2.0.bin', programId: 'node-miner' as const, releaseId: 'node-miner-2.0', name: 'NODE Miner', version: '2.0', sizeBytes: 100 }
    const withFuture: GameState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 5, files: [...state.player.localDevice.filesystem.files, future] } } } }
    const result = startNodeMiner(withFuture, future.path, 'addr')
    expect(result.status).toBe('unsupported_program')
    expect(result.state.process.processes).toHaveLength(0)
  })

  it('requires an explicit non-empty payout address', () => {
    const state = readyState()
    expect(startNodeMiner(state, LOCAL_MINER_PATH, '').status).toBe('invalid_payout_address')
    expect(startNodeMiner(state, LOCAL_MINER_PATH, '   ').status).toBe('invalid_payout_address')
  })

  it('starts exactly one continuous Process on the local executor, retaining its own configured provenance', () => {
    const state = readyState()
    const started = run(state, 'player-chosen-address')
    expect(started.processId).toBe('process-0001')
    const process = started.state.process.processes[0] as NodeMinerProcess
    expect(process).toMatchObject({
      kind: 'node_miner',
      status: 'running',
      executorDeviceId: state.player.localDevice.id,
      programId: 'node-miner',
      releaseId: 'node-miner-1.0',
      payoutAddress: 'player-chosen-address',
      producedNodeUnits: 0,
      creditedNodeUnits: 0,
      workRemainder: 0,
      ramRequiredMiB: NODE_MINER_RAM_REQUIRED_MIB,
    })
  })

  it('retains accepted payout text exactly, including surrounding spaces, so matching stays exact', () => {
    const state = readyState()
    const payoutAddress = ` ${state.nodeWallet.address} `
    const started = run(state, payoutAddress)
    const process = started.state.process.processes[0] as NodeMinerProcess
    expect(process.payoutAddress).toBe(payoutAddress)

    const advanced = advanceGameState(started.state, 1000)
    expect(advanced.nodeWallet.balanceNodeUnits).toBe(0)
    expect((advanced.process.processes[0] as NodeMinerProcess).producedNodeUnits).toBe(100)
    expect((advanced.process.processes[0] as NodeMinerProcess).creditedNodeUnits).toBe(0)
  })

  it('rejects a duplicate RUN for the same program while one is already running on this executor', () => {
    const started = run(readyState())
    const duplicate = startNodeMiner(started.state, LOCAL_MINER_PATH, 'another-address')
    expect(duplicate.status).toBe('already_running')
    expect(duplicate.state.process.processes).toHaveLength(1)
  })

  it('reserves RAM through existing admission semantics and rejects atomically when insufficient', () => {
    const state = readyState()
    const constrained: GameState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, hardware: { ...state.player.localDevice.hardware, ram: { ...state.player.localDevice.hardware.ram, capacityMiB: 600 } } } } }
    const result = startNodeMiner(constrained, LOCAL_MINER_PATH, 'addr')
    expect(result).toMatchObject({ status: 'insufficient_memory', requiredMiB: NODE_MINER_RAM_REQUIRED_MIB })
    expect(result.state.process.processes).toHaveLength(0)
  })

  it('keeps running after its source executable is moved or deleted, since only admission required it', () => {
    const started = run(readyState())
    const withoutSource: GameState = { ...started.state, player: { ...started.state.player, localDevice: { ...started.state.player.localDevice, filesystem: { ...started.state.player.localDevice.filesystem, files: started.state.player.localDevice.filesystem.files.filter((file) => file.path !== LOCAL_MINER_PATH) } } } }
    const advanced = advanceGameState(withoutSource, 1000)
    const process = advanced.process.processes.find(({ id }) => id === started.processId) as NodeMinerProcess
    expect(process.status).toBe('running')
    expect(process.producedNodeUnits).toBeGreaterThan(0)
  })
})

describe('NODE Miner continuous runtime and mining accounting', () => {
  it('never completes from elapsed work, however large the interval', () => {
    const started = run(readyState())
    const advanced = advanceGameState(started.state, 100_000_000)
    const process = advanced.process.processes.find(({ id }) => id === started.processId) as NodeMinerProcess
    expect(process.status).toBe('running')
  })

  it('produces deterministic whole atomic NODE units from actual allocated compute, preserving a fractional remainder', () => {
    const started = run(readyState())
    // node-01: computeCapacity 100, baseline forced to 0 -> 100 compute-seconds/s allocated while running alone; 1 compute-second = 1 atomic NODE unit.
    const afterOneSecond = advanceGameState(started.state, 1000)
    const oneSecond = afterOneSecond.process.processes[0] as NodeMinerProcess
    expect(oneSecond.producedNodeUnits).toBe(100)
    expect(oneSecond.workRemainder).toBeCloseTo(0)

    const afterPartialSecond = advanceGameState(started.state, 505)
    const partialSecond = afterPartialSecond.process.processes[0] as NodeMinerProcess
    expect(partialSecond.producedNodeUnits).toBe(50)
    expect(partialSecond.workRemainder).toBeCloseTo(0.5)
  })

  it('never rounds allocated compute per tick and is tick-size independent', () => {
    const started = run(readyState())
    const once = advanceGameState(started.state, 1000)
    const chunked = advanceGameState(advanceGameState(advanceGameState(advanceGameState(started.state, 250), 250), 250), 250)
    const onceProcess = once.process.processes[0] as NodeMinerProcess
    const chunkedProcess = chunked.process.processes[0] as NodeMinerProcess
    expect(chunkedProcess.producedNodeUnits).toBe(onceProcess.producedNodeUnits)
    expect(chunkedProcess.workRemainder).toBeCloseTo(onceProcess.workRemainder)
    expect(chunked.nodeWallet.balanceNodeUnits).toBe(once.nodeWallet.balanceNodeUnits)
  })

  it('credits the represented NODE Wallet only when the configured payout address exactly matches', () => {
    const base = readyState()
    const matched = run(base, base.nodeWallet.address)
    const advancedMatched = advanceGameState(matched.state, 1000)
    expect(advancedMatched.nodeWallet.balanceNodeUnits).toBe(100)
    const matchedProcess = advancedMatched.process.processes[0] as NodeMinerProcess
    expect(matchedProcess.producedNodeUnits).toBe(100)
    expect(matchedProcess.creditedNodeUnits).toBe(100)

    const unmatched = run(readyState(), 'some-other-fictional-address')
    const advancedUnmatched = advanceGameState(unmatched.state, 1000)
    expect(advancedUnmatched.nodeWallet.balanceNodeUnits).toBe(0)
    const unmatchedProcess = advancedUnmatched.process.processes[0] as NodeMinerProcess
    expect(unmatchedProcess.producedNodeUnits).toBe(100)
    expect(unmatchedProcess.creditedNodeUnits).toBe(0)
  })

  it('never falls back to crediting the represented Wallet when the address does not match', () => {
    const unmatched = run(readyState(), 'nobody-owns-this-address')
    const advanced = advanceGameState(unmatched.state, 5000)
    expect(advanced.nodeWallet.balanceNodeUnits).toBe(0)
    const process = advanced.process.processes[0] as NodeMinerProcess
    expect(process.producedNodeUnits).toBeGreaterThan(0)
    expect(process.creditedNodeUnits).toBe(0)
  })

  it('never retroactively credits previously produced NODE if the Wallet address later happens to match', () => {
    const started = run(readyState(), 'unmatched-address')
    const produced = advanceGameState(started.state, 1000)
    const producedProcess = produced.process.processes[0] as NodeMinerProcess
    expect(producedProcess.producedNodeUnits).toBe(100)
    expect(produced.nodeWallet.balanceNodeUnits).toBe(0)

    // The represented Wallet address happens to start matching the Miner's already-configured address.
    const walletNowMatches: GameState = { ...produced, nodeWallet: { ...produced.nodeWallet, address: 'unmatched-address' } }
    const further = advanceGameState(walletNowMatches, 1000)
    const furtherProcess = further.process.processes[0] as NodeMinerProcess
    // Only the newly produced NODE from this next interval may credit; the earlier 100 units stay uncredited forever.
    expect(furtherProcess.producedNodeUnits).toBe(200)
    expect(furtherProcess.creditedNodeUnits).toBe(100)
    expect(further.nodeWallet.balanceNodeUnits).toBe(100)
  })

  it('leaves the Dollar Wallet balance completely unaffected by NODE mining', () => {
    const started = run(readyState())
    const advanced = advanceGameState(started.state, 10_000)
    expect(advanced.wallet).toEqual(started.state.wallet)
    expect(advanced.wallet).toEqual({ balance: 1250 })
  })

  it('never reads NodeScan computeClass or Discovery as economic truth', () => {
    const state = readyState()
    const enhancedDevice: DiscoveredDeviceSnapshot = {
      id: 'host-lan-001', address: '198.51.100.47', scope: 'lan', servicesObserved: false, services: [],
      inspect: { networkStatus: 'ONLINE', deviceKind: 'server', enhanced: { firmware: { name: 'RACK-OS', version: '1.0' }, computeClass: 'HIGH' } },
    }
    const withDiscovery: GameState = { ...state, discovery: { ...state.discovery, devices: [enhancedDevice] } }

    const withProcess = advanceGameState(run(withDiscovery).state, 1000).process.processes[0] as NodeMinerProcess
    const withoutProcess = advanceGameState(run(state).state, 1000).process.processes[0] as NodeMinerProcess
    expect(withProcess.workRemainder).toBe(withoutProcess.workRemainder)
    expect(withProcess.producedNodeUnits).toBe(withoutProcess.producedNodeUnits)
  })
})

describe('NODE Miner STOP', () => {
  it('removes the Process and immediately releases RAM and CPU allocation', () => {
    const state = readyState()
    const started = run(state)
    const usageBefore = deriveResourceUsage(state.player.localDevice, state.process)
    const stopped = stopNodeMiner(started.state, started.processId)
    expect(stopped.status).toBe('stopped')
    expect(stopped.state.process.processes).toHaveLength(0)
    const usageAfter = deriveResourceUsage(stopped.state.player.localDevice, stopped.state.process)
    expect(usageAfter.availableRamMiB).toBe(usageBefore.availableRamMiB)
    expect(usageAfter.processCpuLoad).toBe(0)
  })

  it('preserves already-credited NODE and generates no hidden final reward', () => {
    const started = run(readyState())
    const produced = advanceGameState(started.state, 1000)
    expect(produced.nodeWallet.balanceNodeUnits).toBe(100)
    const stopped = stopNodeMiner(produced, produced.process.processes[0].id)
    expect(stopped.state.nodeWallet.balanceNodeUnits).toBe(100)
    expect(stopped.state.process.processes).toHaveLength(0)
  })

  it('does not rewind Process ID progression, so a later RUN receives a new identity', () => {
    const started = run(readyState())
    const stopped = stopNodeMiner(started.state, started.processId)
    const restarted = run(stopped.state)
    expect(started.processId).toBe('process-0001')
    expect(restarted.processId).toBe('process-0002')
    expect(restarted.state.process.nextId).toBe(3)
  })

  it('is a no-op for an unknown or already-stopped Process ID', () => {
    const state = readyState()
    const result = stopNodeMiner(state, 'process-9999')
    expect(result.status).toBe('not_found')
    expect(result.state).toBe(state)
  })

  it('cannot remove a Miner executed by another represented Device', () => {
    const state = readyState()
    const foreignMiner: NodeMinerProcess = {
      kind: 'node_miner', id: 'process-0001', label: 'NODE MINER', executorDeviceId: 'device-srv-01',
      status: 'running', ramRequiredMiB: NODE_MINER_RAM_REQUIRED_MIB, programId: 'node-miner',
      releaseId: 'node-miner-1.0', payoutAddress: state.nodeWallet.address, producedNodeUnits: 7, creditedNodeUnits: 4, workRemainder: 25,
    }
    const withForeign: GameState = { ...state, process: { nextId: 2, processes: [foreignMiner] } }

    const result = stopNodeMiner(withForeign, foreignMiner.id)

    expect(result.status).toBe('not_found')
    expect(result.state).toBe(withForeign)
    expect(result.state.process).toEqual({ nextId: 2, processes: [foreignMiner] })
    expect(result.state.nodeWallet.balanceNodeUnits).toBe(state.nodeWallet.balanceNodeUnits)
  })
})

describe('atomic NODE unit denomination', () => {
  it('defines 1 NODE as 1,000,000 atomic NODE units', () => {
    expect(NODE_UNITS_PER_NODE).toBe(1_000_000)
  })
})

describe('NODE Miner CLI availability', () => {
  it('is unavailable before installation, even with a same-named local file that is not a real supported executable', () => {
    const base = createInitialGameState()
    expect(isNodeMinerAvailable(base.player.localDevice)).toBe(false)
    expect(findNodeMinerExecutable(base.player.localDevice.filesystem)).toBeUndefined()
  })

  it('becomes available only once the package is installed, producing the deterministic executable at the installed path', () => {
    const base = createInitialGameState()
    const installed = installLocalSoftwarePackage(base, '/home/user/downloads/node-miner-1.0.pkg')
    if (installed.status !== 'installed') throw new Error(installed.status)
    expect(isNodeMinerAvailable(installed.state.player.localDevice)).toBe(true)
    const executable = findNodeMinerExecutable(installed.state.player.localDevice.filesystem)
    expect(executable?.path).toBe(NODE_MINER_INSTALLED_EXECUTABLE_PATH)
    expect(installed.state.process.processes).toHaveLength(0)
  })

  it('becomes unavailable again, without conjuring the Process, once the installed executable is deleted', () => {
    const base = createInitialGameState()
    const installed = installLocalSoftwarePackage(base, '/home/user/downloads/node-miner-1.0.pkg')
    if (installed.status !== 'installed') throw new Error(installed.status)
    const withoutExecutable: GameState = {
      ...installed.state,
      player: {
        ...installed.state.player,
        localDevice: {
          ...installed.state.player.localDevice,
          filesystem: { ...installed.state.player.localDevice.filesystem, files: installed.state.player.localDevice.filesystem.files.filter((file) => file.path !== NODE_MINER_INSTALLED_EXECUTABLE_PATH) },
        },
      },
    }
    expect(isNodeMinerAvailable(withoutExecutable.player.localDevice)).toBe(false)
    expect(startNodeMiner(withoutExecutable, NODE_MINER_INSTALLED_EXECUTABLE_PATH, 'addr').status).toBe('source_not_found')
  })
})
