import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { GameProvider } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { RATTLER_INSTALLED_EXECUTABLE_PATH, RATTLER_PROGRAM_ID } from '../../core/game/rattler'
import { RATTLER_1_0 } from '../../core/game/softwareReleaseContent'
import type { GameState, RattlerPinSearchProcess } from '../../core/game/types'
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

function withRattlerProcess(status: 'running' | 'completed', result?: RattlerPinSearchProcess['result']): GameState {
  const base = availableState()
  const process: RattlerPinSearchProcess = {
    kind: 'rattler_pin_search', id: 'process-0042', label: 'RATTLER 1.0', executorDeviceId: 'host-phone-001',
    status, ramRequiredMiB: 96, workRequired: 10_000, workCompleted: status === 'running' ? 42 : 7043,
    targetDeviceId: 'host-phone-001', attackedSurface: 'veyra_wallet_device_pin', rattlerReleaseId: RATTLER_1_0.releaseId,
    rattlerBuildId: RATTLER_1_0.buildId, payloadFileId: 'file-remote-payload', payloadPathSnapshot: '/tmp/rattler.rpl',
    attemptsCompleted: status === 'running' ? 42 : 7043, elapsedMs: status === 'running' ? 4_032 : 676_128,
    currentCandidate: status === 'running' ? '0041' : '7042', result,
  }
  return { ...base, remoteSession: { ...base.remoteSession, active: null }, process: { ...base.process, processes: [process] } }
}

it('presents only the target input and CREATE PAYLOAD action, then reports the concrete artifact', async () => {
  const user = userEvent.setup()
  render(<GameProvider initialState={availableState()}><Rattler /></GameProvider>)
  expect(screen.getByRole('heading', { name: 'RATTLER' })).toBeInTheDocument()
  await user.type(screen.getByLabelText('IP address'), '198.51.100.47')
  await user.click(screen.getByRole('button', { name: 'CREATE PAYLOAD' }))
  expect(screen.getByText(/CREATED · \/home\/user\/apps\/rattler\/payloads\/payload-target-stable-id\.rpl/)).toBeInTheDocument()
})

it('monitors the latest running deployment after its Remote Session is gone', () => {
  render(<GameProvider initialState={withRattlerProcess('running')}><Rattler /></GameProvider>)
  expect(screen.getByLabelText('RATTLER deployment status')).toHaveTextContent('RUNNING')
  expect(screen.getByLabelText('RATTLER deployment status')).toHaveTextContent('42 / 10000')
  expect(screen.getByLabelText('IP address')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'CREATE PAYLOAD' })).toBeInTheDocument()
})

it('reconstructs and selects multiple canonical target deployments while authoring remains available', async () => {
  const user = userEvent.setup()
  const first = withRattlerProcess('running')
  const second: RattlerPinSearchProcess = {
    ...(first.process.processes[0] as RattlerPinSearchProcess), id: 'process-0043', targetDeviceId: 'host-phone-002',
    executorDeviceId: 'host-phone-002', status: 'completed', attemptsCompleted: 10_000, workCompleted: 10_000,
    elapsedMs: 960_000, currentCandidate: '9999', result: { status: 'search_exhausted' },
  }
  render(<GameProvider initialState={{ ...first, process: { ...first.process, processes: [...first.process.processes, second] } }}><Rattler /></GameProvider>)
  const deployments = screen.getByRole('navigation', { name: 'RATTLER deployments' })
  expect(deployments).toHaveTextContent('host-phone-001 · RUNNING')
  expect(deployments).toHaveTextContent('host-phone-002 · SEARCH EXHAUSTED')
  expect(screen.getByLabelText('RATTLER deployment status')).toHaveTextContent('host-phone-002')
  await user.click(screen.getByRole('button', { name: 'host-phone-001 · RUNNING' }))
  expect(screen.getByLabelText('RATTLER deployment status')).toHaveTextContent('host-phone-001')
  expect(screen.getByRole('button', { name: 'CREATE PAYLOAD' })).toBeInTheDocument()
})

it('keeps a terminal deployment inspectable after its Remote Session is gone', () => {
  render(<GameProvider initialState={withRattlerProcess('completed', { status: 'pin_found', pin: '7042' })}><Rattler /></GameProvider>)
  expect(screen.getByLabelText('RATTLER deployment status')).toHaveTextContent('SUCCESS / PIN FOUND')
  expect(screen.getByLabelText('RATTLER deployment status')).toHaveTextContent('7043 / 10000')
})
