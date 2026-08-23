import type { NetworkService, Vulnerability } from './types'

export const GATE_SSH_PRODUCT_ID = 'gate-ssh'
export const GATE_SSH_1_3_2_RELEASE_ID = 'gate-ssh-1.3.2'
export const GATE_SSH_1_4_0_RELEASE_ID = 'gate-ssh-1.4.0'
export const AUTH_017: Vulnerability = { id: 'AUTH-017', label: 'Weak authentication configuration' }

/** The deliberately small causal mapping for the concrete GateSSH releases represented by V1. */
export function vulnerabilitiesForService(service: NetworkService): readonly Vulnerability[] {
  return service.implementation.productId === GATE_SSH_PRODUCT_ID
    && service.implementation.releaseId === GATE_SSH_1_3_2_RELEASE_ID
    ? [AUTH_017]
    : []
}
