import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState, type GameActionStartProcessInput } from './GameContext'

afterEach(() => vi.useRealTimers())

function ActionHarness({ inputs }: { inputs: readonly GameActionStartProcessInput[] }) {
  const actions = useGameActions()
  const state = useGameState()
  return <>
    <button onClick={() => {
      const results = inputs.map((input) => actions.startProcess(input))
      document.body.dataset.results = results.map((result) => result.status).join(',')
    }}>start</button>
    <output>{JSON.stringify(state.process)}</output>
  </>
}

describe('GameProvider process actions', () => {
  it('atomically retains two back-to-back starts with sequential IDs and reservations', () => {
    render(<GameProvider><ActionHarness inputs={[
      { label: 'A', workRequired: 1000, ramRequiredMiB: 500 },
      { label: 'B', workRequired: 1000, ramRequiredMiB: 500 },
    ]} /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    const process = JSON.parse(screen.getByRole('status').textContent ?? '')
    expect(process.nextId).toBe(3)
    expect(process.processes.map(({ id }: { id: string }) => id)).toEqual(['process-0001', 'process-0002'])
    expect(process.processes.reduce((sum: number, item: { ramRequiredMiB: number }) => sum + item.ramRequiredMiB, 0)).toBe(1000)
    expect(document.body.dataset.results).toBe('started,started')
  })

  it('admits the second call against the first reservation without consuming a rejected ID', () => {
    render(<GameProvider><ActionHarness inputs={[
      { label: 'A', workRequired: 1000, ramRequiredMiB: 3000 },
      { label: 'B', workRequired: 1000, ramRequiredMiB: 200 },
    ]} /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    const process = JSON.parse(screen.getByRole('status').textContent ?? '')
    expect(process).toMatchObject({ nextId: 2, processes: [{ id: 'process-0001', label: 'A' }] })
    expect(document.body.dataset.results).toBe('started,insufficient_memory')
  })

  it('always assigns the local executor even if an untyped caller attempts to spoof it', () => {
    const spoofed = { label: 'A', workRequired: 1000, ramRequiredMiB: 100, executorDeviceId: 'host-lan-001' } as GameActionStartProcessInput
    render(<GameProvider><ActionHarness inputs={[spoofed]} /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    const process = JSON.parse(screen.getByRole('status').textContent ?? '')
    expect(process.processes[0].executorDeviceId).toBe('device-local-v0')
  })

  it('does not rerender consumers during repeated idle scheduler ticks', () => {
    vi.useFakeTimers()
    let renders = 0
    function Counter() { useGameState(); renders += 1; return null }
    render(<GameProvider><Counter /></GameProvider>)
    expect(renders).toBe(1)
    act(() => vi.advanceTimersByTime(2000))
    expect(renders).toBe(1)
  })
})
