/** Presents canonical integer Dollar cents using the current Wallet locale. */
export function formatDollarCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

/** Presents a signed activity amount with an explicit sign, so a debit and a credit never read alike. */
export function formatSignedDollarCents(cents: number): string {
  return `${cents < 0 ? '−' : '+'}${formatDollarCents(Math.abs(cents))}`
}

/**
 * Converts a human-typed Dollar amount into exact canonical cents at the input
 * boundary, so no floating-point Dollar value ever reaches the domain. Accepts
 * whole dollars and one or two fractional digits (`12`, `12.3`, `12.34`) and
 * refuses everything else — more precision than a cent, non-numeric text, zero,
 * a negative value, and any amount too large to stay an exact integer.
 */
export function parseDollarAmountToCents(input: string): number | undefined {
  const match = /^\$?(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim())
  if (!match) return undefined
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '0').padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents > 0 ? cents : undefined
}
