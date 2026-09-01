import type { ComponentType } from 'react'
import { Files } from '../apps/files/Files'
import { Flipper } from '../apps/flipper/Flipper'
import { Market } from '../apps/market/Market'
import { Mail } from '../apps/mail/Mail'
import { Network } from '../apps/network/Network'
import { Notes } from '../apps/notes/Notes'
import { System } from '../apps/system/System'
import { Terminal } from '../apps/terminal/Terminal'
import { Wallet } from '../apps/wallet/Wallet'
import { Processes } from '../apps/processes/Processes'
import { Rattler } from '../apps/rattler/Rattler'

export interface AppDefinition { label: string; component: ComponentType<{ openApp?: (app: 'flipper' | 'rattler') => void }>; home?: boolean }

export const appRegistry = {
  terminal: { label: 'Terminal', component: Terminal },
  network: { label: 'NodeScan', component: Network },
  mail: { label: 'NodeMail', component: Mail },
  processes: { label: 'Processes', component: Processes },
  files: { label: 'Files', component: Files },
  flipper: { label: 'Flipper', component: Flipper, home: false },
  rattler: { label: 'RATTLER', component: Rattler, home: false },
  market: { label: 'Market', component: Market },
  wallet: { label: 'Wallet', component: Wallet },
  notes: { label: 'Notes', component: Notes },
  system: { label: 'System', component: System },
} satisfies Record<string, AppDefinition>

export type AppId = keyof typeof appRegistry
export const appEntries = (Object.entries(appRegistry) as [AppId, AppDefinition][]).filter(([, app]) => app.home !== false)
