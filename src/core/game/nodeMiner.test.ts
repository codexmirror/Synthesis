import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { advanceGameState } from './gameAdvancement'
import { deriveResourceUsage } from './processes'
import { installLocalSoftwarePackage } from './softwareInstallation'
import { listDirectory, readTextFile } from './filesystem'
import {
  findNodeMinerExecutable, findRunningLocalNodeMiner, findRunningNodeMiner, isNodeMinerAvailable, NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS,
  NODE_MINER_1_0_DEVELOPER_SHARE_PERCENT, NODE_MINER_INSTALLED_EXECUTABLE_PATH,
  NODE_MINER_RAM_REQUIRED_MIB, NODE_UNITS_PER_NODE, payoutLocalNodeMiner, payoutNodeMiner, retargetLocalNodeMinerPayout, retargetNodeMinerPayout, startNodeMiner, startRemoteNodeMiner, stopNodeMiner, stopRemoteNodeMiner,
} from './nodeMiner'
import { NODE_MINER_PAYOUT_LOG_CAPACITY, NODE_MINER_PAYOUT_LOG_HEADER, NODE_MINER_PAYOUT_LOG_PATH, recordNodeMinerPayout } from './nodeMinerPayoutLog'
import { connectRemoteFromObservation, disconnectRemoteSession } from './remoteSession'
import { findNodeAccountByAddress } from './nodeEconomy'
import type { DiscoveredDeviceSnapshot, ExecutableFile, GameState, NetworkHost, NodeMinerProcess, TextFile } from './types'

const LOCAL_MINER_PATH = '/home/user/downloads/node-miner-1.0.bin'

/**
 * A local Device that already owns a downloaded NODE Miner copy (independent
 * of the canonical installed package/executable flow exercised elsewhere),
 * with baseline CPU load forced to zero so allocated-compute arithmetic in
 * these tests lands on clean whole numbers.
 */
function readyState(): GameState {
  const base = createInitialGameState()
  const minerFile: ExecutableFile = { kind: 'executable', id: 'file-0006', path: LOCAL_MINER_PATH, programId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
  return {
    ...base,
    player: {
      ...base.player,
      localDevice: {
        ...base.player.localDevice,
        filesystem: { nextFileId: 7, files: [...base.player.localDevice.filesystem.files, minerFile] },
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

function miner(state: GameState): NodeMinerProcess {
  return state.process.processes.find((process): process is NodeMinerProcess => process.kind === 'node_miner')!
}

function developerBalance(state: GameState): number {
  return findNodeAccountByAddress(state.nodeEconomy, NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS)!.balanceNodeUnits
}

function payoutLog(state: GameState): TextFile | undefined {
  return state.player.localDevice.filesystem.files.find((file): file is TextFile => file.kind === 'text' && file.path === NODE_MINER_PAYOUT_LOG_PATH)
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
    const other = { kind: 'executable' as const, id: 'file-0004', path: '/home/user/downloads/other.bin', programId: 'other-program', releaseId: 'other-1.0', buildId: 'build-fixture-v0', name: 'Other Tool', version: '1.0', sizeBytes: 100 }
    const withOther: GameState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 5, files: [...state.player.localDevice.filesystem.files, other] } } } }
    const result = startNodeMiner(withOther, other.path, 'addr')
    expect(result.status).toBe('unsupported_program')
    expect(result.state.process.processes).toHaveLength(0)
  })

  it('rejects an unknown release that shares the NODE Miner program identity', () => {
    const state = readyState()
    const future = { kind: 'executable' as const, id: 'file-0004', path: '/home/user/downloads/node-miner-2.0.bin', programId: 'node-miner' as const, releaseId: 'node-miner-2.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '2.0', sizeBytes: 100 }
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
      buildId: 'build-fixture-v0', payoutAddress: 'player-chosen-address',
      producedNodeUnits: 0,
      payoutNodeUnits: 0,
      developerFeeNodeUnits: 0,
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
    expect(miner(advanced).producedNodeUnits).toBe(100)
    expect(miner(advanced).payoutNodeUnits).toBe(0)
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
    const oneSecond = miner(afterOneSecond)
    expect(oneSecond.producedNodeUnits).toBe(100)
    expect(oneSecond.workRemainder).toBeCloseTo(0)

    const afterPartialSecond = advanceGameState(started.state, 505)
    const partialSecond = miner(afterPartialSecond)
    expect(partialSecond.producedNodeUnits).toBe(50)
    expect(partialSecond.workRemainder).toBeCloseTo(0.5)
  })

  it('never rounds allocated compute per tick and is tick-size independent', () => {
    const started = run(readyState())
    const once = advanceGameState(started.state, 1000)
    const chunked = advanceGameState(advanceGameState(advanceGameState(advanceGameState(started.state, 250), 250), 250), 250)
    const onceProcess = miner(once)
    const chunkedProcess = miner(chunked)
    expect(chunkedProcess.producedNodeUnits).toBe(onceProcess.producedNodeUnits)
    expect(chunkedProcess.workRemainder).toBeCloseTo(onceProcess.workRemainder)
    expect(chunked.nodeWallet.balanceNodeUnits).toBe(once.nodeWallet.balanceNodeUnits)
  })

  it('credits the represented NODE Wallet only when the configured payout address exactly matches', () => {
    const base = readyState()
    const matched = run(base, base.nodeWallet.address)
    const advancedMatched = advanceGameState(matched.state, 1000)
    // The configured payout allocation, not gross production: this release keeps a tenth for itself.
    expect(advancedMatched.nodeWallet.balanceNodeUnits).toBe(0)
    const matchedProcess = miner(advancedMatched)
    expect(matchedProcess.producedNodeUnits).toBe(100)
    expect(matchedProcess.payoutNodeUnits).toBe(0)

    const unmatched = run(readyState(), 'some-other-fictional-address')
    const advancedUnmatched = advanceGameState(unmatched.state, 1000)
    expect(advancedUnmatched.nodeWallet.balanceNodeUnits).toBe(0)
    const unmatchedProcess = miner(advancedUnmatched)
    expect(unmatchedProcess.producedNodeUnits).toBe(100)
    expect(unmatchedProcess.payoutNodeUnits).toBe(0)
  })

  it('never falls back to crediting the represented Wallet when the address does not match', () => {
    const unmatched = run(readyState(), 'nobody-owns-this-address')
    const advanced = advanceGameState(unmatched.state, 10_000)
    expect(advanced.nodeWallet.balanceNodeUnits).toBe(0)
    expect(advanced.nodeWallet.activity.records).toHaveLength(0)
    const process = miner(advanced)
    expect(process.producedNodeUnits).toBeGreaterThan(0)
    expect(process.payoutNodeUnits).toBe(0)
  })

  it('never retroactively credits previously produced NODE if the Wallet address later happens to match', () => {
    const started = run(readyState(), 'unmatched-address')
    const produced = advanceGameState(started.state, 10_000)
    const producedProcess = miner(produced)
    expect(producedProcess.producedNodeUnits).toBe(1000)
    expect(produced.nodeWallet.balanceNodeUnits).toBe(0)

    // The represented Wallet address happens to start matching the Miner's already-configured address.
    const walletNowMatches: GameState = { ...produced, nodeWallet: { ...produced.nodeWallet, address: 'unmatched-address' } }
    const further = advanceGameState(walletNowMatches, 10_000)
    const furtherProcess = miner(further)
    // Only the newly allocated payout from this next interval may credit; the earlier allocation stays uncredited forever.
    expect(furtherProcess.producedNodeUnits).toBe(2000)
    expect(furtherProcess.payoutNodeUnits).toBe(0)
    expect(further.nodeWallet.balanceNodeUnits).toBe(0)
  })

  it('leaves the Dollar Wallet balance completely unaffected by NODE mining', () => {
    const started = run(readyState())
    const advanced = advanceGameState(started.state, 10_000)
    expect(advanced.dollarFinance).toEqual(started.state.dollarFinance)
  })

  it('never reads NodeScan computeClass or Discovery as economic truth', () => {
    const state = readyState()
    const enhancedDevice: DiscoveredDeviceSnapshot = {
      id: 'host-lan-001', address: '198.51.100.47', scope: 'lan', servicesObserved: false, services: [],
      inspect: { networkStatus: 'ONLINE', deviceKind: 'server', enhanced: { firmware: { name: 'RACK-OS', version: '1.0' }, computeClass: 'HIGH' } },
    }
    const withDiscovery: GameState = { ...state, discovery: { ...state.discovery, devices: [enhancedDevice] } }

    const withProcess = miner(advanceGameState(run(withDiscovery).state, 1000))
    const withoutProcess = miner(advanceGameState(run(state).state, 1000))
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
    expect(stopped.state.recentActivity.entries).toEqual([{ kind: 'process', id: started.processId, process: expect.objectContaining({ payoutAddress: state.nodeWallet.address, producedNodeUnits: 0, payoutNodeUnits: 0 }) }])
    const usageAfter = deriveResourceUsage(stopped.state.player.localDevice, stopped.state.process)
    expect(usageAfter.availableRamMiB).toBe(usageBefore.availableRamMiB)
    expect(usageAfter.processCpuLoad).toBe(0)
  })

  it('preserves already-credited NODE and generates no hidden final reward', () => {
    const started = run(readyState())
    const produced = advanceGameState(started.state, 10_000)
    expect(produced.nodeWallet.balanceNodeUnits).toBe(0)
    const stopped = stopNodeMiner(produced, produced.process.processes[0].id)
    expect(stopped.state.nodeWallet.balanceNodeUnits).toBe(670)
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
      releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', payoutAddress: state.nodeWallet.address, payoutSegment: 1, producedNodeUnits: 7, payoutNodeUnits: 6, developerFeeNodeUnits: 0, segmentPayoutNodeUnits: 6, segmentDeveloperFeeNodeUnits: 0, workRemainder: 25,
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

  it('becomes available only once the installation Process completes, producing the deterministic executable at the installed path', () => {
    const base = createInitialGameState()
    const started = installLocalSoftwarePackage(base, '/home/user/downloads/node-miner-1.0.pkg')
    if (started.status !== 'started') throw new Error(started.status)
    expect(isNodeMinerAvailable(started.state.player.localDevice)).toBe(false)
    const done = advanceGameState(started.state, 20_000)
    expect(isNodeMinerAvailable(done.player.localDevice)).toBe(true)
    const executable = findNodeMinerExecutable(done.player.localDevice.filesystem)
    expect(executable?.path).toBe(NODE_MINER_INSTALLED_EXECUTABLE_PATH)
  })

  it('becomes unavailable again, without conjuring the Process, once the installed executable is deleted', () => {
    const base = createInitialGameState()
    const started = installLocalSoftwarePackage(base, '/home/user/downloads/node-miner-1.0.pkg')
    if (started.status !== 'started') throw new Error(started.status)
    const installed = advanceGameState(started.state, 20_000)
    const withoutExecutable: GameState = {
      ...installed,
      player: {
        ...installed.player,
        localDevice: {
          ...installed.player.localDevice,
          filesystem: { ...installed.player.localDevice.filesystem, files: installed.player.localDevice.filesystem.files.filter((file) => file.path !== NODE_MINER_INSTALLED_EXECUTABLE_PATH) },
        },
      },
    }
    expect(isNodeMinerAvailable(withoutExecutable.player.localDevice)).toBe(false)
    expect(startNodeMiner(withoutExecutable, NODE_MINER_INSTALLED_EXECUTABLE_PATH, 'addr').status).toBe('source_not_found')
  })
})

describe('NODE Miner 1.0 manual settlement', () => {
  it('creates no payout artifact before a real settlement, then creates it at the application-owned path', () => {
    const accrued = advanceGameState(run(readyState()).state, 1_000)
    expect(payoutLog(accrued)).toBeUndefined()
    expect(listDirectory(accrued.player.localDevice.filesystem, '/home/user/apps/node-miner/logs')).toEqual({ status: 'not_found' })

    const paid = payoutLocalNodeMiner(accrued)
    expect(NODE_MINER_PAYOUT_LOG_PATH).toBe('/home/user/apps/node-miner/logs/payout.log')
    expect(payoutLog(paid.state)).toMatchObject({ kind: 'text', path: NODE_MINER_PAYOUT_LOG_PATH })
  })

  it('settles all accrued units, leaves the Process running, and no-ops when nothing is unpaid', () => {
    const accrued = advanceGameState(run(readyState()).state, 24_300)
    const paid = payoutLocalNodeMiner(accrued)
    expect(paid).toMatchObject({ status: 'paid', settledGrossNodeUnits: 2430, payoutNodeUnits: 1629 })
    expect(miner(paid.state)).toMatchObject({ producedNodeUnits: 2430, payoutNodeUnits: 1629, developerFeeNodeUnits: 801, status: 'running' })
    expect(paid.state.nodeWallet.balanceNodeUnits).toBe(1629)
    expect(developerBalance(paid.state)).toBe(801)
    expect(payoutLog(paid.state)?.content).toContain('gross=2430 payout=1629')
    expect(payoutLocalNodeMiner(paid.state)).toMatchObject({ status: 'nothing_unpaid', state: paid.state })
  })

  it('uses cumulative allocation so payout chunking cannot change developer-fee rounding', () => {
    const started = run(readyState()).state
    const once = payoutLocalNodeMiner(advanceGameState(started, 10_000)).state
    let many = started
    for (let index = 0; index < 100; index += 1) many = payoutLocalNodeMiner(advanceGameState(many, 100)).state
    expect(miner(many)).toMatchObject({ payoutNodeUnits: miner(once).payoutNodeUnits, developerFeeNodeUnits: miner(once).developerFeeNodeUnits })
    expect(many.nodeWallet.balanceNodeUnits).toBe(once.nodeWallet.balanceNodeUnits)
    expect(developerBalance(many)).toBe(developerBalance(once))
  })

  it('routes later settlement to a newly configured address without moving past settlement', () => {
    const first = payoutLocalNodeMiner(advanceGameState(run(readyState()).state, 10_000)).state
    const oldBalance = first.nodeWallet.balanceNodeUnits
    const retargeted = retargetLocalNodeMinerPayout(first, 'node-addr-foreign').state
    const second = payoutLocalNodeMiner(advanceGameState(retargeted, 10_000)).state
    expect(second.nodeWallet.balanceNodeUnits).toBe(oldBalance)
    expect(miner(second)).toMatchObject({ producedNodeUnits: 2000, payoutNodeUnits: 1340, developerFeeNodeUnits: 660 })
    expect(payoutLog(second)?.content).toContain('payout-address=node-addr-foreign')
  })

  it('rewrites one segment under the same file identity and retains only the newest bounded segments', () => {
    const initial = readyState().player.localDevice.filesystem
    const record = (payoutSegment: number, grossNodeUnits = payoutSegment) => ({
      processId: 'process-log-test', payoutSegment, grossNodeUnits,
      payoutAddress: `node-address-${payoutSegment}`, payoutNodeUnits: grossNodeUnits,
    })
    const first = recordNodeMinerPayout(initial, record(1))
    const rewritten = recordNodeMinerPayout(first, record(1, 99))
    expect(rewritten.files.find(({ path }) => path === NODE_MINER_PAYOUT_LOG_PATH)?.id)
      .toBe(first.files.find(({ path }) => path === NODE_MINER_PAYOUT_LOG_PATH)?.id)
    expect((rewritten.files.find(({ path }) => path === NODE_MINER_PAYOUT_LOG_PATH) as TextFile).content).toContain('gross=99')

    let retained = rewritten
    for (let segment = 2; segment <= NODE_MINER_PAYOUT_LOG_CAPACITY + 2; segment += 1) {
      retained = recordNodeMinerPayout(retained, record(segment))
    }
    const lines = (retained.files.find(({ path }) => path === NODE_MINER_PAYOUT_LOG_PATH) as TextFile).content.split('\n')
    expect(lines[0]).toBe(NODE_MINER_PAYOUT_LOG_HEADER)
    expect(lines.slice(1)).toHaveLength(NODE_MINER_PAYOUT_LOG_CAPACITY)
    expect(lines.join('\n')).not.toContain('process-log-test#1 ')
    expect(lines.join('\n')).toContain(`process-log-test#${NODE_MINER_PAYOUT_LOG_CAPACITY + 2} `)
  })

  it('does not overwrite an unrelated artifact occupying the application-owned log path', () => {
    const base = readyState()
    const occupant: TextFile = { kind: 'text', id: 'file-log-occupant', path: NODE_MINER_PAYOUT_LOG_PATH, content: 'unrelated truth' }
    const occupied: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice,
      filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, occupant] },
    } } }
    const paid = payoutLocalNodeMiner(advanceGameState(run(occupied).state, 1_000))
    expect(paid.status).toBe('paid')
    expect(paid.state.player.localDevice.filesystem.files.find(({ id }) => id === occupant.id)).toEqual(occupant)
  })

  it('keeps the payout artifact after STOP removes the completed Miner Process', () => {
    const running = run(readyState())
    const stopped = stopNodeMiner(advanceGameState(running.state, 1_000), running.processId)
    expect(stopped.status).toBe('stopped')
    expect(payoutLog(stopped.state)).toMatchObject({ path: NODE_MINER_PAYOUT_LOG_PATH })
    expect(findRunningLocalNodeMiner(stopped.state)).toBeUndefined()
  })
})

const REMOTE_DEVICE_ID = 'host-lan-001'
const REMOTE_MINER_PATH = '/usr/local/bin/node-miner'

function remoteMinerExecutable(path: string = REMOTE_MINER_PATH): ExecutableFile {
  return { kind: 'executable', id: 'file-0009', path, programId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
}

/**
 * The player operating srv-01 through a real Session, with a supported NODE
 * Miner executable already present on that Device's own filesystem and its
 * baseline CPU load forced to zero so allocated-compute arithmetic lands on
 * whole numbers. `alterHost` is applied *after* the Session is established,
 * so a test can represent a target that went offline while operating it.
 */
function operatingState(alterHost?: (host: NetworkHost) => NetworkHost): GameState {
  const base = readyState()
  const host: NetworkHost = {
    ...base.world.network.hosts[0],
    filesystem: { nextFileId: 10, files: [...base.world.network.hosts[0].filesystem!.files, remoteMinerExecutable()] },
    runtime: { baselineCpuLoad: 0, baselineRamUsage: 0 },
  }
  const authorized: GameState = {
    ...base,
    deviceAccess: { nextId: 2, established: [{ id: 'access-remote-run', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
    world: { ...base.world, network: { ...base.world.network, hosts: [host, ...base.world.network.hosts.slice(1)] } },
  }
  const connected = connectRemoteFromObservation(authorized, { targetDeviceId: host.id, address: host.ip }).state
  if (!alterHost) return connected
  return { ...connected, world: { ...connected.world, network: { ...connected.world.network, hosts: [alterHost(host), ...connected.world.network.hosts.slice(1)] } } }
}

function runRemote(state: GameState, payoutAddress: string = state.nodeWallet.address, path: string = REMOTE_MINER_PATH) {
  const result = startRemoteNodeMiner(state, path, payoutAddress)
  if (result.status !== 'started') throw new Error(result.status)
  return result
}

function remoteHost(state: GameState): NetworkHost {
  return state.world.network.hosts.find(({ id }) => id === REMOTE_DEVICE_ID)!
}

function remotePayoutLog(state: GameState): TextFile | undefined {
  return remoteHost(state).filesystem!.files.find((file): file is TextFile => file.kind === 'text' && file.path === NODE_MINER_PAYOUT_LOG_PATH)
}


describe('remote NODE Miner RUN admission', () => {
  it('executes on the Device the Session actually operates, never on the local Device', () => {
    const started = runRemote(operatingState())
    const process = findRunningNodeMiner(started.state, REMOTE_DEVICE_ID)!

    expect(process.id).toBe(started.processId)
    expect(process.executorDeviceId).toBe(REMOTE_DEVICE_ID)
    expect(process.programId).toBe('node-miner')
    expect(process.releaseId).toBe('node-miner-1.0')
    expect(findRunningLocalNodeMiner(started.state)).toBeUndefined()
    // The Session admitted it; nothing about the Process references the Session or its access.
    expect(process).not.toHaveProperty('sessionId')
    expect(process).not.toHaveProperty('accessId')
  })

  it('resolves its executor from the canonical operating context rather than any supplied identity', () => {
    // The same call, with the Session pointing at srv-02 instead, admits onto srv-02.
    const base = operatingState()
    const other = base.world.network.hosts[1]
    const retargetedSession: GameState = {
      ...base,
      deviceAccess: { nextId: 2, established: [{ id: 'access-remote-run', sourceDeviceId: base.player.localDevice.id, targetDeviceId: other.id, viaServiceId: 'service-ssh-002', privilege: 'USER' }] },
      world: { ...base.world, network: { ...base.world.network, hosts: [base.world.network.hosts[0], { ...other, filesystem: { nextFileId: 10, files: [...other.filesystem!.files, remoteMinerExecutable()] } }, ...base.world.network.hosts.slice(2)] } },
    }

    const started = runRemote(retargetedSession)

    expect(findRunningNodeMiner(started.state, other.id)?.id).toBe(started.processId)
    expect(findRunningNodeMiner(started.state, REMOTE_DEVICE_ID)).toBeUndefined()
  })

  it('runs a copied executable without matching InstalledSoftware, even where the Device represents no inventory at all', () => {
    const state = operatingState((host) => ({
      ...host,
      installedSoftware: undefined,
      filesystem: { nextFileId: 11, files: [...host.filesystem!.files, remoteMinerExecutable('/tmp/copied-miner')] },
    }))
    expect(remoteHost(state).installedSoftware).toBeUndefined()

    const started = runRemote(state, state.nodeWallet.address, '/tmp/copied-miner')

    expect(findRunningNodeMiner(started.state, REMOTE_DEVICE_ID)?.id).toBe(started.processId)
  })

  it('rejects a missing, wrong-kind or unsupported remote artifact atomically', () => {
    const state = operatingState((host) => ({
      ...host,
      filesystem: { nextFileId: 12, files: [
        ...host.filesystem!.files,
        { kind: 'executable', id: 'file-0011', path: '/usr/local/bin/other', programId: 'other-program', releaseId: 'other-1.0', buildId: 'build-fixture-v0', name: 'Other', version: '1.0', sizeBytes: 10 },
      ] },
    }))

    for (const [path, status] of [['/srv/missing', 'source_not_found'], ['/srv', 'source_not_file'], ['relative', 'invalid_path'], ['/srv/readme.txt', 'not_executable'], ['/usr/local/bin/other', 'unsupported_program']] as const) {
      const result = startRemoteNodeMiner(state, path, 'addr')
      expect(result.status).toBe(status)
      expect(result.state).toBe(state)
    }
    // The local Device's own copy is never an execution source for the remote Device.
    expect(startRemoteNodeMiner(state, LOCAL_MINER_PATH, 'addr').status).toBe('source_not_found')
  })

  it('requires an explicit non-empty payout address', () => {
    const state = operatingState()
    const result = startRemoteNodeMiner(state, REMOTE_MINER_PATH, '   ')
    expect(result.status).toBe('invalid_payout_address')
    expect(result.state).toBe(state)
  })

  it('fails admission without a resolvable operating context', () => {
    const state = readyState()
    const result = startRemoteNodeMiner(state, REMOTE_MINER_PATH, 'addr')
    expect(result.status).toBe('session_unavailable')
    expect(result.state).toBe(state)
  })

  it('fails admission when the target went offline while the Session was live', () => {
    const state = operatingState((host) => ({ ...host, operational: { lifecycle: 'RUNNING', connectivity: 'DISCONNECTED' } }))
    const result = startRemoteNodeMiner(state, REMOTE_MINER_PATH, 'addr')
    expect(result.status).toBe('target_offline')
    expect(result.state).toBe(state)
  })

  it('fails admission on a target that represents no executable runtime', () => {
    const state = operatingState((host) => ({ ...host, hardware: undefined }))
    const result = startRemoteNodeMiner(state, REMOTE_MINER_PATH, 'addr')
    expect(result.status).toBe('target_not_executable')
    expect(result.state).toBe(state)
  })

  it('admits RAM against the target Device rather than the local Device', () => {
    const state = operatingState((host) => ({ ...host, hardware: { ...host.hardware!, ram: { name: '256 MB', capacityMiB: 256 } } }))
    const result = startRemoteNodeMiner(state, REMOTE_MINER_PATH, 'addr')

    expect(result).toMatchObject({ status: 'insufficient_memory', requiredMiB: NODE_MINER_RAM_REQUIRED_MIB, availableMiB: 256 })
    expect(result.state).toBe(state)
    // node-01 has ample RAM: the rejection is the target's truth, not the local Device's.
    expect(deriveResourceUsage(state.player.localDevice, state.process).availableRamMiB).toBeGreaterThan(NODE_MINER_RAM_REQUIRED_MIB)
  })

  it('rejects a duplicate Miner on the same executor while allowing a local Miner alongside it', () => {
    const remote = runRemote(operatingState())
    expect(startRemoteNodeMiner(remote.state, REMOTE_MINER_PATH, 'addr').status).toBe('already_running')

    const local = run(remote.state)
    expect(findRunningLocalNodeMiner(local.state)?.id).toBe(local.processId)
    expect(findRunningNodeMiner(local.state, REMOTE_DEVICE_ID)?.id).toBe(remote.processId)
    expect(local.processId).not.toBe(remote.processId)
  })

  it("reserves each Miner's RAM on its own executor alone", () => {
    const both = run(runRemote(operatingState()).state).state
    expect(deriveResourceUsage(both.player.localDevice, both.process).processRamMiB).toBe(NODE_MINER_RAM_REQUIRED_MIB)
    expect(deriveResourceUsage({ id: REMOTE_DEVICE_ID, hardware: remoteHost(both).hardware!, runtime: remoteHost(both).runtime! }, both.process).processRamMiB).toBe(NODE_MINER_RAM_REQUIRED_MIB)
  })
})

describe('remote NODE Miner runtime', () => {
  it("produces from the target Device's own compute, independently of the local Miner", () => {
    // srv-01: 160 compute at zero baseline. node-01: 100 compute at zero baseline.
    const advanced = advanceGameState(run(runRemote(operatingState()).state).state, 1_000)

    expect(findRunningNodeMiner(advanced, REMOTE_DEVICE_ID)?.producedNodeUnits).toBe(160)
    expect(findRunningLocalNodeMiner(advanced)?.producedNodeUnits).toBe(100)
  })

  it("shares the target Device's compute with that Device's other running work", () => {
    const started = runRemote(operatingState())
    const contended: GameState = { ...started.state, process: { ...started.state.process, processes: [
      ...started.state.process.processes,
      { kind: 'generic', id: 'process-other', label: 'OTHER WORK', executorDeviceId: REMOTE_DEVICE_ID, status: 'running', workRequired: 1_000_000, workCompleted: 0, ramRequiredMiB: 64 },
    ] } }

    const advanced = advanceGameState(contended, 1_000)

    // Half of srv-01's 160 available compute, not the local Device's share.
    expect(findRunningNodeMiner(advanced, REMOTE_DEVICE_ID)?.producedNodeUnits).toBe(80)
  })

  it('keeps running through returning to NODE-OS and through DISCONNECT', () => {
    const started = runRemote(operatingState())
    const disconnected = disconnectRemoteSession(started.state)
    expect(disconnected.state.remoteSession.active).toBeNull()
    expect(disconnected.state.deviceAccess.established).toHaveLength(1)

    const advanced = advanceGameState(disconnected.state, 1_000)
    const process = findRunningNodeMiner(advanced, REMOTE_DEVICE_ID)

    expect(process?.id).toBe(started.processId)
    expect(process?.producedNodeUnits).toBe(160)
  })
})

describe('remote NODE Miner manual settlement', () => {
  it('settles on the operated executor and owns the payout log remotely', () => {
    const accrued = advanceGameState(runRemote(operatingState()).state, 6_250)
    const paid = payoutNodeMiner(accrued)
    expect(paid).toMatchObject({ status: 'paid', settledGrossNodeUnits: 1000, payoutNodeUnits: 670 })
    expect(paid.state.nodeWallet.balanceNodeUnits).toBe(670)
    expect(remotePayoutLog(paid.state)?.content).toContain('gross=1000 payout=670')
    expect(payoutLog(paid.state)).toBeUndefined()
  })
})

describe('remote NODE Miner STOP', () => {
  it("removes only the operated Device's Miner and immediately releases its CPU and RAM", () => {
    const remote = runRemote(operatingState())
    const both = run(remote.state)
    const producing = advanceGameState(both.state, 10_000)

    const stopped = stopRemoteNodeMiner(producing, remote.processId)
    expect(stopped.status).toBe('stopped')

    expect(findRunningNodeMiner(stopped.state, REMOTE_DEVICE_ID)).toBeUndefined()
    expect(findRunningLocalNodeMiner(stopped.state)?.id).toBe(both.processId)
    const host = remoteHost(stopped.state)
    expect(deriveResourceUsage({ id: REMOTE_DEVICE_ID, hardware: host.hardware!, runtime: host.runtime! }, stopped.state.process)).toMatchObject({ processRamMiB: 0, processCpuLoad: 0 })
    // No hidden final mining work or payout, and the Device keeps its own payout artifact.
    expect(stopped.state.nodeWallet.balanceNodeUnits).toBeGreaterThan(producing.nodeWallet.balanceNodeUnits)
    expect(developerBalance(stopped.state)).toBeGreaterThan(developerBalance(producing))
    expect(remotePayoutLog(stopped.state)?.content).toContain('gross=1600')
  })

  it("archives no foreign runtime into the local Device's Recent Activity", () => {
    const remote = runRemote(operatingState())
    const stopped = stopRemoteNodeMiner(advanceGameState(remote.state, 10_000), remote.processId).state

    expect(stopped.recentActivity.entries).toEqual([])
    expect(stopped.process.processes).toEqual([])
  })

  it("cannot stop the player's own local Miner, and local STOP cannot stop the remote one", () => {
    const remote = runRemote(operatingState())
    const both = run(remote.state).state

    expect(stopRemoteNodeMiner(both, findRunningLocalNodeMiner(both)!.id)).toEqual({ status: 'not_found', state: both })
    expect(stopNodeMiner(both, remote.processId)).toEqual({ status: 'not_found', state: both })
  })

  it('requires a resolvable operating context', () => {
    const remote = runRemote(operatingState())
    const disconnected = disconnectRemoteSession(remote.state).state

    const result = stopRemoteNodeMiner(disconnected, remote.processId)
    expect(result.status).toBe('session_unavailable')
    expect(findRunningNodeMiner(result.state, REMOTE_DEVICE_ID)?.id).toBe(remote.processId)
  })
})
