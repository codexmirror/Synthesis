import { describe, expect, it } from 'vitest'
import { onlineRuntimeEnabled } from '../App'

describe('runtime mode selection', () => {
  it('never treats development alone as Online authority', () => {
    expect(onlineRuntimeEnabled({ MODE: 'development' })).toBe(false)
    expect(onlineRuntimeEnabled({ MODE: 'development', VITE_SYNTHESIS_ONLINE: '1' })).toBe(true)
  })

  it('keeps the default/Pages production build Sandbox unless Online is explicitly selected', () => {
    expect(onlineRuntimeEnabled({ MODE: 'production' })).toBe(false)
    expect(onlineRuntimeEnabled({ MODE: 'production', VITE_SYNTHESIS_ONLINE: '1' })).toBe(true)
  })

  it('stays Sandbox under the test runner regardless of the Online flag', () => {
    expect(onlineRuntimeEnabled({ MODE: 'test' })).toBe(false)
    expect(onlineRuntimeEnabled({ MODE: 'test', VITE_SYNTHESIS_ONLINE: '1' })).toBe(false)
  })
})
