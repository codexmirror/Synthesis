import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameProvider } from '../../app/GameContext'
import { advanceGameState } from '../../core/game/gameAdvancement'
import { createInitialGameState } from '../../core/game/initialState'
import { NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS, startNodeMiner } from '../../core/game/nodeMiner'
import type { ExecutableFile, GameState } from '../../core/game/types'
import { Wallet } from './Wallet'

/** A local Device mining with the Wallet's own address configured, so the Wallet really receives NODE. */
function minedState(elapsedMs: number): GameState {
  const base = createInitialGameState()
  const minerFile: ExecutableFile = { kind: 'executable', id: 'file-fixture-miner', path: '/home/user/node-miner-1.0.bin', programId: 'node-miner', releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
  const withFile: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { nextFileId: 50, files: [...base.player.localDevice.filesystem.files, minerFile] }, runtime: { ...base.player.localDevice.runtime, baselineCpuLoad: 0 } } } }
  const started = startNodeMiner(withFile, minerFile.path, withFile.nodeWallet.address)
  if (started.status !== 'started') throw new Error(started.status)
  return advanceGameState(started.state, elapsedMs)
}

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
    const state: GameState = { ...base, wallet: { balance: 42 }, nodeWallet: { ...base.nodeWallet, balanceNodeUnits: 7 } }
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    expect(screen.getByText('$42')).toBeInTheDocument()
    expect(screen.getByText('0.000007 NODE')).toBeInTheDocument()
    expect(screen.queryByText('$1,250')).not.toBeInTheDocument()
  })

  it('formats the canonical integer atomic NODE balance as human-readable NODE without floating-point loss', () => {
    const base = createInitialGameState()
    const state: GameState = { ...base, nodeWallet: { ...base.nodeWallet, balanceNodeUnits: 4_281 } }
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    expect(screen.getByText('0.004281 NODE')).toBeInTheDocument()
  })

  it('presents a balance of exactly whole NODE without a spurious fraction', () => {
    const base = createInitialGameState()
    const state: GameState = { ...base, nodeWallet: { ...base.nodeWallet, balanceNodeUnits: 2_000_000 } }
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    expect(screen.getByText('2 NODE')).toBeInTheDocument()
  })

  it('keeps Dollar and NODE visually distinguishable', () => {
    const base = createInitialGameState()
    const state: GameState = { ...base, wallet: { balance: 42 }, nodeWallet: { ...base.nodeWallet, balanceNodeUnits: 7 } }
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    const dollarBalance = screen.getByText('$42')
    const nodeBalance = screen.getByText('0.000007 NODE')
    expect(dollarBalance.className).not.toBe(nodeBalance.className)
  })

  it('presents the real NODE this Wallet received rather than an empty transaction state', () => {
    const state = minedState(10_000)
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    expect(screen.getByText('NODE ACTIVITY')).toBeInTheDocument()
    expect(screen.getByText('+900 units')).toBeInTheDocument()
    expect(screen.getByText('MINING PAYOUT')).toBeInTheDocument()
    expect(screen.queryByText('NO NODE ACTIVITY')).not.toBeInTheDocument()
  })

  it('derives activity from canonical Wallet state, newest first', () => {
    const state = advanceGameState(minedState(10_000), 20_000)
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    expect(state.nodeWallet.activity.records.map(({ amountNodeUnits }) => amountNodeUnits)).toEqual([900, 1800])
    const amounts = screen.getAllByText(/^\+[\d,]+ units$/).map((element) => element.textContent)
    expect(amounts).toEqual(['+1,800 units', '+900 units'])
  })

  it('reports no NODE activity when this Wallet has received nothing', () => {
    render(<GameProvider><Wallet /></GameProvider>)
    expect(screen.getByText('NO NODE ACTIVITY')).toBeInTheDocument()
  })

  it('never reveals the hidden developer destination or claims anything about what a payer kept', () => {
    const state = minedState(10_000)
    render(<GameProvider initialState={state}><Wallet /></GameProvider>)
    const wallet = document.querySelector('.wallet-app') as HTMLElement
    expect(state.nodeEconomy.accounts[0].balanceNodeUnits).toBe(100)
    expect(wallet.textContent).not.toContain(NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS)
    expect(wallet.textContent).not.toMatch(/DEVELOPER|FEE|STOLEN|1,000 units/i)
  })

  it('records no Dollar transaction history alongside NODE activity', () => {
    render(<GameProvider initialState={minedState(10_000)}><Wallet /></GameProvider>)
    expect(screen.getByText('Virtual account · No transactions yet')).toBeInTheDocument()
    expect(screen.getByText('$1,250')).toBeInTheDocument()
  })
})
