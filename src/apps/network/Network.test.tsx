import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GameProvider, useGameActions } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { applyScanObservation } from '../../core/game/discovery'
import { scanNetworkTarget } from '../../core/game/scan'
import { Network } from './Network'

const base = createInitialGameState(); const targets = { localDevice: base.player.localDevice, network: base.world.network }
const withObservation = (...inputs: string[]) => ({ ...base, discovery: inputs.reduce((memory, input) => applyScanObservation(memory, scanNetworkTarget(targets, input)), base.discovery) })

function ObserveSelf() { const actions = useGameActions(); return <button onClick={() => actions.scanTarget(base.player.localDevice.network.ip)}>Observe self</button> }

describe('Discovery-backed Scan workspace', () => {
  it('mounts without observing and renders only intrinsic SELF on a fresh game', () => {
    render(<GameProvider><Network /></GameProvider>)
    expect(screen.getByText('SELF')).toBeInTheDocument(); expect(screen.getByText('198.51.100.23')).toBeInTheDocument(); expect(screen.getByText('No known relationships')).toBeInTheDocument()
    expect(screen.queryByText('home-net')).not.toBeInTheDocument(); expect(screen.queryByText('198.51.100.47')).not.toBeInTheDocument(); expect(screen.queryByText('SSH')).not.toBeInTheDocument()
  })
  it('persists a legitimate observation across Scan unmount and remount', async () => {
    const user = userEvent.setup(); const view = render(<GameProvider><ObserveSelf /><Network /></GameProvider>); await user.click(screen.getByText('Observe self')); expect(await screen.findByText('home-net')).toBeInTheDocument(); view.rerender(<GameProvider><ObserveSelf /><Network /></GameProvider>); expect(screen.getByText('home-net')).toBeInTheDocument()
  })
  it('browses a known network without observing, then explicitly scans it once', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={withObservation('198.51.100.23')}><Network /></GameProvider>); await user.click(screen.getByRole('button', { name: 'Open known area home-net' })); expect(screen.getByText('Members not observed yet')).toBeInTheDocument(); expect(screen.queryByText('198.51.100.47')).not.toBeInTheDocument(); await user.click(screen.getByText('SCAN NETWORK')); expect(await screen.findByText('198.51.100.47')).toBeInTheDocument(); expect(screen.queryByText('SSH')).not.toBeInTheDocument()
  })
  it('browses a discovered device without observing and explicitly discovers services', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={withObservation('198.51.100.23', 'home-net')}><Network /></GameProvider>); await user.click(screen.getByRole('button', { name: 'Open known area home-net' })); await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' })); expect(screen.getByText('Services not observed yet')).toBeInTheDocument(); await user.click(screen.getByText('SCAN DEVICE')); expect(await screen.findByText('SSH')).toBeInTheDocument(); expect(screen.getByText('HTTP')).toBeInTheDocument()
  })
  it('opens Service Detail from the remembered endpoint snapshot', async () => {
    const user = userEvent.setup(); const known = withObservation('198.51.100.23', 'home-net', '198.51.100.47'); const host = known.world.network.hosts[0]; const moved = { ...known, world: { network: { ...known.world.network, hosts: [{ ...host, ip: '198.51.100.83' }, ...known.world.network.hosts.slice(1)] } } }
    render(<GameProvider initialState={moved}><Network /></GameProvider>); await user.click(screen.getByRole('button', { name: 'Open known area home-net' })); await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' })); await user.click(screen.getByRole('button', { name: 'Open SSH service' })); expect(screen.getByText('198.51.100.47:22')).toBeInTheDocument(); expect(screen.queryByText('host-lan-001')).not.toBeInTheDocument()
  })
})
