import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import nodeTerminalSource from '../terminal/Terminal.tsx?raw'
import nodeTerminalCss from '../terminal/terminal.css?raw'
import rackTerminalSource from '../rackos/RackOS.tsx?raw'
import { TerminalInteractionFrame } from './TerminalInteractionFrame'
import frameCss from './terminalInteraction.css?raw'
import { useTerminalInteraction } from './useTerminalInteraction'

function Harness({ dispatch = () => undefined }: { dispatch?: (command: string) => void }) {
  const [lines, setLines] = useState<string[]>([])
  const interaction = useTerminalInteraction({
    dispatch: (command) => { dispatch(command); setLines((current) => [...current, command]) },
    onDispatchFailure: () => undefined,
    outputVersion: lines,
  })

  return <TerminalInteractionFrame interaction={interaction} ariaLabel="Test Terminal" inputAriaLabel="Test command" prompt="test >">
    {lines.map((line) => <div key={line}>{line}</div>)}
  </TerminalInteractionFrame>
}

describe('TerminalInteractionFrame', () => {
  it('supplies the complete input, form, and output browser bindings', async () => {
    const dispatch = vi.fn()
    const user = userEvent.setup()
    render(<Harness dispatch={dispatch} />)

    const frame = screen.getByRole('region', { name: 'Test Terminal' })
    const output = frame.querySelector('.terminal-interaction-output') as HTMLDivElement
    const input = screen.getByRole('textbox', { name: 'Test command' })

    expect(frame).toHaveClass('terminal-interaction-frame')
    expect(output).toHaveAttribute('data-editing-scroll-owner')
    expect(input).toHaveAttribute('autocapitalize', 'none')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(input).toHaveAttribute('autocorrect', 'off')
    expect(input).toHaveAttribute('spellcheck', 'false')
    expect(input).toHaveAttribute('enterkeyhint', 'send')
    expect(input).not.toHaveAttribute('autofocus')
    expect(output).not.toHaveAttribute('aria-live')

    Object.defineProperties(output, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
    })
    output.scrollTop = 0
    fireEvent.scroll(output)
    await user.type(input, 'help{Enter}')
    expect(dispatch).toHaveBeenCalledWith('help')
    expect(output.scrollTop).toBe(500)
  })

  it('owns the shared shrinkable frame and internal output scrolling contract', () => {
    expect(frameCss).toMatch(/\.terminal-interaction-frame\s*{[^}]*min-height:\s*0;[^}]*display:\s*grid;[^}]*grid-template-rows:\s*minmax\(0, 1fr\) auto;[^}]*overflow:\s*hidden;/)
    expect(frameCss).toMatch(/\.terminal-interaction-output\s*{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;[^}]*overflow-x:\s*hidden;[^}]*overscroll-behavior-y:\s*contain;[^}]*touch-action:\s*pan-y pinch-zoom;/)
  })

  it('is the shared structural consumer for NODE and RACK without the old NODE reserve', () => {
    expect(nodeTerminalSource).toContain('<TerminalInteractionFrame')
    expect(rackTerminalSource).toContain('<TerminalInteractionFrame')
    expect(nodeTerminalSource).not.toContain('data-editing-scroll-owner')
    expect(rackTerminalSource).not.toContain('data-editing-scroll-owner')
    expect(nodeTerminalSource).not.toContain('autoCapitalize=')
    expect(rackTerminalSource).not.toContain('autoCapitalize=')
    expect(nodeTerminalCss).not.toContain('72px')
    expect(nodeTerminalCss).not.toContain('data-standalone="false"')
  })
})
