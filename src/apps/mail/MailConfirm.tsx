/**
 * The in-application confirmation NodeMail uses before removing correspondence
 * from the mailbox.
 *
 * It is deliberately an ordinary part of the surface rather than a browser
 * `confirm()` sheet or a modal overlay: the player stays in the mailbox, sees
 * exactly what is about to be removed, and reads what removal does and does
 * not do before answering.
 */
export function MailConfirm({ question, detail, confirmLabel, confirm, cancel }: {
  question: string
  detail: string
  confirmLabel: string
  confirm: () => void
  cancel: () => void
}) {
  return <div className="mail-confirm" role="group" aria-label={question}>
    <p className="mail-confirm-question">{question}</p>
    <p className="mail-confirm-detail">{detail}</p>
    <div className="mail-confirm-actions">
      <button className="node-action" type="button" onClick={cancel}>KEEP</button>
      <button className="node-action node-action--destructive" type="button" onClick={confirm}>{confirmLabel}</button>
    </div>
  </div>
}
