import { composeMail, deleteMailThreads, openMailThread, sendMailReply, type ComposeMailInput, type ComposeMailResult, type SendMailReplyResult } from '../core/game/mail'
import { commitResult, commitState, type GameStateAccessor } from './gameStateAccess'

export function createMailActions(accessor: GameStateAccessor) {
  return {
    openMailThread(threadId: string): void {
      commitState(accessor, openMailThread(accessor.read(), threadId))
    },
    sendMailReply(threadId: string, text: string, attachmentFileIds?: readonly string[]): SendMailReplyResult {
      return commitResult(accessor, sendMailReply(accessor.read(), threadId, text, attachmentFileIds))
    },
    composeMail(input: ComposeMailInput): ComposeMailResult {
      return commitResult(accessor, composeMail(accessor.read(), input))
    },
    deleteMailThreads(threadIds: readonly string[]): void {
      commitState(accessor, deleteMailThreads(accessor.read(), threadIds))
    },
  }
}
