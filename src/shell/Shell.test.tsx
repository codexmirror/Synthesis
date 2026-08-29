import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState, type GameActions } from '../app/GameContext'
import { connectRemoteFromObservation } from '../core/game/remoteSession'
import { advanceGameState } from '../core/game/gameAdvancement'
import { createInitialGameState, GAME_STATE_VERSION } from '../core/game/initialState'
import { RACK_OS_FIRMWARE_ID } from '../core/game/firmwareIdentity'
import type { FirmwareState, GameState } from '../core/game/types'
import { Shell } from './Shell'
import type { EditingViewportState } from './useEditingViewport'
import shellCss from './shell.css?raw'

let viewport: EditingViewportState
/* The Shell's explicit end-of-editing intent, isolated from the real
   controller so these tests prove the Shell expresses it. */
const endEditing = vi.fn()
vi.mock('./useEditingViewport', () => ({
  useEditingViewport: () => ({ ...viewport, endEditing }),
}))

const observation = { targetDeviceId: 'host-lan-001', address: '198.51.100.47' }

function accessedState(): GameState {
  const base = createInitialGameState()
  const target = base.world.network.hosts[0]
  return {
    ...base,
    world: { network: { ...base.world.network, hosts: [{
      ...target,
      displayName: 'truth-server',
      firmware: { id: RACK_OS_FIRMWARE_ID, name: 'TRUTH-OS', version: '2.4' },
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
  endEditing.mockClear()
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

  it('keeps DISCONNECT canonical while ENTER is waiting for editing recovery', async () => {
    const user = userEvent.setup()
    viewport = { ...viewport, editing: true, editingPresentation: true, presentationPhase: 'editing', recoveryReady: false }
    render(<GameProvider initialState={connectedState()}><Shell /><Capture /></GameProvider>)

    expect(screen.getByRole('button', { name: 'ENTER TRUTH-OS →' })).toBeDisabled()
    expect(screen.getByText('RELEASING LOCAL INPUT')).toBeInTheDocument()
    const disconnect = screen.getByRole('button', { name: 'DISCONNECT' })
    expect(disconnect).toBeEnabled()

    await user.click(disconnect)
    expect((JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState).remoteSession.active).toBeNull()
    expect(screen.queryByLabelText('Remote session handoff')).not.toBeInTheDocument()
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
    expect(GAME_STATE_VERSION).toBe(42)
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

    await user.click(screen.getByRole('button', { name: 'Return to NODE-OS without disconnecting' }))
    const localState = JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState
    expect(localState.remoteSession.active).toEqual(session)
    expect(localState.deviceAccess).toEqual(access)
    expect(screen.getByLabelText('TRUTH-OS remote operating environment')).toHaveAttribute('hidden')
    expect(document.querySelector('.node-workspace')).not.toHaveAttribute('hidden')
    expect(screen.getByRole('button', { name: 'Open Terminal' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'RETURN REMOTE · 198.51.100.47' })).toBeInTheDocument()
    expect(screen.queryByText(/REMOTE · truth-server/)).not.toBeInTheDocument()

    const beforeReturn = screen.getByTestId('state').textContent
    await user.click(screen.getByRole('button', { name: 'RETURN REMOTE · 198.51.100.47' }))
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

    await user.click(screen.getByRole('button', { name: 'Return to NODE-OS without disconnecting' }))
    let current = JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState
    expect(current.deviceAccess.established.map(({ id }) => id)).toContain(activeTransfer?.accessId)
    expect(current.fileTransfer.active?.id).toBe(activeTransfer?.id)

    await user.click(screen.getByRole('button', { name: 'RETURN REMOTE · 198.51.100.47' }))
    await user.click(screen.getByRole('button', { name: 'DISCONNECT' }))
    current = JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState
    expect(current.remoteSession.active).toBeNull()
    expect(current.deviceAccess.established.map(({ id }) => id)).toContain(activeTransfer?.accessId)
    expect(current.fileTransfer.active?.id).toBe(activeTransfer?.id)
    expect(screen.queryByRole('button', { name: 'RETURN REMOTE · 198.51.100.47' })).not.toBeInTheDocument()

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

    const localButton = screen.getByRole('button', { name: 'Return to NODE-OS without disconnecting' })
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

  it('keeps switching the operating view and ending the Session as two distinct, self-describing actions', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={connectedState()}><Shell /><Capture /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ENTER TRUTH-OS →' }))
    const session = (JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState).remoteSession.active
    const rackOs = screen.getByLabelText('TRUTH-OS remote operating environment')

    // A: the return action is visibly a navigation action, not context text,
    // and never reads as a Session-ending or paused one.
    const returnLocal = within(rackOs).getByRole('button', { name: 'Return to NODE-OS without disconnecting' })
    const disconnect = within(rackOs).getByRole('button', { name: 'DISCONNECT' })
    expect(returnLocal).toHaveTextContent('← NODE-OS')
    expect(returnLocal).not.toBe(disconnect)
    expect(returnLocal).not.toHaveTextContent(/DISCONNECT|PAUSE/)

    // B: it switches the presented environment and leaves the Session intact.
    await user.click(returnLocal)
    expect((JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState).remoteSession.active).toEqual(session)
    expect(rackOs).toHaveAttribute('hidden')
    expect(document.querySelector('.node-workspace')).not.toHaveAttribute('hidden')

    // C: the local control names the retained connected address, and says it
    // returns rather than connecting.
    const returnRemote = screen.getByRole('button', { name: 'RETURN REMOTE · 198.51.100.47' })
    expect(returnRemote).toHaveTextContent('RETURN REMOTE')
    expect(returnRemote).toHaveTextContent(session!.connectedAddress)
    expect(returnRemote).not.toHaveTextContent(/CONNECT$|NEW/)

    // D: using it reopens the same Session with no second handoff.
    await user.click(returnRemote)
    expect(screen.getByLabelText('TRUTH-OS remote operating environment')).toBe(rackOs)
    expect(rackOs).not.toHaveAttribute('hidden')
    expect(screen.queryByLabelText('Remote session handoff')).not.toBeInTheDocument()
    expect((JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState).remoteSession.active).toEqual(session)

    // E: DISCONNECT is the only one of the three that ends the Session.
    await user.click(within(rackOs).getByRole('button', { name: 'DISCONNECT' }))
    expect((JSON.parse(screen.getByTestId('state').textContent ?? '') as GameState).remoteSession.active).toBeNull()
    expect(screen.queryByLabelText('TRUTH-OS remote operating environment')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'RETURN REMOTE · 198.51.100.47' })).not.toBeInTheDocument()
  })

  it('keeps the connected SystemBar context control touch-safe and bounded on narrow widths', () => {
    expect(shellCss).toMatch(/\.remote-context\s*{[^}]*min-width:\s*0;[^}]*min-height:\s*44px;[^}]*overflow:\s*hidden;/)
    expect(shellCss).toMatch(/@media \(max-width: 480px\)\s*{[\s\S]*?\.system-bar--remote\s*{[^}]*padding-inline:\s*8px;[^}]*gap:\s*8px;/)
    // The address is the part that must stay legible when the control is
    // squeezed, so only it may be truncated.
    expect(shellCss).toMatch(/\.remote-context__address\s*{[^}]*max-width:\s*100%;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/)
  })
})

describe('Firmware-driven remote operating surface', () => {
  const phoneObservation = { targetDeviceId: 'host-phone-001', address: '198.51.100.61' }

  /** An entered-Session world for the represented VEYRA phone, optionally running other Firmware. */
  function phoneConnectedState(firmware?: FirmwareState): GameState {
    const base = createInitialGameState()
    const hosts = base.world.network.hosts.map((host) =>
      host.id === phoneObservation.targetDeviceId && firmware ? { ...host, firmware } : host)
    const accessed: GameState = {
      ...base,
      world: { network: { ...base.world.network, hosts } },
      deviceAccess: { nextId: 2, established: [{
        id: 'access-phone', sourceDeviceId: base.player.localDevice.id,
        targetDeviceId: phoneObservation.targetDeviceId, viaServiceId: 'service-ssh-003', privilege: 'USER',
      }] },
    }
    return connectRemoteFromObservation(accessed, phoneObservation).state
  }

  it('mounts VEYRA for a VEYRA OS target and never RACK-OS', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={phoneConnectedState()}><Shell /></GameProvider>)

    const handoff = screen.getByLabelText('Remote session handoff')
    expect(handoff).toHaveTextContent('VEYRA OS 4.1')
    await user.click(screen.getByRole('button', { name: 'ENTER VEYRA OS →' }))

    expect(screen.getByLabelText('VEYRA OS personal device environment')).toBeInTheDocument()
    expect(screen.queryByLabelText('VEYRA OS remote operating environment')).not.toBeInTheDocument()
    expect(document.querySelector('.rack-os')).not.toBeInTheDocument()
  })

  it('still mounts RACK-OS for a RACK-OS target', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={connectedState()}><Shell /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'ENTER TRUTH-OS →' }))

    expect(screen.getByLabelText('TRUTH-OS remote operating environment')).toBeInTheDocument()
    expect(document.querySelector('.veyra')).not.toBeInTheDocument()
  })

  it('refuses entry for Firmware it cannot present rather than falling back to RACK-OS', () => {
    render(<GameProvider initialState={phoneConnectedState({ id: 'firmware-vault-os-v2', name: 'VAULT-OS', version: '2.0' })}><Shell /></GameProvider>)

    const handoff = screen.getByLabelText('Remote session handoff')
    // The Session is real and is still stated; only the operating surface is missing.
    expect(handoff).toHaveTextContent('SESSION ESTABLISHED')
    expect(handoff).toHaveTextContent('VAULT-OS 2.0')
    expect(handoff).toHaveTextContent('NO OPERATING SURFACE FOR THIS FIRMWARE')
    expect(screen.queryByRole('button', { name: /^ENTER / })).not.toBeInTheDocument()
    expect(document.querySelector('.rack-os')).not.toBeInTheDocument()
    expect(document.querySelector('.veyra')).not.toBeInTheDocument()
    // Leaving is still possible: a Session that cannot be presented can be ended.
    expect(screen.getByRole('button', { name: 'DISCONNECT' })).toBeInTheDocument()
  })
})
