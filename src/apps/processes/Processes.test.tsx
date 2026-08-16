import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import type { GameState } from '../../core/game/types'
import { appEntries, appRegistry } from '../../shell/appRegistry'
import { Processes } from './Processes'

afterEach(() => vi.useRealTimers())
const withProcesses = (): GameState => ({ ...createInitialGameState(), process: { nextId: 3, processes: [
  { id: 'process-0001', label: 'Active analysis', executorDeviceId: 'device-local-v0', status: 'running', workRequired: 100, workCompleted: 25, ramRequiredMiB: 512 },
  { id: 'process-0002', label: 'Finished analysis', executorDeviceId: 'device-local-v0', status: 'completed', workRequired: 100, workCompleted: 100, ramRequiredMiB: 512 },
] } })

describe('Processes application integration', () => {
  it('is the seventh canonical app while Network remains registered', () => { expect(appEntries).toHaveLength(7); expect(appRegistry).toHaveProperty('processes'); expect(appRegistry).toHaveProperty('network') })
  it('renders a clear idle state', () => { render(<GameProvider><Processes /></GameProvider>); expect(screen.getByText('No active processes')).toBeInTheDocument(); expect(screen.getByText('18%')).toBeInTheDocument() })
  it('renders running progress/allocation/RAM and retained completion', () => { render(<GameProvider initialState={withProcesses()}><Processes /></GameProvider>); expect(screen.getByText('25% complete')).toBeInTheDocument(); expect(screen.getByText('CPU 82%')).toBeInTheDocument(); expect(screen.getByText('RAM 512 MiB')).toBeInTheDocument(); expect(screen.getByText('Finished analysis')).toBeInTheDocument(); expect(screen.getByText('completed')).toBeInTheDocument() })
  it('advances at the provider boundary even when the app is not mounted', () => { vi.useFakeTimers(); const state = withProcesses(); function Snapshot() { const value = useGameState().process.processes[0].workCompleted; return <output>{value}</output> } render(<GameProvider initialState={state}><Snapshot /></GameProvider>); expect(screen.getByText('25')).toBeInTheDocument(); act(() => vi.advanceTimersByTime(500)); expect(Number(screen.getByRole('status').textContent)).toBeGreaterThan(25) })
})
