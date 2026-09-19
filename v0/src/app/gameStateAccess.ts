import type { GameState } from '../core/game/types'

/**
 * Shared application-level read/commit surface every action adapter uses to
 * observe and update the single canonical GameState `GameProvider` hosts.
 * `read` always returns the latest committed state, so consecutive
 * synchronous actions built on this accessor observe each other's effects.
 */
export interface GameStateAccessor {
  read(): GameState
  write(next: GameState): void
}

/**
 * Commits `result.state` only when a domain operation actually produced a
 * new canonical state. Every domain result echoes back the exact same state
 * reference it was given on rejection, so a reference comparison never
 * fabricates an update — it is not a status-code interpreter, it never
 * inspects `result.status`.
 */
export function commitResult<TResult extends { readonly state: GameState }>(accessor: GameStateAccessor, result: TResult): TResult {
  if (result.state !== accessor.read()) accessor.write(result.state)
  return result
}

/** Commits a directly returned GameState (no result wrapper) under the same no-op-on-unchanged-reference convention. */
export function commitState(accessor: GameStateAccessor, nextState: GameState): GameState {
  if (nextState !== accessor.read()) accessor.write(nextState)
  return nextState
}
