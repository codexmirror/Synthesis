import { createLocalScanTarget } from './localScanOperation'
import { createLocalInspectTarget } from './localInspectOperation'
import { startServiceAnalysisFromObservation } from '../core/game/serviceAnalysis'
import { findInstalledNodeScan, nodeScanSupportsInspect } from '../core/game/software'
import type { GameState } from '../core/game/types'

/**
 * NodeScan is software, not a control panel the player has to operate one
 * technical step at a time. These two application operations are the routine
 * technical work it legitimately performs on the player's behalf.
 *
 * They introduce no new gameplay rule and no new canonical state. Each one
 * composes existing canonical operations — Scan, Inspect, Service Analysis —
 * against targets the player already legitimately knows, and each underlying
 * operation keeps its own capability gate, its own identity validation, its
 * own memory semantics and its own resource cost. Terminal users can still
 * perform every one of these steps individually; they are the same operations.
 */

export type FindTargetsResult =
  | { readonly status: 'observed'; readonly networksKnown: number; readonly targetsKnown: number }
  | { readonly status: 'no_response' | 'software_unavailable' }

export type FindTargetsOperation = () => Promise<FindTargetsResult>

export interface SweepTargetObservation {
  readonly targetDeviceId: string
  readonly address: string
}

export type SweepTargetResult =
  | { readonly status: 'observed'; readonly servicesObserved: number; readonly analysesStarted: number; readonly insufficientMemory: boolean }
  | { readonly status: 'no_response' | 'unknown_target' | 'software_unavailable' }

export type SweepTargetOperation = (observed: SweepTargetObservation) => Promise<SweepTargetResult>

/**
 * Look around: observe SELF's own Network relationships, then observe the
 * responding members of every Network the player now legitimately knows.
 * Both steps are the same canonical Scan operation the Terminal exposes; the
 * only thing added here is that the player does not have to issue them one at
 * a time. Nothing outside remembered Discovery is ever scanned.
 */
export function createFindTargets(readState: () => GameState, writeState: (state: GameState) => void): FindTargetsOperation {
  const scan = createLocalScanTarget(readState, writeState)
  return async () => {
    const state = readState()
    if (!findInstalledNodeScan(state.player.localDevice)) return { status: 'software_unavailable' }
    const self = await scan(state.player.localDevice.network.ip)
    if (self.status === 'software_unavailable') return { status: 'software_unavailable' }
    if (self.status === 'no_response' || self.status === 'unknown_target') return { status: 'no_response' }
    for (const network of readState().discovery.networks) await scan(network.name)
    const latest = readState()
    return { status: 'observed', networksKnown: latest.discovery.networks.length, targetsKnown: latest.discovery.devices.length }
  }
}

/**
 * Find out about one known target: observe its currently open Services, then,
 * where the installed release supplies Inspect, observe the target's own
 * properties and Service fingerprints, then investigate every Service the
 * player now legitimately remembers.
 *
 * Service Analysis stays real work: each investigation is a canonical Process
 * with its own RAM cost and elapsed time, started through the same
 * observation-bound operation the Service surface uses, and any of them may
 * legitimately fail to start. NodeScan 1.0 Standard supplies no Inspect, so
 * the middle step simply does not happen there.
 */
export function createSweepTarget(readState: () => GameState, writeState: (state: GameState) => void): SweepTargetOperation {
  const scan = createLocalScanTarget(readState, writeState)
  const inspect = createLocalInspectTarget(readState, writeState)
  return async (observed) => {
    const installation = findInstalledNodeScan(readState().player.localDevice)
    if (!installation) return { status: 'software_unavailable' }

    const result = await scan(observed.address)
    if (result.status === 'software_unavailable') return { status: 'software_unavailable' }
    if (result.status === 'no_response') return { status: 'no_response' }
    if (result.status === 'unknown_target' || result.status === 'network') return { status: 'unknown_target' }
    // Another Device answering this address is a legitimate observation and is
    // remembered as one, but it is not this target: nothing is investigated on
    // its behalf and this target's own information is left exactly as it was.
    if (result.targetId !== observed.targetDeviceId) return { status: 'observed', servicesObserved: 0, analysesStarted: 0, insufficientMemory: false }

    if (nodeScanSupportsInspect(installation)) inspect(observed.address)

    const latest = readState()
    const device = latest.discovery.devices.find(({ id }) => id === observed.targetDeviceId)
    let working = latest
    let analysesStarted = 0
    let insufficientMemory = false
    for (const service of device?.services ?? []) {
      const started = startServiceAnalysisFromObservation(working, { endpoint: service.endpoint, targetDeviceId: observed.targetDeviceId, serviceId: service.id })
      if (started.status === 'started') { working = started.state; analysesStarted++ }
      else if (started.status === 'insufficient_memory') insufficientMemory = true
    }
    if (working !== latest) writeState(working)
    return { status: 'observed', servicesObserved: device?.services.length ?? 0, analysesStarted, insufficientMemory }
  }
}
