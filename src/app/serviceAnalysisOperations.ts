import { startServiceAnalysis, startServiceAnalysisAtEndpoint, startServiceAnalysisFromObservation, type EndpointAnalysisResult, type ObservedServiceTarget, type StartServiceAnalysisResult } from '../core/game/serviceAnalysis'
import { findInstalledNodeScan } from '../core/game/software'
import type { GameState } from '../core/game/types'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export type NodeScanStartServiceAnalysisResult = StartServiceAnalysisResult | { status: 'software_unavailable'; state: GameState }
export type NodeScanEndpointAnalysisResult = EndpointAnalysisResult | { status: 'software_unavailable'; state: GameState }
export interface ObservedServiceAnalysisBatchResult {
  readonly started: number
  readonly insufficientMemory?: { readonly requiredMiB: number; readonly availableMiB: number }
}

/** NodeScan-gated application adapter for Service Analysis: NodeScan availability is an application-level admission concern the domain itself does not check. */
export function createServiceAnalysisActions(accessor: GameStateAccessor) {
  function requireNodeScan(state: GameState): { status: 'software_unavailable'; state: GameState } | undefined {
    return findInstalledNodeScan(state.player.localDevice) ? undefined : { status: 'software_unavailable', state }
  }
  return {
    startServiceAnalysis(targetDeviceId: string, serviceId: string): NodeScanStartServiceAnalysisResult {
      const state = accessor.read()
      return requireNodeScan(state) ?? commitResult(accessor, startServiceAnalysis(state, targetDeviceId, serviceId))
    },
    startServiceAnalysisAtEndpoint(endpoint: string): NodeScanEndpointAnalysisResult {
      const state = accessor.read()
      return requireNodeScan(state) ?? commitResult(accessor, startServiceAnalysisAtEndpoint(state, endpoint))
    },
    startServiceAnalysisFromObservation(observed: ObservedServiceTarget): NodeScanEndpointAnalysisResult {
      const state = accessor.read()
      return requireNodeScan(state) ?? commitResult(accessor, startServiceAnalysisFromObservation(state, observed))
    },
    /** One committed re-render for the whole batch: intermediate admissions are threaded locally rather than through `accessor`, exactly as they were before this adapter existed. */
    startObservedServiceAnalyses(observed: readonly ObservedServiceTarget[]): ObservedServiceAnalysisBatchResult {
      let state = accessor.read()
      let started = 0
      let insufficientMemory: ObservedServiceAnalysisBatchResult['insufficientMemory']
      for (const service of observed) {
        const result = startServiceAnalysisFromObservation(state, service)
        if (result.status === 'started') {
          started++
          state = result.state
        } else if (result.status === 'insufficient_memory') {
          insufficientMemory = { requiredMiB: result.requiredMiB, availableMiB: result.availableMiB }
        }
      }
      if (started) accessor.write(state)
      return { started, ...(insufficientMemory ? { insufficientMemory } : {}) }
    },
  }
}
