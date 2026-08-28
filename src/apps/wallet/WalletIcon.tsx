import type { ReactNode } from 'react'

/**
 * The Wallet's line iconography, drawn the same way the Shell draws its
 * application icons: inline `currentColor` strokes on a 24-unit grid, no icon
 * dependency and no glyph font.
 *
 * Every icon here marks something the Wallet actually does. None of them
 * implies a capability that is not represented — there is no scanner, no
 * payment request, no card and no network mark — and none of them is the only
 * label on a control: each is presented alongside real text.
 */
export type WalletIconName = 'send' | 'receive' | 'account' | 'copy' | 'node'

const paths: Record<WalletIconName, ReactNode> = {
  send: <><path d="M7 17 17 7" /><path d="M9 7h8v8" /></>,
  receive: <><path d="M17 7 7 17" /><path d="M15 17H7V9" /></>,
  account: <><circle cx="12" cy="8.5" r="3.3" /><path d="M5 20c0-3.5 3.1-5.4 7-5.4s7 1.9 7 5.4" /></>,
  copy: <><path d="M9 9h11v11H9z" /><path d="M15 5H4v11" /></>,
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
