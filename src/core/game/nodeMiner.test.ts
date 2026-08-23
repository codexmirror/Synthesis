import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { advanceGameState } from './gameAdvancement'
import { deriveResourceUsage } from './processes'
import { NODE_MINER_RAM_REQUIRED_MIB, startNodeMiner, stopNodeMiner } from './nodeMiner'
import type { DiscoveredDeviceSnapshot, GameState, NodeMinerProcess } from './types'

const LOCAL_MINER_PATH = '/home/user/downloads/node-miner-1.0.bin'

/**
 * A local Device that already owns a downloaded NODE Miner copy (as the
 * existing srv-01 -> download -> local Files flow would produce), with
 * baseline CPU load forced to zero so allocated-compute arithmetic in these
 * tests lands on clean whole numbers.
 */
function readyState(): GameState {
  const base = createInitialGameState()
  const minerFile = { kind: 'executable' as const, id: 'file-0002', path: LOCAL_MINER_PATH, programId: 'node-miner' as const, releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
  return {
    ...base,
    player: {
      ...base.player,
      localDevice: {
        ...base.player.localDevice,
        filesystem: { nextFileId: 3, files: [...base.player.localDevice.filesystem.files, minerFile] },
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
    const other = { kind: 'executable' as const, id: 'file-0003', path: '/home/user/downloads/other.bin', programId: 'other-program', releaseId: 'other-1.0', name: 'Other Tool', version: '1.0', sizeBytes: 100 }
    const withOther: GameState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 4, files: [...state.player.localDevice.filesystem.files, other] } } } }
    const result = startNodeMiner(withOther, other.path, 'addr')
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
      producedNode: 0,
      creditedNode: 0,
      workRemainder: 0,
      ramRequiredMiB: NODE_MINER_RAM_REQUIRED_MIB,
    })
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
    expect(process.producedNode).toBeGreaterThan(0)
  })
})

describe('NODE Miner continuous runtime and mining accounting', () => {
  it('never completes from elapsed work, however large the interval', () => {
    const started = run(readyState())
    const advanced = advanceGameState(started.state, 100_000_000)
    const process = advanced.process.processes.find(({ id }) => id === started.processId) as NodeMinerProcess
    expect(process.status).toBe('running')
  })

  it('produces deterministic whole NODE from actual allocated compute, preserving a fractional remainder', () => {
    const started = run(readyState())
    // node-01: computeCapacity 100, baseline forced to 0 -> 100 compute-seconds/s allocated while running alone.
    const afterOneSecond = advanceGameState(started.state, 1000)
    const oneSecond = afterOneSecond.process.processes[0] as NodeMinerProcess
    expect(oneSecond.producedNode).toBe(1)
    expect(oneSecond.workRemainder).toBeCloseTo(0)

    const afterHalfSecond = advanceGameState(started.state, 500)
    const halfSecond = afterHalfSecond.process.processes[0] as NodeMinerProcess
    expect(halfSecond.producedNode).toBe(0)
    expect(halfSecond.workRemainder).toBeCloseTo(50)
  })

  it('never rounds allocated compute per tick and is tick-size independent', () => {
    const started = run(readyState())
    const once = advanceGameState(started.state, 1000)
    const chunked = advanceGameState(advanceGameState(advanceGameState(advanceGameState(started.state, 250), 250), 250), 250)
    const onceProcess = once.process.processes[0] as NodeMinerProcess
    const chunkedProcess = chunked.process.processes[0] as NodeMinerProcess
    expect(chunkedProcess.producedNode).toBe(onceProcess.producedNode)
    expect(chunkedProcess.workRemainder).toBeCloseTo(onceProcess.workRemainder)
    expect(chunked.nodeWallet.balanceNode).toBe(once.nodeWallet.balanceNode)
  })

  it('credits the represented NODE Wallet only when the configured payout address exactly matches', () => {
    const base = readyState()
    const matched = run(base, base.nodeWallet.address)
    const advancedMatched = advanceGameState(matched.state, 1000)
    expect(advancedMatched.nodeWallet.balanceNode).toBe(1)
    const matchedProcess = advancedMatched.process.processes[0] as NodeMinerProcess
    expect(matchedProcess.producedNode).toBe(1)
    expect(matchedProcess.creditedNode).toBe(1)

    const unmatched = run(readyState(), 'some-other-fictional-address')
    const advancedUnmatched = advanceGameState(unmatched.state, 1000)
    expect(advancedUnmatched.nodeWallet.balanceNode).toBe(0)
    const unmatchedProcess = advancedUnmatched.process.processes[0] as NodeMinerProcess
    expect(unmatchedProcess.producedNode).toBe(1)
    expect(unmatchedProcess.creditedNode).toBe(0)
  })

  it('never falls back to crediting the represented Wallet when the address does not match', () => {
    const unmatched = run(readyState(), 'nobody-owns-this-address')
    const advanced = advanceGameState(unmatched.state, 5000)
    expect(advanced.nodeWallet.balanceNode).toBe(0)
    const process = advanced.process.processes[0] as NodeMinerProcess
    expect(process.producedNode).toBeGreaterThan(0)
    expect(process.creditedNode).toBe(0)
  })

  it('never retroactively credits previously produced NODE if the Wallet address later happens to match', () => {
    const started = run(readyState(), 'unmatched-address')
    const produced = advanceGameState(started.state, 1000)
    const producedProcess = produced.process.processes[0] as NodeMinerProcess
    expect(producedProcess.producedNode).toBe(1)
    expect(produced.nodeWallet.balanceNode).toBe(0)

    // The represented Wallet address happens to start matching the Miner's already-configured address.
    const walletNowMatches: GameState = { ...produced, nodeWallet: { ...produced.nodeWallet, address: 'unmatched-address' } }
    const further = advanceGameState(walletNowMatches, 1000)
    const furtherProcess = further.process.processes[0] as NodeMinerProcess
    // Only the newly produced NODE from this next interval may credit; the earlier 1 NODE stays uncredited forever.
    expect(furtherProcess.producedNode).toBe(2)
    expect(furtherProcess.creditedNode).toBe(1)
    expect(further.nodeWallet.balanceNode).toBe(1)
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
    expect(withProcess.producedNode).toBe(withoutProcess.producedNode)
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
    expect(produced.nodeWallet.balanceNode).toBe(1)
    const stopped = stopNodeMiner(produced, produced.process.processes[0].id)
    expect(stopped.state.nodeWallet.balanceNode).toBe(1)
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
})
