import type { BookstoreCoffeeOffering, BusinessBranchSale, BusinessBranchSaleLine } from './types'

export const BOOKSTORE_HOUSE_COFFEE_ID = 'bookstore-house-coffee-01'
export const BOOKSTORE_HOUSE_COFFEE: BookstoreCoffeeOffering = {
  id: BOOKSTORE_HOUSE_COFFEE_ID,
  name: 'House Coffee',
  unitPriceCents: 350,
}
export const BOOKSTORE_COFFEE_MACHINE_PRICE_CENTS = 25_000

/** One customer intention, sampled only when Coffee service exists. Never rerolled on refusal. */
export function selectBookstoreCoffeePurchaseMode(random: () => number): 'books_only' | 'books_and_coffee' | 'coffee_only' {
  const raw = random()
  const sample = Number.isFinite(raw) && raw >= 0 && raw < 1 ? raw : 0
  return sample < 0.6 ? 'books_only' : sample < 0.9 ? 'books_and_coffee' : 'coffee_only'
}

/** Captured composition owns sale meaning, independently of the current machine or catalog. */
export function deriveBookstoreSaleKind(lines: readonly BusinessBranchSaleLine[]): BusinessBranchSale['kind'] {
  const containsCoffee = lines.some(line => line.merchandiseId === BOOKSTORE_HOUSE_COFFEE_ID)
  if (!containsCoffee) return 'book_sale'
  return lines.some(line => line.merchandiseId !== BOOKSTORE_HOUSE_COFFEE_ID) ? 'book_and_coffee_sale' : 'coffee_sale'
}
