import type { VeyraBusinessDetail } from './VeyraBusiness'
import { parentVeyraBusinessDetail } from './VeyraBusiness'
import type { VeyraSettingsDetail } from './VeyraSettings'
import type { VeyraWalletDetail } from './VeyraWallet'

/**
 * Where the player is inside the phone.
 *
 * ```text
 * HOME -> application / system-surface root -> detail -> a detail's own child detail
 * ```
 *
 * It is Presentation state held by `VeyraOS` and never reaches `GameState`: a
 * launcher position is not world truth.
 */
export type VeyraLocation =
  | { readonly app: 'home' }
  | { readonly app: 'communication' }
  | { readonly app: 'wallet-locked' }
  | { readonly app: 'wallet'; readonly detail?: VeyraWalletDetail }
  | { readonly app: 'business'; readonly detail?: VeyraBusinessDetail }
  | { readonly app: 'settings'; readonly detail?: VeyraSettingsDetail }

/**
 * The one surface directly above this one, or `undefined` at Home.
 *
 * This is VEYRA's whole navigation hierarchy, and it is deliberately concrete:
 * every surface names its own parent, so the navigation band's BACK and a
 * surface's own local back control cannot disagree, and a detail that is
 * really a child of another detail — Product Detail under Inventory — returns
 * where the player came from rather than to its application root. It is not a
 * route table, a history stack or a generic navigator: there is no path
 * syntax, no registry and no per-OS abstraction, and an application owns the
 * shape of its own details (`parentVeyraBusinessDetail`).
 */
export function veyraParentLocation(location: VeyraLocation): VeyraLocation | undefined {
  if (location.app === 'home') return undefined
  if (location.app === 'communication' || location.app === 'wallet-locked') return { app: 'home' }
  if (!location.detail) return { app: 'home' }
  if (location.app === 'business') {
    const parent = parentVeyraBusinessDetail(location.detail)
    return parent ? { app: 'business', detail: parent } : { app: 'business' }
  }
  return { app: location.app }
}

/**
 * A stable identity for one surface, used to tell a real navigation from an
 * ordinary re-render: an advancing delivery, a completed sale or an appended
 * Market Report re-renders the same surface and leaves this key alone.
 */
export function veyraLocationKey(location: VeyraLocation): string {
  if (location.app === 'business' && location.detail) return `business:${businessDetailKey(location.detail)}`
  if (location.app === 'wallet' && location.detail) return `wallet:${location.detail}`
  if (location.app === 'settings' && location.detail) return `settings:${location.detail}`
  return location.app
}

function businessDetailKey(detail: VeyraBusinessDetail): string {
  if ('inventory' in detail) return 'inventory'
  if ('productId' in detail) return `product:${detail.productId}`
  if ('marketAnalyst' in detail) return 'market-analyst'
  return `offer:${detail.offerId}`
}

/** Whether `location` is the surface directly above `from`. */
export function isVeyraParentOf(location: VeyraLocation, from: VeyraLocation): boolean {
  const parent = veyraParentLocation(from)
  return parent !== undefined && veyraLocationKey(parent) === veyraLocationKey(location)
}
