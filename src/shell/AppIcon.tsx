import type { ReactNode } from 'react'
import type { AppId } from './appRegistry'

export function AppIcon({ app }: { app: AppId }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'square' as const,
    strokeLinejoin: 'miter' as const,
    strokeWidth: 1.5,
  }

  const paths = {
    terminal: <><path d="m5 7 4 4-4 4" /><path d="M11 16h8" /></>,
    network: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" /><path d="M12 4V2M20 12h2M12 20v2M4 12H2" /></>,
    networkManagement: <><rect x="4" y="4" width="16" height="5" /><rect x="4" y="15" width="16" height="5" /><path d="M8 9v6M16 9v6" /></>,
    mail: <><path d="M3 6h18v12H3z" /><path d="m3 7 9 6 9-6" /></>,
    processes: <><path d="M4 6h6v4H4zM14 6h6M14 10h4M4 14h6v4H4zM14 14h6M14 18h4" /></>,
    files: <><path d="M3 7h7l2 2h9v10H3z" /><path d="M3 7V5h7l2 2h7" /></>,
    flipper: <><rect x="5" y="3" width="14" height="18" /><rect x="8" y="6" width="8" height="6" /><circle cx="9" cy="17" r="1.4" /><path d="M13 17h4" /></>,
    market: <><path d="M4 9h16l-1.5 11H5.5z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    wallet: <><path d="M3 6h15v12H3z" /><path d="M18 10h3v5h-7v-5h4" /><circle cx="16.5" cy="12.5" r=".7" fill="currentColor" stroke="none" /></>,
    notes: <><path d="M5 3h12l3 3v15H5z" /><path d="M17 3v4h3M8 11h8M8 15h8M8 19h5" /></>,
    system: <><rect x="6" y="6" width="12" height="12" /><rect x="9" y="9" width="6" height="6" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></>,
  } satisfies Record<AppId, ReactNode>

  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[app]}</svg>
}
