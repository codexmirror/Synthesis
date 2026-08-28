import type { DollarAccountActivityEntry } from '../../core/game/dollarFinance'

/**
 * Balance trajectory for the Dollar hero.
 *
 * This is Wallet presentation, not finance domain truth. Nothing here is
 * stored: the sequence is reconstructed on every render from the canonical
 * balance and the canonical Transactions the Account is part of, and it is
 * discarded again immediately.
 *
 * It deliberately represents BALANCE ACROSS REPRESENTED TRANSACTION SEQUENCE
 * rather than balance over clock time. Dollar Transactions carry canonical
 * insertion order and no represented timestamp, so a time axis would be an
 * invention; the trajectory therefore has no time axis, no range selector, no
 * sampling and no interpolation between represented states.
 */

/**
 * The balance states this Account is represented as having held, oldest first.
 *
 * Derived by undoing each Transaction backwards from the current canonical
 * balance: an Account with N Transactions has exactly N+1 represented balance
 * states, and an Account with none has exactly one — its balance now.
 *
 * `activity` is the canonical newest-first projection, whose amounts are
 * already signed from this Account's point of view, so undoing an entry is
 * subtracting that signed amount.
 */
export function deriveDollarBalanceTrajectory(currentBalanceCents: number, activity: readonly DollarAccountActivityEntry[]): readonly number[] {
  const states: number[] = [currentBalanceCents]
  let balance = currentBalanceCents
  for (const entry of activity) {
    balance -= entry.amountCents
    states.push(balance)
  }
  return states.reverse()
}

/**
 * The trajectory as SVG polyline coordinates across the given box, or
 * `undefined` where there is nothing to draw.
 *
 * A single represented balance state is not a line: one state cannot show
 * movement, and drawing a flat or fluctuating stroke through it would claim
 * history this Account does not have. The hero omits the graph entirely in
 * that case rather than filling the space with a shape.
 */
export function dollarTrajectoryPolylinePoints(states: readonly number[], width: number, height: number): string | undefined {
  if (states.length < 2) return undefined
  const low = Math.min(...states)
  const high = Math.max(...states)
  const span = high - low
  const step = width / (states.length - 1)
  return states
    // A degenerate span cannot happen while every Transaction moves a positive
    // amount, but a flat series must still render as a flat line, not NaN.
    .map((cents, index) => `${round(index * step)},${round(span === 0 ? height / 2 : height - ((cents - low) / span) * height)}`)
    .join(' ')
}

/** Two decimals is well below one rendered pixel at these box sizes and keeps the attribute short. */
function round(value: number): number {
  return Math.round(value * 100) / 100
}
