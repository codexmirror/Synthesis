import { useState } from 'react'

const PIN_LENGTH = 4
const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

/**
 * VEYRA's one Device-PIN challenge, used identically to open a
 * protection-gated Wallet and to authorize a Settings change: a concise
 * title, four PIN indicators and a large numeric keypad. The fourth digit
 * verifies automatically — there is no visible text field and no separate
 * Confirm step.
 *
 * `verify` performs the actual Device-owner security action this challenge
 * is authorizing — a canonical mutation for Settings, a plain check for
 * Wallet-open — against the represented Device PIN, and reports only
 * whether it succeeded. This component never sees the correct PIN and holds
 * only the digits currently being entered, which are cleared after every
 * attempt; a caller decides what a successful attempt actually authorizes
 * inside `onSuccess`.
 */
export function VeyraPinChallenge({ title = 'Enter Device PIN', note, verify, onSuccess, onCancel, observedCandidate, observedAttemptNumber }: {
  title?: string
  note?: string
  verify: (pin: string) => boolean
  onSuccess: () => void
  onCancel: () => void
  observedCandidate?: string
  observedAttemptNumber?: number
}) {
  const [digits, setDigits] = useState('')
  const [refusal, setRefusal] = useState<string>()

  // A masked submit cycle derived only from canonical attempt identity. It
  // resets across successive real attempts without encoding candidate digits.
  const presentedLength = observedCandidate && observedAttemptNumber !== undefined
    ? (Math.max(1, observedAttemptNumber) - 1) % PIN_LENGTH + 1
    : digits.length

  function press(digit: string) {
    if (digits.length >= PIN_LENGTH) return
    const next = digits + digit
    setDigits(next)
    setRefusal(undefined)
    if (next.length < PIN_LENGTH) return
    if (verify(next)) {
      onSuccess()
      return
    }
    setDigits('')
    setRefusal('Incorrect PIN.')
  }

  function backspace() {
    setDigits((current) => current.slice(0, -1))
  }

  return <section className="veyra-screen veyra-pin" aria-label={title}>
    <h1 className="veyra-title">{title}</h1>
    {note && <p className="veyra-note">{note}</p>}
    {observedCandidate && observedAttemptNumber !== undefined && <p className="veyra-pin__rattler">RATTLER · ATTEMPT {observedAttemptNumber}</p>}
    <div className="veyra-pin__dots" aria-hidden="true">
      {Array.from({ length: PIN_LENGTH }, (_, index) => <span className="veyra-pin__dot" key={index}
        data-filled={index < presentedLength || undefined}
        data-rattler-attempt={observedCandidate ? true : undefined} />)}
    </div>
    <output className="veyra-hidden" aria-live="polite">{observedCandidate ? `RATTLER attempt ${observedAttemptNumber ?? ''} submitted` : `${digits.length} of ${PIN_LENGTH} digits entered`}</output>
    <p className="veyra-pin__refusal" role={refusal ? 'alert' : undefined}>{refusal || ' '}</p>
    <div className="veyra-keypad">
      {KEYPAD_DIGITS.map((digit) => <button key={digit} type="button" className="veyra-key" onClick={() => press(digit)}>{digit}</button>)}
      <span className="veyra-key veyra-key--empty" aria-hidden="true" />
      <button type="button" className="veyra-key" onClick={() => press('0')}>0</button>
      <button type="button" className="veyra-key veyra-key--backspace" onClick={backspace} disabled={digits.length === 0}>Delete</button>
    </div>
    <button className="veyra-quiet" type="button" onClick={onCancel}>Cancel</button>
  </section>
}
