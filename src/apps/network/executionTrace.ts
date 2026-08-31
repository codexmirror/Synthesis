import type { TargetOperation } from './targetProjection'

/**
 * Presentation choreography for a running NodeScan operation — and nothing
 * else.
 *
 * A phase mark is a procedural statement about the operation the player
 * actually started: which stage of *itself* it has reached, at the canonical
 * progress where it reached it. It is deliberately not represented technical
 * truth: it observes no target, reports no telemetry, discovers nothing, and
 * carries no value that is not already either the operation's own identity or
 * information the player holds. Anything a player could mistake for a finding
 * belongs to `targetProjection.ts` instead.
 *
 * Marks are a pure function of canonical progress, so a trace is identical
 * every time it is derived. Leaving a running target and coming back
 * reconstructs exactly the marks that operation has genuinely passed, rather
 * than replaying a timeline presentation happened to be holding.
 */
export interface ExecutionPhase {
  /** Canonical progress at which this phase is reached. */
  readonly at: number
  readonly label: string
}

const PHASES: Readonly<Record<TargetOperation['kind'], readonly ExecutionPhase[]>> = {
  service_analysis: [
    { at: 0, label: 'ANALYSIS ADMITTED' },
    { at: 12, label: 'SERVICE EXAMINATION' },
    { at: 88, label: 'EVALUATING OUTCOME' },
  ],
  credential_access: [
    { at: 0, label: 'PROVIDER LINKED' },
    { at: 8, label: 'ROUTE SELECTED' },
    { at: 22, label: 'ATTEMPTING CREDENTIAL ACCESS' },
    { at: 90, label: 'RESOLVING ATTEMPT' },
  ],
  rack_update_exploit: [
    { at: 0, label: 'PROVIDER LINKED' },
    { at: 8, label: 'SUBMISSION INTERFACE SELECTED' },
    { at: 22, label: 'ATTEMPTING ROLLBACK' },
    { at: 90, label: 'RESOLVING ATTEMPT' },
  ],
  package_submission: [
    { at: 0, label: 'SUBMISSION AUTHORIZED' },
    { at: 4, label: 'UPLOADING PACKAGE' },
    { at: 96, label: 'AWAITING ACCEPTANCE' },
  ],
}

/** The marks this operation has actually reached, oldest first. */
export function reachedPhases(operation: TargetOperation): readonly ExecutionPhase[] {
  return PHASES[operation.kind].filter(({ at }) => operation.percent >= at)
}

/** Every mark this kind of operation passes through, for the progress rail. */
export function operationPhases(kind: TargetOperation['kind']): readonly ExecutionPhase[] {
  return PHASES[kind]
}
