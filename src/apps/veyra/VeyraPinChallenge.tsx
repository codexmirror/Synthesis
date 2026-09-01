import { useEffect, useRef, useState } from 'react'

const PIN_LENGTH = 4
const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

/** How often presentation takes a fresh snapshot of the real canonical candidate. */
const SAMPLE_INTERVAL_MS = 500
/** Per-digit reveal cadence within one sample; the full four-digit reveal completes inside one sample interval. */
const STEP_MS = 125

interface Sample { readonly candidate: string; readonly attempt: number; readonly length: number }

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
  const isObserving = observedCandidate !== undefined && observedAttemptNumber !== undefined
  const [sample, setSample] = useState<Sample>()

  // The canonical RATTLER search runs far faster than a readable keypad
  // reveal (the full 10,000-candidate search completes in ~16 minutes; a
  // readable reveal needs hundreds of milliseconds per candidate). This
  // effect never drives, counts, or verifies anything: on a fixed interval
  // it takes one read-only snapshot of whatever candidate/attempt canonical
  // Process state currently holds, through a ref so the interval itself
  // never restarts on every canonical tick, and plays that one snapshot's
  // four digits at a readable cadence. Canonical ATTEMPT/CURRENT may — and
  // will — advance past what is on screen between samples; that gap is the
  // intended projection, never a second attempt stream. The moment
  // observation stops (canonical Process no longer running, interrupted, or
  // terminal), the interval and any pending reveal step are cancelled and
  // presentation converges to unobserved state immediately.
  const liveObserved = useRef({ candidate: observedCandidate, attempt: observedAttemptNumber })
  liveObserved.current = { candidate: observedCandidate, attempt: observedAttemptNumber }

  useEffect(() => {
    if (!isObserving) {
      setSample(undefined)
      return
    }
    let stepTimers: number[] = []
    function takeSample() {
      stepTimers.forEach(window.clearTimeout)
      stepTimers = []
      const live = liveObserved.current
      if (live.candidate === undefined || live.attempt === undefined) return
      setSample({ candidate: live.candidate, attempt: live.attempt, length: 1 })
      stepTimers = [2, 3, 4].map((length) => window.setTimeout(() => setSample((current) => current && { ...current, length }), (length - 1) * STEP_MS))
    }
    takeSample()
    const sampleInterval = window.setInterval(takeSample, SAMPLE_INTERVAL_MS)
    return () => {
      stepTimers.forEach(window.clearTimeout)
      window.clearInterval(sampleInterval)
    }
  }, [isObserving])

  const presentedLength = isObserving ? (sample?.length ?? 0) : digits.length
  const observedDigit = isObserving && sample ? sample.candidate[sample.length - 1] : undefined

  function press(digit: string) {
    if (isObserving || digits.length >= PIN_LENGTH) return
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
    if (isObserving) return
    setDigits((current) => current.slice(0, -1))
  }

  return <section className="veyra-screen veyra-pin" aria-label={title}>
    <h1 className="veyra-title">{title}</h1>
    {note && <p className="veyra-note">{note}</p>}
    {isObserving && sample && <p className="veyra-pin__rattler">RATTLER · ATTEMPT {sample.attempt}</p>}
    <div className="veyra-pin__dots" aria-hidden="true">
      {Array.from({ length: PIN_LENGTH }, (_, index) => <span className="veyra-pin__dot" key={index}
        data-filled={index < presentedLength || undefined}
        data-rattler-attempt={isObserving && sample ? true : undefined} />)}
    </div>
    <output className="veyra-hidden" aria-live="polite">{isObserving && sample ? `RATTLER attempt ${sample.attempt}: ${sample.length} of ${PIN_LENGTH} digits entered` : `${digits.length} of ${PIN_LENGTH} digits entered`}</output>
    <p className="veyra-pin__refusal" role={refusal ? 'alert' : undefined}>{refusal || ' '}</p>
    <div className="veyra-keypad">
      {KEYPAD_DIGITS.map((digit) => <button key={digit} type="button" className="veyra-key" disabled={isObserving} data-rattler-active={digit === observedDigit || undefined} onClick={() => press(digit)}>{digit}</button>)}
      <span className="veyra-key veyra-key--empty" aria-hidden="true" />
      <button type="button" className="veyra-key" disabled={isObserving} data-rattler-active={observedDigit === '0' || undefined} onClick={() => press('0')}>0</button>
      <button type="button" className="veyra-key veyra-key--backspace" onClick={backspace} disabled={isObserving || digits.length === 0}>Delete</button>
    </div>
    <button className="veyra-quiet" type="button" onClick={onCancel}>Cancel</button>
  </section>
}
