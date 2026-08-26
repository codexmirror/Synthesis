import type { ComponentType } from 'react'
import { Files } from '../apps/files/Files'
import { Mail } from '../apps/mail/Mail'
import { Network } from '../apps/network/Network'
import { Notes } from '../apps/notes/Notes'
import { System } from '../apps/system/System'
import { Terminal } from '../apps/terminal/Terminal'
import { Wallet } from '../apps/wallet/Wallet'
import { Processes } from '../apps/processes/Processes'

export interface AppDefinition { label: string; component: ComponentType }

export const appRegistry = {
  terminal: { label: 'Terminal', component: Terminal },
  network: { label: 'NodeScan', component: Network },
  mail: { label: 'NodeMail', component: Mail },
  processes: { label: 'Processes', component: Processes },
  files: { label: 'Files', component: Files },
  wallet: { label: 'Wallet', component: Wallet },
  notes: { label: 'Notes', component: Notes },
  system: { label: 'System', component: System },
} satisfies Record<string, AppDefinition>

export type AppId = keyof typeof appRegistry
export const appEntries = Object.entries(appRegistry) as [AppId, AppDefinition][]
