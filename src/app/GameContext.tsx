import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'
import { startServiceAnalysis, startServiceAnalysisAtEndpoint, startServiceAnalysisFromObservation, type EndpointAnalysisResult, type ObservedServiceTarget, type StartServiceAnalysisResult } from '../core/game/serviceAnalysis'
import { clearRecentActivity, removeRecentActivity } from '../core/game/recentActivity'
import { advanceGameState } from '../core/game/gameAdvancement'
import { createLocalScanTarget, type ScanTargetOperation } from './localScanOperation'
import { createLocalPingTarget, type PingTargetOperation } from './localPingOperation'
import { createLocalInspectTarget, type InspectTargetOperation } from './localInspectOperation'
import { createFindTargets, type FindTargetsOperation } from './targetDiscoveryOperation'
import { startCredentialAccessAttemptFromObservation, type CredentialAccessObservation, type StartCredentialAccessResult } from '../core/game/credentialAccess'
import { connectRemoteFromObservation, disconnectRemoteSession, type ConnectRemoteResult, type DisconnectRemoteResult, type RemoteDeviceObservation } from '../core/game/remoteSession'
import { findInstalledNodeScan } from '../core/game/software'
import { startFlipperModuleIntegration, type StartFlipperModuleIntegrationResult } from '../core/game/flipper'
import { cancelFileTransfer, startMarketPackageDownload, startRemoteFileDownload, startRemoteFileUpload, type CancelFileTransferResult, type StartMarketPackageDownloadResult, type StartRemoteFileDownloadResult, type StartRemoteFileUploadResult } from '../core/game/fileTransfer'
import { purchaseMarketOffer, type PurchaseMarketOfferResult } from '../core/game/market'
import { installLocalSoftwarePackage, installRemoteSoftwarePackage, type InstallLocalSoftwarePackageResult, type InstallRemoteSoftwarePackageResult } from '../core/game/softwareInstallation'
import { removeInstalledSoftware, type RemoveInstalledSoftwareResult } from '../core/game/softwareRemoval'
import { payoutLocalNodeMiner, payoutNodeMiner, retargetLocalNodeMinerPayout, retargetNodeMinerPayout, startNodeMiner, startRemoteNodeMiner, stopNodeMiner, stopRemoteNodeMiner, type PayoutNodeMinerResult, type RetargetLocalNodeMinerPayoutResult, type RetargetNodeMinerPayoutResult, type StartNodeMinerResult, type StartRemoteNodeMinerResult, type StopNodeMinerResult, type StopRemoteNodeMinerResult } from '../core/game/nodeMiner'
import type { InstalledSoftware } from '../core/game/types'
import { cancelLocalProcess, type CancelLocalProcessResult } from '../core/game/processes'
import { openMailThread, sendMailReply, type SendMailReplyResult } from '../core/game/mail'
import { cancelRackUpdatePackageSubmission, startRackUpdateExploitAttemptFromObservation, startRackUpdatePackageSubmission, type CancelRackUpdatePackageSubmissionResult, type RackUpdateExploitObservation, type RackUpdateSubmissionObservation, type StartRackUpdateExploitResult, type StartRackUpdatePackageSubmissionResult } from '../core/game/rackUpdate'
import { authenticateDollarAccount, authenticateDollarAccountWithSavedSignIn, logoutDollarAccount, transferDollars, transferDollarsFromOperatedRemoteDevice, type AuthenticateDollarAccountResult, type AuthenticateWithSavedDollarSignInResult, type LogoutDollarAccountResult, type TransferDollarsResult, type TransferRemoteDollarsResult } from '../core/game/dollarFinance'
import { changeWalletProtectionForOperatedRemoteDevice, verifyDevicePinForOperatedRemoteDevice, type ChangeWalletProtectionForOperatedRemoteDeviceResult, type VerifyDevicePinForOperatedRemoteDeviceResult } from '../core/game/deviceSecurity'
import { createRattlerPayload, type CreateRattlerPayloadResult } from '../core/game/rattler'

const GameContext = createContext<GameState | null>(null)
export type NodeScanStartServiceAnalysisResult = StartServiceAnalysisResult | { status: 'software_unavailable'; state: GameState }
export type NodeScanEndpointAnalysisResult = EndpointAnalysisResult | { status: 'software_unavailable'; state: GameState }
export interface ObservedServiceAnalysisBatchResult {
  readonly started: number
  readonly insufficientMemory?: { readonly requiredMiB: number; readonly availableMiB: number }
}
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
  createRattlerPayload?: (address: string) => CreateRattlerPayloadResult
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
  const [scanTarget] = useState(() => createLocalScanTarget(() => currentState.current, (nextState) => {
    currentState.current = nextState
    setGameState(nextState)
  }))
  const [pingTarget] = useState(() => createLocalPingTarget(() => currentState.current, (nextState) => {
    currentState.current = nextState
    setGameState(nextState)
  }))
  const [inspectTarget] = useState(() => createLocalInspectTarget(() => currentState.current, (nextState) => {
    currentState.current = nextState
    setGameState(nextState)
  }))
  const [findTargets] = useState(() => createFindTargets(() => currentState.current, (nextState) => {
    currentState.current = nextState
    setGameState(nextState)
  }))
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
  const actions: GameActions = { pingTarget, scanTarget, inspectTarget, findTargets, startServiceAnalysis(targetDeviceId, serviceId) {
    const state = currentState.current
    if (!findInstalledNodeScan(state.player.localDevice)) return { status: 'software_unavailable', state }
    const result = startServiceAnalysis(state, targetDeviceId, serviceId)
    if (result.status === 'started') {
      const nextState = result.state
      currentState.current = nextState
      setGameState(nextState)
    }
    return result
  }, startServiceAnalysisAtEndpoint(endpoint) {
    const state = currentState.current
    if (!findInstalledNodeScan(state.player.localDevice)) return { status: 'software_unavailable', state }
    const result = startServiceAnalysisAtEndpoint(state, endpoint)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, startServiceAnalysisFromObservation(observed) {
    const state = currentState.current
    if (!findInstalledNodeScan(state.player.localDevice)) return { status: 'software_unavailable', state }
    const result = startServiceAnalysisFromObservation(state, observed)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, startObservedServiceAnalyses(observed) {
    let started = 0
    let insufficientMemory: ObservedServiceAnalysisBatchResult['insufficientMemory']
    for (const service of observed) {
      const result = startServiceAnalysisFromObservation(currentState.current, service)
      if (result.status === 'started') {
        started++
        currentState.current = result.state
      } else if (result.status === 'insufficient_memory') {
        insufficientMemory = { requiredMiB: result.requiredMiB, availableMiB: result.availableMiB }
      }
    }
    if (started) setGameState(currentState.current)
    return { started, ...(insufficientMemory ? { insufficientMemory } : {}) }
  }, startCredentialAccessAttemptFromObservation(observed) {
    const result = startCredentialAccessAttemptFromObservation(currentState.current, observed)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, startRackUpdateExploitAttemptFromObservation(observed) {
    const result = startRackUpdateExploitAttemptFromObservation(currentState.current, observed)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, startRackUpdatePackageSubmission(observed) {
    const result = startRackUpdatePackageSubmission(currentState.current, observed)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, cancelRackUpdatePackageSubmission(submissionId) {
    const result = cancelRackUpdatePackageSubmission(currentState.current, submissionId)
    if (result.status === 'cancelled') { currentState.current = result.state; setGameState(result.state) }
    return result
  }, connectRemoteFromObservation(observed) {
    const result = connectRemoteFromObservation(currentState.current, observed)
    if (result.state !== currentState.current) { currentState.current = result.state; setGameState(result.state) }
    return result
  }, disconnectRemoteSession() {
    const result = disconnectRemoteSession(currentState.current)
    if (result.state !== currentState.current) { currentState.current = result.state; setGameState(result.state) }
    return result
  }, startRemoteFileDownload(sourcePath) {
    const result = startRemoteFileDownload(currentState.current, sourcePath)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, startRemoteFileUpload(sourcePath, destinationPath) {
    const result = startRemoteFileUpload(currentState.current, sourcePath, destinationPath)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, cancelFileTransfer(transferId) {
    const result = cancelFileTransfer(currentState.current, transferId)
    if (result.state !== currentState.current) { currentState.current = result.state; setGameState(result.state) }
    return result
  }, purchaseMarketOffer(offerId) {
    const result = purchaseMarketOffer(currentState.current, offerId)
    if (result.status === 'purchased') { currentState.current = result.state; setGameState(result.state) }
    return result
  }, startMarketPackageDownload(offerId) {
    const result = startMarketPackageDownload(currentState.current, offerId)
    if (result.status === 'started') { currentState.current = result.state; setGameState(result.state) }
    return result
  }, cancelLocalProcess(processId) {
    const result = cancelLocalProcess(currentState.current, processId)
    if (result.status === 'cancelled') { currentState.current = result.state; setGameState(result.state) }
    return result
  }, installLocalSoftwarePackage(path) {
    const result = installLocalSoftwarePackage(currentState.current, path)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, installRemoteSoftwarePackage(path) {
    const result = installRemoteSoftwarePackage(currentState.current, path)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, startFlipperModuleIntegration(moduleFileId) {
    const result = startFlipperModuleIntegration(currentState.current, moduleFileId)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, removeInstalledSoftware(productId) {
    const result = removeInstalledSoftware(currentState.current, productId)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, runNodeMiner(sourceFilePath, payoutAddress) {
    const result = startNodeMiner(currentState.current, sourceFilePath, payoutAddress)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, stopNodeMiner(processId) {
    const result = stopNodeMiner(currentState.current, processId)
    if (result.status === 'stopped') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, runRemoteNodeMiner(sourceFilePath, payoutAddress) {
    const result = startRemoteNodeMiner(currentState.current, sourceFilePath, payoutAddress)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, stopRemoteNodeMiner(processId) {
    const result = stopRemoteNodeMiner(currentState.current, processId)
    if (result.status === 'stopped') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, retargetLocalNodeMinerPayout(payoutAddress) {
    const result = retargetLocalNodeMinerPayout(currentState.current, payoutAddress)
    if (result.state !== currentState.current) { currentState.current = result.state; setGameState(result.state) }
    return result
  }, retargetNodeMinerPayout(payoutAddress) {
    const result = retargetNodeMinerPayout(currentState.current, payoutAddress)
    if (result.state !== currentState.current) { currentState.current = result.state; setGameState(result.state) }
    return result
  }, payoutLocalNodeMiner() {
    const result = payoutLocalNodeMiner(currentState.current)
    if (result.state !== currentState.current) { currentState.current = result.state; setGameState(result.state) }
    return result
  }, payoutNodeMiner() {
    const result = payoutNodeMiner(currentState.current)
    if (result.state !== currentState.current) { currentState.current = result.state; setGameState(result.state) }
    return result
  }, authenticateDollarAccount(loginIdentifier, password) {
    const state = currentState.current
    const result = authenticateDollarAccount(state, state.player.localDevice.id, loginIdentifier, password)
    if (result.status === 'authenticated') { currentState.current = result.state; setGameState(result.state) }
    return result
  }, authenticateDollarAccountWithSavedSignIn() {
    const state = currentState.current
    const result = authenticateDollarAccountWithSavedSignIn(state, state.player.localDevice.id)
    if (result.status === 'authenticated') { currentState.current = result.state; setGameState(result.state) }
    return result
  }, logoutDollarAccount() {
    const state = currentState.current
    const result = logoutDollarAccount(state, state.player.localDevice.id)
    if (result.status === 'logged_out') { currentState.current = result.state; setGameState(result.state) }
    return result
  }, transferDollars(recipientAccountReference, amountCents) {
    const state = currentState.current
    const result = transferDollars(state, state.player.localDevice.id, recipientAccountReference, amountCents)
    if (result.status === 'transferred') { currentState.current = result.state; setGameState(result.state) }
    return result
  }, transferRemoteDollars(recipientAccountReference, amountCents) {
    // Deliberately no Device argument: the acting Device is resolved from the active Remote Session inside the domain operation.
    const result = transferDollarsFromOperatedRemoteDevice(currentState.current, recipientAccountReference, amountCents)
    if (result.status === 'transferred') { currentState.current = result.state; setGameState(result.state) }
    return result
  }, changeWalletProtectionForOperatedRemoteDevice(pin, enabled) {
    // Deliberately no Device argument: the acting Device is resolved from the active Remote Session inside the domain operation, exactly as the remote Dollar transfer already does.
    const result = changeWalletProtectionForOperatedRemoteDevice(currentState.current, pin, enabled)
    if (result.status === 'changed') { currentState.current = result.state; setGameState(result.state) }
    return result
  }, verifyDevicePinForOperatedRemoteDevice(pin) {
    // A query only: it commits nothing, so there is no canonical state to advance.
    return verifyDevicePinForOperatedRemoteDevice(currentState.current, pin)
  }, openMailThread(threadId) {
    const state = currentState.current
    const nextState = openMailThread(state, threadId)
    if (nextState === state) return
    currentState.current = nextState
    setGameState(nextState)
  }, createRattlerPayload(address) {
    const result = createRattlerPayload(currentState.current, address)
    if (result.status === 'created') { currentState.current = result.state; setGameState(result.state) }
    return result
  }, sendMailReply(threadId, text) {
    const result = sendMailReply(currentState.current, threadId, text)
    if (result.status === 'sent') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, clearRecentActivity() {
    const state = currentState.current
    const nextState = clearRecentActivity(state, state.player.localDevice.id)
    if (nextState === state) return
    currentState.current = nextState
    setGameState(nextState)
  }, removeRecentActivity(activityId) {
    const state = currentState.current
    const nextState = removeRecentActivity(state, activityId, state.player.localDevice.id)
    if (nextState === state) return
    currentState.current = nextState
    setGameState(nextState)
  } }
  return <GameActionsContext.Provider value={actions}><GameContext.Provider value={gameState}>{children}</GameContext.Provider></GameActionsContext.Provider>
}

export function useGameActions() { const actions = useContext(GameActionsContext); if (!actions) throw new Error('useGameActions must be used inside GameProvider'); return actions }

export function useGameState() {
  const state = useContext(GameContext)
  if (!state) throw new Error('useGameState must be used inside GameProvider')
  return state
}
