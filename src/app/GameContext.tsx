import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'
import { startServiceAnalysis, startServiceAnalysisAtEndpoint, startServiceAnalysisFromObservation, type EndpointAnalysisResult, type ObservedServiceTarget, type StartServiceAnalysisResult } from '../core/game/serviceAnalysis'
import { clearRecentActivity, removeRecentActivity } from '../core/game/recentActivity'
import { advanceGameState } from '../core/game/gameAdvancement'
import { createLocalScanTarget, type ScanTargetOperation } from './localScanOperation'
import { createLocalInspectTarget, type InspectTargetOperation } from './localInspectOperation'
import { startCredentialAccessAttemptFromObservation, type CredentialAccessObservation, type StartCredentialAccessResult } from '../core/game/credentialAccess'
import { connectRemoteFromObservation, disconnectRemoteSession, type ConnectRemoteResult, type DisconnectRemoteResult, type RemoteDeviceObservation } from '../core/game/remoteSession'
import { findInstalledNodeScan } from '../core/game/software'
import { cancelFileTransfer, startRemoteFileDownload, startRemoteFileUpload, type CancelFileTransferResult, type StartRemoteFileDownloadResult, type StartRemoteFileUploadResult } from '../core/game/fileTransfer'
import { installLocalSoftwarePackage, type InstallLocalSoftwarePackageResult } from '../core/game/softwareInstallation'
import { removeInstalledSoftware, type RemoveInstalledSoftwareResult } from '../core/game/softwareRemoval'
import { startNodeMiner, stopNodeMiner, type StartNodeMinerResult, type StopNodeMinerResult } from '../core/game/nodeMiner'
import type { InstalledSoftware } from '../core/game/types'
import { cancelLocalProcess, type CancelLocalProcessResult } from '../core/game/processes'

const GameContext = createContext<GameState | null>(null)
export type NodeScanStartServiceAnalysisResult = StartServiceAnalysisResult | { status: 'software_unavailable'; state: GameState }
export type NodeScanEndpointAnalysisResult = EndpointAnalysisResult | { status: 'software_unavailable'; state: GameState }
export interface GameActions {
  scanTarget: ScanTargetOperation
  inspectTarget: InspectTargetOperation
  startServiceAnalysis(targetDeviceId: string, serviceId: string): NodeScanStartServiceAnalysisResult
  startServiceAnalysisAtEndpoint(endpoint: string): NodeScanEndpointAnalysisResult
  startServiceAnalysisFromObservation(observed: ObservedServiceTarget): NodeScanEndpointAnalysisResult
  startCredentialAccessAttemptFromObservation(observed: CredentialAccessObservation): StartCredentialAccessResult
  connectRemoteFromObservation(observed: RemoteDeviceObservation): ConnectRemoteResult
  disconnectRemoteSession(): DisconnectRemoteResult
  startRemoteFileDownload(sourcePath: string): StartRemoteFileDownloadResult
  startRemoteFileUpload(sourcePath: string, destinationPath: string): StartRemoteFileUploadResult
  cancelFileTransfer(transferId: string): CancelFileTransferResult
  cancelLocalProcess(processId: string): CancelLocalProcessResult
  installLocalSoftwarePackage(path: string): InstallLocalSoftwarePackageResult
  removeInstalledSoftware(productId: InstalledSoftware['id']): RemoveInstalledSoftwareResult
  runNodeMiner(sourceFilePath: string, payoutAddress: string): StartNodeMinerResult
  stopNodeMiner(processId: string): StopNodeMinerResult
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
  const [inspectTarget] = useState(() => createLocalInspectTarget(() => currentState.current, (nextState) => {
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
  const actions: GameActions = { scanTarget, inspectTarget, startServiceAnalysis(targetDeviceId, serviceId) {
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
  }, startCredentialAccessAttemptFromObservation(observed) {
    const result = startCredentialAccessAttemptFromObservation(currentState.current, observed)
    if (result.status === 'started') {
      currentState.current = result.state
      setGameState(result.state)
    }
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
