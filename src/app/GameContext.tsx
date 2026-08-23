import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'
import { startServiceAnalysis, startServiceAnalysisAtEndpoint, startServiceAnalysisFromObservation, type EndpointAnalysisResult, type ObservedServiceTarget, type StartServiceAnalysisResult } from '../core/game/serviceAnalysis'
import { clearCompletedProcesses as clearCompletedProcessState, removeCompletedProcess as removeCompletedProcessState } from '../core/game/processes'
import { advanceGameState } from '../core/game/gameAdvancement'
import { createLocalScanTarget, type ScanTargetOperation } from './localScanOperation'
import { startCredentialAccessAttemptFromObservation, type CredentialAccessObservation, type StartCredentialAccessResult } from '../core/game/credentialAccess'
import { connectRemoteFromObservation, disconnectRemoteSession, type ConnectRemoteResult, type DisconnectRemoteResult, type RemoteDeviceObservation } from '../core/game/remoteSession'
import { findInstalledNodeScan } from '../core/game/software'
import { cancelFileTransfer, startRemoteFileDownload, type CancelFileTransferResult, type StartRemoteFileDownloadResult } from '../core/game/fileTransfer'
import { installLocalSoftwarePackage, type InstallLocalSoftwarePackageResult } from '../core/game/softwareInstallation'

const GameContext = createContext<GameState | null>(null)
export type NodeScanStartServiceAnalysisResult = StartServiceAnalysisResult | { status: 'software_unavailable'; state: GameState }
export type NodeScanEndpointAnalysisResult = EndpointAnalysisResult | { status: 'software_unavailable'; state: GameState }
export interface GameActions {
  scanTarget: ScanTargetOperation
  startServiceAnalysis(targetDeviceId: string, serviceId: string): NodeScanStartServiceAnalysisResult
  startServiceAnalysisAtEndpoint(endpoint: string): NodeScanEndpointAnalysisResult
  startServiceAnalysisFromObservation(observed: ObservedServiceTarget): NodeScanEndpointAnalysisResult
  startCredentialAccessAttemptFromObservation(observed: CredentialAccessObservation): StartCredentialAccessResult
  connectRemoteFromObservation(observed: RemoteDeviceObservation): ConnectRemoteResult
  disconnectRemoteSession(): DisconnectRemoteResult
  startRemoteFileDownload(sourcePath: string): StartRemoteFileDownloadResult
  cancelFileTransfer(transferId: string): CancelFileTransferResult
  installLocalSoftwarePackage(path: string): InstallLocalSoftwarePackageResult
  clearCompletedProcesses(): void
  removeCompletedProcess(processId: string): void
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
  const actions: GameActions = { scanTarget, startServiceAnalysis(targetDeviceId, serviceId) {
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
  }, cancelFileTransfer(transferId) {
    const result = cancelFileTransfer(currentState.current, transferId)
    if (result.state !== currentState.current) { currentState.current = result.state; setGameState(result.state) }
    return result
  }, installLocalSoftwarePackage(path) {
    const result = installLocalSoftwarePackage(currentState.current, path)
    if (result.status === 'installed') {
      currentState.current = result.state
      setGameState(result.state)
    }
    return result
  }, clearCompletedProcesses() {
    const state = currentState.current
    const process = clearCompletedProcessState(state.process)
    if (process === state.process) return
    const nextState = { ...state, process }
    currentState.current = nextState
    setGameState(nextState)
  }, removeCompletedProcess(processId) {
    const state = currentState.current
    const process = removeCompletedProcessState(state.process, processId)
    if (process === state.process) return
    const nextState = { ...state, process }
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
