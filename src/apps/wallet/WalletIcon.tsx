import type { ReactNode } from 'react'

/**
 * The Wallet's line iconography, drawn the same way the Shell draws its
 * application icons: inline `currentColor` strokes on a 24-unit grid, no icon
 * dependency and no glyph font.
 *
 * They are drawn as one family rather than as five separate marks: every path
 * lives inside the same 5–19 optical box, uses the same 1.5 stroke, and turns
 * with the same square cap and mitred corner, so a mark never reads heavier or
 * softer than the one beside it. The three action marks in particular sit in
 * the same strip and must look like one set.
 *
 * Every icon here marks something the Wallet actually does. None of them
 * implies a capability that is not represented — there is no scanner, no
 * payment request, no card and no network mark — and none of them is the only
 * label on a control: each is presented alongside real text.
 */
export type WalletIconName = 'send' | 'receive' | 'account' | 'copy' | 'copied' | 'node'

const paths: Record<WalletIconName, ReactNode> = {
  // Outgoing and incoming are the same arrow reflected, so a direction reads
  // from the mark's geometry and not only from its colour.
  send: <><path d="M7 17 17 7" /><path d="M10 7h7v7" /></>,
  receive: <><path d="M17 7 7 17" /><path d="M14 17H7v-7" /></>,
  account: <><circle cx="12" cy="9" r="3.2" /><path d="M5.8 19.4v-1c0-2.3 2.8-3.7 6.2-3.7s6.2 1.4 6.2 3.7v1" /></>,
  copy: <><path d="M9 9h10v10H9z" /><path d="M15 5H5v10" /></>,
  copied: <path d="m5.6 12.4 4.3 4.4 8.5-9.2" />,
  node: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" /><path d="m4 7.5 8 4.5 8-4.5" /><path d="M12 12v9" /></>,
}

export function WalletIcon({ name }: { name: WalletIconName }) {
  return <svg
    className="wallet-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeLinecap="square"
    strokeLinejoin="miter"
    strokeWidth={1.5}
  >{paths[name]}</svg>
}
