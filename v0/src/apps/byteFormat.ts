/**
 * Shared byte and transfer-rate presentation.
 *
 * Represented artifact sizes are plain byte counts and are presented in
 * decimal units (KB/MB), which is what every existing artifact surface shows.
 * Canonical `NetworkTransferCapacity` values are binary rates
 * (1 MiB/s = 1_048_576 B/s), so rates are presented in binary units
 * (KiB/s, MiB/s). Each label therefore matches the calculation used for it.
 */
export function formatBytes(bytes: number) {
  const value = Math.max(0, bytes)
  if (value < 1_000) return `${Math.round(value)} B`
  if (value < 1_000_000) return `${stripZero((value / 1_000).toFixed(1))} KB`
  return `${stripZero((value / 1_000_000).toFixed(1))} MB`
}

export function formatTransferRate(bytesPerSecond: number) {
  const value = Math.max(0, bytesPerSecond)
  if (value < 1_024) return `${Math.round(value)} B/s`
  if (value < 1_048_576) return `${stripZero((value / 1_024).toFixed(1))} KiB/s`
  return `${stripZero((value / 1_048_576).toFixed(1))} MiB/s`
}

/**
 * Present transferred-of-total bytes. When both values land on the same unit
 * the unit is written once, which keeps the pair on one line on narrow screens.
 */
export function formatByteProgress(transferred: number, total: number) {
  const transferredLabel = formatBytes(transferred)
  const totalLabel = formatBytes(total)
  const unit = totalLabel.slice(totalLabel.indexOf(' ') + 1)
  return transferredLabel.endsWith(` ${unit}`)
    ? `${transferredLabel.slice(0, -unit.length - 1)} / ${totalLabel}`
    : `${transferredLabel} / ${totalLabel}`
}

function stripZero(value: string) { return value.endsWith('.0') ? value.slice(0, -2) : value }
