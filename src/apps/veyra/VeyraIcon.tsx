import type { ReactNode } from 'react'

export type VeyraIconName =
  | 'wallet'
  | 'settings'
  | 'send'
  | 'receive'
  | 'copy'
  | 'copied'
  | 'chevron'
  | 'back'
  | 'home'

/**
 * VEYRA's own line art, drawn locally with no icon dependency.
 *
 * One 24-unit grid, one stroke weight, round caps and joints throughout. The
 * roundness is the point: NODE-OS draws the same kind of marks with square caps
 * and mitred joints, so the two families stay recognizably different products
 * rather than the same icons in different colours. Nothing here is a copy of
 * another platform's glyph set, and no icon ever carries a control on its own —
 * every one of them sits beside a real text label and is `aria-hidden`.
 *
 * An icon marks a surface that is already reachable; it grants no capability
 * and states no fact about the world.
 */
export function VeyraIcon({ name }: { name: VeyraIconName }) {
  const glyphs = {
    wallet: <><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H17a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" /><path d="M4 9h13" /><circle cx="16" cy="13.5" r="1.1" /></>,
    settings: <><path d="M4 8h4.4M13.6 8H20M4 16h9.4M18.6 16H20" /><circle cx="11" cy="8" r="2.6" /><circle cx="16" cy="16" r="2.6" /></>,
    send: <><path d="M18 6 6 18" /><path d="M9.5 6H18v8.5" /></>,
    receive: <><path d="M6 18 18 6" /><path d="M14.5 18H6V9.5" /></>,
    copy: <><rect x="9" y="9" width="10.5" height="10.5" rx="2.4" /><path d="M15 6.2A2.2 2.2 0 0 0 12.8 4H6.7A2.7 2.7 0 0 0 4 6.7v6.1A2.2 2.2 0 0 0 6.2 15" /></>,
    copied: <path d="m5 12.6 4.4 4.4L19 7.4" />,
    chevron: <path d="m10 6 6 6-6 6" />,
    back: <path d="m14 6-6 6 6 6" />,
    home: <><path d="M4.5 10.8 12 4.6l7.5 6.2" /><path d="M6.6 12.4V19h10.8v-6.6" /></>,
  } satisfies Record<VeyraIconName, ReactNode>

  return <svg
    className="veyra-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
  >{glyphs[name]}</svg>
}
