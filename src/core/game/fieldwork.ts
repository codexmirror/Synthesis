import { advanceRemoteSessionReachability } from './remoteSession'
import { appendGatewayConnectionAttemptEvidence } from './networkActivityHistory'
import { creditNodeWalletRecovery } from './nodeEconomy'
import type { FilesystemFile, GameState, NetworkHost, SoftwarePackageFile, TextFile } from './types'
import type { RecoveryRequest } from './fieldworkTypes'
import { createInitialGameState } from './initialState'
import { SENTRY_1_0, NODESCAN_1_2_STANDARD, FLIPPER_1_0, RATTLER_1_0, NODE_MINER_1_0, type SoftwareReleaseContent } from './softwareReleaseContent'
import { ROLLBACK_MODULE_1_0 } from './flipper'
import { GATE_SSH_1_3_2_BUILD_ID, GATE_SSH_1_3_3_BUILD_ID, RACK_UPDATE_1_0_BUILD_ID } from './serviceImplementations'
import { RACK_OS_FIRMWARE_ID } from './firmwareIdentity'
import { RACK_OS_1_1_BUSINESS_RELEASE } from './rackOsFirmwareUpdate'
import { resolveServiceEndpoint } from './serviceAnalysis'
import { resolvePlayerNetworkPath } from './networkPath'
import { isDeviceNetworkUsable } from './deviceOperationalState'
import { appendAuthenticationHistoryForHost } from './authenticationHistory'
import { AUTH_GUARD_1_0_INSTALLATION } from './authGuard'

export const RACK_UPDATE_ADVISORY = 'Foundry engineering advisory UPD-001\nRackUpdate 1.0 accepts old GateSSH releases without rollback protection. Use Rollback to open package submission; supply a concrete GateSSH package. The running service changes only at reboot.\n'

const BROKER = 'node-account-switchboard'
export const DISPATCH_INTERVAL_MS = 180_000
export const SENTRY_RELEASE = SENTRY_1_0
const sites = [
  { id: 'relay', company: 'Relay Cooperative', address: '203.0.113.71', title: 'Recover the missing mirror index', brief: 'An old release mirror holds our index and a reconnaissance build. Recover the index; keep any useful tools. Its operator reviews authentication history periodically.', reward: 18_000, patched: false, guard: false, period: 240_000 },
  { id: 'atlas', company: 'Atlas Distribution', address: '203.0.113.72', title: 'Find Atlas’s delivery ledger', brief: 'The warehouse cache has delivery records and a maintenance credential for Northline. The public SSH deployment may have been patched. A release mirror may hold another way in.', reward: 32_000, patched: true, guard: false, period: 150_000 },
  { id: 'northline', company: 'Northline Book Supply', address: '203.0.113.73', title: 'Recover the Northline supply audit', brief: 'Supply audit on a protected operations server. Atlas staff use a maintenance key here. Brute force is a poor bet; software and credentials circulate between these companies.', reward: 45_000, patched: true, guard: true, period: 120_000 },
  { id: 'foundry', company: 'Foundry Hosting', address: '203.0.113.74', title: 'Recover the build manifest', brief: 'Build host with legacy SSH and spare compute. Its archive carries Rollback, an engineering advisory and an old GateSSH package. Security maintenance patches used entry points; take what matters first.', reward: 24_000, patched: false, guard: false, period: 210_000 },
  { id: 'meridian', company: 'Meridian Research', address: '203.0.113.75', title: 'Retrieve the research snapshot', brief: 'A patched service and a RackUpdate endpoint. Their maintenance notes say accepted updates activate at the next scheduled restart. A Rollback tool and legacy package may create an opening.', reward: 60_000, patched: true, guard: true, period: 180_000 },
] as const

export function packageFile(release: Pick<SoftwareReleaseContent, 'productId' | 'releaseId' | 'buildId' | 'name' | 'version'> & { channel?: string; publisher?: string }, id: string, path: string, sizeBytes = 4_000_000): SoftwarePackageFile {
  return { kind: 'software_package', id, path, productId: release.productId, releaseId: release.releaseId, buildId: release.buildId, name: release.name, version: release.version, ...('channel' in release ? { channel: release.channel } : {}), ...('publisher' in release ? { publisher: release.publisher } : {}), sizeBytes }
}
const textFile = (id: string, path: string, content: string): TextFile => ({ kind: 'text', id, path, content })
export function recoveryDigest(text: string): string {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  return (hash >>> 0).toString(16)
}
function dossier(site: typeof sites[number], sequence: number) {
  const filename = `${site.id}-dispatch-${sequence}.txt`
  const content = `${site.company} / operational dispatch ${sequence}\nShipment reference ${site.id.toUpperCase()}-${sequence * 7919}.\nThis is the requested original recovery document.\n`
  const request: RecoveryRequest = { id: `recovery-${site.id}-${sequence}`, company: site.company, address: site.address, title: sequence === 1 ? site.title : `${site.company}: dispatch ${sequence}`, brief: site.brief, filename, reward: site.reward + (sequence > 1 ? 6_000 : 0), digest: recoveryDigest(content) }
  return { request, content }
}
export function serviceKeyDocument(address: string, targetId: string, serviceId: string, secret: string): string {
  return `SERVICE KEY\nAddress: ${address}\nDevice: ${targetId}\nService: ${serviceId}\nSecret: ${secret}\n\nA maintenance credential, not a vulnerability. Rotation invalidates old copies.\n`
}
export function readServiceKey(file: FilesystemFile): { address: string; targetId: string; serviceId: string; secret: string } | undefined {
  if (file.kind !== 'text' || !file.content.startsWith('SERVICE KEY\n')) return
  const fields = file.content.match(/^SERVICE KEY\nAddress: ([^\n]+)\nDevice: ([^\n]+)\nService: ([^\n]+)\nSecret: ([^\n]+)\n/)
  return fields ? { address: fields[1], targetId: fields[2], serviceId: fields[3], secret: fields[4] } : undefined
}

/** Existing game, enriched in place only at the Sandbox composition boundary. */
export function createSandboxGameState(): GameState {
  const base = createInitialGameState()
  const hosts: NetworkHost[] = [...base.world.network.hosts]
  const networks = [...base.world.network.localNetworks]
  const companies = [...base.business.companies]
  const branches = [...base.business.branches]
  const requests: RecoveryRequest[] = []
  sites.forEach((site, index) => {
    const id = `field-${site.id}`, serviceId = `${id}-ssh`, gatewayId = `${id}-gateway`, networkId = `${id}-net`
    const implementation = { productId: 'gate-ssh', releaseId: site.patched ? 'gate-ssh-1.3.3' : 'gate-ssh-1.3.2', buildId: site.patched ? GATE_SSH_1_3_3_BUILD_ID : GATE_SSH_1_3_2_BUILD_ID, name: 'GateSSH', version: site.patched ? '1.3.3' : '1.3.2' }
    const dispatch = dossier(site, 1); requests.push(dispatch.request)
    const files: FilesystemFile[] = [textFile('file-0001', `/work/${dispatch.request.filename}`, dispatch.content), textFile('file-0002', '/work/operator-notes.txt', `${site.company} — ${site.id}\n${site.brief}\nMaintenance interval: ${site.period / 1000} seconds. Used credentials are rotated. Authenticated operators can inspect maintenance in System.\n`)]
    if (site.id === 'relay') files.push(packageFile(NODESCAN_1_2_STANDARD, 'file-0003', '/software/nodescan-1.2.pkg', 19_200_000), textFile('file-0004', '/work/atlas-maintenance.key', serviceKeyDocument('203.0.113.72', 'field-atlas', 'field-atlas-ssh', 'atlas-route-one')), packageFile(FLIPPER_1_0, 'file-0005', '/software/flipper-1.0.pkg'))
    if (site.id === 'atlas') files.push(textFile('file-0003', '/work/northline-maintenance.key', serviceKeyDocument('203.0.113.73', 'field-northline', 'field-northline-ssh', 'northline-route-one')), packageFile(RATTLER_1_0, 'file-0004', '/software/rattler-1.0.pkg', 2_800_000))
    if (site.id === 'northline') files.push(textFile('file-0004', '/work/relay-maintenance.key', serviceKeyDocument('203.0.113.71', 'field-relay', 'field-relay-ssh', 'relay-route-one')), textFile('file-0005', '/work/meridian-maintenance.key', serviceKeyDocument('203.0.113.75', 'field-meridian', 'field-meridian-ssh', 'meridian-route-one')), packageFile(SENTRY_RELEASE, 'file-0003', '/software/sentry-1.0.pkg', 2_000_000))
    if (site.id === 'foundry') files.push(textFile('file-0006', '/work/rackupdate-advisory.txt', RACK_UPDATE_ADVISORY), { kind: 'software_module', id: 'file-0003', path: '/software/rollback-1.0.mod', ...ROLLBACK_MODULE_1_0 }, packageFile({ productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID, name: 'GateSSH', version: '1.3.2' }, 'file-0004', '/software/gatessh-1.3.2.pkg', 6_400_000), packageFile(NODE_MINER_1_0, 'file-0005', '/software/node-miner-1.0.pkg', 3_400_000))
    if (site.id === 'meridian') files.push(textFile('file-0005', '/work/foundry-maintenance.key', serviceKeyDocument('203.0.113.74', 'field-foundry', 'field-foundry-ssh', 'foundry-route-one')), packageFile(SENTRY_RELEASE, 'file-0003', '/software/sentry-1.0.pkg', 2_000_000), textFile('file-0004', '/work/bookstore-contact.txt', 'Bookstore public edge: 203.0.113.42\nThe work phone is forwarded on port 2222. Its Business application has company authority. A wallet incident causes its technician to react.\n'))
    const services: NonNullable<NetworkHost['services']>[number][] = [{ id: serviceId, name: 'SSH', port: 22, protocol: 'TCP', open: true, implementation, credentialAccess: { privilege: 'USER' } }]
    if (site.id === 'meridian') services.push({ id: `${id}-update`, name: 'RackUpdate', port: 8443, protocol: 'TCP', open: true, implementation: { productId: 'rack-update', releaseId: 'rack-update-1.0', buildId: RACK_UPDATE_1_0_BUILD_ID, name: 'RackUpdate', version: '1.0' } })
    hosts.push({ id, ip: `10.${70 + index}.0.10`, displayName: `${site.id}-ops`, deviceType: 'SERVER', role: 'server', firmware: index % 2 ? RACK_OS_1_1_BUSINESS_RELEASE.firmware : { id: RACK_OS_FIRMWARE_ID, name: 'RACK-OS', version: '1.0' }, operational: { lifecycle: 'RUNNING', connectivity: 'CONNECTED' }, connectivityRecoveryBehavior: 'REBOOT_ON_DISCONNECT', hardware: { cpu: { name: index === 3 ? 'Build CPU' : 'Operations CPU', computeCapacity: index === 3 ? 320 : 140 }, ram: { name: '8 GB', capacityMiB: 8192 } }, runtime: { baselineCpuLoad: 12, baselineRamUsage: 18 }, transferCapacity: { uploadBytesPerSecond: index === 2 ? 262_144 : 4_194_304, downloadBytesPerSecond: 4_194_304 }, filesystem: { nextFileId: 10, files }, installedSoftware: [{ id: 'gate-ssh', ...implementation }, ...(site.guard ? [AUTH_GUARD_1_0_INSTALLATION, { id: SENTRY_RELEASE.productId, name: SENTRY_RELEASE.name, version: SENTRY_RELEASE.version, releaseId: SENTRY_RELEASE.releaseId, buildId: SENTRY_RELEASE.buildId, publisher: SENTRY_RELEASE.publisher }] : [])], services, authenticationHistory: { nextId: 1, records: [] }, serviceKeys: [{ serviceId, secret: `${site.id}-route-one` }], securityMaintenance: { intervalMs: site.period, remainingMs: site.period, observedAuthCounter: 1, rotations: 0 } })
    hosts.push({ id: gatewayId, ip: `10.${70 + index}.0.1`, publicAddress: site.address, deviceType: 'ROUTER', operational: { lifecycle: 'RUNNING', connectivity: 'CONNECTED' }, services: [], exposures: services.map(service => ({ protocol: 'TCP', externalPort: service.port, targetDeviceId: id, targetServiceId: service.id })), activityHistory: { nextId: 1, records: [] } })
    networks.push({ id: networkId, name: `${site.id}-net`, cidr: `10.${70 + index}.0.0/24`, gatewayDeviceId: gatewayId, memberDeviceIds: [id, gatewayId], transferCapacity: { uploadBytesPerSecond: 8_388_608, downloadBytesPerSecond: 8_388_608 }, activityHistory: { nextId: 1, records: [] } })
    const companyId = site.id === 'atlas' ? 'company-atlas-distribution-01' : site.id === 'northline' ? 'company-northline-book-supply-01' : `company-${site.id}`
    if (!companies.some(c => c.id === companyId)) companies.push({ id: companyId, displayName: site.company })
    branches.push({ id: `${id}-branch`, displayName: `${site.company} Operations`, location: 'Remote operations', companyId, networkId })
  })
  const prices: Record<string, number> = { 'market-offer-rattler-1.0-v0': 18_000, 'market-offer-flipper-1.0': 24_000, 'market-offer-flipper-rollback-module-1.0': 32_000, 'market-offer-gate-ssh-1.3.2': 12_000, 'market-offer-rack-os-1.1-business': 65_000 }
  return { ...base, market: { ...base.market, offers: base.market.offers.map(offer => ({ ...offer, priceNodeUnits: prices[offer.id] ?? offer.priceNodeUnits })) }, fieldwork: { edition: 1, requests, nextDispatch: 2, elapsedMs: 0, dispatchRemainingMs: DISPATCH_INTERVAL_MS, receipts: [] }, world: { ...base.world, network: { hosts, localNetworks: networks } }, business: { ...base.business, companies, branches }, nodeEconomy: { accounts: [...base.nodeEconomy.accounts, { id: BROKER, address: 'node-switchboard-escrow', balanceNodeUnits: 5_000_000 }] }, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: base.player.localDevice.filesystem.files.filter(f => f.kind !== 'software_package' || f.releaseId !== NODESCAN_1_2_STANDARD.releaseId) } } } }
}

/** A request proves possession of the exact delivered document, not Access or a UI checkbox. */
export function deliverRecovery(state: GameState, requestId: string, fileId: string): { status: 'paid' | 'already_delivered' | 'file_mismatch' | 'unavailable'; state: GameState } {
  const request = state.fieldwork?.requests.find(r => r.id === requestId)
  if (!request || !state.fieldwork) return { status: 'unavailable', state }
  if (request.delivered) return { status: 'already_delivered', state }
  const file = state.player.localDevice.filesystem.files.find(f => f.id === fileId)
  if (file?.kind !== 'text' || recoveryDigest(file.content) !== request.digest) return { status: 'file_mismatch', state }
  const broker = state.nodeEconomy.accounts.find(a => a.id === BROKER)
  if (!broker || broker.balanceNodeUnits < request.reward) return { status: 'unavailable', state }
  return { status: 'paid', state: { ...state, fieldwork: { ...state.fieldwork, requests: state.fieldwork.requests.map(r => r.id === request.id ? { ...r, delivered: true } : r), receipts: [...state.fieldwork.receipts, { requestId, title: request.title, reward: request.reward }].slice(-30) }, nodeEconomy: { accounts: state.nodeEconomy.accounts.map(a => a.id === BROKER ? { ...a, balanceNodeUnits: a.balanceNodeUnits - request.reward } : a) }, nodeWallet: creditNodeWalletRecovery(state.nodeWallet, request.reward, request.title) } }
}

/** Credential material is an actual local file; the endpoint and secret are revalidated against the owning Device. */
export function authenticateServiceKey(state: GameState, fileId: string): { status: 'access_established' | 'key_rejected' | 'key_unavailable'; state: GameState } {
  const file = state.player.localDevice.filesystem.files.find(f => f.id === fileId)
  const key = file && readServiceKey(file)
  if (!key) return { status: 'key_unavailable', state }
  const resolved = resolveServiceEndpoint(state, `${key.address}:22`)
  const target = state.world.network.hosts.find(h => h.id === key.targetId)
  const service = target?.services?.find(s => s.id === key.serviceId)
  const reached = resolved !== 'invalid' && resolved?.targetDeviceId === key.targetId && resolved.serviceId === key.serviceId
  const path = resolvePlayerNetworkPath(state, key.address, 22)
  const usable = isDeviceNetworkUsable(state.player.localDevice.operational) && target && isDeviceNetworkUsable(target.operational) && (path.kind !== 'EXPOSED_EDGE' || isDeviceNetworkUsable(path.gateway.operational))
  if (!reached || !usable || !service?.open || !service.credentialAccess) return { status: 'key_rejected', state }
  const accepted = target?.serviceKeys?.some(k => k.serviceId === key.serviceId && k.secret === key.secret)
  const sourceAddress = state.player.localDevice.network.ip
  const result = accepted ? 'SUCCESS' as const : 'FAILURE' as const
  const world = appendGatewayConnectionAttemptEvidence(
    appendAuthenticationHistoryForHost(state.world, key.targetId, { serviceId: service.id, serviceName: service.name, sourceAddress, result }),
    { sourceDeviceId: state.player.localDevice.id, targetDeviceId: key.targetId, sourceAddress, targetAddress: key.address, serviceId: service.id, serviceName: service.name, result },
  )
  if (!accepted) return { status: 'key_rejected', state: { ...state, world } }
  const exists = state.deviceAccess.established.some(a => a.sourceDeviceId === state.player.localDevice.id && a.targetDeviceId === key.targetId && a.viaServiceId === key.serviceId)
  const previous = state.discovery.devices.find(d => d.id === key.targetId)
  const rememberedService = previous?.services.find(s => s.id === key.serviceId)
  const discovery = { ...state.discovery, devices: [...state.discovery.devices.filter(d => d.id !== key.targetId), { ...previous, id: key.targetId, address: key.address, scope: previous?.scope ?? 'remote' as const, servicesObserved: true, services: [...(previous?.services.filter(s => s.id !== key.serviceId) ?? []), { ...rememberedService, id: service.id, name: service.name, port: 22, protocol: service.protocol, endpoint: `${key.address}:22` }] }] }
  const deviceAccess = exists ? state.deviceAccess : { nextId: state.deviceAccess.nextId + 1, established: [...state.deviceAccess.established, { id: `access-${String(state.deviceAccess.nextId).padStart(4, '0')}`, sourceDeviceId: state.player.localDevice.id, targetDeviceId: key.targetId, viaServiceId: service.id, viaServiceBuildId: service.implementation.buildId, privilege: service.credentialAccess.privilege }] }
  return { status: 'access_established', state: { ...state, world, discovery, deviceAccess } }
}

/** Device maintenance acts on its own authentication evidence. It never rewrites player memory. */
function maintainDevice(state: GameState, deviceId: string): GameState {
  const host = state.world.network.hosts.find(h => h.id === deviceId)
  const maintenance = host?.securityMaintenance
  if (!host || !maintenance) return state
  const counter = host.authenticationHistory?.nextId ?? 1
  const used = counter > maintenance.observedAuthCounter
  const rotation = maintenance.rotations + (used ? 1 : 0)
  let nextHost: NetworkHost = { ...host, securityMaintenance: { ...maintenance, remainingMs: maintenance.intervalMs, observedAuthCounter: counter, rotations: rotation } }
  if (used) {
    nextHost = { ...nextHost,
      serviceKeys: host.serviceKeys?.map(key => ({ ...key, secret: `${host.id}-rotation-${rotation}` })),
      services: host.services?.map(service => service.implementation.productId === 'gate-ssh' ? { ...service, implementation: { ...service.implementation, releaseId: 'gate-ssh-1.3.3', buildId: GATE_SSH_1_3_3_BUILD_ID, version: '1.3.3' } } : service),
      installedSoftware: host.installedSoftware?.map(software => software.id === 'gate-ssh' ? { ...software, releaseId: 'gate-ssh-1.3.3', buildId: GATE_SSH_1_3_3_BUILD_ID, version: '1.3.3' } : software),
    }
  }
  // A pending RackUpdate submission requires an actual reboot. Connectivity recovery owns that lifecycle.
  if (host.pendingGateSshActivation) nextHost = { ...nextHost, operational: { ...host.operational, connectivity: 'DISCONNECTED' } }
  let next: GameState = { ...state, world: { ...state.world, network: { ...state.world.network, hosts: state.world.network.hosts.map(h => h.id === deviceId ? nextHost : h) } }, deviceAccess: used ? { ...state.deviceAccess, established: state.deviceAccess.established.filter(a => a.targetDeviceId !== deviceId) } : state.deviceAccess }
  if (used && state.fieldwork && state.deviceAccess.established.some(a => a.targetDeviceId === deviceId && a.sourceDeviceId === state.player.localDevice.id)) {
    next = { ...next, fieldwork: { ...state.fieldwork, lastNotice: `Access to ${host.displayName ?? host.ip} expired during its security review. Your downloaded files remain. Recheck its services or recover a current maintenance key.` } }
  }
  if (used) {
    // The administrators update their represented backup key documents. Stolen local copies stay stale.
    next = { ...next, world: { ...next.world, network: { ...next.world.network, hosts: next.world.network.hosts.map(h => !h.filesystem ? h : { ...h, filesystem: { ...h.filesystem, files: h.filesystem.files.map(file => {
      const key = readServiceKey(file)
      const replacement = nextHost.serviceKeys?.find(k => k.serviceId === key?.serviceId)
      return key?.targetId === host.id && replacement && file.kind === 'text' ? { ...file, path: file.path.replace(/(-r[0-9]+)?\.key$/, `-r${rotation}.key`), content: serviceKeyDocument(key.address, key.targetId, key.serviceId, replacement.secret) } : file
    }) } }) } } }
  }
  // Sentry's automatic maintenance uses exactly the same concrete cleanup as the operator's sweep.
  if (host.installedSoftware?.some(s => s.id === SENTRY_RELEASE.productId && s.buildId === SENTRY_RELEASE.buildId)) next = cleanKnownPayloads(next, host.id)
  return advanceRemoteSessionReachability(next)
}
function publishDispatch(state: GameState): GameState {
  if (!state.fieldwork) return state
  const fieldwork = state.fieldwork
  const site = sites[(fieldwork.nextDispatch - 2) % sites.length]
  const outstanding = fieldwork.requests.find(r => r.address === site.address && !r.delivered)
  let next = { ...state, fieldwork: { ...fieldwork, nextDispatch: fieldwork.nextDispatch + 1, dispatchRemainingMs: DISPATCH_INTERVAL_MS } }
  if (outstanding) return next
  const dispatch = dossier(site, fieldwork.nextDispatch)
  const hosts = next.world.network.hosts.map(host => host.id !== `field-${site.id}` || !host.filesystem ? host : { ...host, filesystem: { nextFileId: host.filesystem.nextFileId + 1, files: [...host.filesystem.files.filter(f => !f.path.startsWith(`/work/${site.id}-dispatch-`)), textFile(`file-${String(host.filesystem.nextFileId).padStart(4, '0')}`, `/work/${dispatch.request.filename}`, dispatch.content)] } })
  return { ...next, fieldwork: { ...next.fieldwork, requests: [...fieldwork.requests.filter(r => r.address !== site.address), dispatch.request] }, world: { ...next.world, network: { ...next.world.network, hosts } } }
}
/** Split elapsed work at maintenance boundaries so attempts never run past a rotation against old truth. */
export function advanceFieldwork(state: GameState, elapsedMs: number, advance: (state: GameState, elapsedMs: number) => GameState): GameState {
  if (!state.fieldwork || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return advance(state, elapsedMs)
  let next = state, remaining = elapsedMs
  while (remaining > 0) {
    const until = Math.min(next.fieldwork!.dispatchRemainingMs, ...next.world.network.hosts.flatMap(h => h.securityMaintenance ? [h.securityMaintenance.remainingMs] : []))
    const step = Math.min(remaining, Math.max(1, until))
    next = correlateFieldworkAdvisory(advance(next, step))
    next = { ...next, fieldwork: { ...next.fieldwork!, elapsedMs: next.fieldwork!.elapsedMs + step, dispatchRemainingMs: next.fieldwork!.dispatchRemainingMs - step }, world: { ...next.world, network: { ...next.world.network, hosts: next.world.network.hosts.map(h => {
      const maintenance = h.securityMaintenance
      if (!maintenance) return h
      const hasPayload = h.installedSoftware?.some(s => s.id === SENTRY_RELEASE.productId && s.buildId === SENTRY_RELEASE.buildId) && h.filesystem?.files.some(f => f.kind === 'rattler_payload' || (f.kind === 'executable' && f.programId === 'node-miner'))
      const hasWork = (h.authenticationHistory?.nextId ?? 1) > maintenance.observedAuthCounter || Boolean(h.pendingGateSshActivation) || hasPayload
      return { ...h, securityMaintenance: { ...maintenance, remainingMs: hasWork ? maintenance.remainingMs - step : maintenance.intervalMs } }
    }) } } }
    for (const host of next.world.network.hosts) if (host.securityMaintenance && host.securityMaintenance.remainingMs <= 0) next = maintainDevice(next, host.id)
    if (next.fieldwork!.dispatchRemainingMs <= 0) next = publishDispatch(next)
    remaining -= step
  }
  return next
}
function cleanKnownPayloads(state: GameState, deviceId: string): GameState {
  const isPayload = (file: FilesystemFile) => file.kind === 'rattler_payload' || (file.kind === 'executable' && file.programId === 'node-miner')
  const clean = (files: readonly FilesystemFile[]) => files.filter(f => !isPayload(f))
  const process = { ...state.process, processes: state.process.processes.filter(p => !(p.executorDeviceId === deviceId && (p.kind === 'node_miner' || p.kind === 'rattler_pin_search'))) }
  if (deviceId === state.player.localDevice.id) return { ...state, process, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.filter(s => s.id !== 'node-miner'), filesystem: { ...state.player.localDevice.filesystem, files: clean(state.player.localDevice.filesystem.files) } } } }
  return { ...state, process, world: { ...state.world, network: { ...state.world.network, hosts: state.world.network.hosts.map(h => h.id === deviceId && h.filesystem ? { ...h, installedSoftware: h.installedSoftware?.filter(s => s.id !== 'node-miner'), filesystem: { ...h.filesystem, files: clean(h.filesystem.files) } } : h) } } }
}
export function runSentrySweep(state: GameState): { status: 'cleaned' | 'software_unavailable'; state: GameState } {
  const local = state.player.localDevice
  if (!local.installedSoftware.some(s => s.id === SENTRY_RELEASE.productId && s.buildId === SENTRY_RELEASE.buildId)) return { status: 'software_unavailable', state }
  return { status: 'cleaned', state: cleanKnownPayloads(state, local.id) }
}

/** Correlate a recovered report with remembered endpoint evidence; never read hidden Services. */
export function correlateFieldworkAdvisory(state: GameState): GameState {
  if (!state.fieldwork || !state.player.localDevice.filesystem.files.some(f => f.kind === 'text' && f.content === RACK_UPDATE_ADVISORY)) return state
  const known = state.knowledge.discoveredVulnerabilities
  const learned = state.discovery.devices.flatMap(device => device.services
    .filter(service => service.inspect?.implementation?.name === 'RackUpdate' && service.inspect.implementation.version === '1.0'
      && !known.some(k => k.targetDeviceId === device.id && k.serviceId === service.id && k.vulnerabilityId === 'UPD-001'))
    .map(service => ({ targetDeviceId: device.id, serviceId: service.id, vulnerabilityId: 'UPD-001', observedLabel: 'Foundry advisory: rollback protection not enforced' })))
  return learned.length ? { ...state, knowledge: { ...state.knowledge, discoveredVulnerabilities: [...known, ...learned] } } : state
}
