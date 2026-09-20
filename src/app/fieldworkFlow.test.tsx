import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GameProvider } from './GameContext'
import { Shell } from '../shell/Shell'
import { createSandboxGameState } from '../core/game/fieldwork'

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('V1 primary session smoke', () => {
  it('investigates, enters a real foreign OS, copies a document and key, gets paid and opens the next machine', () => {
    vi.useFakeTimers()
    render(<GameProvider initialState={createSandboxGameState()}><Shell /></GameProvider>)
    click('EXPLORE NETWORKS')
    click(/Relay Cooperative Recover the missing mirror index/)
    click('INVESTIGATE RELAY COOPERATIVE')
    expect(screen.getByRole('heading', { name: 'INVESTIGATING SERVICES' })).toBeInTheDocument()
    advance(10_000)
    click('Execute Credential Access with GhostKey 1.0')
    advance(10_000)
    click('CONNECT')
    expect(screen.getByRole('region', { name: 'RACK-OS remote operating environment' })).toBeInTheDocument()
    click('DOC relay-dispatch-1.txt /work/relay-dispatch-1.txt')
    click('DOWNLOAD'); advance(1000)
    expect(screen.getByRole('button', { name: 'DOWNLOADED ✓' })).toBeDisabled()
    click('← /')
    click('DOC atlas-maintenance.key /work/atlas-maintenance.key')
    click('DOWNLOAD'); advance(1000)
    click('DISCONNECT')
    click('← Known Space')
    click(/Relay Cooperative Recover the missing mirror index/)
    click('DELIVER COPY')
    expect(screen.getByRole('status')).toHaveTextContent('+0.018 NODE')
    fireEvent.click(screen.getByText(/RECOVERED KEYS/))
    click('USE KEY')
    // A successful credential does not force another pointless analysis.
    expect(screen.queryByLabelText('Analysis progress')).not.toBeInTheDocument()
    click('CONNECT')
    expect(screen.getByRole('region', { name: 'RACK-OS remote operating environment' })).toHaveTextContent('atlas-ops')
    expect(screen.getByText('RACK-OS 1.1 Business')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /northline-maintenance.key/ })).toBeInTheDocument()
  })
})
