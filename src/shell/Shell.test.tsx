import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState, type GameActions } from '../app/GameContext'
import { connectRemoteFromObservation } from '../core/game/remoteSession'
import { createInitialGameState, GAME_STATE_VERSION } from '../core/game/initialState'
import type { GameState } from '../core/game/types'
import { Shell } from './Shell'
import type { EditingViewportState } from './useEditingViewport'

let viewport: EditingViewportState
vi.mock('./useEditingViewport', () => ({ useEditingViewport: () => viewport }))

const observation = { targetDeviceId: 'host-lan-001', address: '198.51.100.47' }

function accessedState(): GameState {
  const base = createInitialGameState()
  const target = base.world.network.hosts[0]
  return {
    ...base,
    world: { network: { ...base.world.network, hosts: [{
      ...target,
      displayName: 'truth-server',
      firmware: { id: 'firmware-truth', name: 'TRUTH-OS', version: '2.4' },
    }, ...base.world.network.hosts.slice(1)] } },
    deviceAccess: { nextId: 2, established: [{
      id: 'access-truth', sourceDeviceId: base.player.localDevice.id,
      targetDeviceId: target.id, viaServiceId: 'service-ssh-001', privilege: 'USER',
    }] },
  }
}

function connectedState(state = accessedState()): GameState {
  return connectRemoteFromObservation(state, observation).state
}

let actions: GameActions
function Capture() {
  actions = useGameActions()
  const state = useGameState()
  return <output data-testid="state">{JSON.stringify(state)}</output>
}

beforeEach(() => {
  viewport = {
    hostHeight: 780, editTop: 0, editHeight: 780, editing: false,
    editingPresentation: false, presentationPhase: 'normal',
    targetViewportTop: 0, shellTop: 0, shellBottom: 780,
    presentationTop: 0, presentationHeight: 780, recoveryReady: true,
    viewportLifecycle: 'active',
  }
})

describe('Remote Session handoff', () => {
  it('presents represented session data before mounting the remote environment', () => {
    render(<GameProvider initialState={connectedState()}><Shell /></GameProvider>)

    expect(screen.queryByLabelText('TRUTH-OS remote operating environment')).not.toBeInTheDocument()
    const handoff = screen.getByLabelText('Remote session handoff')
    expect(handoff).toHaveTextContent('SESSION ESTABLISHED')
    expect(handoff).toHaveTextContent('truth-server')
    expect(handoff).toHaveTextContent('198.51.100.47')
    expect(handoff).toHaveTextContent('SSH / TCP 22')
    expect(handoff).toHaveTextContent('USER')
    expect(handoff).toHaveTextContent('TRUTH-OS 2.4')
    expect(handoff).toHaveTextContent('session-0001')
  })

  it('releases focused local editing once and waits for editing recovery before entry', async () => {
    viewport = { ...viewport, editing: true, editingPresentation: true, presentationPhase: 'editing', recoveryReady: false }
    const initial = accessedState()
    const view = render(<GameProvider initialState={initial}><input aria-label="Local editor" /><Shell /><Capture /></GameProvider>)
    const editor = screen.getByLabelText('Local editor')
    const blur = vi.spyOn(editor, 'blur')
    editor.focus()

    act(() => { actions.connectRemoteFromObservation(observation) })
    expect(blur).toHaveBeenCalledTimes(1)
    expect(editor).not.toHaveFocus()
    expect(screen.getByRole('button', { name: 'ENTER TRUTH-OS →' })).toBeDisabled()
    expect(screen.getByText('RELEASING LOCAL INPUT')).toBeInTheDocument()
    view.rerender(<GameProvider initialState={initial}><input aria-label="Local editor" /><Shell /><Capture /></GameProvider>)
    expect(blur).toHaveBeenCalledTimes(1)

    viewport = { ...viewport, editing: false, editingPresentation: false, presentationPhase: 'normal', recoveryReady: true }
    view.rerender(<GameProvider initialState={initial}><input aria-label="Local editor" /><Shell /><Capture /></GameProvider>)
    expect(screen.getByRole('button', { name: 'ENTER TRUTH-OS →' })).toBeEnabled()
  })

  it('enters without mutating GameState, disconnects canonically, and gates a later session again', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={connectedState()}><Shell /><Capture /></GameProvider>)
    const beforeEntry = screen.getByTestId('state').textContent

    await user.click(screen.getByRole('button', { name: 'ENTER TRUTH-OS →' }))
    expect(screen.getByLabelText('TRUTH-OS remote operating environment')).toBeInTheDocument()
    expect(screen.getByTestId('state')).toHaveTextContent(beforeEntry ?? '')

    act(() => { actions.disconnectRemoteSession() })
    expect(document.querySelector('.node-workspace')).not.toHaveAttribute('hidden')
    expect(screen.queryByLabelText('Remote session handoff')).not.toBeInTheDocument()

    act(() => { actions.connectRemoteFromObservation(observation) })
    expect(screen.getByLabelText('Remote session handoff')).toHaveTextContent('session-0002')
    expect(screen.queryByLabelText('TRUTH-OS remote operating environment')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'DISCONNECT' }))
    expect((JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState).remoteSession.active).toBeNull()
    expect(document.querySelector('.node-workspace')).not.toHaveAttribute('hidden')
    expect(GAME_STATE_VERSION).toBe(19)
  })
})
