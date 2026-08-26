import { type PointerEvent, useEffect, useRef, useState } from 'react'
import { isValidIpv4 } from '../../core/game/networkTarget'

type BodyFragment =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'address'; readonly value: string }

const ADDRESS_SHAPED = /\d{1,3}(?:\.\d{1,3}){3}/g

/**
 * A message body is historical communicated text and is rendered as written.
 *
 * The only affordance offered over it is copying an address exactly as it was
 * communicated. That is presentation: nothing here resolves the string against
 * the World, and reading or copying it grants no Discovery, Knowledge, target
 * identity or access. Verifying what a correspondent claimed remains the
 * player's job, through the existing observation operations.
 */
export function MailMessageBody({ body }: { body: string }) {
  return <>{splitCommunicatedAddresses(body).map((fragment, index) => fragment.kind === 'address'
    ? <CommunicatedAddress key={index} value={fragment.value} />
    : <span key={index}>{fragment.value}</span>)}</>
}

/** Purely lexical: an address-shaped run of characters in the text somebody wrote. */
function splitCommunicatedAddresses(body: string): readonly BodyFragment[] {
  const fragments: BodyFragment[] = []
  let cursor = 0
  for (const match of body.matchAll(ADDRESS_SHAPED)) {
    if (!isValidIpv4(match[0]) || match.index === undefined) continue
    if (match.index > cursor) fragments.push({ kind: 'text', value: body.slice(cursor, match.index) })
    fragments.push({ kind: 'address', value: match[0] })
    cursor = match.index + match[0].length
  }
  if (cursor < body.length) fragments.push({ kind: 'text', value: body.slice(cursor) })
  return fragments
}

function CommunicatedAddress({ value }: { value: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const resetTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(resetTimer.current), [])

  function preserveEditing(event: PointerEvent<HTMLButtonElement>) {
    // Copying an address must not open the keyboard or collapse a reply the
    // player is already writing. Keyboard users still reach this native button.
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
      className="mail-address"
      type="button"
      aria-label={`Copy address ${value}`}
      title="Communicated address · Copy"
      data-copy-state={copyState}
      onPointerDown={preserveEditing}
      onClick={copy}
    >
      <span>{value}</span>
      {copyState === 'copied' && <span className="mail-address-feedback" aria-hidden="true">✓</span>}
      {copyState === 'failed' && <span className="mail-address-feedback" aria-hidden="true">!</span>}
      <span className="sr-only" aria-live="polite">{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : ''}</span>
    </button>
  )
}
