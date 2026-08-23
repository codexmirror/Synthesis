import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameProvider } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import type { GameState } from '../../core/game/types'
import { System } from './System'

function withDevice(overrides: Partial<GameState['player']['localDevice']>): GameState {
  const base = createInitialGameState()
  return { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, ...overrides } } }
}

const value = (label: string) => screen.getByText(label).parentElement?.querySelector('dd')?.textContent

describe('System', () => {
  it('derives machine identity, hardware and network from canonical Device state', () => {
    render(<GameProvider initialState={withDevice({
      displayName: 'field-node',
      firmware: { id: 'firmware-test', name: 'TEST-OS', version: '7.4' },
      hardware: { cpu: { name: 'Altered CPU', computeCapacity: 250 }, ram: { name: '16 GB', capacityMiB: 16_384 } },
      network: { ip: '203.0.113.77', transferCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 2_097_152 } },
      runtime: { baselineCpuLoad: 41, baselineRamUsage: 12, networkStatus: 'OFFLINE' },
    })}><System /></GameProvider>)

    expect(value('DEVICE')).toBe('field-node')
    expect(value('FIRMWARE')).toBe('TEST-OS')
    expect(value('VERSION')).toBe('7.4')
    expect(value('CPU')).toBe('Altered CPU')
    expect(value('RAM')).toBe('16 GB · 16384 MiB')
    expect(value('CPU LOAD')).toBe('41%')
    expect(value('RAM USED')).toBe('12%')
    expect(value('ADDRESS')).toBe('203.0.113.77')
    expect(value('STATUS')).toBe('OFFLINE')
  })

  it('presents the Device-owned installed software inventory', () => {
    render(<GameProvider initialState={withDevice({ installedSoftware: [
      { id: 'nodescan', releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental' },
    ] })}><System /></GameProvider>)

    expect(screen.getByText('NodeScan')).toBeInTheDocument()
    expect(screen.getByText('1.1 · EXPERIMENTAL · nodescan-1.1-experimental')).toBeInTheDocument()
    expect(screen.queryByText(/basic-credential-toolkit/)).not.toBeInTheDocument()
  })

  it('states an absent inventory rather than implying software exists', () => {
    render(<GameProvider initialState={withDevice({ installedSoftware: [] })}><System /></GameProvider>)
    expect(screen.getByText('NO INSTALLED SOFTWARE')).toBeInTheDocument()
  })

  it('does not present a second activity list beside the Activity Monitor', () => {
    render(<GameProvider><System /></GameProvider>)
    expect(screen.queryByText(/RUNNING|ACTIVITY|PROCESS|TRANSFER/i)).not.toBeInTheDocument()
  })
})
