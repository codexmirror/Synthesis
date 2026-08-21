import { type FormEvent, type KeyboardEvent, useLayoutEffect, useRef, useState } from 'react'

export const FOLLOW_TAIL_TOLERANCE = 28

export function isNearTerminalTail(element: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= FOLLOW_TAIL_TOLERANCE
}

export function useTerminalInteraction(onCommand: (command: string) => Promise<void>, contentVersion: unknown) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const draft = useRef('')
  const composing = useRef(false)
  const submitting = useRef(false)
  const followingTail = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const output = outputRef.current
    if (output && followingTail.current) output.scrollTop = output.scrollHeight
  }, [contentVersion])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current || composing.current) return
    const command = input.trim()
    if (!command) return
    const preserveFocus = document.activeElement === inputRef.current
    submitting.current = true
    followingTail.current = true
    setInput('')
    draft.current = ''
    setHistory((current) => {
      const next = [...current, command]
      setHistoryIndex(next.length)
      return next
    })
    if (preserveFocus) inputRef.current?.focus({ preventScroll: true })
    try { await onCommand(command) } finally { submitting.current = false }
  }

  function navigate(direction: -1 | 1) {
    const next = Math.max(0, Math.min(history.length, historyIndex + direction))
    if (historyIndex === history.length && next < history.length) draft.current = input
    setHistoryIndex(next)
    setInput(next === history.length ? draft.current : history[next])
    requestAnimationFrame(() => {
      const target = inputRef.current
      if (target) target.setSelectionRange(target.value.length, target.value.length)
    })
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'ArrowUp') { event.preventDefault(); navigate(-1) }
    if (event.key === 'ArrowDown') { event.preventDefault(); navigate(1) }
  }

  return {
    input, setInput: (value: string) => { setInput(value); if (historyIndex === history.length) draft.current = value },
    inputRef, outputRef, submit, onKeyDown,
    onCompositionStart: () => { composing.current = true },
    onCompositionEnd: () => { composing.current = false },
    onOutputScroll: () => { const output = outputRef.current; if (output) followingTail.current = isNearTerminalTail(output) },
  }
}
