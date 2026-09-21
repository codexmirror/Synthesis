import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState } from '../../app/GameContext'
import { connectRemoteFromObservation } from '../../core/game/remoteSession'
import { installRemoteSoftwarePackage } from '../../core/game/softwareInstallation'
import { createInitialGameState } from '../../core/game/initialState'
import { RACK_OS_1_1_BUSINESS_FIRMWARE_ID, RACK_OS_FIRMWARE_ID } from '../../core/game/firmwareIdentity'
import { RACK_OS_1_1_BUSINESS_RELEASE, RACK_OS_FIRMWARE_UPDATE_DURATION_MS } from '../../core/game/rackOsFirmwareUpdate'
import { Shell } from '../../shell/Shell'
import type { ExecutableFile, GameProcess, GameState, NetworkHost, NodeMinerProcess } from '../../core/game/types'
import { rememberScan } from '../../core/game/discovery'
import { scanNetworkTarget } from '../../core/game/scan'
import { Terminal } from '../terminal/Terminal'
import { withoutBookstoreBackgroundTiming } from '../../test/canonicalSnapshot'
import rackSource from './RackOS.tsx?raw'
import rackUpdateSource from './RackFirmwareUpdate.tsx?raw'
import rackCss from './rackos.css?raw'
import { executeBookstoreSale } from '../../core/game/bookstoreSale'
import { BOOKSTORE_BRANCH_ID } from '../../core/game/business'
import { BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, placeBookstoreRestockOrder, proposeBookstoreRestockOrder } from '../../core/game/bookstoreRestock'

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
  const altered = { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, displayName: 'live-server', ip: '192.0.2.99', firmware: { id: RACK_OS_FIRMWARE_ID, name: 'STATE-OS', version: '7.4' }, filesystem: { nextFileId: 50, files: [{ kind: 'text' as const, id: 'file-fixture-text', path: '/srv/proof.txt', content: 'Foreign canonical proof.' }] } }, ...base.world.network.hosts.slice(1)] } }, deviceAccess: { nextId: 2, established: [{ id: 'access-test', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: 'service-http-001', privilege: 'USER' as const }] } }
  const connected = connectRemoteFromObservation(altered, { targetDeviceId: host.id, address: '192.0.2.99' }).state
  return { ...connected, remoteSession: { ...connected.remoteSession, active: { ...connected.remoteSession.active!, connectedAddress: '198.51.100.47' } } }
}

/** `connectedState` plus a represented remote `/home/user` directory, so the
 *  remote-first Upload workflow can start from a non-root remote directory. */
function connectedStateWithRemoteHome(): GameState {
  const base = connectedState()
  const host = base.world.network.hosts[0]
  const files = [...host.filesystem!.files, { kind: 'text' as const, id: 'file-fixture-remote-home', path: '/home/user/notes.txt', content: 'Remote workspace notes.' }]
  return { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, filesystem: { nextFileId: 60, files } }, ...base.world.network.hosts.slice(1)] } } }
}

async function enterRemote(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^ENTER .+ →$/ }))
}

afterEach(() => vi.useRealTimers())

describe('RACK-OS mobile presentation contract', () => {
  it('owns editing scroll in its output and configures the remote command for mobile entry', async () => {
    const user = userEvent.setup(); render(<GameProvider initialState={connectedState()}><Shell /></GameProvider>)
    await enterRemote(user)

    const output = document.querySelector('.rack-output')
    expect(output).toHaveAttribute('data-editing-scroll-owner')
    expect(document.querySelectorAll('.rack-os [data-editing-scroll-owner]')).toHaveLength(1)
    expect(output).not.toBeNull()
    expect(output!.parentElement).toHaveClass('rack-terminal')

    expect(screen.getByLabelText('Remote command')).toHaveAttribute('autocapitalize', 'none')
    expect(screen.getByLabelText('Remote command')).toHaveAttribute('autocomplete', 'off')
    expect(screen.getByLabelText('Remote command')).toHaveAttribute('autocorrect', 'off')
    expect(screen.getByLabelText('Remote command')).toHaveAttribute('spellcheck', 'false')
    expect(screen.getByLabelText('Remote command')).toHaveAttribute('enterkeyhint', 'send')
    expect(screen.getByLabelText('Remote command')).not.toHaveAttribute('autofocus')
  })

  it('keeps the compact prompt while enforcing mobile input and output geometry', () => {
    expect(rackCss).toMatch(/\.rack-terminal label\s*{[^}]*font-size:\s*\.76rem;/)
    expect(rackCss).toMatch(/@media \(max-width: 700px\), \(max-width: 900px\) and \(pointer: coarse\)[\s\S]*?\.rack-terminal input\s*{\s*font-size:\s*16px;\s*}/)
    expect(rackCss).toMatch(/\.rack-output\s*{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;[^}]*overflow-x:\s*hidden;[^}]*overscroll-behavior-y:\s*contain;[^}]*touch-action:\s*pan-y pinch-zoom;[^}]*-webkit-overflow-scrolling:\s*touch;/)
  })

  it('keeps viewport correction logic out of the RACK boundary', () => {
    expect(rackSource + rackUpdateSource + rackCss).not.toMatch(/visualViewport|window\.scrollTo|scrollIntoView/)
  })

  it('keeps its narrow header context actions touch-safe', () => {
    expect(rackCss).toMatch(/\.rack-header__actions\s*{[^}]*width:\s*100%;[^}]*flex-wrap:\s*wrap;/)
    expect(rackCss).toMatch(/\.rack-header button\s*{[^}]*min-height:\s*44px;/)
  })

  it('keeps the Upload workflow usable under the software keyboard on mobile', () => {
    // The destination field must not trigger Safari zoom, and the panel that
    // owns it must own its own scrolling so CANCEL/UPLOAD stay reachable while
    // that field is focused.
    expect(rackCss).toMatch(/@media \(max-width: 700px\), \(max-width: 900px\) and \(pointer: coarse\)[\s\S]*?\.rack-input\s*{\s*font-size:\s*16px;\s*}/)
    expect(rackCss).toMatch(/\.rack-panel\s*{[^}]*overflow:\s*auto;[^}]*overscroll-behavior-y:\s*contain;[^}]*touch-action:\s*pan-y pinch-zoom;/)
    expect(rackCss).toMatch(/\.rack-input\s*{[^}]*min-width:\s*0;[^}]*width:\s*100%;[^}]*min-height:\s*44px;/)
    expect(rackCss).toMatch(/\.rack-upload-entry\s*{[^}]*min-height:\s*44px;/)
    expect(rackCss).toMatch(/\.rack-secondary\s*{[^}]*min-height:\s*44px;/)
    // Long paths wrap inside the panel rather than widening the viewport.
    expect(rackCss).toMatch(/\.rack-file-meta\s*{[^}]*overflow-wrap:\s*anywhere;/)
  })
})
