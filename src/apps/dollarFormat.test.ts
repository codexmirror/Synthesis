import { describe, expect, it } from 'vitest'
import { formatDollarCents, formatSignedDollarCents, parseDollarAmountToCents } from './dollarFormat'

describe('Dollar presentation formatting', () => {
  it('formats canonical integer cents for Wallet presentation', () => {
    expect(formatDollarCents(125_000)).toBe('$1,250.00')
    expect(formatDollarCents(1_234)).toBe('$12.34')
    expect(formatDollarCents(0)).toBe('$0.00')
  })

  it('signs activity amounts so a debit and a credit never read alike', () => {
    expect(formatSignedDollarCents(-2_500)).toBe('−$25.00')
    expect(formatSignedDollarCents(2_500)).toBe('+$25.00')
  })
})

describe('Dollar amount input', () => {
  it.each([
    ['12', 1_200],
    ['12.3', 1_230],
    ['12.34', 1_234],
    ['0.01', 1],
    ['1250', 125_000],
    [' 25.00 ', 2_500],
    ['$25', 2_500],
  ])('parses %s into exact cents', (input, cents) => {
    expect(parseDollarAmountToCents(input)).toBe(cents)
  })

  it.each([
    ['', 'empty input'],
    ['abc', 'non-numeric input'],
    ['12.345', 'more than two fractional digits'],
    ['12.', 'a trailing separator'],
    ['.5', 'a missing whole part'],
    ['0', 'zero'],
    ['0.00', 'zero written with cents'],
    ['-5', 'a negative amount'],
    ['1,250', 'grouped input this V1 does not accept'],
    ['1e3', 'exponent notation'],
    ['99999999999999999', 'an amount beyond exact integer cents'],
  ])('refuses %s (%s)', (input) => {
    expect(parseDollarAmountToCents(input)).toBeUndefined()
  })

  it('never produces a floating-point cent value', () => {
    for (const input of ['0.07', '19.99', '1250.05']) {
      const cents = parseDollarAmountToCents(input)
      expect(Number.isSafeInteger(cents)).toBe(true)
    }
    // The naive `Number(input) * 100` route loses this one.
    expect(parseDollarAmountToCents('1.15')).toBe(115)
  })
})
