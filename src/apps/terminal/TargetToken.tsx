import { type PointerEvent, useEffect, useRef, useState } from 'react'

export function TargetToken({ value }: { value: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const resetTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(resetTimer.current), [])

  function preservePromptFocus(event: PointerEvent<HTMLButtonElement>) {
    // Pointer activation should not open the keyboard or collapse an existing
    // editing session. Keyboard users can still focus this native button.
    event.preventDefault()
  }

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setCopyState('idle'), 1600)
  }

  return (
    <button
      className="target-token"
      type="button"
      aria-label={`Copy target ${value}`}
      data-copy-state={copyState}
      onPointerDown={preservePromptFocus}
      onClick={copy}
    >
      <span>{value}</span>
      {copyState === 'copied' && <span className="target-token-feedback" aria-hidden="true">✓</span>}
      {copyState === 'failed' && <span className="target-token-feedback" aria-hidden="true">!</span>}
      <span className="sr-only" aria-live="polite">{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : ''}</span>
    </button>
  )
}
