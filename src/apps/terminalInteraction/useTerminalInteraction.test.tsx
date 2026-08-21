import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { isNearTerminalTail, useTerminalInteraction } from './useTerminalInteraction'

function Harness({ dispatch = () => undefined }: { dispatch?: (command: string) => void | Promise<void> }) {
  const [output, setOutput] = useState<string[]>([])
  const interaction = useTerminalInteraction({
    outputVersion: output,
    dispatch: async (command) => { await dispatch(command); setOutput((current) => [...current, command]) },
    onDispatchFailure: (command) => setOutput((current) => [...current, `${command}: failed`]),
  })
  return <form onSubmit={interaction.onSubmit}>
    <div aria-label="output" ref={interaction.outputRef} onScroll={interaction.onOutputScroll}>{output.join('|')}</div>
    <button type="button" onClick={() => setOutput((current) => [...current, 'later'])}>append output</button>
    <input aria-label="command" ref={interaction.inputRef} value={interaction.input} onChange={(event) => interaction.setInput(event.target.value)} onKeyDown={interaction.onKeyDown} onCompositionStart={interaction.onCompositionStart} onCompositionEnd={interaction.onCompositionEnd} />
  </form>
}

describe('Terminal interaction foundation', () => {
  it('uses a modest near-tail tolerance', () => {
    expect(isNearTerminalTail({ scrollTop: 471, clientHeight: 500, scrollHeight: 1000 })).toBe(false)
    expect(isNearTerminalTail({ scrollTop: 472, clientHeight: 500, scrollHeight: 1000 })).toBe(true)
  })

  it('preserves the live draft while navigating per-instance history', async () => {
    const user = userEvent.setup()
    render(<><Harness /><Harness /></>)
    const [first, second] = screen.getAllByLabelText('command')
    await user.type(first, 'help{Enter}analy{ArrowUp}{ArrowDown}')
    expect(first).toHaveValue('analy')
    expect(second).toHaveValue('')
    await user.click(second)
    await user.keyboard('{ArrowUp}')
    expect(second).toHaveValue('')
  })

  it('guards pending dispatch, preserves the next draft, and recovers after rejection', async () => {
    const user = userEvent.setup()
    let reject!: () => void
    const dispatch = vi.fn(() => new Promise<void>((_resolve, rejectPromise) => { reject = () => rejectPromise(new Error('no')) }))
    render(<Harness dispatch={dispatch} />)
    const input = screen.getByLabelText('command')
    await user.type(input, 'scan home{Enter}next{Enter}')
    expect(input).toHaveValue('next')
    expect(dispatch).toHaveBeenCalledTimes(1)
    reject()
    expect(await screen.findByText('scan home: failed')).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, 'help{Enter}')
    expect(dispatch).toHaveBeenCalledTimes(2)
  })

  it('does not submit Enter used by an active composition', async () => {
    const user = userEvent.setup()
    const dispatch = vi.fn()
    render(<Harness dispatch={dispatch} />)
    const input = screen.getByLabelText('command')
    await user.type(input, 'text')
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    await user.keyboard('{Enter}')
    expect(dispatch).not.toHaveBeenCalled()
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
  })

  it('also rejects native composing and IME-process Enter at the keyboard boundary', () => {
    const dispatch = vi.fn()
    render(<Harness dispatch={dispatch} />)
    const input = screen.getByLabelText('command')
    fireEvent.change(input, { target: { value: 'text' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('keeps manual follow-tail intent across output and submit transitions using rendered geometry', async () => {
    const user = userEvent.setup()
    let scrollHeight = 500
    const dispatch = vi.fn(() => { scrollHeight = 900 })
    render(<Harness dispatch={dispatch} />)
    const output = screen.getByLabelText('output')
    Object.defineProperties(output, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, get: () => scrollHeight },
    })

    output.scrollTop = 200
    fireEvent.scroll(output)
    scrollHeight = 700
    await user.click(screen.getByRole('button', { name: 'append output' }))
    expect(output.scrollTop).toBe(200)

    output.scrollTop = 572
    fireEvent.scroll(output)
    scrollHeight = 800
    await user.click(screen.getByRole('button', { name: 'append output' }))
    expect(output.scrollTop).toBe(800)

    output.scrollTop = 0
    fireEvent.scroll(output)
    await user.type(screen.getByLabelText('command'), 'help{Enter}')
    expect(dispatch).toHaveBeenCalledWith('help')
    expect(output.scrollTop).toBe(900)
  })
})
