import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { VeyraIcon } from './VeyraIcon'

/**
 * Copies a represented reference exactly as it is.
 *
 * It is a copy affordance and nothing more: it resolves nothing, requests
 * nothing and moves no money. The copied and failed states are local
 * Presentation state lasting about a second and a half; they report what this
 * control just did and claim nothing about the Account, the Provider, or
 * anything the world represents.
 */
export function VeyraCopyControl({ value, label, children }: { value: string; label: string; children: ReactNode }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const resetTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(resetTimer.current), [])

  function preserveEditing(event: PointerEvent<HTMLButtonElement>) {
    // Copying must not open the software keyboard or move Shell-owned editing.
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

  return <button
    className="veyra-copy"
    type="button"
    aria-label={label}
    data-copy-state={copyState}
    onPointerDown={preserveEditing}
    onClick={copy}
  >
    <VeyraIcon name={copyState === 'copied' ? 'copied' : 'copy'} />
    <span>{copyState === 'copied' ? 'Copied' : children}</span>
    <span className="veyra-hidden" aria-live="polite">{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : ''}</span>
  </button>
}
