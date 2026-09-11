import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState } from '../app/GameContext'
import { createInitialGameState } from '../core/game/initialState'
import { rememberPing } from '../core/game/discovery'
import { Terminal } from '../apps/terminal/Terminal'

function Harness() { const state = useGameState(); const actions = useGameActions(); return <><button onClick={() => void actions.pingTarget('203.0.113.42')}>PING</button><output>{state.discovery.devices.map(({ address }) => address).join(',')}</output></> }

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
})
