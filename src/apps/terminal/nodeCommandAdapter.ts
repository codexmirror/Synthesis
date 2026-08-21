import type { GameActions } from '../../app/GameContext'
import type { GameState } from '../../core/game/types'
import { dispatchCommand } from './registry'
import { parseCommand } from './parser'
import { inspectNetworkTarget } from '../../core/game/inspect'
import { resolveServiceEndpoint } from '../../core/game/serviceAnalysis'
import { BASIC_CREDENTIAL_TOOLKIT_ID } from '../../core/game/credentialAccess'
import { listDirectory, readTextFile } from '../../core/game/filesystem'
import type { deriveResourceUsage } from '../../core/game/processes'

type ResourceUsage = ReturnType<typeof deriveResourceUsage>

export function dispatchNodeCommand(command: string, gameState: GameState, actions: GameActions, usage: ResourceUsage) {
  const parsedCommand = parseCommand(command)

  const dispatched = dispatchCommand(parsedCommand, {
    localDevice: { ip: gameState.player.localDevice.network.ip, installedSoftware: gameState.player.localDevice.installedSoftware },
    filesystem: {
      list: (path) => listDirectory(gameState.player.localDevice.filesystem, path),
      readText: (path) => readTextFile(gameState.player.localDevice.filesystem, path),
    },
    runtime: {
      cpuLoad: Math.round(usage.totalCpuLoad),
      ramUsage: Math.round(usage.totalRamUsage),
      networkStatus: gameState.player.localDevice.runtime.networkStatus,
    },
    operations: {
      scanTarget: actions.scanTarget,
      inspectTarget: (target) =>
        inspectNetworkTarget(
          {
            localDevice: gameState.player.localDevice,
            network: gameState.world.network,
          },
          target,
        ),
      analyzeEndpoint: (endpoint) => {
        const resolved = resolveServiceEndpoint(gameState, endpoint)
        if (resolved === 'invalid') return { status: 'invalid_endpoint' }
        if (!resolved) return { status: 'endpoint_not_found' }

        const { state: _state, ...result } =
          actions.startServiceAnalysis(
            resolved.targetDeviceId,
            resolved.serviceId,
          )

        return result
      },
      knownWeaknesses: (targetDeviceId, serviceId) =>
        gameState.knowledge.discoveredVulnerabilities
          .filter(
            (known) =>
              known.targetDeviceId === targetDeviceId &&
              known.serviceId === serviceId,
          )
          .map((known) => known.observedLabel),
      attackEndpoint: (endpoint) => {
        const device = gameState.discovery.devices.find((candidate) =>
          candidate.services.some(
            (service) => service.endpoint === endpoint,
          ),
        )
        const service = device?.services.find(
          (candidate) => candidate.endpoint === endpoint,
        )
        const known =
          device && service
            ? gameState.knowledge.discoveredVulnerabilities.find(
                (candidate) =>
                  candidate.targetDeviceId === device.id &&
                  candidate.serviceId === service.id,
              )
            : undefined

        if (!device || !service || !known) {
          return { status: 'not_available' }
        }

        const { state: _state, ...result } =
          actions.startCredentialAccessAttemptFromObservation({
            endpoint,
            targetDeviceId: device.id,
            serviceId: service.id,
            vulnerabilityId: known.vulnerabilityId,
            toolId: BASIC_CREDENTIAL_TOOLKIT_ID,
          })

        return result
      },
      connectAddress: (address) => {
        const observed = gameState.discovery.devices.find((device) => device.address === address)
        if (!observed) return { status: 'target_not_known' }
        const { state: _state, ...result } = actions.connectRemoteFromObservation({ targetDeviceId: observed.id, address })
        return result
      },
      disconnectRemote: () => {
        const { state: _state, ...result } = actions.disconnectRemoteSession()
        return result
      },
      installLocalSoftwarePackage: (path) => {
        const { state: _state, ...result } = actions.installLocalSoftwarePackage(path)
        return result
      },
    },
  })
  return { parsedCommand, dispatched }
}
