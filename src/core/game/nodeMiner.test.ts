import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { advanceGameState } from './gameAdvancement'
import { deriveResourceUsage } from './processes'
import { installLocalSoftwarePackage } from './softwareInstallation'
import { listDirectory, readTextFile } from './filesystem'
import {
  findNodeMinerExecutable, findRunningLocalNodeMiner, findRunningNodeMiner, isNodeMinerAvailable, NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS,
  NODE_MINER_1_0_DEVELOPER_SHARE_PERCENT, NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS, NODE_MINER_INSTALLED_EXECUTABLE_PATH,
  NODE_MINER_RAM_REQUIRED_MIB, NODE_UNITS_PER_NODE, retargetLocalNodeMinerPayout, retargetNodeMinerPayout, startNodeMiner, startRemoteNodeMiner, stopNodeMiner, stopRemoteNodeMiner,
} from './nodeMiner'
import { NODE_MINER_PAYOUT_LOG_CAPACITY, NODE_MINER_PAYOUT_LOG_HEADER, NODE_MINER_PAYOUT_LOG_PATH } from './nodeMinerPayoutLog'
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
    expect(process.payoutNodeUnits).toBeGreaterThan(0)
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
    expect(furtherProcess.payoutNodeUnits).toBe(1340)
    expect(further.nodeWallet.balanceNodeUnits).toBe(670)
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
    expect(produced.nodeWallet.balanceNodeUnits).toBe(670)
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
      releaseId: 'node-miner-1.0', payoutAddress: state.nodeWallet.address, payoutSegment: 1, producedNodeUnits: 7, payoutNodeUnits: 6, developerFeeNodeUnits: 0, segmentPayoutNodeUnits: 6, segmentDeveloperFeeNodeUnits: 0, workRemainder: 25,
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

describe('unofficial NODE Miner 1.0 payout behavior', () => {
  it('keeps 999 gross units pending without creating a payout event', () => {
    const advanced = advanceGameState(run(readyState()).state, 9_990)
    expect(miner(advanced)).toMatchObject({ producedNodeUnits: 999, payoutNodeUnits: 0, developerFeeNodeUnits: 0 })
    expect(advanced.nodeWallet.balanceNodeUnits).toBe(0)
    expect(advanced.nodeWallet.activity.records).toHaveLength(0)
    expect(payoutLog(advanced)).toBeUndefined()
  })

  it('pays two complete batches from 2,430 gross and leaves 430 pending', () => {
    const advanced = advanceGameState(run(readyState()).state, 24_300)
    expect(NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS).toBe(1_000)
    expect(miner(advanced)).toMatchObject({ producedNodeUnits: 2430, payoutNodeUnits: 1340, developerFeeNodeUnits: 660 })
    expect(advanced.nodeWallet.balanceNodeUnits).toBe(1340)
    expect(developerBalance(advanced)).toBe(660)
    expect(advanced.nodeWallet.activity.records.map(({ amountNodeUnits }) => amountNodeUnits)).toEqual([670, 670])
  })

  it('is represented as an unofficial third-party release through its own package and installed-software provenance', () => {
    const base = createInitialGameState()
    const packageFile = base.player.localDevice.filesystem.files.find((file) => file.kind === 'software_package' && file.productId === 'node-miner')
    expect(packageFile).toMatchObject({ kind: 'software_package', channel: 'unofficial', publisher: 'nm-dev' })

    const started = installLocalSoftwarePackage(base, '/home/user/downloads/node-miner-1.0.pkg')
    if (started.status !== 'started') throw new Error(started.status)
    const installed = advanceGameState(started.state, 20_000)
    expect(installed.player.localDevice.installedSoftware).toContainEqual({
      id: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev',
    })
  })

  it('splits each completed 1,000-unit batch into 670 configured payout and 330 embedded developer fee', () => {
    const started = run(readyState())
    const advanced = advanceGameState(started.state, 10_000)
    const process = miner(advanced)
    expect(NODE_MINER_1_0_DEVELOPER_SHARE_PERCENT).toBe(33)
    // Gross production stays derived from actual allocated compute and is never redefined downward.
    expect(process.producedNodeUnits).toBe(1000)
    expect(process.payoutNodeUnits).toBe(670)
    expect(process.developerFeeNodeUnits).toBe(330)
    expect(process.payoutNodeUnits + process.developerFeeNodeUnits).toBe(process.producedNodeUnits)
    expect(advanced.nodeWallet.balanceNodeUnits).toBe(670)
    expect(developerBalance(advanced)).toBe(330)
  })

  it('allocates identically however the same gross production is chunked across advancement calls', () => {
    const started = run(readyState())
    const once = advanceGameState(started.state, 10_000)
    let chunked = started.state
    for (let index = 0; index < 40; index += 1) chunked = advanceGameState(chunked, 250)

    expect(miner(chunked).producedNodeUnits).toBe(miner(once).producedNodeUnits)
    expect(miner(chunked).payoutNodeUnits).toBe(miner(once).payoutNodeUnits)
    expect(miner(chunked).developerFeeNodeUnits).toBe(miner(once).developerFeeNodeUnits)
    expect(chunked.nodeWallet.balanceNodeUnits).toBe(once.nodeWallet.balanceNodeUnits)
    expect(developerBalance(chunked)).toBe(developerBalance(once))
    expect(chunked.nodeWallet.activity).toEqual(once.nodeWallet.activity)
    expect(payoutLog(chunked)?.content).toBe(payoutLog(once)?.content)
  })

  it('credits nobody when a payout address has multiple represented recipients', () => {
    const base = readyState()
    const collisionAddress = base.nodeWallet.address
    const collided: GameState = { ...base, nodeEconomy: { accounts: [...base.nodeEconomy.accounts, { id: 'node-account-collision', address: collisionAddress, balanceNodeUnits: 0 }] } }
    const advanced = advanceGameState(run(collided, collisionAddress).state, 10_000)
    expect(advanced.nodeWallet.balanceNodeUnits).toBe(0)
    expect(advanced.nodeWallet.activity.records).toHaveLength(0)
    expect(findNodeAccountByAddress(advanced.nodeEconomy, collisionAddress)?.balanceNodeUnits).toBe(0)
  })

  it('credits nobody when duplicate nodeEconomy accounts hold the payout address', () => {
    const base = readyState()
    const address = 'node-addr-duplicate'
    const collided: GameState = { ...base, nodeEconomy: { accounts: [...base.nodeEconomy.accounts,
      { id: 'node-account-collision-a', address, balanceNodeUnits: 0 },
      { id: 'node-account-collision-b', address, balanceNodeUnits: 0 },
    ] } }
    const advanced = advanceGameState(run(collided, address).state, 10_000)
    expect(advanced.nodeEconomy.accounts.filter((account) => account.address === address).map((account) => account.balanceNodeUnits)).toEqual([0, 0])
  })

  it('pays the developer into real represented economic state rather than presentation or log text alone', () => {
    const started = run(readyState())
    const advanced = advanceGameState(started.state, 10_000)
    const account = findNodeAccountByAddress(advanced.nodeEconomy, NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS)
    expect(account).toMatchObject({ id: 'node-account-nm-dev-v0', balanceNodeUnits: 330 })
    // The developer account is a represented recipient with its own stable identity, not the local Wallet.
    expect(account?.id).not.toBe(advanced.nodeWallet.id)
    expect(account?.address).not.toBe(advanced.nodeWallet.address)
  })

  it('still diverts the developer share for a foreign configured address without ever falling back to the local Wallet', () => {
    const started = run(readyState(), 'some-other-fictional-address')
    const advanced = advanceGameState(started.state, 10_000)
    const process = miner(advanced)
    expect(process.producedNodeUnits).toBe(1000)
    expect(process.payoutNodeUnits).toBe(670)
    expect(process.developerFeeNodeUnits).toBe(330)
    expect(developerBalance(advanced)).toBe(330)
    expect(advanced.nodeWallet.balanceNodeUnits).toBe(0)
    expect(advanced.nodeWallet.activity.records).toHaveLength(0)
  })

  it('pays a foreign configured address that a represented account actually holds, leaving the local Wallet untouched', () => {
    const base = readyState()
    const withAccount: GameState = { ...base, nodeEconomy: { accounts: [...base.nodeEconomy.accounts, { id: 'node-account-fixture', address: 'node-addr-fixture', balanceNodeUnits: 0 }] } }
    const advanced = advanceGameState(run(withAccount, 'node-addr-fixture').state, 10_000)
    expect(findNodeAccountByAddress(advanced.nodeEconomy, 'node-addr-fixture')?.balanceNodeUnits).toBe(670)
    expect(developerBalance(advanced)).toBe(330)
    expect(advanced.nodeWallet.balanceNodeUnits).toBe(0)
  })

  it('records only what the local Wallet actually received, with monotonic deterministic record IDs', () => {
    const started = run(readyState())
    const advanced = advanceGameState(advanceGameState(started.state, 10_000), 10_000)
    expect(advanced.nodeWallet.activity.records).toEqual([
      { id: 'node-activity-0001', kind: 'mining_payout', amountNodeUnits: 670 },
      { id: 'node-activity-0002', kind: 'mining_payout', amountNodeUnits: 670 },
    ])
    expect(advanced.nodeWallet.activity.records.reduce((sum, record) => sum + record.amountNodeUnits, 0)).toBe(advanced.nodeWallet.balanceNodeUnits)
    expect(advanced.nodeWallet.activity.nextId).toBe(3)
  })

  it('leaves the Dollar Wallet untouched while both NODE recipients are credited', () => {
    const started = run(readyState())
    const advanced = advanceGameState(started.state, 10_000)
    expect(advanced.wallet).toEqual({ balance: 1250 })
  })
})

describe('NODE Miner payout artifact', () => {
  it('is created by real payouts rather than seeded, and records gross, configured, and developer allocation', () => {
    const started = run(readyState())
    expect(payoutLog(started.state)).toBeUndefined()

    const advanced = advanceGameState(started.state, 10_000)
    const log = payoutLog(advanced)
    expect(log).toBeDefined()
    expect(log?.content).toContain('gross=1000')
    expect(log?.content).toContain('payout=670')
    expect(log?.content).toContain(`payout-address=${advanced.nodeWallet.address}`)
    expect(log?.content).toContain('fee=330')
    expect(log?.content).toContain(`fee-address=${NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS}`)
    expect(log?.content).toContain(miner(advanced).id)
  })

  it('records only completed payout totals while unbatched production remains pending', () => {
    const advanced = advanceGameState(run(readyState()).state, 24_300)
    expect(payoutLog(advanced)?.content).toContain('gross=2000 payout=1340')
    expect(payoutLog(advanced)?.content).toContain('fee=660')
    expect(payoutLog(advanced)?.content).not.toContain('gross=2430')
  })

  it('rewrites one line per Miner run, so continuous mining never grows the artifact without limit', () => {
    const started = run(readyState())
    let state = started.state
    for (let index = 0; index < 40; index += 1) state = advanceGameState(state, 250)
    const log = payoutLog(state)
    expect(log?.content.split('\n')).toHaveLength(2)
    expect(log?.content).toContain('gross=1000')
  })

  it('retains a bounded number of Miner runs, evicting the oldest first', () => {
    let state = readyState()
    for (let index = 0; index < NODE_MINER_PAYOUT_LOG_CAPACITY + 3; index += 1) {
      const started = run(state)
      state = advanceGameState(started.state, 10_000)
      state = stopNodeMiner(state, started.processId).state
    }
    const lines = payoutLog(state)!.content.split('\n')
    expect(lines).toHaveLength(NODE_MINER_PAYOUT_LOG_CAPACITY + 1)
    expect(lines[0]).toBe('NODE MINER PAYOUT LOG')
    expect(payoutLog(state)!.content).not.toContain('process-0001#1 ')
    expect(payoutLog(state)!.content).toContain('process-0011#1 ')
  })

  it('survives STOP: neither the artifact nor already-received Wallet activity is erased with the Process', () => {
    const started = run(readyState())
    const produced = advanceGameState(started.state, 10_000)
    const stopped = stopNodeMiner(produced, started.processId).state
    expect(stopped.process.processes).toHaveLength(0)
    expect(payoutLog(stopped)?.content).toContain('gross=1000')
    expect(stopped.nodeWallet.activity.records).toHaveLength(1)
    expect(stopped.nodeWallet.balanceNodeUnits).toBe(670)
    expect(developerBalance(stopped)).toBe(330)
  })

  it('never overwrites an unrelated Device artifact already occupying the payout-log path', () => {
    const base = readyState()
    const occupied: GameState = {
      ...base,
      player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: {
        nextFileId: 10,
        files: [...base.player.localDevice.filesystem.files, { kind: 'executable', id: 'file-0009', path: NODE_MINER_PAYOUT_LOG_PATH, programId: 'other-program', releaseId: 'other-1.0', name: 'Other', version: '1.0', sizeBytes: 100 }],
      } } },
    }
    const advanced = advanceGameState(run(occupied).state, 10_000)
    const existing = advanced.player.localDevice.filesystem.files.find((file) => file.path === NODE_MINER_PAYOUT_LOG_PATH)
    expect(existing?.kind).toBe('executable')
    // The economic payouts themselves still happened.
    expect(advanced.nodeWallet.balanceNodeUnits).toBe(670)
    expect(developerBalance(advanced)).toBe(330)
  })

  it('never overwrites an unrelated TextFile at the payout-log path', () => {
    const base = readyState()
    const foreign: TextFile = { kind: 'text', id: 'file-0009', path: NODE_MINER_PAYOUT_LOG_PATH, content: 'UNRELATED LOG\nkeep this data' }
    const occupied: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { nextFileId: 10, files: [...base.player.localDevice.filesystem.files, foreign] } } } }
    const advanced = advanceGameState(run(occupied).state, 10_000)
    expect(advanced.player.localDevice.filesystem.files.find((file) => file.path === NODE_MINER_PAYOUT_LOG_PATH)).toEqual(foreign)
    expect(advanced.nodeWallet.balanceNodeUnits).toBe(670)
  })
})

describe('NODE Miner payout artifact observation', () => {
  it('is one ordinary Device-owned file observable through the canonical filesystem, not a private Miner view', () => {
    const advanced = advanceGameState(run(readyState()).state, 10_000)
    const filesystem = advanced.player.localDevice.filesystem
    expect(listDirectory(filesystem, '/var/log/node-miner')).toEqual({ status: 'ok', entries: [{ name: 'payout.log', type: 'file' }] })
    const read = readTextFile(filesystem, NODE_MINER_PAYOUT_LOG_PATH)
    expect(read.status).toBe('ok')
    expect(read.status === 'ok' && read.content).toContain('gross=1000')
  })
})

const REMOTE_MINER_PATH = '/usr/local/bin/node-miner'
const REMOTE_DEVICE_ID = 'host-lan-001'

function remoteMinerExecutable(path: string = REMOTE_MINER_PATH): ExecutableFile {
  return { kind: 'executable', id: 'file-0009', path, programId: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
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
        { kind: 'executable', id: 'file-0011', path: '/usr/local/bin/other', programId: 'other-program', releaseId: 'other-1.0', name: 'Other', version: '1.0', sizeBytes: 10 },
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
    const state = operatingState((host) => ({ ...host, online: false }))
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

describe('remote NODE Miner payout', () => {
  it('routes remote production through the same exact-address recipient rules', () => {
    const advanced = advanceGameState(runRemote(operatingState()).state, 10_000)

    expect(advanced.nodeWallet.balanceNodeUnits).toBe(670)
    expect(developerBalance(advanced)).toBe(330)
    expect(advanced.nodeWallet.activity.records).toHaveLength(1)
  })

  it('credits nobody for a foreign address while still diverting the developer share', () => {
    const advanced = advanceGameState(runRemote(operatingState(), 'node-addr-nobody-holds').state, 10_000)

    expect(advanced.nodeWallet.balanceNodeUnits).toBe(0)
    expect(developerBalance(advanced)).toBe(330)
  })

  it('writes its payout artifact to the executing Device rather than to node-01', () => {
    const advanced = advanceGameState(runRemote(operatingState()).state, 10_000)

    expect(remotePayoutLog(advanced)?.content).toContain('gross=1000')
    expect(remotePayoutLog(advanced)?.content).toContain(`payout-address=${advanced.nodeWallet.address}`)
    expect(payoutLog(advanced)).toBeUndefined()
  })

  it("keeps each Device's payout artifact on its own filesystem when both mine at once", () => {
    const advanced = advanceGameState(run(runRemote(operatingState()).state).state, 20_000)

    expect(payoutLog(advanced)?.content).toContain(findRunningLocalNodeMiner(advanced)!.id)
    expect(payoutLog(advanced)?.content).not.toContain(findRunningNodeMiner(advanced, REMOTE_DEVICE_ID)!.id)
    expect(remotePayoutLog(advanced)?.content).toContain(findRunningNodeMiner(advanced, REMOTE_DEVICE_ID)!.id)
    expect(remotePayoutLog(advanced)?.content).not.toContain(findRunningLocalNodeMiner(advanced)!.id)
  })

  it('never overwrites an unrelated artifact occupying the payout-log path on the remote Device', () => {
    const foreign: TextFile = { kind: 'text', id: 'file-0020', path: NODE_MINER_PAYOUT_LOG_PATH, content: 'UNRELATED LOG\nkeep this data' }
    const state = operatingState((host) => ({ ...host, filesystem: { nextFileId: 21, files: [...host.filesystem!.files, foreign] } }))

    const advanced = advanceGameState(runRemote(state).state, 10_000)

    expect(remoteHost(advanced).filesystem!.files.find(({ path }) => path === NODE_MINER_PAYOUT_LOG_PATH)).toEqual(foreign)
    // The economic payouts themselves still happened.
    expect(advanced.nodeWallet.balanceNodeUnits).toBe(670)
  })
})

describe('live NODE Miner payout retarget', () => {
  const NEW_ADDRESS = 'node-addr-9f31c7a4d2'

  it('uses the local authority boundary to retarget only the local Miner', () => {
    const both = run(runRemote(operatingState()).state)
    const localBefore = findRunningLocalNodeMiner(both.state)!
    const remoteBefore = findRunningNodeMiner(both.state, REMOTE_DEVICE_ID)!
    const result = retargetLocalNodeMinerPayout(both.state, NEW_ADDRESS)
    expect(result.status).toBe('retargeted')
    expect(findRunningLocalNodeMiner(result.state)).toMatchObject({ id: localBefore.id, payoutAddress: NEW_ADDRESS })
    expect(findRunningNodeMiner(result.state, REMOTE_DEVICE_ID)).toEqual(remoteBefore)
  })

  it('changes the configured address in place, preserving Process identity and every accumulated counter', () => {
    const started = runRemote(operatingState())
    const producing = advanceGameState(started.state, 14_300)
    const before = findRunningNodeMiner(producing, REMOTE_DEVICE_ID)!

    const result = retargetNodeMinerPayout(producing, NEW_ADDRESS)
    expect(result.status).toBe('retargeted')
    const after = findRunningNodeMiner(result.state, REMOTE_DEVICE_ID)!

    expect(after.id).toBe(before.id)
    expect(after.executorDeviceId).toBe(before.executorDeviceId)
    expect(after.programId).toBe(before.programId)
    expect(after.releaseId).toBe(before.releaseId)
    expect(after.ramRequiredMiB).toBe(before.ramRequiredMiB)
    expect(after.producedNodeUnits).toBe(before.producedNodeUnits)
    expect(after.payoutNodeUnits).toBe(before.payoutNodeUnits)
    expect(after.developerFeeNodeUnits).toBe(before.developerFeeNodeUnits)
    expect(after.workRemainder).toBe(before.workRemainder)
    expect(after.payoutAddress).toBe(NEW_ADDRESS)
    // Pending production is deliberately not reset merely because configuration changed.
    expect(after.producedNodeUnits - (after.payoutNodeUnits + after.developerFeeNodeUnits)).toBeGreaterThan(0)
  })

  it('consumes no simulation time, creates no second Process, and fabricates no lifecycle history', () => {
    const producing = advanceGameState(runRemote(operatingState()).state, 14_300)
    const retargeted = retargetNodeMinerPayout(producing, NEW_ADDRESS).state

    expect(retargeted.process.processes).toHaveLength(1)
    expect(retargeted.process.nextId).toBe(producing.process.nextId)
    expect(retargeted.recentActivity.entries).toEqual([])
    // No hidden final payout: nothing moved at the instant of the change.
    expect(retargeted.nodeWallet).toEqual(producing.nodeWallet)
    expect(retargeted.nodeEconomy).toEqual(producing.nodeEconomy)
    expect(remotePayoutLog(retargeted)).toEqual(remotePayoutLog(producing))
  })

  it('leaves already-routed NODE untouched and routes only later completed batches to the new address', () => {
    // srv-01 produces 160 units/s at zero baseline, so 6.25 s is exactly one 1,000-unit batch.
    const started = runRemote(operatingState())
    const firstBatch = advanceGameState(started.state, 6_250)
    expect(firstBatch.nodeWallet.balanceNodeUnits).toBe(670)

    const retargeted = retargetNodeMinerPayout(firstBatch, NEW_ADDRESS).state
    const secondBatch = advanceGameState(retargeted, 6_250)

    // The Wallet keeps exactly what it was already paid; the new address received the next batch.
    expect(secondBatch.nodeWallet.balanceNodeUnits).toBe(670)
    expect(secondBatch.nodeWallet.activity.records).toHaveLength(1)
    // 330 from the first batch's developer share, plus 670 + 330 from the second, now that both go to the same address.
    expect(developerBalance(secondBatch)).toBe(330 + 670 + 330)
    // Developer-share behavior stays release-correct across the change.
    const process = findRunningNodeMiner(secondBatch, REMOTE_DEVICE_ID)!
    expect(process.payoutNodeUnits).toBe(1_340)
    expect(process.developerFeeNodeUnits).toBe(660)
  })

  it('keeps the payout artifact historically truthful across an address change', () => {
    const started = runRemote(operatingState())
    const firstBatch = advanceGameState(started.state, 6_250)
    const secondBatch = advanceGameState(retargetNodeMinerPayout(firstBatch, NEW_ADDRESS).state, 6_250)

    const lines = remotePayoutLog(secondBatch)!.content.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe(`${started.processId}#1 gross=1000 payout=670 payout-address=node-wallet-addr-0001 fee=330 fee-address=${NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS}`)
    expect(lines[2]).toBe(`${started.processId}#2 gross=1000 payout=670 payout-address=${NEW_ADDRESS} fee=330 fee-address=${NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS}`)
    // The earlier line still names the address that was actually paid then.
    expect(lines[1]).not.toContain(`payout-address=${NEW_ADDRESS}`)
  })

  it('keeps payout-artifact retention bounded however often one run is retargeted', () => {
    let state = advanceGameState(runRemote(operatingState()).state, 10_000)
    for (let index = 0; index < NODE_MINER_PAYOUT_LOG_CAPACITY + 3; index += 1) {
      state = retargetNodeMinerPayout(state, `node-addr-rotate-${index}`).state
      state = advanceGameState(state, 10_000)
    }

    const lines = remotePayoutLog(state)!.content.split('\n')
    expect(lines).toHaveLength(NODE_MINER_PAYOUT_LOG_CAPACITY + 1)
    expect(lines[0]).toBe(NODE_MINER_PAYOUT_LOG_HEADER)
    expect(state.process.processes).toHaveLength(1)
  })

  it('rejects an empty address, a missing Session, and an offline target atomically', () => {
    const producing = advanceGameState(runRemote(operatingState()).state, 14_300)
    for (const [state, address, status] of [
      [producing, '   ', 'invalid_payout_address'],
      [{ ...producing, remoteSession: { ...producing.remoteSession, active: null } }, NEW_ADDRESS, 'session_unavailable'],
      [{ ...producing, world: { ...producing.world, network: { ...producing.world.network, hosts: [{ ...remoteHost(producing), online: false }, ...producing.world.network.hosts.slice(1)] } } }, NEW_ADDRESS, 'target_offline'],
    ] as const) {
      const result = retargetNodeMinerPayout(state, address)
      expect(result.status).toBe(status)
      expect(result.state).toBe(state)
    }
  })

  it('never retargets a Miner that is not running on the operated Device', () => {
    // A local Miner is running, but srv-01 has none: the operated Device is what counts.
    const localOnly = run(operatingState()).state
    const result = retargetNodeMinerPayout(localOnly, NEW_ADDRESS)

    expect(result.status).toBe('not_running')
    expect(result.state).toBe(localOnly)
    expect(findRunningLocalNodeMiner(localOnly)?.payoutAddress).toBe(localOnly.nodeWallet.address)
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
    expect(stopped.state.nodeWallet.balanceNodeUnits).toBe(producing.nodeWallet.balanceNodeUnits)
    expect(developerBalance(stopped.state)).toBe(developerBalance(producing))
    expect(remotePayoutLog(stopped.state)?.content).toContain('gross=1000')
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
