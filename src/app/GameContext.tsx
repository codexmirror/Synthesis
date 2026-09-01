import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'
import { advanceGameState } from '../core/game/gameAdvancement'
import { createLocalScanTarget, type ScanTargetOperation } from './localScanOperation'
import { createLocalPingTarget, type PingTargetOperation } from './localPingOperation'
import { createLocalInspectTarget, type InspectTargetOperation } from './localInspectOperation'
import { createFindTargets, type FindTargetsOperation } from './targetDiscoveryOperation'
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
import { createRattlerActions } from './rattlerOperations'
import { createMailActions } from './mailOperations'
import { createRecentActivityActions } from './recentActivityOperations'
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
import type { CreateRattlerPayloadResult, DeployRattlerResult } from '../core/game/rattler'
import type { SendMailReplyResult } from '../core/game/mail'
import type { InstalledSoftware } from '../core/game/types'

const GameContext = createContext<GameState | null>(null)

export interface GameActions {
  pingTarget: PingTargetOperation
  scanTarget: ScanTargetOperation
  inspectTarget: InspectTargetOperation
  findTargets: FindTargetsOperation
  startServiceAnalysis(targetDeviceId: string, serviceId: string): NodeScanStartServiceAnalysisResult
  startServiceAnalysisAtEndpoint(endpoint: string): NodeScanEndpointAnalysisResult
  startServiceAnalysisFromObservation(observed: ObservedServiceTarget): NodeScanEndpointAnalysisResult
  startObservedServiceAnalyses(observed: readonly ObservedServiceTarget[]): ObservedServiceAnalysisBatchResult
  startCredentialAccessAttemptFromObservation(observed: CredentialAccessObservation): StartCredentialAccessResult
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
  /** Checks a submitted PIN against the operated remote Device's own PIN without committing anything. */
  verifyDevicePinForOperatedRemoteDevice(pin: string): VerifyDevicePinForOperatedRemoteDeviceResult
  createRattlerPayload(targetAddress: string): CreateRattlerPayloadResult
  deployRattler?(): DeployRattlerResult
  openMailThread(threadId: string): void
  sendMailReply(threadId: string, text: string): SendMailReplyResult
  clearRecentActivity(): void
  removeRecentActivity(activityId: string): void
}
const GameActionsContext = createContext<GameActions | null>(null)

export function GameProvider({ children, initialState }: { children: ReactNode; initialState?: GameState }) {
  const [gameState, setGameState] = useState(() => initialState ?? createInitialGameState())
  const currentState = useRef(gameState)
  const lastTick = useRef(performance.now())
  const [accessor] = useState<GameStateAccessor>(() => ({
    read: () => currentState.current,
    write: (next) => { currentState.current = next; setGameState(next) },
  }))
  const [scanTarget] = useState(() => createLocalScanTarget(accessor.read, accessor.write))
  const [pingTarget] = useState(() => createLocalPingTarget(accessor.read, accessor.write))
  const [inspectTarget] = useState(() => createLocalInspectTarget(accessor.read, accessor.write))
  const [findTargets] = useState(() => createFindTargets(accessor.read, accessor.write))
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = performance.now(); const elapsed = now - lastTick.current; lastTick.current = now
      const state = currentState.current
      const nextState = advanceGameState(state, elapsed)
      if (nextState === state) return
      currentState.current = nextState
      setGameState(nextState)
    }, 250)
    return () => window.clearInterval(timer)
  }, [])
  // Explicit composition: each domain owns its own application adapter; GameProvider only wires them to the shared canonical-state accessor.
  const actions: GameActions = {
    pingTarget, scanTarget, inspectTarget, findTargets,
    ...createServiceAnalysisActions(accessor),
    ...createCredentialAccessActions(accessor),
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
