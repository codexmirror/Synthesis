import { describe, expect, it } from 'vitest'
import { isVeyraParentOf, veyraLocationKey, veyraParentLocation, type VeyraLocation } from './veyraNavigation'

/**
 * VEYRA's navigation hierarchy is one thing, consumed by the navigation band's
 * BACK, by each surface's own back control, and by where a newly opened surface
 * starts scrolling. These are the shapes all three depend on.
 */
describe('VEYRA navigation hierarchy', () => {
  it('leaves Home with nowhere above it', () => {
    expect(veyraParentLocation({ app: 'home' })).toBeUndefined()
  })

  it('returns every application and system-surface root to Home', () => {
    const roots: readonly VeyraLocation[] = [
      { app: 'communication' }, { app: 'wallet-locked' }, { app: 'wallet' }, { app: 'business' }, { app: 'settings' },
    ]
    for (const root of roots) expect(veyraParentLocation(root)).toEqual({ app: 'home' })
  })

  it('returns an ordinary detail to its own application root', () => {
    expect(veyraParentLocation({ app: 'wallet', detail: 'send' })).toEqual({ app: 'wallet' })
    expect(veyraParentLocation({ app: 'settings', detail: 'security' })).toEqual({ app: 'settings' })
    expect(veyraParentLocation({ app: 'business', detail: { inventory: true } })).toEqual({ app: 'business' })
    expect(veyraParentLocation({ app: 'business', detail: { marketAnalyst: true } })).toEqual({ app: 'business' })
    expect(veyraParentLocation({ app: 'business', detail: { offerId: 'offer-mixed' } })).toEqual({ app: 'business' })
  })

  it('treats Product Detail as a child of Inventory rather than of the Business root', () => {
    expect(veyraParentLocation({ app: 'business', detail: { productId: 'bookstore-merch-006' } }))
      .toEqual({ app: 'business', detail: { inventory: true } })
  })

  it('identifies a surface by where it is, not by what it currently states', () => {
    // Two Products are two surfaces; the same Product re-rendered is one.
    expect(veyraLocationKey({ app: 'business', detail: { productId: 'a' } }))
      .toBe(veyraLocationKey({ app: 'business', detail: { productId: 'a' } }))
    expect(veyraLocationKey({ app: 'business', detail: { productId: 'a' } }))
      .not.toBe(veyraLocationKey({ app: 'business', detail: { productId: 'b' } }))
    expect(veyraLocationKey({ app: 'business', detail: { inventory: true } })).not.toBe(veyraLocationKey({ app: 'business' }))
    expect(veyraLocationKey({ app: 'wallet', detail: 'send' })).not.toBe(veyraLocationKey({ app: 'settings', detail: 'security' }))
  })

  it('recognizes only a real one-step ascent as going back up', () => {
    const inventory: VeyraLocation = { app: 'business', detail: { inventory: true } }
    const product: VeyraLocation = { app: 'business', detail: { productId: 'bookstore-merch-006' } }
    const root: VeyraLocation = { app: 'business' }

    expect(isVeyraParentOf(inventory, product)).toBe(true)
    expect(isVeyraParentOf(root, inventory)).toBe(true)
    // Skipping a level is not an ascent, and neither is going the other way.
    expect(isVeyraParentOf(root, product)).toBe(false)
    expect(isVeyraParentOf(product, inventory)).toBe(false)
    expect(isVeyraParentOf({ app: 'home' }, product)).toBe(false)
  })
})
