import { NODE_UNITS_PER_NODE } from '../core/game/nodeMiner'

/**
 * Presents canonical integer atomic NODE units as human-readable NODE.
 * Composed from integer division/remainder rather than floating-point
 * division, so displayed economic truth never loses precision.
 */
export function formatNodeUnitsAsNode(units: number): string {
  const whole = Math.trunc(units / NODE_UNITS_PER_NODE)
  const remainderUnits = Math.trunc(units) - whole * NODE_UNITS_PER_NODE
  const fraction = String(Math.abs(remainderUnits)).padStart(6, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : `${whole}`
}
