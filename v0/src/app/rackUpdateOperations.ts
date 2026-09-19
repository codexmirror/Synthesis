import {
  cancelRackUpdatePackageSubmission,
  startRackUpdateExploitAttemptFromObservation,
  startRackUpdatePackageSubmission,
  type CancelRackUpdatePackageSubmissionResult,
  type RackUpdateExploitObservation,
  type RackUpdateSubmissionObservation,
  type StartRackUpdateExploitResult,
  type StartRackUpdatePackageSubmissionResult,
} from '../core/game/rackUpdate'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

/** RackUpdate's own concrete actions: the ATTACK exploit attempt and its narrow package-submission mechanic. */
export function createRackUpdateActions(accessor: GameStateAccessor) {
  return {
    startRackUpdateExploitAttemptFromObservation(observed: RackUpdateExploitObservation): StartRackUpdateExploitResult {
      return commitResult(accessor, startRackUpdateExploitAttemptFromObservation(accessor.read(), observed))
    },
    startRackUpdatePackageSubmission(observed: RackUpdateSubmissionObservation): StartRackUpdatePackageSubmissionResult {
      return commitResult(accessor, startRackUpdatePackageSubmission(accessor.read(), observed))
    },
    cancelRackUpdatePackageSubmission(submissionId: string): CancelRackUpdatePackageSubmissionResult {
      return commitResult(accessor, cancelRackUpdatePackageSubmission(accessor.read(), submissionId))
    },
  }
}
