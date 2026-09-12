import { describe, expect, it } from 'vitest'
import { onlineRuntimeEnabled } from '../App'

describe('deployment mode', () => {
  it('keeps the static production Pages artifact offline unless a backend is explicitly selected', () => {
    expect(onlineRuntimeEnabled({ MODE: 'production', DEV: false })).toBe(false)
    expect(onlineRuntimeEnabled({ MODE: 'production', DEV: false, VITE_SYNTHESIS_ONLINE: '1' })).toBe(true)
    expect(onlineRuntimeEnabled({ MODE: 'development', DEV: true })).toBe(true)
  })
})
