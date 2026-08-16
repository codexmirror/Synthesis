import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState } from './GameContext'

afterEach(() => vi.useRealTimers())

function ActionHarness() {
  const actions = useGameActions(); const state = useGameState()
  return <><button onClick={() => {
    const results = [actions.startServiceAnalysis('host-lan-001', 'service-ssh-001'), actions.startServiceAnalysis('host-lan-001', 'service-http-001')]
    document.body.dataset.results = results.map(({ status }) => status).join(',')
  }}>start</button><output>{JSON.stringify(state.process)}</output></>
}

describe('GameProvider service-analysis actions', () => {
  it('atomically retains two concrete back-to-back starts', () => {
    render(<GameProvider><ActionHarness /></GameProvider>); fireEvent.click(screen.getByRole('button', { name: 'start' }))
    const process = JSON.parse(screen.getByRole('status').textContent ?? '')
    expect(process.processes.map(({ serviceId }: { serviceId: string }) => serviceId)).toEqual(['service-ssh-001', 'service-http-001'])
    expect(document.body.dataset.results).toBe('started,started')
  })
  it('does not rerender consumers during repeated idle scheduler ticks', () => {
    vi.useFakeTimers(); let renders = 0
    function Counter() { useGameState(); renders += 1; return null }
    render(<GameProvider><Counter /></GameProvider>); expect(renders).toBe(1); act(() => vi.advanceTimersByTime(2000)); expect(renders).toBe(1)
  })
})
