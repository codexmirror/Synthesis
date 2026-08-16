import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GameProvider } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { appRegistry } from '../../shell/appRegistry'
import { Network } from './Network'

async function openLanDevice() {
  const user = userEvent.setup()
  render(<GameProvider><Network /></GameProvider>)
  await user.click(screen.getByRole('button', { name: 'Scan network' }))
  await user.click(screen.getByRole('button', { name: 'Scan device 198.51.100.47' }))
  return user
}

describe('Scan workspace', () => {
  it('preserves the network registry identity while exposing Scan', () => {
    expect(appRegistry.network.label).toBe('Scan')
    expect(Object.keys(appRegistry)).toHaveLength(7)
  })

  it('discovers the local hierarchy from shared observations', async () => {
    const user = userEvent.setup()
    render(<GameProvider><Network /></GameProvider>)
    expect(screen.getByText('home-net')).toBeInTheDocument()
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Scan network' }))
    expect(screen.getByText('2 responding')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.23')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.47')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Scan device 198.51.100.47' }))
    expect(screen.getByText('1 discovered')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'SSH' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'HTTP' })).toBeInTheDocument()
    expect(screen.getByText('22 / TCP')).toBeInTheDocument()
    expect(screen.getByText('80 / TCP')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.47:22')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/service-ssh-001|host-lan-001|vulnerability-ssh-001/)
  })

  it('copies device addresses and complete endpoints', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const user = await openLanDevice()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await user.click(screen.getByRole('button', { name: 'Copy 198.51.100.47' }))
    await user.click(screen.getByRole('button', { name: 'Copy 198.51.100.47:22' }))
    expect(writeText).toHaveBeenNthCalledWith(1, '198.51.100.47')
    expect(writeText).toHaveBeenNthCalledWith(2, '198.51.100.47:22')
  })

  it('starts concrete analyses and presents canonical running state', async () => {
    const user = await openLanDevice()
    const analyze = screen.getAllByRole('button', { name: 'Analyze' })[0]
    await user.click(analyze)
    expect(screen.getByText('ANALYSIS RUNNING')).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: 'Analyze' })).toHaveLength(1)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    await waitFor(() => expect(Number(screen.getByRole('progressbar').getAttribute('value'))).toBeGreaterThan(0), { timeout: 1500 })
  })

  it('uses retained Knowledge even if current vulnerability truth has changed', async () => {
    const base = createInitialGameState()
    const host = base.world.network.hosts.find((candidate) => candidate.ip === '198.51.100.47')!
    const ssh = host.services![0]
    const state = {
      ...base,
      world: { network: { ...base.world.network, hosts: base.world.network.hosts.map((candidate) => candidate.id === host.id ? { ...candidate, services: candidate.services?.map((service) => service.id === ssh.id ? { ...service, vulnerabilities: [] } : service) } : candidate) } },
      knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'historical', targetDeviceId: host.id, serviceId: ssh.id, observedLabel: 'Weak authentication configuration' }] },
    }
    const user = userEvent.setup()
    render(<GameProvider initialState={state}><Network /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'Scan network' }))
    await user.click(screen.getByRole('button', { name: 'Scan device 198.51.100.47' }))
    expect(screen.getByText('Weak authentication configuration')).toBeInTheDocument()
  })

  it('reports canonical memory contention locally', async () => {
    const state = createInitialGameState()
    const constrained = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, hardware: { ...state.player.localDevice.hardware, ram: { ...state.player.localDevice.hardware.ram, capacityMiB: 700 } } } } }
    const user = userEvent.setup()
    render(<GameProvider initialState={constrained}><Network /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'Scan network' }))
    await user.click(screen.getByRole('button', { name: 'Scan device 198.51.100.47' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Analyze' })[0])
    expect(screen.getByText(/INSUFFICIENT MEMORY/)).toBeInTheDocument()
  })
})
