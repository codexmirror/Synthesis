import type { ComponentType } from 'react'
import { Files } from '../apps/Files'
import { Network } from '../apps/Network'
import { Notes } from '../apps/Notes'
import { System } from '../apps/System'
import { Terminal } from '../apps/terminal/Terminal'
import { Wallet } from '../apps/Wallet'
import type { AppId } from '../core/game/GameContext'

export interface AppDefinition { id: AppId; label: string; glyph: string; component: ComponentType }

export const appRegistry: AppDefinition[] = [
  { id: 'terminal', label: 'Terminal', glyph: '>_', component: Terminal },
  { id: 'network', label: 'Network', glyph: '◇', component: Network },
  { id: 'wallet', label: 'Wallet', glyph: '$', component: Wallet },
  { id: 'notes', label: 'Notes', glyph: '≡', component: Notes },
  { id: 'files', label: 'Files', glyph: '▱', component: Files },
  { id: 'system', label: 'System', glyph: '⌁', component: System },
]
