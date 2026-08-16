import type { ComponentType } from 'react'
import { Files } from '../apps/files/Files'
import { Network } from '../apps/network/Network'
import { Notes } from '../apps/notes/Notes'
import { System } from '../apps/system/System'
import { Terminal } from '../apps/terminal/Terminal'
import { Wallet } from '../apps/wallet/Wallet'
import { Processes } from '../apps/processes/Processes'

export interface AppDefinition { label: string; glyph: string; component: ComponentType }

export const appRegistry = {
  terminal: { label: 'Terminal', glyph: '>_', component: Terminal },
  network: { label: 'Network', glyph: '◇', component: Network },
  processes: { label: 'Processes', glyph: '▤', component: Processes },
  wallet: { label: 'Wallet', glyph: '$', component: Wallet },
  notes: { label: 'Notes', glyph: '≡', component: Notes },
  files: { label: 'Files', glyph: '▱', component: Files },
  system: { label: 'System', glyph: '⌁', component: System },
} satisfies Record<string, AppDefinition>

export type AppId = keyof typeof appRegistry
export const appEntries = Object.entries(appRegistry) as [AppId, AppDefinition][]
