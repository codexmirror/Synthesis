import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react'

export type TerminalCaretMode = 'idle' | 'custom' | 'native'

type CaretPresentation = {
  mode: TerminalCaretMode
  prefix: string
  x: number
}

type RefreshOptions = {
  focused?: boolean
  composing?: boolean
}

const initialPresentation: CaretPresentation = { mode: 'idle', prefix: '', x: 0 }

export function useTerminalCaret(
  inputRef: RefObject<HTMLInputElement | null>,
  fieldRef: RefObject<HTMLDivElement | null>,
  measureRef: RefObject<HTMLSpanElement | null>,
  value: string,
) {
  const [presentation, setPresentation] = useState(initialPresentation)
  const composingRef = useRef(false)

  const refresh = useCallback((options: RefreshOptions = {}) => {
    const input = inputRef.current
    const field = fieldRef.current
    const measure = measureRef.current
    if (!input || !field || !measure) return

    const focused = options.focused ?? document.activeElement === input
    const composing = options.composing ?? composingRef.current
    const selectionStart = input.selectionStart ?? input.value.length
    const selectionEnd = input.selectionEnd ?? selectionStart
    const mode: TerminalCaretMode = focused
      ? composing || selectionStart !== selectionEnd ? 'native' : 'custom'
      : 'idle'
    const caretIndex = focused ? selectionStart : input.value.length
    const prefix = input.value.slice(0, caretIndex)
    measure.textContent = prefix

    const inputRect = input.getBoundingClientRect()
    const fieldRect = field.getBoundingClientRect()
    const styles = getComputedStyle(input)
    const contentOrigin = inputRect.left - fieldRect.left
      + input.clientLeft
      + (Number.parseFloat(styles.paddingLeft) || 0)
    const x = contentOrigin + measure.getBoundingClientRect().width - input.scrollLeft

    setPresentation((current) => current.mode === mode && current.prefix === prefix && current.x === x
      ? current
      : { mode, prefix, x })
  }, [fieldRef, inputRef, measureRef])

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    const update = () => refresh()
    const focus = () => refresh({ focused: true })
    const blur = () => refresh({ focused: false })
    const startComposition = () => { composingRef.current = true; refresh({ composing: true }) }
    const endComposition = () => { composingRef.current = false; refresh({ composing: false }) }
    const selectionChanged = () => {
      if (document.activeElement === input) update()
    }

    input.addEventListener('focus', focus)
    input.addEventListener('blur', blur)
    input.addEventListener('input', update)
    input.addEventListener('select', update)
    input.addEventListener('scroll', update)
    input.addEventListener('compositionstart', startComposition)
    input.addEventListener('compositionend', endComposition)
    document.addEventListener('selectionchange', selectionChanged)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update)
    resizeObserver?.observe(input)
    refresh()

    return () => {
      input.removeEventListener('focus', focus)
      input.removeEventListener('blur', blur)
      input.removeEventListener('input', update)
      input.removeEventListener('select', update)
      input.removeEventListener('scroll', update)
      input.removeEventListener('compositionstart', startComposition)
      input.removeEventListener('compositionend', endComposition)
      document.removeEventListener('selectionchange', selectionChanged)
      resizeObserver?.disconnect()
    }
  }, [inputRef, refresh])

  useLayoutEffect(() => { refresh() }, [refresh, value])

  return { ...presentation, refresh }
}
