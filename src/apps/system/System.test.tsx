import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { installLocalSoftwarePackage } from '../../core/game/softwareInstallation'
import { advanceGameState } from '../../core/game/gameAdvancement'
import type { GameState } from '../../core/game/types'
import { System } from './System'

function withDevice(overrides: Partial<GameState['player']['localDevice']>): GameState {
  const base = createInitialGameState()
  return { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, ...overrides } } }
}

const value = (label: string) => screen.getByText(label).parentElement?.querySelector('dd')?.textContent

afterEach(() => { vi.useRealTimers() })

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
    expect(screen.getByText('1.1 · EXPERIMENTAL')).toBeInTheDocument()
    expect(screen.queryByText(/basic-credential-toolkit/)).not.toBeInTheDocument()
  })

  it('presents the installed NODE Miner release as unofficial third-party software', () => {
    const base = createInitialGameState()
    const started = installLocalSoftwarePackage(base, '/home/user/downloads/node-miner-1.0.pkg')
    if (started.status !== 'started') throw new Error(started.status)
    const installed = advanceGameState(started.state, 20_000)
    render(<GameProvider initialState={installed}><System /></GameProvider>)

    expect(screen.getByText('NODE Miner')).toBeInTheDocument()
    expect(screen.getByText('1.0 · UNOFFICIAL · nm-dev')).toBeInTheDocument()
  })

  it('states an absent inventory rather than implying software exists', () => {
    render(<GameProvider initialState={withDevice({ installedSoftware: [] })}><System /></GameProvider>)
    expect(screen.getByText('NO INSTALLED SOFTWARE')).toBeInTheDocument()
  })

  it('renders ordinary installed software without inventing a removal action', async () => {
    render(<GameProvider initialState={withDevice({ installedSoftware: [
      { id: 'packet-viewer', releaseId: 'packet-viewer-1.0', name: 'Packet Viewer', version: '1.0', channel: 'standard', publisher: 'test-publisher' },
    ] })}><System /></GameProvider>)
    const row = screen.getByRole('button', { name: 'Packet Viewer 1.0 · STANDARD · test-publisher' })
    await userEvent.setup().click(row)
    expect(value('STATE')).toBe('INSTALLED')
    expect(screen.queryByRole('button', { name: /UNINSTALL|REMOVE|RESTORE/ })).not.toBeInTheDocument()
  })

  it('does not present a second activity list beside the Activity Monitor', () => {
    render(<GameProvider><System /></GameProvider>)
    expect(screen.queryByText(/RUNNING|ACTIVITY|PROCESS|TRANSFER/i)).not.toBeInTheDocument()
  })

  it('manages installed software inline, with no row arrows and no standalone destructive controls', async () => {
    const started = installLocalSoftwarePackage(createInitialGameState(), '/home/user/downloads/node-miner-1.0.pkg')
    if (started.status !== 'started') throw new Error(started.status)
    const { container } = render(<GameProvider initialState={advanceGameState(started.state, 20_000)}><System /></GameProvider>)

    expect(container.querySelectorAll('.node-row-arrow')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /Remove|Restore/ })).not.toBeInTheDocument()
    const rows = ['NodeScan 1.0 · STANDARD', 'Basic Credential Toolkit 1.0', 'NODE Miner 1.0 · UNOFFICIAL · nm-dev']
    for (const name of rows) {
      const row = screen.getByRole('button', { name })
      expect(row).toHaveAttribute('aria-expanded', 'false')
      expect(row.querySelector('svg')).toBeNull()
    }
  })

  it('expands one software row at a time, in place, and collapses it again', async () => {
    const started = installLocalSoftwarePackage(createInitialGameState(), '/home/user/downloads/node-miner-1.0.pkg')
    if (started.status !== 'started') throw new Error(started.status)
    const { container } = render(<GameProvider initialState={advanceGameState(started.state, 20_000)}><System /></GameProvider>)
    const user = userEvent.setup()
    const miner = screen.getByRole('button', { name: /^NODE Miner 1\.0/ })

    await user.click(miner)
    expect(miner).toHaveAttribute('aria-expanded', 'true')
    expect(container.querySelectorAll('.software-expanded')).toHaveLength(1)
    // Inline: still the System screen, with the whole inventory and Device state present.
    expect(screen.getByText('INSTALLED SOFTWARE')).toBeInTheDocument()
    expect(screen.getByText('HARDWARE')).toBeInTheDocument()
    expect(screen.getByText('Unofficial NODE mining software that converts Device compute into NODE production.')).toBeInTheDocument()
    expect(screen.getByText('NODE MINING')).toBeInTheDocument()
    expect(screen.getByText('PAYOUT CONFIGURATION')).toBeInTheDocument()
    expect(value('STATE')).toBe('INSTALLED')
    expect(screen.getByRole('button', { name: 'UNINSTALL' })).toBeInTheDocument()

    await user.click(miner)
    expect(miner).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelectorAll('.software-expanded')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'UNINSTALL' })).not.toBeInTheDocument()

    await user.click(miner)
    await user.click(screen.getByRole('button', { name: /^Basic Credential Toolkit/ }))
    expect(container.querySelectorAll('.software-expanded')).toHaveLength(1)
    expect(miner).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('NODE MINING')).not.toBeInTheDocument()
    expect(screen.getByText('CREDENTIAL ACCESS')).toBeInTheDocument()
  })

  it('keeps detailed release facts behind an explicit disclosure', async () => {
    const started = installLocalSoftwarePackage(createInitialGameState(), '/home/user/downloads/node-miner-1.0.pkg')
    if (started.status !== 'started') throw new Error(started.status)
    render(<GameProvider initialState={advanceGameState(started.state, 20_000)}><System /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^NODE Miner 1\.0/ }))
    expect(screen.queryByText('CHANGES')).not.toBeInTheDocument()
    expect(screen.queryByText('node-miner-1.0')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /RELEASE INFORMATION/ }))
    expect(screen.getByText('CHANGES')).toBeInTheDocument()
    expect(screen.getByText('Initial unofficial release.')).toBeInTheDocument()
    expect(value('RELEASE')).toBe('node-miner-1.0')

    await user.click(screen.getByRole('button', { name: /RELEASE INFORMATION/ }))
    expect(screen.queryByText('node-miner-1.0')).not.toBeInTheDocument()
  })

  it('expands the protected NodeScan baseline with truthful system context and no destructive action', async () => {
    render(<GameProvider><System /></GameProvider>)
    await userEvent.setup().click(screen.getByRole('button', { name: /^NodeScan 1\./ }))

    expect(screen.getByText('Standard NODE-OS network reconnaissance software.')).toBeInTheDocument()
    expect(screen.getByText('NETWORK SCAN')).toBeInTheDocument()
    expect(screen.getByText('SERVICE ANALYSIS')).toBeInTheDocument()
    expect(screen.queryByText('TARGET INSPECT')).not.toBeInTheDocument()
    expect(value('STATE')).toBe('SYSTEM BASELINE')
    expect(value('PROVIDED BY')).toBe('NODE-OS 1.0')
    expect(screen.queryByRole('button', { name: /RESTORE|UNINSTALL|REMOVE/ })).not.toBeInTheDocument()
  })

  it('restores NodeScan through canonical removal while keeping its expanded row open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const base = createInitialGameState()
    const experimental: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: base.player.localDevice.installedSoftware.map((software) => software.id === 'nodescan' ? { ...software, releaseId: 'nodescan-1.1-experimental', version: '1.1', channel: 'experimental' } : software) } } }
    render(<GameProvider initialState={experimental}><System /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    expect(screen.queryByRole('button', { name: 'RESTORE 1.0 STANDARD' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^NodeScan 1\./ }))
    expect(screen.getByText('TARGET INSPECT')).toBeInTheDocument()
    expect(value('ACTIVE')).toBe('1.1 · EXPERIMENTAL')
    expect(value('BASELINE')).toBe('1.0 STANDARD')

    await user.click(screen.getByRole('button', { name: 'RESTORE 1.0 STANDARD' }))
    expect(value('STATE')).toBe('RESTORING')
    expect(screen.getByText('1.1 · EXPERIMENTAL · RESTORING')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /RESTORE|UNINSTALL/ })).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(20_000) })
    expect(screen.getByText('1.0 · STANDARD')).toBeInTheDocument()
    expect(value('STATE')).toBe('SYSTEM BASELINE')
    expect(value('PROVIDED BY')).toBe('NODE-OS 1.0')
  })

  it('expands the credential toolkit as ordinary software without baseline claims or an unsupported removal action', async () => {
    render(<GameProvider><System /></GameProvider>)
    await userEvent.setup().click(screen.getByRole('button', { name: /Basic Credential Toolkit/ }))
    expect(screen.getByText('Credential-focused offensive toolkit for represented authentication techniques.')).toBeInTheDocument()
    expect(screen.getByText('CREDENTIAL ACCESS')).toBeInTheDocument()
    expect(screen.getByText('AUTH-017 SUPPORT')).toBeInTheDocument()
    expect(value('STATE')).toBe('INSTALLED')
    expect(screen.queryByText('SYSTEM BASELINE')).not.toBeInTheDocument()
    expect(screen.queryByText(/PROVIDED BY/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /UNINSTALL|REMOVE|RESTORE/ })).not.toBeInTheDocument()
  })

  it('uninstalls NODE Miner canonically, showing REMOVING with no second action, and collapses when it is gone', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const started = installLocalSoftwarePackage(createInitialGameState(), '/home/user/downloads/node-miner-1.0.pkg')
    if (started.status !== 'started') throw new Error(started.status)
    const installed = advanceGameState(started.state, 20_000)
    render(<GameProvider initialState={installed}><System /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: /^NODE Miner 1\.0/ }))
    await user.click(screen.getByRole('button', { name: 'UNINSTALL' }))

    expect(value('STATE')).toBe('REMOVING')
    expect(screen.getByText('1.0 · UNOFFICIAL · nm-dev · REMOVING')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /UNINSTALL|REMOVE/ })).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(20_000) })
    expect(screen.getByText('INSTALLED SOFTWARE')).toBeInTheDocument()
    expect(screen.queryByText('NODE Miner')).not.toBeInTheDocument()
  })

  it('shows factual metadata and no invented documentation for an unknown NodeScan release', async () => {
    const state = withDevice({ installedSoftware: [{ id: 'nodescan', releaseId: 'nodescan-future', name: 'NodeScan', version: '2.4', channel: 'preview' }] })
    render(<GameProvider initialState={state}><System /></GameProvider>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^NodeScan 2\.4/ }))
    expect(value('ACTIVE')).toBe('2.4 · PREVIEW')
    await user.click(screen.getByRole('button', { name: /RELEASE INFORMATION/ }))
    expect(value('RELEASE')).toBe('nodescan-future')
    for (const heading of ['ABOUT', 'CAPABILITIES', 'CHANGES']) expect(screen.queryByText(heading)).not.toBeInTheDocument()
    expect(screen.queryByText('1.1 EXPERIMENTAL')).not.toBeInTheDocument()
  })

})
