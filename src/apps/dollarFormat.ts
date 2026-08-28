/** Presents canonical integer Dollar cents using the current Wallet locale. */
export function formatDollarCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}
