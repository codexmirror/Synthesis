import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { changeDeviceWalletProtection, changeWalletProtectionForOperatedRemoteDevice } from './deviceSecurity'
import { connectRemoteFromObservation } from './remoteSession'
import type { GameState } from './types'

const PHONE_ID = 'host-phone-001'
const PHONE_PIN = '7042'

/** An entered-Session world for the represented VEYRA phone, reached the way the game reaches it. */
function phoneConnectedState(state = createInitialGameState()): GameState {
  const accessed: GameState = {
    ...state,
    deviceAccess: { nextId: 2, established: [{
      id: 'access-phone', sourceDeviceId: state.player.localDevice.id,
      targetDeviceId: PHONE_ID, viaServiceId: 'service-ssh-003', privilege: 'USER',
    }] },
  }
  return connectRemoteFromObservation(accessed, { targetDeviceId: PHONE_ID, address: '198.51.100.61' }).state
}

describe('Device-owned Wallet protection', () => {
  it('starts OFF and is not derived from any other domain', () => {
    const state = createInitialGameState()
    const phone = state.world.network.hosts.find(({ id }) => id === PHONE_ID)
    expect(phone?.security).toEqual({ devicePin: PHONE_PIN, walletProtectionEnabled: false })
  })

  it('commits the requested state on a correct PIN and leaves the rest of the Device untouched', () => {
    const before = createInitialGameState()
    const result = changeDeviceWalletProtection(before, PHONE_ID, PHONE_PIN, true)
    expect(result.status).toBe('changed')
    if (result.status !== 'changed') return
    const phone = result.state.world.network.hosts.find(({ id }) => id === PHONE_ID)
    expect(phone?.security).toEqual({ devicePin: PHONE_PIN, walletProtectionEnabled: true })
    expect(phone?.displayName).toBe(before.world.network.hosts.find(({ id }) => id === PHONE_ID)?.displayName)
  })

  it('refuses an incorrect PIN and leaves canonical state exactly as it was', () => {
    const before = createInitialGameState()
    const result = changeDeviceWalletProtection(before, PHONE_ID, '0000', true)
    expect(result).toEqual({ status: 'invalid_pin', state: before })
    const phone = result.state.world.network.hosts.find(({ id }) => id === PHONE_ID)
    expect(phone?.security?.walletProtectionEnabled).toBe(false)
  })

  it('refuses a Device with no represented security state rather than inventing one', () => {
    const before = createInitialGameState()
    const result = changeDeviceWalletProtection(before, 'host-lan-001', 'anything', true)
    expect(result).toEqual({ status: 'device_not_found', state: before })
  })

  it('persists through repeated verified changes rather than resetting or expiring', () => {
    const before = createInitialGameState()
    const on = changeDeviceWalletProtection(before, PHONE_ID, PHONE_PIN, true)
    expect(on.status).toBe('changed')
    if (on.status !== 'changed') return
    const still = on.state.world.network.hosts.find(({ id }) => id === PHONE_ID)
    expect(still?.security?.walletProtectionEnabled).toBe(true)

    const off = changeDeviceWalletProtection(on.state, PHONE_ID, PHONE_PIN, false)
    expect(off.status).toBe('changed')
    if (off.status !== 'changed') return
    expect(off.state.world.network.hosts.find(({ id }) => id === PHONE_ID)?.security?.walletProtectionEnabled).toBe(false)
  })

  describe('the operated-remote-Device authority boundary', () => {
    it('resolves the acting Device from the active Remote Session, not a caller-supplied identity', () => {
      const connected = phoneConnectedState()
      const result = changeWalletProtectionForOperatedRemoteDevice(connected, PHONE_PIN, true)
      expect(result.status).toBe('changed')
      if (result.status !== 'changed') return
      expect(result.state.world.network.hosts.find(({ id }) => id === PHONE_ID)?.security?.walletProtectionEnabled).toBe(true)
    })

    it('grants no authority merely from DeviceAccess and an active Remote Session: a wrong PIN still fails', () => {
      const connected = phoneConnectedState()
      const result = changeWalletProtectionForOperatedRemoteDevice(connected, '0000', true)
      expect(result).toEqual({ status: 'invalid_pin', state: connected })
      expect(result.state.world.network.hosts.find(({ id }) => id === PHONE_ID)?.security?.walletProtectionEnabled).toBe(false)
    })

    it('refuses with no active Remote Session, granting no authority from Session absence either', () => {
      const before = createInitialGameState()
      const result = changeWalletProtectionForOperatedRemoteDevice(before, PHONE_PIN, true)
      expect(result).toEqual({ status: 'session_unavailable', state: before })
    })
  })
})
