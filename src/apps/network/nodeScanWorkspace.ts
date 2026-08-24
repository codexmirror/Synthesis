import { basicCredentialToolkitSupports, findInstalledBasicCredentialToolkit, findInstalledNodeScan, nodeScanSupportsInspect } from '../../core/game/software'
import type {
  CredentialAccessProcess,
  GameState,
  GameProcess,
  LocalDeviceState,
  ServiceAnalysisProcess,
} from '../../core/game/types'

/**
 * NodeScan is a workspace over player information, not an admin panel over
 * World Truth. Everything the interface renders is derived here, from this
 * deliberately narrow slice of canonical state: remembered Discovery, earned
 * Knowledge, the player's own Processes, and the player's current
 * relationships. `world` is intentionally absent from the slice, so hidden
 * Device names, unobserved Service implementations, unobserved authentication
 * conditions, vulnerability presence and attack feasibility cannot reach the
 * interface even by accident.
 */
export type PlayerInformation = Pick<GameState, 'player' | 'discovery' | 'knowledge' | 'process' | 'deviceAccess' | 'remoteSession'>

/** Currently installed NodeScan release and the capability it actually supplies. */
export interface NodeScanRelease {
  readonly name: string
  readonly version: string
  readonly channel: string
  /**
   * Derived from canonical installed-software capability logic, never from a
   * version-number comparison. It stays true while a removal Process is still
   * running, because the override release remains installed until completion.
   */
  readonly canInspect: boolean
}

export function resolveNodeScanRelease(device: LocalDeviceState): NodeScanRelease | undefined {
  const installation = findInstalledNodeScan(device)
  if (!installation) return undefined
  return {
    name: installation.name,
    version: installation.version,
    channel: installation.channel,
    canInspect: nodeScanSupportsInspect(installation),
  }
}

export interface KnownWeakness {
  /** Player-facing technique identity, e.g. `AUTH-017`. */
  readonly id: string
  readonly label: string
}

export type OperationKind = 'analysis' | 'credential_access'

export interface RunningOperation {
  readonly kind: OperationKind
  readonly percent: number
}

export interface KnownNetworkSummary {
  readonly id: string
  readonly name: string
  readonly membersObserved: boolean
  readonly memberCount: number
}

export interface KnownDeviceSummary {
  readonly id: string
  readonly address: string
  readonly scope: 'lan' | 'remote'
  readonly servicesObserved: boolean
  readonly serviceCount: number
  readonly networkNames: readonly string[]
  readonly hasAccess: boolean
  readonly sessionActive: boolean
  readonly operationsRunning: number
}

export interface KnownSpace {
  readonly self: { readonly name: string; readonly address: string }
  readonly networks: readonly KnownNetworkSummary[]
  readonly devices: readonly KnownDeviceSummary[]
}

export interface NetworkMember {
  readonly id: string
  readonly address: string
  /** `self` members are intrinsic context rather than remembered Discovery Devices. */
  readonly scope: 'self' | 'lan' | 'remote'
}

export interface NetworkWorkspace {
  readonly id: string
  readonly name: string
  readonly membersObserved: boolean
  readonly members: readonly NetworkMember[]
  /** Remembered Inspect evidence; present only where a legitimate observation stored it. */
  readonly observed?: { readonly connected: boolean }
}

export interface ServiceSummary {
  readonly id: string
  readonly name: string
  readonly port: number
  readonly protocol: 'TCP' | 'UDP'
  readonly endpoint: string
  readonly observed?: { readonly implementation: string; readonly authentication?: string }
  readonly knowledge: readonly KnownWeakness[]
  readonly running: readonly RunningOperation[]
  readonly accessPrivilege?: 'USER'
}

export interface DeviceWorkspace {
  readonly id: string
  readonly address: string
  readonly scope: 'lan' | 'remote'
  readonly observed?: {
    readonly deviceKind: 'device' | 'server'
    readonly networkStatus: 'ONLINE'
    readonly firmware?: string
    readonly computeClass?: string
  }
  readonly networks: readonly { readonly id: string; readonly name: string }[]
  readonly servicesObserved: boolean
  readonly services: readonly ServiceSummary[]
  readonly access?: { readonly privilege: 'USER'; readonly viaServiceName?: string }
  readonly session?: { readonly privilege: 'USER'; readonly connectedAddress: string; readonly viaServiceName?: string }
}

export type AnalysisOutcome = 'weaknesses_detected' | 'no_weakness_detected' | 'service_unavailable'

export interface ServiceWorkspace {
  readonly deviceId: string
  readonly deviceAddress: string
  readonly id: string
  readonly name: string
  readonly port: number
  readonly protocol: 'TCP' | 'UDP'
  readonly endpoint: string
  readonly observed?: { readonly implementation: string; readonly authentication?: string }
  readonly knowledge: readonly KnownWeakness[]
  readonly analysisRunning?: RunningOperation
  /** Retained, disposable Process history — never permanent Knowledge. */
  readonly analysisOutcome?: AnalysisOutcome
  readonly credentialRunning?: RunningOperation
  readonly credentialFailed: boolean
  readonly access?: { readonly privilege: 'USER' }
  /**
   * The technique the installed credential tool actually supports for this
   * Service's known weaknesses. It reflects local software capability and
   * player Knowledge only; it never predicts whether an attempt would succeed.
   */
  readonly attempt?: { readonly toolName: string; readonly vulnerabilityId: string }
}

function percentOf(process: { workCompleted: number; workRequired: number }): number {
  return Math.floor(process.workCompleted / process.workRequired * 100)
}

function isServiceAnalysis(process: GameProcess): process is ServiceAnalysisProcess { return process.kind === 'service_analysis' }
function isCredentialAccess(process: GameProcess): process is CredentialAccessProcess { return process.kind === 'credential_access' }

/**
 * Operations are bound to the endpoint they were started against, so a
 * remembered card never adopts work aimed at a different endpoint of the same
 * stable Service identity.
 */
function operationsFor<T extends ServiceAnalysisProcess | CredentialAccessProcess>(
  processes: readonly T[], targetDeviceId: string, serviceId: string, endpoint: string,
): readonly T[] {
  return processes.filter((process) => process.targetDeviceId === targetDeviceId && process.serviceId === serviceId && process.startedEndpoint === endpoint)
}

function accessFor(information: PlayerInformation, targetDeviceId: string) {
  return information.deviceAccess.established.filter((access) =>
    access.sourceDeviceId === information.player.localDevice.id && access.targetDeviceId === targetDeviceId)
}

function knowledgeFor(information: PlayerInformation, targetDeviceId: string, serviceId: string): readonly KnownWeakness[] {
  return information.knowledge.discoveredVulnerabilities
    .filter((item) => item.targetDeviceId === targetDeviceId && item.serviceId === serviceId)
    .map((item) => ({ id: item.vulnerabilityId, label: item.observedLabel }))
}

function networksOf(information: PlayerInformation, deviceId: string) {
  return information.discovery.networkDeviceRelations
    .filter((relation) => relation.deviceId === deviceId)
    .map((relation) => information.discovery.networks.find((network) => network.id === relation.networkId))
    .filter((network): network is NonNullable<typeof network> => Boolean(network))
    .map(({ id, name }) => ({ id, name }))
}

function runningAgainst(information: PlayerInformation, targetDeviceId: string): number {
  return information.process.processes.filter((process) =>
    (isServiceAnalysis(process) || isCredentialAccess(process)) && process.status === 'running' && process.targetDeviceId === targetDeviceId).length
}

function describeImplementation(observed?: { implementation: { name: string; version: string }; authentication?: string }) {
  return observed ? { implementation: `${observed.implementation.name} ${observed.implementation.version}`, ...(observed.authentication ? { authentication: observed.authentication } : {}) } : undefined
}

export function selectKnownSpace(information: PlayerInformation): KnownSpace {
  const { discovery } = information
  const activeAccessId = information.remoteSession.active?.accessId
  return {
    self: { name: information.player.localDevice.displayName, address: information.player.localDevice.network.ip },
    networks: discovery.networks.map((network) => ({
      id: network.id,
      name: network.name,
      membersObserved: network.membersObserved,
      memberCount: discovery.networkDeviceRelations.filter((relation) => relation.networkId === network.id).length,
    })),
    devices: discovery.devices.map((device) => {
      const access = accessFor(information, device.id)
      return {
        id: device.id,
        address: device.address,
        scope: device.scope,
        servicesObserved: device.servicesObserved,
        serviceCount: device.services.length,
        networkNames: networksOf(information, device.id).map(({ name }) => name),
        hasAccess: access.length > 0,
        sessionActive: access.some(({ id }) => id === activeAccessId),
        operationsRunning: runningAgainst(information, device.id),
      }
    }),
  }
}

export function selectNetworkWorkspace(information: PlayerInformation, networkId: string): NetworkWorkspace | undefined {
  const network = information.discovery.networks.find(({ id }) => id === networkId)
  if (!network) return undefined
  const localDevice = information.player.localDevice
  const members = information.discovery.networkDeviceRelations
    .filter((relation) => relation.networkId === network.id)
    .map((relation): NetworkMember | undefined => {
      if (relation.deviceId === localDevice.id) return { id: localDevice.id, address: localDevice.network.ip, scope: 'self' }
      const device = information.discovery.devices.find(({ id }) => id === relation.deviceId)
      return device ? { id: device.id, address: device.address, scope: device.scope } : undefined
    })
    .filter((member): member is NetworkMember => Boolean(member))
  return {
    id: network.id,
    name: network.name,
    membersObserved: network.membersObserved,
    members,
    ...(network.inspect ? { observed: { connected: network.inspect.connected } } : {}),
  }
}

export function selectDeviceWorkspace(information: PlayerInformation, deviceId: string): DeviceWorkspace | undefined {
  const device = information.discovery.devices.find(({ id }) => id === deviceId)
  if (!device) return undefined
  const analyses = information.process.processes.filter(isServiceAnalysis)
  const attempts = information.process.processes.filter(isCredentialAccess)
  const established = accessFor(information, device.id)
  const activeAccessId = information.remoteSession.active?.accessId
  const activeAccess = established.find(({ id }) => id === activeAccessId)
  const serviceName = (serviceId: string) => device.services.find(({ id }) => id === serviceId)?.name

  const services = device.services.map((service): ServiceSummary => {
    const observed = describeImplementation(service.inspect)
    const running: RunningOperation[] = []
    const analysis = operationsFor(analyses, device.id, service.id, service.endpoint).find(({ status }) => status === 'running')
    if (analysis) running.push({ kind: 'analysis', percent: percentOf(analysis) })
    const attempt = operationsFor(attempts, device.id, service.id, service.endpoint).find(({ status }) => status === 'running')
    if (attempt) running.push({ kind: 'credential_access', percent: percentOf(attempt) })
    const viaAccess = established.find((access) => access.viaServiceId === service.id)
    return {
      id: service.id,
      name: service.name,
      port: service.port,
      protocol: service.protocol,
      endpoint: service.endpoint,
      ...(observed ? { observed } : {}),
      knowledge: knowledgeFor(information, device.id, service.id),
      running,
      ...(viaAccess ? { accessPrivilege: viaAccess.privilege } : {}),
    }
  })

  const passive = established[0]
  return {
    id: device.id,
    address: device.address,
    scope: device.scope,
    ...(device.inspect
      ? {
        observed: {
          deviceKind: device.inspect.deviceKind,
          networkStatus: device.inspect.networkStatus,
          ...(device.inspect.enhanced ? { firmware: `${device.inspect.enhanced.firmware.name} ${device.inspect.enhanced.firmware.version}`, computeClass: device.inspect.enhanced.computeClass } : {}),
        },
      }
      : {}),
    networks: networksOf(information, device.id),
    servicesObserved: device.servicesObserved,
    services,
    ...(passive ? { access: { privilege: passive.privilege, ...(serviceName(passive.viaServiceId) ? { viaServiceName: serviceName(passive.viaServiceId) } : {}) } } : {}),
    ...(activeAccess && information.remoteSession.active
      ? {
        session: {
          privilege: activeAccess.privilege,
          connectedAddress: information.remoteSession.active.connectedAddress,
          ...(serviceName(activeAccess.viaServiceId) ? { viaServiceName: serviceName(activeAccess.viaServiceId) } : {}),
        },
      }
      : {}),
  }
}

export function selectServiceWorkspace(information: PlayerInformation, deviceId: string, serviceId: string): ServiceWorkspace | undefined {
  const device = information.discovery.devices.find(({ id }) => id === deviceId)
  const service = device?.services.find(({ id }) => id === serviceId)
  if (!device || !service) return undefined

  const analyses = operationsFor(information.process.processes.filter(isServiceAnalysis), device.id, service.id, service.endpoint)
  const analysisRunning = analyses.find(({ status }) => status === 'running')
  const analysisOutcome = [...analyses].reverse().find((process) => process.status === 'completed' && process.result)?.result?.status
  const attempts = operationsFor(information.process.processes.filter(isCredentialAccess), device.id, service.id, service.endpoint)
  const credentialRunning = attempts.find(({ status }) => status === 'running')
  const lastAttempt = [...attempts].reverse().find((process) => process.status === 'completed' && process.result)?.result
  const access = accessFor(information, device.id).find((item) => item.viaServiceId === service.id)
  const knowledge = knowledgeFor(information, device.id, service.id)
  const toolkit = findInstalledBasicCredentialToolkit(information.player.localDevice)
  const supported = toolkit && knowledge.find(({ id }) => basicCredentialToolkitSupports(toolkit, id))
  const observed = describeImplementation(service.inspect)

  return {
    deviceId: device.id,
    deviceAddress: device.address,
    id: service.id,
    name: service.name,
    port: service.port,
    protocol: service.protocol,
    endpoint: service.endpoint,
    ...(observed ? { observed } : {}),
    knowledge,
    ...(analysisRunning ? { analysisRunning: { kind: 'analysis' as const, percent: percentOf(analysisRunning) } } : {}),
    ...(analysisOutcome ? { analysisOutcome } : {}),
    ...(credentialRunning ? { credentialRunning: { kind: 'credential_access' as const, percent: percentOf(credentialRunning) } } : {}),
    credentialFailed: lastAttempt?.status === 'attempt_failed',
    ...(access ? { access: { privilege: access.privilege } } : {}),
    ...(toolkit && supported ? { attempt: { toolName: toolkit.name, vulnerabilityId: supported.id } } : {}),
  }
}
