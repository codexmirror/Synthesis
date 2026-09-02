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

/** Only Credential Access integrated; the seeded initial-state Credential Access artifact stays, and no Rollback artifact exists. */
function withInstalledHost(state = createInitialGameState()): GameState {
  const installation: FlipperInstallation = { ...FLIPPER_1_0_CANONICAL_INSTALLATION, buildId: 'build-flipper-1.0-credential-access', integratedModules: ['credential-access'], sizeBytes: 5_600_000 }
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice,
    installedSoftware: [...state.player.localDevice.installedSoftware, installation],
    filesystem: { ...state.player.localDevice.filesystem, files: [...state.player.localDevice.filesystem.files, { kind: 'executable', id: 'file-flipper-host', path: '/home/user/apps/flipper', programId: 'flipper', releaseId: installation.releaseId, buildId: installation.buildId, name: installation.name, version: installation.version, sizeBytes: installation.sizeBytes }] },
  } } }
}

function withModuleArtifact(state = withInstalledHost()): GameState {
  const filesystem = state.player.localDevice.filesystem
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...filesystem, files: [...filesystem.files, ROLLBACK_ARTIFACT] } } } }
}

function Snapshot() {
  const device = useGameState().player.localDevice
  const flipper = findInstalledFlipper(device)
  return <>
    <output data-testid="flipper-state">{JSON.stringify(flipper)}</output>
    <output data-testid="rollback-artifact-present">{String(device.filesystem.files.some((file) => file.id === ROLLBACK_ARTIFACT.id))}</output>
  </>
}
const installed = () => JSON.parse(screen.getByTestId('flipper-state').textContent ?? 'null') as FlipperInstallation
const rollbackArtifactPresent = () => screen.getByTestId('rollback-artifact-present').textContent === 'true'

afterEach(() => { vi.useRealTimers() })

describe('Flipper application', () => {
  it('states the installed product and its concrete build and size from canonical state', () => {
    render(<GameProvider initialState={withInstalledHost()}><Flipper /></GameProvider>)
    expect(screen.getByText('Flipper')).toBeInTheDocument()
    expect(value('RELEASE')).toBe('1.0 · STANDARD')
    expect(value('BUILD')).toBe('build-flipper-1.0-credential-access')
    expect(value('SIZE')).toBe('5.6 MB')
  })

  it('presents derived ACCESS and concrete NETWORK branches', () => {
    render(<GameProvider initialState={withInstalledHost()}><Flipper /></GameProvider>)
    const arsenal = screen.getByRole('region', { name: 'Offensive arsenal' })
    expect(arsenal).toHaveTextContent('ACCESS')
    expect(arsenal).toHaveTextContent('CREDENTIAL ACCESS')
    expect(arsenal).toHaveTextContent('Credential Access Module 1.0')
    expect(arsenal).toHaveTextContent('KeyProbe 1.0')
    expect(arsenal).toHaveTextContent('NETWORK')
    expect(arsenal).toHaveTextContent('DEAUTH')
    expect(arsenal).toHaveTextContent('deauth.ext 1.0')
    expect(within(arsenal).queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows only Credential Access as INTEGRATED and discloses no other module or the authored catalog size', () => {
    render(<GameProvider initialState={withInstalledHost()}><Flipper /></GameProvider>)
    const modules = screen.getAllByText(/Module$/).map((strong) => strong.closest('.node-row') as HTMLElement)
    expect(modules).toHaveLength(1)
    expect(within(modules[0]).getByText('INTEGRATED')).toBeInTheDocument()
    expect(within(modules[0]).getByText('AUTH-017')).toBeInTheDocument()
    // An already-integrated row describes the integrated capability itself, not its surviving source artifact's path/size.
    expect(within(modules[0]).queryByText(/credential-access-1\.0\.mod/)).not.toBeInTheDocument()
    expect(screen.queryByText('Rollback Module')).not.toBeInTheDocument()
    expect(screen.queryByText('UPD-001')).not.toBeInTheDocument()
    expect(screen.queryByText(/\/\s*2/)).not.toBeInTheDocument()
    expect(screen.queryByText('NOT INTEGRATED')).not.toBeInTheDocument()
  })

  it('reads build, size and module state from the installation rather than hardcoding them', () => {
    const base = withModuleArtifact()
    const altered: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: base.player.localDevice.installedSoftware.map((software) => software.id === FLIPPER_PRODUCT_ID
      ? { ...software, buildId: 'build-flipper-synthetic-alternate', integratedModules: ['rollback'], sizeBytes: 9_100_000 } as FlipperInstallation
      : software) } } }
    render(<GameProvider initialState={altered}><Flipper /></GameProvider>)
    expect(value('BUILD')).toBe('build-flipper-synthetic-alternate')
    expect(value('SIZE')).toBe('9.1 MB')
    const rollback = screen.getByText('Rollback Module').closest('.node-row') as HTMLElement
    expect(within(rollback).getByText('INTEGRATED')).toBeInTheDocument()
    // Credential Access is no longer integrated on this build, but its seeded artifact is still possessed, so it stays a valid candidate rather than disappearing.
    const credential = screen.getByText('Credential Access Module').closest('.node-row') as HTMLElement
    expect(within(credential).getByRole('button', { name: 'INTEGRATE' })).toBeInTheDocument()
  })

  it('discloses the newly possessed Rollback artifact for integration, with no separate INTEGRATION section', () => {
    render(<GameProvider initialState={withModuleArtifact()}><Flipper /></GameProvider>)
    expect(screen.queryByText('INTEGRATION')).not.toBeInTheDocument()
    const rollback = screen.getByText('Rollback Module').closest('.node-row') as HTMLElement
    expect(within(rollback).getByRole('button', { name: 'INTEGRATE' })).toBeInTheDocument()
    expect(within(rollback).getByText(new RegExp(ROLLBACK_ARTIFACT.path))).toBeInTheDocument()
  })

  it('states a truthful empty MODULES state without revealing what modules exist elsewhere', () => {
    const base = createInitialGameState()
    const noModulesInstalled: FlipperInstallation = { ...FLIPPER_1_0_CANONICAL_INSTALLATION, integratedModules: [] }
    const noArtifacts: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice,
      installedSoftware: [...base.player.localDevice.installedSoftware, noModulesInstalled],
      filesystem: { ...base.player.localDevice.filesystem, files: base.player.localDevice.filesystem.files.filter((file) => file.kind !== 'software_module') },
    } } }
    render(<GameProvider initialState={noArtifacts}><Flipper /></GameProvider>)
    expect(screen.getByText('NO MODULES')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'INTEGRATE' })).not.toBeInTheDocument()
    expect(screen.queryByText('Credential Access Module')).not.toBeInTheDocument()
    expect(screen.queryByText('Rollback Module')).not.toBeInTheDocument()
  })

  it('does not offer an unsupported/foreign module build as an integration candidate', () => {
    const base = withInstalledHost()
    const foreign = { ...ROLLBACK_ARTIFACT, buildId: 'unsupported-rollback-build' }
    const state: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, foreign] } } } }
    render(<GameProvider initialState={state}><Flipper /></GameProvider>)
    expect(screen.queryByText('Rollback Module')).not.toBeInTheDocument()
  })

  it('integrates a possessed module through the canonical operation, showing running progress on that same row, mutating the build only at completion, and decoupling the integrated row from the surviving source artifact', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<GameProvider initialState={withModuleArtifact()}><Flipper /><Snapshot /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await user.click(screen.getByRole('button', { name: 'INTEGRATE' }))

    // Admission alone changes nothing about the installed build.
    expect(installed()).toMatchObject({ buildId: 'build-flipper-1.0-credential-access', integratedModules: ['credential-access'], sizeBytes: 5_600_000 })
    const rollbackRow = screen.getByText('Rollback Module').closest('.node-row') as HTMLElement
    expect(within(rollbackRow).getByText(/INTEGRATING ·/)).toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(30_000) })

    expect(installed()).toMatchObject({
      releaseId: 'flipper-1.0',
      buildId: FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID,
      integratedModules: ['credential-access', 'rollback'],
      sizeBytes: 5_600_000 + ROLLBACK_MODULE_1_0.sizeBytes,
    })
    expect(value('BUILD')).toBe(FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID)
    expect(value('SIZE')).toBe('7.7 MB')
    // Rollback appears exactly once, as INTEGRATED. The row now describes the
    // integrated capability itself and no longer appends the source artifact's
    // path/size, even though that artifact still exists, unconsumed, in Files.
    const modules = screen.getAllByText(/Module$/)
    expect(modules.filter((el) => el.textContent === 'Rollback Module')).toHaveLength(1)
    const rollback = screen.getByText('Rollback Module').closest('.node-row') as HTMLElement
    expect(within(rollback).getByText('INTEGRATED')).toBeInTheDocument()
    expect(within(rollback).queryByText(new RegExp(ROLLBACK_ARTIFACT.path))).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'INTEGRATE' })).not.toBeInTheDocument()
    expect(rollbackArtifactPresent()).toBe(true)
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
