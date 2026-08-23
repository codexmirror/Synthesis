import { describe, expect, it } from 'vitest'
import tokensCss from './tokens.css?raw'
import nodeUiCss from './nodeui.css?raw'
import baseCss from './base.css?raw'
import appsCss from '../apps/apps.css?raw'
import networkCss from '../apps/network/network.css?raw'
import processesCss from '../apps/processes/processes.css?raw'
import terminalCss from '../apps/terminal/terminal.css?raw'
import shellCss from '../shell/shell.css?raw'
import rackosCss from '../apps/rackos/rackos.css?raw'
import filesSource from '../apps/files/Files.tsx?raw'
import systemSource from '../apps/system/System.tsx?raw'
import walletSource from '../apps/wallet/Wallet.tsx?raw'
import notesSource from '../apps/notes/Notes.tsx?raw'
import terminalSource from '../apps/terminal/Terminal.tsx?raw'
import networkSource from '../apps/network/Network.tsx?raw'
import processesSource from '../apps/processes/Processes.tsx?raw'
import rackosSource from '../apps/rackos/RackOS.tsx?raw'

/**
 * The NODE-OS presentation language is shared, so a class or custom property
 * an application references must actually be defined somewhere. Both of these
 * silently degraded before: `.eyebrow` was used by four applications and
 * styled by none, and Terminal referenced an undefined `--muted`.
 */

const nodeOsStylesheets = [tokensCss, nodeUiCss, baseCss, appsCss, networkCss, processesCss, terminalCss, shellCss]
const allStylesheets = [...nodeOsStylesheets, rackosCss]
const applicationSources = [filesSource, systemSource, walletSource, notesSource, terminalSource, networkSource, processesSource]

function referencedCustomProperties(css: string): string[] {
  return [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1])
    // `--node-*` are Shell-owned transient viewport variables written at
    // runtime, not palette tokens.
    .filter((name) => !name.startsWith('--node-'))
}

function definedCustomProperties(css: string): Set<string> {
  return new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]))
}

function referencedSharedClasses(source: string): string[] {
  return [...source.matchAll(/['"`]([^'"`\n]*)['"`]/g)]
    .flatMap((match) => match[1].split(/\s+/))
    .filter((name) => name === 'eyebrow' || /^node-[a-z-]+$/.test(name))
}

describe('NODE-OS presentation language', () => {
  it('defines every palette token the NODE-OS stylesheets reference', () => {
    const defined = definedCustomProperties(tokensCss)
    const missing = nodeOsStylesheets.flatMap(referencedCustomProperties).filter((name) => !defined.has(name))
    expect([...new Set(missing)]).toEqual([])
  })

  it('styles every shared primitive the applications reference', () => {
    const styled = allStylesheets.join('\n')
    const missing = applicationSources.flatMap(referencedSharedClasses)
      .filter((name) => !new RegExp(`\\.${name}[\\s,.:>{[]`).test(styled))
    expect([...new Set(missing)]).toEqual([])
  })

  it('gives every application surface the same gutter rather than per-app padding', () => {
    expect(appsCss).toMatch(/\.app-content\s*{[^}]*padding:\s*clamp\(18px, 4vw, 40px\)/)
    for (const css of [networkCss, processesCss]) {
      expect(css).not.toMatch(/padding:\s*clamp\(/)
    }
  })

  it('keeps RACK-OS on its own foreign presentation rather than NODE-OS primitives', () => {
    expect(rackosCss).not.toMatch(/var\(--green\)|var\(--accent/)
    expect(referencedSharedClasses(rackosSource)).toEqual([])
  })
})
