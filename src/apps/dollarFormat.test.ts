import { describe, expect, it } from 'vitest'
import { formatDollarCents } from './dollarFormat'

describe('Dollar presentation formatting', () => {
  it('formats canonical integer cents for Wallet presentation', () => {
    expect(formatDollarCents(125_000)).toBe('$1,250.00')
    expect(formatDollarCents(1_234)).toBe('$12.34')
    expect(formatDollarCents(0)).toBe('$0.00')
  })
})
