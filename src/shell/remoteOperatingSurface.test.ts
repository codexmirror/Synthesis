import { describe, expect, it } from 'vitest'
import { RACK_OS_FIRMWARE_ID, VEYRA_OS_4_1_FIRMWARE_ID, VEYRA_OS_4_2_FIRMWARE_ID } from '../core/game/firmwareIdentity'
import { createInitialGameState } from '../core/game/initialState'
import { selectRemoteOperatingSurface } from './remoteOperatingSurface'

describe('remote operating surface selection', () => {
  it('selects each surface from the Firmware identities the world actually represents', () => {
    const hosts = createInitialGameState().world.network.hosts
    const rack = hosts.find(({ id }) => id === 'host-lan-001')!.firmware
    const veyra = hosts.find(({ id }) => id === 'host-phone-001')!.firmware

    expect(selectRemoteOperatingSurface(rack)).toBe('rack-os')
    expect(selectRemoteOperatingSurface(veyra)).toBe('veyra-os')
  })

  it('mounts VEYRA for both represented VEYRA OS releases, which stay distinct identities', () => {
    expect(VEYRA_OS_4_2_FIRMWARE_ID).not.toBe(VEYRA_OS_4_1_FIRMWARE_ID)
    expect(selectRemoteOperatingSurface({ id: VEYRA_OS_4_2_FIRMWARE_ID, name: 'VEYRA OS', version: '4.2' })).toBe('veyra-os')
  })

  it('decides from stable Firmware identity rather than the mutable display name', () => {
    // A renamed release is the same Firmware and still mounts its own
    // environment; a name alone never selects one.
    expect(selectRemoteOperatingSurface({ id: RACK_OS_FIRMWARE_ID, name: 'TRUTH-OS', version: '2.4' })).toBe('rack-os')
    expect(selectRemoteOperatingSurface({ id: VEYRA_OS_4_1_FIRMWARE_ID, name: 'Something Else', version: '9.9' })).toBe('veyra-os')
    expect(selectRemoteOperatingSurface({ id: 'firmware-unknown-v1', name: 'RACK-OS', version: '1.0' })).toBeUndefined()
    expect(selectRemoteOperatingSurface({ id: 'firmware-unknown-v1', name: 'VEYRA OS', version: '4.1' })).toBeUndefined()
  })

  it('selects nothing for Firmware it cannot present, rather than falling back', () => {
    expect(selectRemoteOperatingSurface({ id: 'firmware-vault-os-v2', name: 'VAULT-OS', version: '2.0' })).toBeUndefined()
    expect(selectRemoteOperatingSurface(undefined)).toBeUndefined()
  })
})
