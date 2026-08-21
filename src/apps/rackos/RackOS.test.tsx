import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { connectRemoteFromObservation } from '../../core/game/remoteSession'
import { createInitialGameState } from '../../core/game/initialState'
import { Shell } from '../../shell/Shell'
import type { GameState } from '../../core/game/types'
import { rememberScan } from '../../core/game/discovery'
import { scanNetworkTarget } from '../../core/game/scan'
import { Terminal } from '../terminal/Terminal'

function StateSnapshot() { return <output data-testid="game-state">{JSON.stringify(useGameState())}</output> }

function discoveredAccessState(): GameState {
  const state = createInitialGameState()
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  let discovery = rememberScan(state.discovery, scanNetworkTarget(targets, state.player.localDevice.network.ip), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, 'home-net'), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, '198.51.100.47'), state.player.localDevice.id)
  return { ...state, discovery, deviceAccess: { nextId: 2, established: [{ id: 'access-roundtrip', sourceDeviceId: state.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] } }
}

function connectedState(): GameState {
  const base = createInitialGameState()
  const host = base.world.network.hosts[0]
  const altered = { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, displayName: 'live-server', ip: '192.0.2.99', firmware: { id: 'firmware-test', name: 'STATE-OS', version: '7.4' }, filesystem: { files: [{ kind: 'text' as const, path: '/srv/proof.txt', content: 'Foreign canonical proof.' }] } }, ...base.world.network.hosts.slice(1)] } }, deviceAccess: { nextId: 2, established: [{ id: 'access-test', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: 'service-http-001', privilege: 'USER' as const }] } }
  const connected = connectRemoteFromObservation(altered, { targetDeviceId: host.id, address: '192.0.2.99' }).state
  return { ...connected, remoteSession: { ...connected.remoteSession, active: { ...connected.remoteSession.active!, connectedAddress: '198.51.100.47' } } }
}

describe('RACK-OS', () => {
  it('presents live canonical identity, authority, access path, and one filesystem through Files and Terminal', async () => {
    const user = userEvent.setup(); const initial = connectedState(); const discoveryBefore = initial.discovery; const knowledgeBefore = initial.knowledge
    render(<GameProvider initialState={initial}><Shell /><StateSnapshot /></GameProvider>)
    expect(screen.getByLabelText('STATE-OS remote operating environment')).toHaveTextContent('STATE-OS 7.4')
    expect(document.body).toHaveTextContent('live-server · 192.0.2.99')
    expect(document.querySelector('.node-workspace')).toHaveAttribute('hidden')
    const input = screen.getByLabelText('Remote command')
    await user.type(input, 'ip{enter}'); expect(document.body).toHaveTextContent('192.0.2.99')
    await user.type(input, 'ls /srv{enter}'); expect(document.body).toHaveTextContent('proof.txt')
    await user.type(input, 'cat /srv/proof.txt{enter}'); expect(document.body).toHaveTextContent('Foreign canonical proof.')
    const current = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(current.discovery).toEqual(discoveryBefore); expect(current.knowledge).toEqual(knowledgeBefore)
    await user.click(screen.getByRole('button', { name: 'FILES' })); await user.click(screen.getByRole('button', { name: 'DIR srv' })); await user.click(screen.getByRole('button', { name: 'FILE proof.txt' })); expect(document.body).toHaveTextContent('Foreign canonical proof.')
    await user.click(screen.getByRole('button', { name: 'SYSTEM' })); expect(document.body).toHaveTextContent('STATE-OS 7.4'); expect(document.body).toHaveTextContent('HTTP')
  })

  it('uses the shared disconnect operation and returns to preserved local presentation', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={connectedState()}><Shell /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'DISCONNECT' }))
    expect(screen.queryByLabelText('STATE-OS remote operating environment')).not.toBeInTheDocument()
    expect(document.querySelector('.node-workspace')).not.toHaveAttribute('hidden')
  })

  it('navigates and presents canonical package metadata while cat rejects the artifact', async () => {
    const initial = connectedState()
    const host = initial.world.network.hosts[0]
    const packageFile = { kind: 'software_package' as const, path: '/opt/packages/scanner.release', releaseId: 'canonical-package', productId: 'nodescan', name: 'Altered NodeScan', version: '8.7', channel: 'nightly' }
    const state = { ...initial, world: { network: { ...initial.world.network, hosts: [{ ...host, filesystem: { files: [packageFile] } }, ...initial.world.network.hosts.slice(1)] } } }
    render(<GameProvider initialState={state}><Shell /></GameProvider>)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Remote command'), 'cat /opt/packages/scanner.release{enter}')
    expect(document.body).toHaveTextContent('NOT A TEXT FILE')
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR opt' }))
    await user.click(screen.getByRole('button', { name: 'DIR packages' }))
    await user.click(screen.getByRole('button', { name: 'FILE scanner.release' }))
    expect(document.body).toHaveTextContent('SOFTWARE PACKAGE')
    expect(screen.getByRole('heading', { name: 'Altered NodeScan' })).toBeInTheDocument()
    expect(document.body).toHaveTextContent('8.7 Nightly')
    expect(document.body).toHaveTextContent('RELEASE')
    expect(document.body).toHaveTextContent('canonical-package')
    expect(screen.queryByRole('button', { name: /install|download|run/i })).not.toBeInTheDocument()
    expect(state.player.localDevice.installedSoftware[0]).toMatchObject({ version: '1.0', channel: 'standard' })
    expect(state.process.processes).toEqual([])
  })

  it('disconnects from the remote Terminal through canonical Session state', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={connectedState()}><Shell /><StateSnapshot /></GameProvider>)
    await user.type(screen.getByLabelText('Remote command'), 'disconnect{enter}')
    expect(screen.queryByLabelText('STATE-OS remote operating environment')).not.toBeInTheDocument()
    expect((JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState).remoteSession.active).toBeNull()
  })

  it('preserves the same Scan Device detail across CONNECT and DISCONNECT', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={discoveredAccessState()}><Shell /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'Open NodeScan' }))
    await user.click(screen.getByRole('button', { name: 'Open known area home-net' }))
    await user.click(screen.getByRole('button', { name: 'Open device 198.51.100.47' }))
    expect(screen.getByRole('button', { name: 'Copy 198.51.100.47' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /CONNECT/ }))
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'DISCONNECT' }))
    expect(screen.getByRole('button', { name: 'Copy 198.51.100.47' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open SSH service' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'HOME' })).not.toBeInTheDocument()
    expect(screen.queryByText('KNOWN SPACE')).not.toBeInTheDocument()
  })

  it('keeps the existing NODE-OS Terminal bound to local address and filesystem during an active Session', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={connectedState()}><Terminal /></GameProvider>)
    const input = screen.getByLabelText('Command input')
    await user.type(input, 'ip{enter}cat /home/user/welcome.txt{enter}')
    expect(screen.getByText('198.51.100.23')).toBeInTheDocument()
    expect(screen.getByText('Welcome to your local filesystem.')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('Foreign canonical proof.')
  })
})
