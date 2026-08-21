import './terminalInteraction.css'
import { type ReactNode, useId } from 'react'
import type { TerminalInteraction } from './useTerminalInteraction'

type TerminalInteractionFrameProps = {
  interaction: TerminalInteraction
  ariaLabel: string
  inputAriaLabel: string
  prompt: ReactNode
  children: ReactNode
  className?: string
  outputClassName?: string
  formClassName?: string
  promptClassName?: string
  inputClassName?: string
  inputId?: string
  inputPrefix?: ReactNode
}

export function TerminalInteractionFrame({
  interaction,
  ariaLabel,
  inputAriaLabel,
  prompt,
  children,
  className,
  outputClassName,
  formClassName,
  promptClassName,
  inputClassName,
  inputId,
  inputPrefix,
}: TerminalInteractionFrameProps) {
  const generatedInputId = useId()
  const resolvedInputId = inputId ?? generatedInputId

  return (
    <section className={classes('terminal-interaction-frame', className)} aria-label={ariaLabel}>
      <div
        className={classes('terminal-interaction-output', outputClassName)}
        data-editing-scroll-owner
        ref={interaction.outputRef}
        onScroll={interaction.onOutputScroll}
      >
        {children}
      </div>
      <form className={classes('terminal-interaction-form', formClassName)} onSubmit={interaction.onSubmit}>
        <label className={promptClassName} htmlFor={resolvedInputId}>{prompt}</label>
        {inputPrefix}
        <input
          id={resolvedInputId}
          className={inputClassName}
          ref={interaction.inputRef}
          value={interaction.input}
          onChange={(event) => interaction.setInput(event.target.value)}
          onKeyDown={interaction.onKeyDown}
          onCompositionStart={interaction.onCompositionStart}
          onCompositionEnd={interaction.onCompositionEnd}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          aria-label={inputAriaLabel}
        />
      </form>
    </section>
  )
}

function classes(...values: (string | undefined)[]) {
  return values.filter(Boolean).join(' ')
}
