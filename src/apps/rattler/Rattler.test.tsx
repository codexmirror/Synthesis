import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { GameProvider } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { RATTLER_INSTALLED_EXECUTABLE_PATH, RATTLER_PROGRAM_ID } from '../../core/game/rattler'
import { RATTLER_1_0 } from '../../core/game/softwareReleaseContent'
import type { GameState } from '../../core/game/types'
import { Rattler } from './Rattler'

function availableState(): GameState {
  const base = createInitialGameState()
  return {
    ...base,
    discovery: { ...base.discovery, devices: [{ id: 'target-stable-id', address: '198.51.100.47', scope: 'lan', servicesObserved: false, services: [] }] },
    player: { ...base.player, localDevice: {
      ...base.player.localDevice,
      installedSoftware: [...base.player.localDevice.installedSoftware, { id: RATTLER_1_0.productId, releaseId: RATTLER_1_0.releaseId, buildId: RATTLER_1_0.buildId, name: RATTLER_1_0.name, version: RATTLER_1_0.version }],
      filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, {
        kind: 'executable', id: 'file-rattler', path: RATTLER_INSTALLED_EXECUTABLE_PATH, programId: RATTLER_PROGRAM_ID,
        releaseId: RATTLER_1_0.releaseId, buildId: RATTLER_1_0.buildId, name: RATTLER_1_0.name, version: RATTLER_1_0.version, sizeBytes: 1_900_000,
      }] },
    } },
  }
}

it('presents only the target input and CREATE PAYLOAD action, then reports the concrete artifact', async () => {
  const user = userEvent.setup()
  render(<GameProvider initialState={availableState()}><Rattler /></GameProvider>)
  expect(screen.getByRole('heading', { name: 'RATTLER' })).toBeInTheDocument()
  await user.type(screen.getByLabelText('IP address'), '198.51.100.47')
  await user.click(screen.getByRole('button', { name: 'CREATE PAYLOAD' }))
  expect(screen.getByText(/CREATED · \/opt\/rattler\/payload-target-stable-id\.rpl/)).toBeInTheDocument()
})
