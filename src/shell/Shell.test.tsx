import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState, type GameActions } from '../app/GameContext'
import { connectRemoteFromObservation } from '../core/game/remoteSession'
import { advanceGameState } from '../core/game/gameAdvancement'
import { createInitialGameState, GAME_STATE_VERSION } from '../core/game/initialState'
import type { GameState } from '../core/game/types'
import { Shell } from './Shell'
import type { EditingViewportState } from './useEditingViewport'
import shellCss from './shell.css?raw'

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
    expect(GAME_STATE_VERSION).toBe(28)
  })

  it('switches between an entered remote context and usable NODE-OS without changing canonical session authority', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={connectedState()}><Shell /><Capture /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ENTER TRUTH-OS →' }))
    const enteredState = JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState
    const session = enteredState.remoteSession.active
    const access = enteredState.deviceAccess
    const rackOs = screen.getByLabelText('TRUTH-OS remote operating environment')
    const remoteOutput = document.querySelector('.rack-output')
    await user.type(screen.getByLabelText('Remote command'), 'ip{enter}')
    expect(remoteOutput).toHaveTextContent('198.51.100.47')

    await user.click(screen.getByRole('button', { name: 'LOCAL · NODE-OS' }))
    const localState = JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState
    expect(localState.remoteSession.active).toEqual(session)
    expect(localState.deviceAccess).toEqual(access)
    expect(screen.getByLabelText('TRUTH-OS remote operating environment')).toHaveAttribute('hidden')
    expect(document.querySelector('.node-workspace')).not.toHaveAttribute('hidden')
    expect(screen.getByRole('button', { name: 'Open Terminal' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'REMOTE · truth-server' })).toBeInTheDocument()

    const beforeReturn = screen.getByTestId('state').textContent
    await user.click(screen.getByRole('button', { name: 'REMOTE · truth-server' }))
    expect(screen.getByLabelText('TRUTH-OS remote operating environment')).toBe(rackOs)
    expect(rackOs).not.toHaveAttribute('hidden')
    expect(document.querySelector('.rack-output')).toBe(remoteOutput)
    expect(remoteOutput).toHaveTextContent('198.51.100.47')
    expect(screen.queryByLabelText('Remote session handoff')).not.toBeInTheDocument()
    expect(screen.getByTestId('state')).toHaveTextContent(beforeReturn ?? '')
    expect((JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState).remoteSession.active).toEqual(session)
  })

  it('keeps a Download active across a local/remote context switch and survives disconnect', async () => {
    const user = userEvent.setup()
    const base = connectedState()
    const slowDownload: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, network: { ...base.player.localDevice.network, transferCapacity: { ...base.player.localDevice.network.transferCapacity, downloadBytesPerSecond: 1 } } } } }
    render(<GameProvider initialState={slowDownload}><Shell /><Capture /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ENTER TRUTH-OS →' }))
    act(() => { actions.startRemoteFileDownload('/srv/readme.txt') })
    const activeTransfer = (JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState).fileTransfer.active
    expect(activeTransfer).not.toBeNull()
    expect(activeTransfer).not.toHaveProperty('sessionId')

    await user.click(screen.getByRole('button', { name: 'LOCAL · NODE-OS' }))
    let current = JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState
    expect(current.deviceAccess.established.map(({ id }) => id)).toContain(activeTransfer?.accessId)
    expect(current.fileTransfer.active?.id).toBe(activeTransfer?.id)

    await user.click(screen.getByRole('button', { name: 'REMOTE · truth-server' }))
    await user.click(screen.getByRole('button', { name: 'DISCONNECT' }))
    current = JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState
    expect(current.remoteSession.active).toBeNull()
    expect(current.deviceAccess.established.map(({ id }) => id)).toContain(activeTransfer?.accessId)
    expect(current.fileTransfer.active?.id).toBe(activeTransfer?.id)
    expect(screen.queryByRole('button', { name: 'REMOTE · truth-server' })).not.toBeInTheDocument()

    // game advancement continues the Download post-disconnect through to completion.
    const advanced = advanceGameState(current, 100_000)
    expect(advanced.fileTransfer.active).toBeNull()
    expect(advanced.player.localDevice.filesystem.files.filter((file) => file.path === '/home/user/downloads/readme.txt')).toHaveLength(1)
  })

  it('releases remote editing and waits for existing viewport recovery before showing local context', async () => {
    const user = userEvent.setup()
    const view = render(<GameProvider initialState={connectedState()}><Shell /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ENTER TRUTH-OS →' }))
    viewport = { ...viewport, editing: true, editingPresentation: true, presentationPhase: 'editing', recoveryReady: false }
    view.rerender(<GameProvider initialState={connectedState()}><Shell /></GameProvider>)
    const input = screen.getByLabelText('Remote command')
    input.focus()
    const blur = vi.spyOn(input, 'blur')

    const localButton = screen.getByRole('button', { name: 'LOCAL · NODE-OS' })
    fireEvent.pointerDown(localButton)
    expect(blur).not.toHaveBeenCalled()
    expect(screen.getByLabelText('TRUTH-OS remote operating environment')).not.toHaveAttribute('hidden')
    fireEvent.click(localButton)
    expect(blur).toHaveBeenCalledTimes(1)
    expect(input).not.toHaveFocus()
    expect(screen.getByLabelText('TRUTH-OS remote operating environment')).not.toHaveAttribute('hidden')
    expect(document.querySelector('.node-workspace')).toHaveAttribute('hidden')

    viewport = { ...viewport, editing: false, editingPresentation: false, presentationPhase: 'normal', recoveryReady: true }
    view.rerender(<GameProvider initialState={connectedState()}><Shell /></GameProvider>)
    expect(screen.getByLabelText('TRUTH-OS remote operating environment')).toHaveAttribute('hidden')
    expect(document.querySelector('.node-workspace')).not.toHaveAttribute('hidden')
  })

  it('keeps the connected SystemBar context control touch-safe and bounded on narrow widths', () => {
    expect(shellCss).toMatch(/\.remote-context\s*{[^}]*min-width:\s*0;[^}]*min-height:\s*44px;[^}]*overflow:\s*hidden;/)
    expect(shellCss).toMatch(/@media \(max-width: 480px\)\s*{[\s\S]*?\.system-bar--remote\s*{[^}]*padding-inline:\s*8px;[^}]*gap:\s*8px;/)
  })
})
