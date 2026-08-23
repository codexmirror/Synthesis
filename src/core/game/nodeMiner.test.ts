import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { advanceGameState } from './gameAdvancement'
import { deriveResourceUsage } from './processes'
import { installLocalSoftwarePackage } from './softwareInstallation'
import { listDirectory, readTextFile } from './filesystem'
import {
  findNodeMinerExecutable, isNodeMinerAvailable, NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS,
  NODE_MINER_1_0_DEVELOPER_SHARE_PERCENT, NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS, NODE_MINER_INSTALLED_EXECUTABLE_PATH,
  NODE_MINER_RAM_REQUIRED_MIB, NODE_UNITS_PER_NODE, startNodeMiner, stopNodeMiner,
} from './nodeMiner'
import { NODE_MINER_PAYOUT_LOG_CAPACITY, NODE_MINER_PAYOUT_LOG_PATH } from './nodeMinerPayoutLog'
import { findNodeAccountByAddress } from './nodeEconomy'
import type { DiscoveredDeviceSnapshot, ExecutableFile, GameState, NodeMinerProcess, TextFile } from './types'

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
      releaseId: 'node-miner-1.0', payoutAddress: state.nodeWallet.address, producedNodeUnits: 7, payoutNodeUnits: 6, developerFeeNodeUnits: 0, workRemainder: 25,
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

    const installed = installLocalSoftwarePackage(base, '/home/user/downloads/node-miner-1.0.pkg')
    if (installed.status !== 'installed') throw new Error(installed.status)
    expect(installed.state.player.localDevice.installedSoftware).toContainEqual({
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
    expect(payoutLog(state)!.content).not.toContain('process-0001 ')
    expect(payoutLog(state)!.content).toContain('process-0011 ')
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
