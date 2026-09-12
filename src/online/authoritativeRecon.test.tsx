import { render, screen } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState } from '../app/GameContext'
import { createInitialGameState } from '../core/game/initialState'
import { rememberPing } from '../core/game/discovery'
import { Terminal } from '../apps/terminal/Terminal'

function Harness() { const state = useGameState(); const actions = useGameActions(); return <><button onClick={() => void actions.pingTarget('203.0.113.42')}>PING</button><output>{state.discovery.devices.map(({ address }) => address).join(',')}</output></> }
function RefreshHarness() { const actions = useGameActions(); const [result, setResult] = useState(''); return <><button onClick={() => void actions.refreshNetwork('network-local-001').then(({ status }) => setResult(status))}>REFRESH</button><output>{result}</output></> }
function DeferredMutationHarness() { const actions = useGameActions(); const [result, setResult] = useState(''); return <><button onClick={() => { try { actions.openMailThread('mail-thread-welcome'); setResult('accepted') } catch { setResult('deferred') } }}>OPEN MAIL</button><output>{result}</output></> }

describe('authenticated Recon transport', () => {
  it('renders only the authoritative committed snapshot after PING', async () => {
    const initial = createInitialGameState(); const committed = { ...initial, discovery: rememberPing(initial.discovery, { status: 'device', targetId: 'host-lan-002', address: '203.0.113.42' }, initial.player.primaryDeviceId) }
    const observe = vi.fn(async () => ({ result: { status: 'device' as const, targetId: 'host-lan-002', address: '203.0.113.42' }, state: committed }))
    render(<GameProvider initialState={initial} serverOwnsAdvancement reconTransport={{ observe }}><Harness /></GameProvider>)
    expect(screen.getByRole('status')).toHaveTextContent(''); await userEvent.click(screen.getByRole('button', { name: 'PING' }))
    expect(await screen.findByText('203.0.113.42')).toBeVisible(); expect(observe).toHaveBeenCalledWith('ping', '203.0.113.42')
  })

  it('routes the mounted Terminal PING command through the authoritative transport', async () => {
    const initial = createInitialGameState(); const committed = { ...initial, discovery: rememberPing(initial.discovery, { status: 'device', targetId: 'host-lan-002', address: '203.0.113.42' }, initial.player.primaryDeviceId) }
    const observe = vi.fn(async () => ({ result: { status: 'device' as const, targetId: 'host-lan-002', address: '203.0.113.42' }, state: committed }))
    render(<GameProvider initialState={initial} serverOwnsAdvancement reconTransport={{ observe }}><Terminal /></GameProvider>)
    await userEvent.type(screen.getByLabelText('Command input'), 'ping 203.0.113.42{Enter}')
    expect(await screen.findByText('RESPONSE')).toBeVisible(); expect(observe).toHaveBeenCalledWith('ping', '203.0.113.42')
  })

  it('refreshes a known Network by unique CIDR rather than an ambiguous presentation name', async () => {
    const initial = createInitialGameState()
    const observe = vi.fn(async () => ({ result: { status: 'network' as const, networkId: 'network-local-001', networkName: 'home-net', cidr: '198.51.100.0/24', devices: [] }, state: initial }))
    render(<GameProvider initialState={initial} serverOwnsAdvancement reconTransport={{ observe }}><RefreshHarness /></GameProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'REFRESH' }))
    expect(await screen.findByText('refreshed')).toBeVisible()
    expect(observe).toHaveBeenCalledWith('scan', '198.51.100.0/24')
  })

  it('explicitly refuses unsupported online mutations instead of committing browser state', async () => {
    const initial = createInitialGameState(); const observe = vi.fn()
    render(<GameProvider initialState={initial} serverOwnsAdvancement reconTransport={{ observe }}><DeferredMutationHarness /></GameProvider>)
    await userEvent.click(screen.getByRole('button', { name: 'OPEN MAIL' }))
    expect(screen.getByText('deferred')).toBeVisible(); expect(observe).not.toHaveBeenCalled()
  })
})
