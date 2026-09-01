import { openMailThread, sendMailReply, type SendMailReplyResult } from '../core/game/mail'
import { commitResult, commitState, type GameStateAccessor } from './gameStateAccess'

export function createMailActions(accessor: GameStateAccessor) {
  return {
    openMailThread(threadId: string): void {
      commitState(accessor, openMailThread(accessor.read(), threadId))
    },
    sendMailReply(threadId: string, text: string): SendMailReplyResult {
      return commitResult(accessor, sendMailReply(accessor.read(), threadId, text))
    },
  }
}
