import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'
import { advanceGameState } from '../core/game/gameAdvancement'
import { createLocalScanTarget, type ScanTargetOperation } from './localScanOperation'
import { createLocalPingTarget, type PingTargetOperation } from './localPingOperation'
import { createFindTargets, createRefreshNetwork, type FindTargetsOperation, type RefreshNetworkOperation } from './targetDiscoveryOperation'
import type { GameStateAccessor } from './gameStateAccess'
import { createServiceAnalysisActions, type NodeScanEndpointAnalysisResult, type NodeScanStartServiceAnalysisResult, type ObservedServiceAnalysisBatchResult } from './serviceAnalysisOperations'
import { createCredentialAccessActions } from './credentialAccessOperations'
import { createRackUpdateActions } from './rackUpdateOperations'
import { createRemoteSessionActions } from './remoteSessionOperations'
import { createFileTransferActions } from './fileTransferOperations'
import { createMarketActions } from './marketOperations'
import { createProcessActions } from './processOperations'
import { createSoftwareActions } from './softwareOperations'
import { createFlipperActions } from './flipperOperations'
import { createNodeMinerActions } from './nodeMinerOperations'
import { createDollarFinanceActions } from './dollarFinanceOperations'
import { createDeviceSecurityActions } from './deviceSecurityOperations'
import { createBusinessActions } from './businessOperations'
import { createFirmwareActions } from './firmwareOperations'
import { createRattlerActions } from './rattlerOperations'
import { createMailActions } from './mailOperations'
import { createRecentActivityActions } from './recentActivityOperations'
import { createDeauthActions } from './deauthOperations'
import type { DeauthObservation, StartDeauthResult } from '../core/game/deauth'
import type { ObservedServiceTarget } from '../core/game/serviceAnalysis'
import type { CredentialAccessObservation, StartCredentialAccessResult } from '../core/game/credentialAccess'
import type { RackUpdateExploitObservation, RackUpdateSubmissionObservation, StartRackUpdateExploitResult, StartRackUpdatePackageSubmissionResult, CancelRackUpdatePackageSubmissionResult } from '../core/game/rackUpdate'
import type { ConnectRemoteResult, DisconnectRemoteResult, RemoteDeviceObservation } from '../core/game/remoteSession'
import type { CancelFileTransferResult, StartMarketPackageDownloadResult, StartRemoteFileDownloadResult, StartRemoteFileUploadResult } from '../core/game/fileTransfer'
import type { PurchaseMarketOfferResult } from '../core/game/market'
import type { CancelLocalProcessResult } from '../core/game/processes'
import type { InstallLocalSoftwarePackageResult, InstallRemoteSoftwarePackageResult } from '../core/game/softwareInstallation'
import type { RemoveInstalledSoftwareResult } from '../core/game/softwareRemoval'
import type { StartFlipperModuleIntegrationResult } from '../core/game/flipper'
import type { PayoutNodeMinerResult, RetargetLocalNodeMinerPayoutResult, RetargetNodeMinerPayoutResult, StartNodeMinerResult, StartRemoteNodeMinerResult, StopNodeMinerResult, StopRemoteNodeMinerResult } from '../core/game/nodeMiner'
import type { AuthenticateDollarAccountResult, AuthenticateWithSavedDollarSignInResult, LogoutDollarAccountResult, TransferDollarsResult, TransferRemoteDollarsResult } from '../core/game/dollarFinance'
import type { ChangeWalletProtectionForOperatedRemoteDeviceResult, VerifyDevicePinForOperatedRemoteDeviceResult } from '../core/game/deviceSecurity'
import type { PlaceOperatedBookstoreRestockOrderResult, RequestOperatedBookstoreMarketReportResult } from '../core/game/companyAdministration'
import type { StartVeyraFirmwareUpdateResult } from '../core/game/veyraFirmwareUpdate'
import type { StartRackOsFirmwareUpdateResult } from '../core/game/rackOsFirmwareUpdate'
import type { CreateRattlerPayloadResult, DeployRattlerResult } from '../core/game/rattler'
import type { ComposeMailInput, ComposeMailResult, SendMailReplyResult } from '../core/game/mail'
import type { InstalledSoftware } from '../core/game/types'
import type { PingResult } from '../core/game/ping'
import type { ScanResult } from '../core/game/scan'

const GameContext = createContext<GameState | null>(null)

export interface GameActions {
  pingTarget: PingTargetOperation
  scanTarget: ScanTargetOperation
  findTargets: FindTargetsOperation
  refreshNetwork: RefreshNetworkOperation
  startServiceAnalysis(targetDeviceId: string, serviceId: string): NodeScanStartServiceAnalysisResult
  startServiceAnalysisAtEndpoint(endpoint: string): NodeScanEndpointAnalysisResult
  startServiceAnalysisFromObservation(observed: ObservedServiceTarget): NodeScanEndpointAnalysisResult
  startObservedServiceAnalyses(observed: readonly ObservedServiceTarget[]): ObservedServiceAnalysisBatchResult
  startCredentialAccessAttemptFromObservation(observed: CredentialAccessObservation): StartCredentialAccessResult
  startDeauthAttempt(observed: DeauthObservation): StartDeauthResult
  startRackUpdateExploitAttemptFromObservation(observed: RackUpdateExploitObservation): StartRackUpdateExploitResult
  startRackUpdatePackageSubmission(observed: RackUpdateSubmissionObservation): StartRackUpdatePackageSubmissionResult
  cancelRackUpdatePackageSubmission(submissionId: string): CancelRackUpdatePackageSubmissionResult
  connectRemoteFromObservation(observed: RemoteDeviceObservation): ConnectRemoteResult
  disconnectRemoteSession(): DisconnectRemoteResult
  startRemoteFileDownload(sourcePath: string): StartRemoteFileDownloadResult
  startRemoteFileUpload(sourcePath: string, destinationPath: string): StartRemoteFileUploadResult
  cancelFileTransfer(transferId: string): CancelFileTransferResult
  purchaseMarketOffer(offerId: string): PurchaseMarketOfferResult
  startMarketPackageDownload(offerId: string): StartMarketPackageDownloadResult
  cancelLocalProcess(processId: string): CancelLocalProcessResult
  installLocalSoftwarePackage(path: string): InstallLocalSoftwarePackageResult
  installRemoteSoftwarePackage(path: string): InstallRemoteSoftwarePackageResult
  removeInstalledSoftware(productId: InstalledSoftware['id']): RemoveInstalledSoftwareResult
  startFlipperModuleIntegration(moduleFileId: string): StartFlipperModuleIntegrationResult
  runNodeMiner(sourceFilePath: string, payoutAddress: string): StartNodeMinerResult
  stopNodeMiner(processId: string): StopNodeMinerResult
  runRemoteNodeMiner(sourceFilePath: string, payoutAddress: string): StartRemoteNodeMinerResult
  stopRemoteNodeMiner(processId: string): StopRemoteNodeMinerResult
  retargetLocalNodeMinerPayout(payoutAddress: string): RetargetLocalNodeMinerPayoutResult
  retargetNodeMinerPayout(payoutAddress: string): RetargetNodeMinerPayoutResult
  payoutLocalNodeMiner(): PayoutNodeMinerResult
  payoutNodeMiner(): PayoutNodeMinerResult
  authenticateDollarAccount(loginIdentifier: string, password: string): AuthenticateDollarAccountResult
  authenticateDollarAccountWithSavedSignIn(): AuthenticateWithSavedDollarSignInResult
  logoutDollarAccount(): LogoutDollarAccountResult
  transferDollars(recipientAccountReference: string, amountCents: number): TransferDollarsResult
  /** The same canonical transfer, acted by the Device the player is currently operating remotely. */
  transferRemoteDollars(recipientAccountReference: string, amountCents: number): TransferRemoteDollarsResult
  /** Changes the operated remote Device's own Wallet-protection setting; verified solely against that Device's own PIN. */
  changeWalletProtectionForOperatedRemoteDevice(pin: string, enabled: boolean): ChangeWalletProtectionForOperatedRemoteDeviceResult
  /** Starts the operated remote Device's own firmware update; verified solely against that Device's own PIN. */
  startVeyraFirmwareUpdateForOperatedRemoteDevice(pin: string): StartVeyraFirmwareUpdateResult
  /** Starts the operated remote Device's own RACK-OS firmware installation from an installer artifact that Device already holds. */
  startRackOsFirmwareUpdateForOperatedRemoteDevice(artifactPath: string): StartRackOsFirmwareUpdateResult
  /** Checks a submitted PIN against the operated remote Device's own PIN without committing anything. */
  verifyDevicePinForOperatedRemoteDevice(pin: string): VerifyDevicePinForOperatedRemoteDeviceResult
  /** Submits the existing authorized Bookstore restock for the operated Device; Company authority and settlement stay inside the domain. */
  placeBookstoreRestockOrderFromOperatedRemoteDevice(branchId: string, decisions: import('../core/game/bookstoreRestock').BookstoreOrderDecisions, reviewedProposal: import('../core/game/bookstoreRestock').BookstoreOrderProposal): PlaceOperatedBookstoreRestockOrderResult
  purchaseBookstoreCoffeeMachineFromOperatedRemoteDevice(branchId: string): import('../core/game/companyAdministration').PurchaseAuthorizedBookstoreCoffeeMachineResult
  requestBookstoreMarketReportFromOperatedRemoteDevice(branchId: string): RequestOperatedBookstoreMarketReportResult
  createRattlerPayload(targetAddress: string): CreateRattlerPayloadResult
  deployRattler?(): DeployRattlerResult
  openMailThread(threadId: string): void
  sendMailReply(threadId: string, text: string, attachmentFileIds?: readonly string[]): SendMailReplyResult
  composeMail(input: ComposeMailInput): ComposeMailResult
  deleteMailThreads(threadIds: readonly string[]): void
  clearRecentActivity(): void
  removeRecentActivity(activityId: string): void
}
const GameActionsContext = createContext<GameActions | null>(null)

export interface AuthoritativeReconTransport { observe(kind: 'ping' | 'scan', input: string): Promise<{ result: PingResult | ScanResult; state: GameState }> }
export function GameProvider({ children, initialState, serverOwnsAdvancement = false, reconTransport }: { children: ReactNode; initialState?: GameState; serverOwnsAdvancement?: boolean; reconTransport?: AuthoritativeReconTransport }) {
  const [gameState, setGameState] = useState(() => initialState ?? createInitialGameState())
  const currentState = useRef(gameState)
  const lastTick = useRef(performance.now())
  const [accessor] = useState<GameStateAccessor>(() => ({
    read: () => currentState.current,
    write: (next) => { if (reconTransport) throw new Error('This gameplay mutation is not yet available online.'); currentState.current = next; setGameState(next) },
  }))
  const [scanTarget] = useState<ScanTargetOperation>(() => reconTransport ? async (input: string) => { const response = await reconTransport.observe("scan", input); currentState.current = response.state; setGameState(response.state); return response.result as ScanResult } : createLocalScanTarget(accessor.read, accessor.write))
  const [pingTarget] = useState<PingTargetOperation>(() => reconTransport ? async (input: string) => { const response = await reconTransport.observe("ping", input); currentState.current = response.state; setGameState(response.state); return response.result as PingResult } : createLocalPingTarget(accessor.read, accessor.write))
  const [findTargets] = useState<FindTargetsOperation>(() => reconTransport ? async () => {
    const state = accessor.read(); const result = await scanTarget(state.player.localDevice.network.ip)
    if (result.status === 'software_unavailable') return { status: 'software_unavailable' }; if (result.status === 'no_response' || result.status === 'unknown_target') return { status: 'no_response' }
    const latest = accessor.read(); return { status: 'observed', networksKnown: latest.discovery.networks.length, targetsKnown: latest.discovery.devices.length }
  } : createFindTargets(accessor.read, accessor.write))
  const [refreshNetwork] = useState<RefreshNetworkOperation>(() => reconTransport ? async (networkId: string): ReturnType<RefreshNetworkOperation> => {
    const state = accessor.read(); const remembered = state.discovery.networks.find(({ id }) => id === networkId); const managed = state.world.network.localNetworks.find(({ id }) => id === networkId)
    const input = remembered?.name ?? remembered?.cidr ?? managed?.name ?? managed?.cidr; if (!input) return { status: 'unknown_network' }
    const result = await scanTarget(input); if (result.status === 'software_unavailable') return result; return result.status === 'network' ? { status: 'refreshed' as const } : { status: 'no_response' as const }
  } : createRefreshNetwork(accessor.read, accessor.write))
  useEffect(() => {
    if (serverOwnsAdvancement) return
    const timer = window.setInterval(() => {
      const now = performance.now(); const elapsed = now - lastTick.current; lastTick.current = now
      const state = currentState.current
      const nextState = advanceGameState(state, elapsed)
      if (nextState === state) return
      currentState.current = nextState
      setGameState(nextState)
    }, 250)
    return () => window.clearInterval(timer)
  }, [serverOwnsAdvancement])
  // Explicit composition: each domain owns its own application adapter; GameProvider only wires them to the shared canonical-state accessor.
  const actions: GameActions = {
    pingTarget, scanTarget, findTargets, refreshNetwork,
    ...createServiceAnalysisActions(accessor),
    ...createCredentialAccessActions(accessor),
    ...createDeauthActions(accessor),
    ...createRackUpdateActions(accessor),
    ...createRemoteSessionActions(accessor),
    ...createFileTransferActions(accessor),
    ...createMarketActions(accessor),
    ...createProcessActions(accessor),
    ...createSoftwareActions(accessor),
    ...createFlipperActions(accessor),
    ...createNodeMinerActions(accessor),
    ...createDollarFinanceActions(accessor),
    ...createDeviceSecurityActions(accessor),
    ...createBusinessActions(accessor),
    ...createFirmwareActions(accessor),
    ...createRattlerActions(accessor),
    ...createMailActions(accessor),
    ...createRecentActivityActions(accessor),
  }
  return <GameActionsContext.Provider value={actions}><GameContext.Provider value={gameState}>{children}</GameContext.Provider></GameActionsContext.Provider>
}

export function useGameActions() { const actions = useContext(GameActionsContext); if (!actions) throw new Error('useGameActions must be used inside GameProvider'); return actions }

export function useGameState() {
  const state = useContext(GameContext)
  if (!state) throw new Error('useGameState must be used inside GameProvider')
  return state
}
