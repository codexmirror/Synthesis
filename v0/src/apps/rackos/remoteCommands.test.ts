import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../../core/game/initialState'
import { runRemoteCommand } from './remoteCommands'

describe('remote RACK-OS commands', () => {
  it('renders the operated Device intrinsic network context for ip', () => {
    const state = createInitialGameState()
    const target = state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    const result = runRemoteCommand({ session: { id: 'session-test', accessId: 'access-test', connectedAddress: '203.0.113.42' }, access: { id: 'access-test', sourceDeviceId: state.player.localDevice.id, targetDeviceId: target.id, viaServiceId: 'service-ssh-002', privilege: 'USER' }, target, service: target.services![0] }, 'ip', {
      startRemoteFileDownload: () => ({ status: 'session_unavailable', state }), startRemoteFileUpload: () => ({ status: 'session_unavailable', state }),
      nodeMiner: { run: () => ({ status: 'unavailable' }), status: () => ({ status: 'idle' }), stop: () => ({ status: 'not_running' }), payout: () => ({ status: 'nothing_unpaid', processId: 'none' }), configurePayout: () => ({ status: 'not_running' }) },
      scan: () => ({ status: 'unknown_target', input: 'unused' }),
      networkContext: () => ['ADDRESS   10.42.0.42', 'NETWORK   10.42.0.0/24', 'GATEWAY   203.0.113.42'],
    })
    expect(result.output).toEqual(['ADDRESS   10.42.0.42', 'NETWORK   10.42.0.0/24', 'GATEWAY   203.0.113.42'])
  })
})
