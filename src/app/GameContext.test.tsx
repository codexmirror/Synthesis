import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState } from './GameContext'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'

afterEach(() => vi.useRealTimers())

function ActionHarness({ onRender }: { onRender?: () => void }) {
  const actions = useGameActions(); const state = useGameState()
  onRender?.()
  return <><button onClick={() => {
    const results = [actions.startServiceAnalysis('host-lan-001', 'service-ssh-001'), actions.startServiceAnalysis('host-lan-001', 'service-http-001')]
    document.body.dataset.results = results.map(({ status }) => status).join(',')
  }}>start</button><output>{JSON.stringify(state.process)}</output></>
}

describe('GameProvider service-analysis actions', () => {
  it('atomically retains two concrete back-to-back starts', () => {
    let renders = 0
    render(<GameProvider><ActionHarness onRender={() => { renders += 1 }} /></GameProvider>); fireEvent.click(screen.getByRole('button', { name: 'start' }))
    const process = JSON.parse(screen.getByRole('status').textContent ?? '')
    expect(process.processes.map(({ serviceId }: { serviceId: string }) => serviceId)).toEqual(['service-ssh-001', 'service-http-001'])
    expect(process.processes.map(({ id }: { id: string }) => id)).toEqual(['process-0001', 'process-0002'])
    expect(process.processes.map(({ ramRequiredMiB }: { ramRequiredMiB: number }) => ramRequiredMiB)).toEqual([768, 768])
    expect(process.processes.every(({ executorDeviceId }: { executorDeviceId: string }) => executorDeviceId === 'device-local-v0')).toBe(true)
    expect(process.nextId).toBe(3)
    expect(document.body.dataset.results).toBe('started,started')
    expect(renders).toBe(2)
  })
  it('applies the first reservation before rejecting an immediate second start without consuming an ID', () => {
    const base = createInitialGameState()
    const constrained: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, hardware: { ...base.player.localDevice.hardware, ram: { ...base.player.localDevice.hardware.ram, capacityMiB: 1800 } } } } }
    let renders = 0
    render(<GameProvider initialState={constrained}><ActionHarness onRender={() => { renders += 1 }} /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    const process = JSON.parse(screen.getByRole('status').textContent ?? '')
    expect(document.body.dataset.results).toBe('started,insufficient_memory')
    expect(process).toMatchObject({ nextId: 2, processes: [{ id: 'process-0001', serviceId: 'service-ssh-001', executorDeviceId: 'device-local-v0', ramRequiredMiB: 768 }] })
    expect(process.processes).toHaveLength(1)
    expect(renders).toBe(2)
  })
  it('does not rerender consumers during repeated idle scheduler ticks', () => {
    vi.useFakeTimers(); let renders = 0
    function Counter() { useGameState(); renders += 1; return null }
    render(<GameProvider><Counter /></GameProvider>); expect(renders).toBe(1); act(() => vi.advanceTimersByTime(2000)); expect(renders).toBe(1)
  })
})
