import type { NetworkService, Vulnerability } from './types'

export const GATE_SSH_PRODUCT_ID = 'gate-ssh'
export const GATE_SSH_1_3_2_RELEASE_ID = 'gate-ssh-1.3.2'
export const GATE_SSH_1_3_3_RELEASE_ID = 'gate-ssh-1.3.3'
export const GATE_SSH_1_4_0_RELEASE_ID = 'gate-ssh-1.4.0'
export const GATE_SSH_1_3_2_BUILD_ID = 'build-gate-ssh-1.3.2-v0'
export const GATE_SSH_1_3_3_BUILD_ID = 'build-gate-ssh-1.3.3-v0'
export const GATE_SSH_1_4_0_BUILD_ID = 'build-gate-ssh-1.4.0-v0'
export const RACK_UPDATE_1_0_BUILD_ID = 'build-rack-update-1.0-v0'
export const BASIC_HTTP_1_0_BUILD_ID = 'build-basic-http-1.0-v0'
export const RACK_UPDATE_PRODUCT_ID = 'rack-update'
export const RACK_UPDATE_1_0_RELEASE_ID = 'rack-update-1.0'
export const AUTH_017: Vulnerability = { id: 'AUTH-017', label: 'Weak authentication configuration' }
export const AUTH_031: Vulnerability = { id: 'AUTH-031', label: 'Pre-authentication challenge state reuse' }
export const UPD_001: Vulnerability = { id: 'UPD-001', label: 'Rollback protection not enforced' }

/** The deliberately small causal mapping for the concrete GateSSH releases represented by V1. */
export function vulnerabilitiesForService(service: NetworkService): readonly Vulnerability[] {
  return service.implementation.productId === GATE_SSH_PRODUCT_ID
    && service.implementation.releaseId === GATE_SSH_1_3_2_RELEASE_ID
    ? [AUTH_017]
    : service.implementation.productId === GATE_SSH_PRODUCT_ID
      && service.implementation.releaseId === GATE_SSH_1_3_3_RELEASE_ID
      ? [AUTH_031]
    : service.implementation.productId === RACK_UPDATE_PRODUCT_ID
      && service.implementation.releaseId === RACK_UPDATE_1_0_RELEASE_ID
      ? [UPD_001]
      : []
}
