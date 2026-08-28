import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { WalletIcon } from './WalletIcon'

/**
 * The small controls every Dollar surface composes: the focused-task heading,
 * the account reference as a copyable object, and the copy affordance itself.
 *
 * They live here rather than in one surface because all four surfaces use them
 * and none of them owns the others. Nothing in this module reads or changes
 * canonical state.
 */

/** The focused-task heading: one BACK to the dashboard and the name of the task. */
export function FocusedHeading({ title, onBack }: { title: string; onBack: () => void }) {
  return <div className="dollar-focused-head">
    <button className="node-back dollar-back" type="button" onClick={onBack}>← BACK</button>
    <p className="dollar-focused-title">{title}</p>
  </div>
}

/** The Account reference as it appears in the hero: readable, secondary to the balance, and copyable. */
export function AccountReference({ reference }: { reference: string }) {
  return <span className="dollar-account-reference">
    <span>{reference}</span>
    <CopyControl value={reference} label={`Copy account number ${reference}`} />
  </span>
}

/**
 * Copies a represented reference exactly as it is. It is a copy affordance
 * only: it resolves nothing, requests nothing and moves no money.
 *
 * `plate` is the same control given a surface of its own — a module's footer
 * action rather than an inline mark — for the one surface whose whole subject
 * is the reference being copied.
 *
 * The copied and failed states are local Presentation state that lasts about a
 * second and a half. They report what this control just did; they claim nothing
 * about the Account, the Provider or anything the world represents.
 */
export function CopyControl({ value, label, variant, children }: {
  value: string
  label: string
  variant?: 'plate'
  children?: ReactNode
}) {
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

  const className = ['dollar-copy', children && 'dollar-copy--labeled', variant === 'plate' && 'dollar-copy--plate']
    .filter(Boolean)
    .join(' ')

  return <button
    className={className}
    type="button"
    aria-label={label}
    data-copy-state={copyState}
    onPointerDown={preserveEditing}
    onClick={copy}
  >
    <WalletIcon name={copyState === 'copied' ? 'copied' : 'copy'} />
    {children && <span>{copyState === 'copied' ? 'COPIED' : children}</span>}
    <span className="sr-only" aria-live="polite">{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : ''}</span>
  </button>
}
