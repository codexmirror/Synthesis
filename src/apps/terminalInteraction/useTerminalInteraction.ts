import { type FormEvent, type KeyboardEvent, useLayoutEffect, useRef, useState } from 'react'

export const TERMINAL_TAIL_TOLERANCE = 28

export function isNearTerminalTail(
  { scrollTop, clientHeight, scrollHeight }: Pick<HTMLElement, 'scrollTop' | 'clientHeight' | 'scrollHeight'>,
  tolerance = TERMINAL_TAIL_TOLERANCE,
) {
  return scrollHeight - clientHeight - scrollTop <= tolerance
}

type TerminalInteractionOptions = {
  dispatch(command: string): void | Promise<void>
  onDispatchFailure(command: string): void
  outputVersion: unknown
}

export function useTerminalInteraction({ dispatch, onDispatchFailure, outputVersion }: TerminalInteractionOptions) {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const dispatchingRef = useRef(false)
  const followingTailRef = useRef(true)
  const liveDraftRef = useRef('')
  const composingRef = useRef(false)
  const mountedRef = useRef(true)

  useLayoutEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useLayoutEffect(() => {
    const output = outputRef.current
    if (output && followingTailRef.current) output.scrollTop = output.scrollHeight
  }, [outputVersion])

  function navigateHistory(direction: -1 | 1) {
    if (direction === -1 && historyIndex === history.length) liveDraftRef.current = input
    const next = Math.max(0, Math.min(history.length, historyIndex + direction))
    if (next === historyIndex) return
    setHistoryIndex(next)
    setInput(next === history.length ? liveDraftRef.current : history[next])
    requestAnimationFrame(() => {
      const element = inputRef.current
      if (element && document.activeElement === element) element.setSelectionRange(element.value.length, element.value.length)
    })
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const isComposing = composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229
    if (isComposing) {
      if (event.key === 'Enter') event.preventDefault()
      return
    }
    if (event.key === 'ArrowUp') { event.preventDefault(); navigateHistory(-1) }
    if (event.key === 'ArrowDown') { event.preventDefault(); navigateHistory(1) }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (dispatchingRef.current || composingRef.current) return
    const command = input.trim()
    if (!command) return

    const preserveFocus = document.activeElement === inputRef.current
    dispatchingRef.current = true
    followingTailRef.current = true
    liveDraftRef.current = ''
    setInput('')
    setHistory((current) => {
      const next = [...current, command]
      setHistoryIndex(next.length)
      return next
    })
    if (preserveFocus) inputRef.current?.focus({ preventScroll: true })

    try {
      await dispatch(command)
    } catch {
      if (mountedRef.current) onDispatchFailure(command)
    } finally {
      dispatchingRef.current = false
    }
  }

  return {
    input,
    setInput,
    inputRef,
    outputRef,
    onSubmit,
    onKeyDown,
    onCompositionStart: () => { composingRef.current = true },
    onCompositionEnd: () => { composingRef.current = false },
    onOutputScroll: () => {
      const output = outputRef.current
      if (output) followingTailRef.current = isNearTerminalTail(output)
    },
  }
}
