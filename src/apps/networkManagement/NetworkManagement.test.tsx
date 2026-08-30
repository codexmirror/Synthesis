import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import type { GameState } from '../../core/game/types'
import { NetworkManagement } from './NetworkManagement'

function withState(overrides: Partial<GameState>): GameState {
  return { ...createInitialGameState(), ...overrides }
}

function Capture() {
  const state = useGameState()
  return <output data-testid="state">{JSON.stringify(state)}</output>
}

describe('NetworkManagement', () => {
  it('presents the authorized home-net Network directly, with its real name and represented external capacity', () => {
    render(<GameProvider initialState={createInitialGameState()}><NetworkManagement /></GameProvider>)
    expect(screen.getByText('home-net')).toBeInTheDocument()
    expect(screen.getByText('MANAGED NETWORK')).toBeInTheDocument()
    // Symmetric home-net capacity: both upload and download render the same represented maximum.
    expect(screen.getAllByText('16 MiB/s')).toHaveLength(2)
  })

  it('presents a truthful coarse member count without enumerating member identity or leaking srv-01', () => {
    const state = createInitialGameState()
    render(<GameProvider initialState={state}><NetworkManagement /></GameProvider>)
    // home-net has exactly two members: the local Device and host-lan-001 (srv-01).
    expect(screen.getByText('MEMBERS').parentElement).toHaveTextContent('2')
    // Opening Network on a fresh game must not reveal srv-01 identity/address before NodeScan legitimately exposes it.
    expect(screen.queryByText('srv-01')).not.toBeInTheDocument()
    expect(screen.queryByText('198.51.100.47')).not.toBeInTheDocument()
    expect(screen.queryByText(/connected|online/i)).not.toBeInTheDocument()
  })

  it('presents a truthful empty Activity state before any record exists', () => {
    render(<GameProvider initialState={createInitialGameState()}><NetworkManagement /></GameProvider>)
    expect(screen.getByText('NO ACTIVITY')).toBeInTheDocument()
    expect(screen.getByText('No activity has been observed on this Network yet.')).toBeInTheDocument()
  })

  it('presents existing connection-attempt, FileTransfer, and RackUpdate submission evidence from observable fields alone, never resolving hidden Device identity', () => {
    const base = createInitialGameState()
    const homeNet = base.world.network.localNetworks[0]
    const state: GameState = {
      ...base,
      world: {
        ...base.world,
        network: {
          ...base.world.network,
          localNetworks: [
            {
              ...homeNet,
              activityHistory: {
                nextId: 4,
                records: [
                  { id: 'net-activity-0001', kind: 'connection_attempt', perspective: 'internal', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', sourceAddress: base.player.localDevice.network.ip, targetAddress: '198.51.100.47', serviceId: 'service-ssh-001', serviceName: 'SSH', result: 'SUCCESS' },
                  { id: 'net-activity-0002', kind: 'file_transfer', perspective: 'internal', sourceDeviceId: 'host-lan-001', destinationDeviceId: base.player.localDevice.id, sourceAddress: '198.51.100.47', destinationAddress: base.player.localDevice.network.ip, bytesTransferred: 2048, result: 'COMPLETED' },
                  { id: 'net-activity-0003', kind: 'package_submission', perspective: 'outbound', sourceDeviceId: base.player.localDevice.id, destinationDeviceId: 'host-lan-002', sourceAddress: base.player.localDevice.network.ip, destinationAddress: '203.0.113.42', bytesTransferred: 512, result: 'INTERRUPTED' },
                ],
              },
            },
            ...base.world.network.localNetworks.slice(1),
          ],
        },
      },
    }

    render(<GameProvider initialState={state}><NetworkManagement /></GameProvider>)

    expect(screen.getByText('CONNECTION ATTEMPT')).toBeInTheDocument()
    expect(screen.getByText('FILE TRANSFER')).toBeInTheDocument()
    expect(screen.getByText('PACKAGE SUBMISSION')).toBeInTheDocument()
    expect(screen.getByText(/198\.51\.100\.23 → 198\.51\.100\.47/)).toHaveTextContent('SSH')
    expect(screen.getByText(/198\.51\.100\.47 → 198\.51\.100\.23/)).toHaveTextContent('2 KB')
    expect(screen.getByText(/198\.51\.100\.23 → 203\.0\.113\.42/)).toHaveTextContent('512 B')
    expect(screen.getByText('SUCCESS')).toBeInTheDocument()
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    expect(screen.getByText('INTERRUPTED')).toBeInTheDocument()
    // Never internal stable Device or Service IDs.
    expect(screen.queryByText(/host-lan-001/)).not.toBeInTheDocument()
    expect(screen.queryByText(/device-local-v0/)).not.toBeInTheDocument()
    expect(screen.queryByText(/service-ssh-001/)).not.toBeInTheDocument()
  })

  it('presents no administrative Network truth once the local Device management authority is removed', () => {
    const base = createInitialGameState()
    const state = withState({ networkManagement: { ...base.networkManagement, established: [] } })
    render(<GameProvider initialState={state}><NetworkManagement /></GameProvider>)
    expect(screen.getByText('NO MANAGED NETWORK')).toBeInTheDocument()
    expect(screen.queryByText('home-net')).not.toBeInTheDocument()
    expect(screen.queryByText('MANAGED NETWORK')).not.toBeInTheDocument()
  })

  it('still holds Network membership after authority is removed, proving membership alone is not what the app requires', () => {
    const base = createInitialGameState()
    const state = withState({ networkManagement: { ...base.networkManagement, established: [] } })
    // Membership itself is untouched World Truth; only the explicit authority relationship was removed.
    expect(state.world.network.localNetworks[0].memberDeviceIds).toContain(state.player.localDevice.id)
    render(<GameProvider initialState={state}><NetworkManagement /></GameProvider>)
    expect(screen.queryByText('16 MiB/s')).not.toBeInTheDocument()
    expect(screen.getByText('NO MANAGED NETWORK')).toBeInTheDocument()
  })

  it('does not mutate NodeScan Discovery merely by being opened', () => {
    const initialState = createInitialGameState()
    render(<GameProvider initialState={initialState}><NetworkManagement /><Capture /></GameProvider>)
    const rendered = JSON.parse(screen.getByTestId('state').textContent!) as GameState
    expect(rendered.discovery).toEqual(initialState.discovery)
  })
})
