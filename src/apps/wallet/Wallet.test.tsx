import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameProvider } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import type { GameState } from '../../core/game/types'
import { Wallet } from './Wallet'

describe('Wallet', () => {
  it('presents the canonical Dollar balance and the separate canonical NODE balance and address', () => {
    render(<GameProvider><Wallet /></GameProvider>)
    expect(screen.getByText('DOLLARS')).toBeInTheDocument()
    expect(screen.getByText('$1,250')).toBeInTheDocument()
    expect(screen.getByText('NODE')).toBeInTheDocument()
    expect(screen.getByText('0 NODE')).toBeInTheDocument()
    expect(screen.getByText('node-wallet-addr-0001')).toBeInTheDocument()
  })

  it('derives both balances from canonical GameState rather than owning its own presentation truth', () => {
    const base = createInitialGameState()
    const state: GameState = { ...base, wallet: { balance: 42 }, nodeWallet: { ...base.nodeWallet, balanceNode: 7 } }
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    expect(screen.getByText('$42')).toBeInTheDocument()
    expect(screen.getByText('7 NODE')).toBeInTheDocument()
    expect(screen.queryByText('$1,250')).not.toBeInTheDocument()
  })

  it('keeps Dollar and NODE visually distinguishable', () => {
    const base = createInitialGameState()
    const state: GameState = { ...base, wallet: { balance: 42 }, nodeWallet: { ...base.nodeWallet, balanceNode: 7 } }
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    const dollarBalance = screen.getByText('$42')
    const nodeBalance = screen.getByText('7 NODE')
    expect(dollarBalance.className).not.toBe(nodeBalance.className)
  })
})
