import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { advanceGameState } from '../../core/game/gameAdvancement'
import { FLIPPER_1_0_CANONICAL_INSTALLATION, FLIPPER_PRODUCT_ID, ROLLBACK_MODULE_1_0, findInstalledFlipper } from '../../core/game/flipper'
import { FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID } from '../../core/game/softwareReleaseContent'
import type { FlipperInstallation, GameState, SoftwareModuleFile } from '../../core/game/types'
import { Flipper } from './Flipper'

const ROLLBACK_ARTIFACT: SoftwareModuleFile = {
  kind: 'software_module', id: 'file-module-rollback', path: '/home/user/downloads/flipper-rollback-module-1.0.mod',
  ...ROLLBACK_MODULE_1_0,
}

const value = (label: string) => screen.getByText(label).parentElement?.querySelector('dd')?.textContent

function withInstalledHost(state = createInitialGameState()): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice,
    installedSoftware: [...state.player.localDevice.installedSoftware, { ...FLIPPER_1_0_CANONICAL_INSTALLATION, buildId: 'build-flipper-1.0-credential-access', integratedModules: ['credential-access'], sizeBytes: 5_600_000 } as FlipperInstallation],
  } } }
}

function withModuleArtifact(state = withInstalledHost()): GameState {
  const filesystem = state.player.localDevice.filesystem
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...filesystem, files: [...filesystem.files, ROLLBACK_ARTIFACT] } } } }
}

function Snapshot() {
  const flipper = findInstalledFlipper(useGameState().player.localDevice)
  return <output data-testid="flipper-state">{JSON.stringify(flipper)}</output>
}
const installed = () => JSON.parse(screen.getByTestId('flipper-state').textContent ?? 'null') as FlipperInstallation

afterEach(() => { vi.useRealTimers() })

describe('Flipper application', () => {
  it('states the installed product, its concrete build, size and integrated modules from canonical state', () => {
    render(<GameProvider initialState={withInstalledHost()}><Flipper /></GameProvider>)
    expect(screen.getByText('Flipper')).toBeInTheDocument()
    expect(value('RELEASE')).toBe('1.0 · STANDARD')
    expect(value('BUILD')).toBe('build-flipper-1.0-credential-access')
    expect(value('SIZE')).toBe('5.6 MB')

    const modules = screen.getAllByText(/Module$/).map((strong) => strong.closest('.node-row') as HTMLElement)
    expect(modules.map((row) => within(row).getByText(/INTEGRATED/).textContent)).toEqual(['INTEGRATED', 'NOT INTEGRATED'])
    expect(within(modules[0]).getByText('AUTH-017')).toBeInTheDocument()
    expect(within(modules[1]).getByText('UPD-001')).toBeInTheDocument()
  })

  it('reads build, size and module state from the installation rather than hardcoding them', () => {
    const base = withInstalledHost()
    const altered: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: base.player.localDevice.installedSoftware.map((software) => software.id === FLIPPER_PRODUCT_ID
      ? { ...software, buildId: 'build-flipper-synthetic-alternate', integratedModules: ['rollback'], sizeBytes: 9_100_000 } as FlipperInstallation
      : software) } } }
    render(<GameProvider initialState={altered}><Flipper /></GameProvider>)
    expect(value('BUILD')).toBe('build-flipper-synthetic-alternate')
    expect(value('SIZE')).toBe('9.1 MB')
    const rollback = screen.getByText('Rollback Module').closest('.node-row') as HTMLElement
    expect(within(rollback).getByText('INTEGRATED')).toBeInTheDocument()
    expect(within(screen.getByText('Credential Access Module').closest('.node-row') as HTMLElement).getByText('NOT INTEGRATED')).toBeInTheDocument()
  })

  it('offers no integration path when the Device possesses no module artifact', () => {
    const base = withInstalledHost()
    const noArtifacts = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: base.player.localDevice.filesystem.files.filter((file) => file.kind !== 'software_module') } } } }
    render(<GameProvider initialState={noArtifacts}><Flipper /></GameProvider>)
    expect(screen.getByText('NO MODULE ARTIFACTS')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'INTEGRATE' })).not.toBeInTheDocument()
  })

  it('integrates a possessed module through the canonical operation, mutating the build only at completion', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<GameProvider initialState={withModuleArtifact()}><Flipper /><Snapshot /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    expect(screen.getByText(new RegExp(ROLLBACK_ARTIFACT.path))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'INTEGRATE' }))

    // Admission alone changes nothing about the installed build.
    expect(installed()).toMatchObject({ buildId: 'build-flipper-1.0-credential-access', integratedModules: ['credential-access'], sizeBytes: 5_600_000 })
    expect(screen.getByRole('button', { name: 'INTEGRATING…' })).toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(30_000) })

    expect(installed()).toMatchObject({
      releaseId: 'flipper-1.0',
      buildId: FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID,
      integratedModules: ['credential-access', 'rollback'],
      sizeBytes: 5_600_000 + ROLLBACK_MODULE_1_0.sizeBytes,
    })
    expect(value('BUILD')).toBe(FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID)
    expect(value('SIZE')).toBe('7.7 MB')
    // The artifact is still possessed, and offers no second integration.
    expect(screen.getByText(new RegExp(ROLLBACK_ARTIFACT.path))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'INTEGRATE' })).not.toBeInTheDocument()
  })

  it('reports a canonical admission failure as-is rather than as fabricated integration state', async () => {
    const state = withModuleArtifact()
    const alreadyIntegrated = advanceGameState({ ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.map((software) => software.id === FLIPPER_PRODUCT_ID
      ? { ...(software as FlipperInstallation), integratedModules: ['credential-access', 'rollback'] } satisfies FlipperInstallation
      : software) } } }, 0)
    render(<GameProvider initialState={alreadyIntegrated}><Flipper /></GameProvider>)
    expect(screen.queryByRole('button', { name: 'INTEGRATE' })).not.toBeInTheDocument()
    expect(screen.getAllByText('INTEGRATED').length).toBeGreaterThan(0)
  })

  it('states an absent host truthfully rather than presenting an empty tool', () => {
    const base = createInitialGameState()
    const withoutFlipper: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: base.player.localDevice.installedSoftware.filter(({ id }) => id !== FLIPPER_PRODUCT_ID) } } }
    render(<GameProvider initialState={withoutFlipper}><Flipper /></GameProvider>)
    expect(screen.getByText('FLIPPER NOT INSTALLED')).toBeInTheDocument()
  })
})
