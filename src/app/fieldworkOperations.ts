import { authenticateServiceKey, deliverRecovery, runSentrySweep } from '../core/game/fieldwork'
import { pingFromDevice } from '../core/game/ping'
import { scanFromDevice } from '../core/game/scan'
import { rememberPing, rememberScan } from '../core/game/discovery'
import { startServiceAnalysisFromObservation } from '../core/game/serviceAnalysis'
import { findInstalledNodeScan } from '../core/game/software'
import type { GameStateAccessor } from './gameStateAccess'
import { commitResult } from './gameStateAccess'

/** One deliberate reconnaissance request, composed from real observations and finite endpoint work. */
export function createFieldworkActions(accessor: GameStateAccessor) {
  return {
    deliverRecovery: (requestId: string, fileId: string) => commitResult(accessor, deliverRecovery(accessor.read(), requestId, fileId)),
    authenticateServiceKey: (fileId: string) => commitResult(accessor, authenticateServiceKey(accessor.read(), fileId)),
    runSentrySweep: () => commitResult(accessor, runSentrySweep(accessor.read())),
    surveyAddress(address: string): { status: string; targetId?: string } {
      let state = accessor.read()
      if (!state.fieldwork || !findInstalledNodeScan(state.player.localDevice)) return { status: 'unavailable' }
      const localId = state.player.localDevice.id
      const ping = pingFromDevice(state, localId, address)
      if (ping.status !== 'device') return { status: 'no_response' }
      state = { ...state, discovery: rememberPing(state.discovery, ping, localId) }
      const scan = scanFromDevice(state, localId, address)
      state = { ...state, discovery: rememberScan(state.discovery, scan, localId) }
      if (scan.status !== 'device') { accessor.write(state); return { status: 'no_response' } }
      // Choose targets only from the surface just observed, never from hidden host inventories.
      const endpoints = [...scan.services.map(service => ({ targetDeviceId: scan.targetId, service })), ...(scan.exposedBackends ?? [])]
      const useful = endpoints.filter(({ service }) => service.name === 'SSH' || service.name === 'RackUpdate')
      let started = 0
      for (const endpoint of useful) {
        if (state.deviceAccess.established.some(a => a.sourceDeviceId === localId && a.targetDeviceId === endpoint.targetDeviceId)) continue
        const result = startServiceAnalysisFromObservation(state, { targetDeviceId: endpoint.targetDeviceId, serviceId: endpoint.service.id, endpoint: `${address}:${endpoint.service.port}` })
        state = result.state
        if (result.status === 'started') started++
      }
      accessor.write(state)
      return { status: started ? 'surveying' : 'observed', targetId: useful[0]?.targetDeviceId ?? scan.targetId }
    },
  }
}
