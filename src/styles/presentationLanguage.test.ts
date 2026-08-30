import { describe, expect, it } from 'vitest'
import tokensCss from './tokens.css?raw'
import nodeUiCss from './nodeui.css?raw'
import baseCss from './base.css?raw'
import appsCss from '../apps/apps.css?raw'
import networkCss from '../apps/network/network.css?raw'
import flipperCss from '../apps/flipper/flipper.css?raw'
import processesCss from '../apps/processes/processes.css?raw'
import mailCss from '../apps/mail/mail.css?raw'
import terminalCss from '../apps/terminal/terminal.css?raw'
import walletCss from '../apps/wallet/wallet.css?raw'
import shellCss from '../shell/shell.css?raw'
import rackosCss from '../apps/rackos/rackos.css?raw'
import veyraCss from '../apps/veyra/veyra.css?raw'
import filesSource from '../apps/files/Files.tsx?raw'
import flipperSource from '../apps/flipper/Flipper.tsx?raw'
import marketSource from '../apps/market/Market.tsx?raw'
import systemSource from '../apps/system/System.tsx?raw'
import walletSource from '../apps/wallet/Wallet.tsx?raw'
import dollarClientSource from '../apps/wallet/DollarClient.tsx?raw'
import dollarSendSource from '../apps/wallet/DollarSend.tsx?raw'
import dollarAccessSource from '../apps/wallet/DollarAccess.tsx?raw'
import walletControlsSource from '../apps/wallet/walletControls.tsx?raw'
import notesSource from '../apps/notes/Notes.tsx?raw'
import mailSource from '../apps/mail/Mail.tsx?raw'
import terminalSource from '../apps/terminal/Terminal.tsx?raw'
import networkSource from '../apps/network/Network.tsx?raw'
import processesSource from '../apps/processes/Processes.tsx?raw'
import activityMonitorSource from '../apps/processes/activityMonitor.ts?raw'
import rackosSource from '../apps/rackos/RackOS.tsx?raw'
import veyraSource from '../apps/veyra/VeyraOS.tsx?raw'
import veyraWalletSource from '../apps/veyra/VeyraWallet.tsx?raw'
import veyraSettingsSource from '../apps/veyra/VeyraSettings.tsx?raw'

/**
 * The NODE-OS presentation language is shared, so a class or custom property
 * an application references must actually be defined somewhere. Both of these
 * silently degraded before: `.eyebrow` was used by four applications and
 * styled by none, and Terminal referenced an undefined `--muted`.
 */

const nodeOsStylesheets = [tokensCss, nodeUiCss, baseCss, appsCss, networkCss, processesCss, terminalCss, mailCss, walletCss, flipperCss, shellCss]
const allStylesheets = [...nodeOsStylesheets, rackosCss, veyraCss]
const applicationSources = [filesSource, flipperSource, marketSource, systemSource, walletSource, dollarClientSource, dollarSendSource, dollarAccessSource, walletControlsSource, notesSource, terminalSource, networkSource, processesSource, mailSource]

function referencedCustomProperties(css: string): string[] {
  return [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1])
    // `--node-*` are Shell-owned transient viewport variables written at
    // runtime, not palette tokens.
    .filter((name) => !name.startsWith('--node-'))
}

function definedCustomProperties(css: string): Set<string> {
  return new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]))
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Body of the rule whose selector list is exactly `selector`. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return stripComments(css).match(new RegExp(`(?:^|[{}])\\s*${escaped}\\s*{([^}]*)}`))?.[1] ?? ''
}

/** Bodies of every rule, nested or not, whose selector mentions `className`. */
function rulesTouching(css: string, className: string): string[] {
  const pattern = new RegExp(`[^{}]*\\.${className}\\b[^{}]*{([^}]*)}`, 'g')
  return [...stripComments(css).matchAll(pattern)].map((match) => match[1])
}

function referencedSharedClasses(source: string): string[] {
  return [...source.matchAll(/['"`]([^'"`\n]*)['"`]/g)]
    .flatMap((match) => match[1].split(/\s+/))
    .filter((name) => name === 'eyebrow' || /^node-[a-z-]+$/.test(name))
}

describe('NODE-OS presentation language', () => {
  it('defines every custom property the NODE-OS stylesheets reference', () => {
    // Shared palette tokens come from `tokens.css`; a stylesheet may also own
    // private values (local geometry, for instance), which must still be
    // defined in the sheet that reads them.
    const palette = definedCustomProperties(tokensCss)
    const missing = nodeOsStylesheets.flatMap((css) => {
      const local = definedCustomProperties(css)
      return referencedCustomProperties(css).filter((name) => !palette.has(name) && !local.has(name))
    })
    expect([...new Set(missing)]).toEqual([])
  })

  it('styles every shared primitive the applications reference', () => {
    const styled = allStylesheets.join('\n')
    const missing = applicationSources.flatMap(referencedSharedClasses)
      .filter((name) => !new RegExp(`\\.${name}[\\s,.:>{[]`).test(styled))
    expect([...new Set(missing)]).toEqual([])
  })

  it('owns the scrolling application gutter once, at every width', () => {
    // Base gutter and the narrow-viewport gutter both belong to `.app-content`.
    expect(ruleBody(appsCss, '.app-content')).toMatch(/padding:\s*clamp\(18px, 4vw, 40px\)/)
    expect(appsCss).toMatch(/@media \(max-width: 480px\)\s*{\s*\.app-content\s*{[^}]*padding:\s*16px 14px 30px/)
  })

  it('lets no scrolling application redeclare that gutter', () => {
    // Every one of these renders inside `.app-content`, so a padding rule on
    // its own surface would silently reintroduce a second gutter.
    const surfaces: readonly [string, string][] = [
      [networkCss, 'scan-app'],
      [processesCss, 'activity-monitor'],
      [appsCss, 'files-app'],
      [flipperCss, 'flipper-app'],
      [appsCss, 'system-app'],
      [walletCss, 'wallet-app'],
      [mailCss, 'mail-app'],
    ]
    for (const [css, className] of surfaces) {
      const rules = rulesTouching(css, className)
      expect(rules.length, `no rule found for .${className}`).toBeGreaterThan(0)
      expect(`.${className} ${rules.join(' ')}`).not.toMatch(/padding/)
    }
  })

  it('keeps Terminal as the single declared gutter exception, for its stated reason', () => {
    // Terminal is a full-bleed grid, not a scrolling document. It may own its
    // padding, but only because it is safe-area aware and keyed to the editing
    // breakpoint; if that stops being true the exception is no longer earned.
    expect(terminalCss).toMatch(/Terminal is the one declared exception/)
    expect(ruleBody(terminalCss, '.terminal')).toMatch(/padding:\s*clamp\(18px, 4vw, 40px\)/)

    const mobileTerminal = terminalCss.match(/@media \(max-width: 700px\), \(max-width: 900px\) and \(pointer: coarse\)\s*{[\s\S]*?\.terminal\s*{([^}]*)}/)?.[1]
    expect(mobileTerminal).toBeDefined()
    expect(mobileTerminal).toMatch(/env\(safe-area-inset-right\)/)
    expect(mobileTerminal).toMatch(/env\(safe-area-inset-left\)/)
    expect(mobileTerminal).toMatch(/env\(safe-area-inset-bottom\)/)

    // Terminal must not also be switched by the density breakpoint, which is
    // what made the previous "one gutter everywhere" claim untrue.
    expect(terminalCss).not.toMatch(/@media \(max-width: 480px\)/)

    // Owning the gutter is only worth something if the grid stays inside it.
    // `.terminal` clips rather than scrolls, so an implicit `auto` column
    // sized to its widest masthead or output line pushed content past the
    // padding box and the right gutter was cut off at narrow widths.
    const terminal = ruleBody(terminalCss, '.terminal')
    expect(terminal).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/)
    expect(terminal).toMatch(/grid-template-rows:[^;]*minmax\(0, 1fr\)/)

    // And no other NODE-OS application may claim the same exception.
    for (const css of [networkCss, processesCss, mailCss]) {
      expect(css).not.toMatch(/env\(safe-area-inset/)
    }
  })

  it('composes the masthead where a subject varies rather than imposing it everywhere', () => {
    // Carried by the applications whose subject varies, or whose operating
    // context needs stating.
    // NodeMail states the mailbox account it is presenting, which is a
    // different operating identity from the local Device the Shell names.
    // Market states the Market it is presenting, which is a different operating
    // identity from the local Device the Shell names: NODE-OS supplies the client,
    // not the catalog.
    const carries = [['Files', filesSource], ['Flipper', flipperSource], ['Market', marketSource], ['System', systemSource], ['Terminal', terminalSource], ['Activity Monitor', processesSource], ['NodeMail', mailSource]] as const
    for (const [name, source] of carries) {
      // Anchored on the class boundary: `node-masthead-subject` alone is a
      // child element, not evidence that the masthead itself is present.
      expect(source, `${name} should carry the shared masthead`).toMatch(/className="node-masthead[" ]/)
    }

    // Deliberately absent: Wallet and Notes are their own subject, and
    // NodeScan's breadcrumb and object heading already identify the browsed
    // object. A masthead must not be added to these for uniformity alone.
    const keepsOwn = [['Wallet', walletSource], ['Dollar client', dollarClientSource], ['Dollar SEND', dollarSendSource], ['Dollar access', dollarAccessSource], ['Notes', notesSource], ['NodeScan', networkSource]] as const
    for (const [name, source] of keepsOwn) {
      expect(source, `${name} intentionally keeps its own presentation`).not.toMatch(/node-masthead/)
    }
    expect(networkSource).toMatch(/className="scan-crumbs"/)
  })

  it('styles only activity states the Activity Monitor can actually be in', () => {
    /*
     * The mirror of the rule above: a class an application names must be
     * styled, and a state a stylesheet selects must be reachable. This one
     * degraded silently — the whole quiet finished treatment was keyed on
     * `completed`, a value `MonitorActivity.status` does not carry, so
     * finished work kept the running rail, title and progress colour and read
     * as live. The DOM contract was covered; nothing tied the CSS to it.
     */
    const statuses = new Set([...activityMonitorSource.matchAll(/readonly status:([^\n]*)/g)]
      .flatMap((match) => [...match[1].matchAll(/'([a-z_]+)'/g)].map((value) => value[1])))
    expect(statuses).toEqual(new Set(['running', 'recent']))

    const styled = [...new Set([...stripComments(processesCss).matchAll(/\[data-status="([a-z_]+)"\]/g)].map((match) => match[1]))]
    expect(styled.length).toBeGreaterThan(0)
    expect(styled.filter((status) => !statuses.has(status))).toEqual([])

    // Both states are actually distinguished, so simultaneous work stays
    // legible against work that has already finished.
    for (const status of statuses) expect(styled, `${status} has no treatment`).toContain(status)
  })

  it('keeps RACK-OS on its own foreign presentation rather than NODE-OS primitives', () => {
    expect(rackosCss).not.toMatch(/var\(--green\)|var\(--accent/)
    expect(referencedSharedClasses(rackosSource)).toEqual([])
  })

  it('keeps VEYRA on its own foreign consumer presentation rather than NODE-OS primitives', () => {
    // The second foreign Firmware surface. Like RACK-OS it owns its whole
    // palette and structure; unlike RACK-OS it is a light consumer product, so
    // it must also not inherit NODE-OS's monospace product typography.
    expect(veyraCss).not.toMatch(/var\(--green\)|var\(--accent(?!-)/)
    for (const source of [veyraSource, veyraWalletSource, veyraSettingsSource]) {
      expect(referencedSharedClasses(source)).toEqual([])
    }
    expect(ruleBody(veyraCss, '.veyra')).toMatch(/--veyra-sans:[^;]*-apple-system/)
    expect(ruleBody(veyraCss, '.veyra')).toMatch(/font-family:\s*var\(--veyra-sans\)/)

    // VEYRA's scrolling region is VEYRA's, and it reads no viewport of its own:
    // it consumes the Shell's editing recovery contract exactly as RACK-OS does.
    const viewport = ruleBody(veyraCss, '.veyra-viewport')
    expect(viewport).toMatch(/overflow-y:\s*auto/)
    expect(viewport).toMatch(/overscroll-behavior-y:\s*contain/)
    for (const source of [veyraSource, veyraWalletSource, veyraSettingsSource]) {
      expect(source).not.toMatch(/visualViewport|scrollIntoView|window\.scrollTo|innerHeight/)
    }

    // The same mobile safety floor the NODE-OS applications are held to below:
    // below 16 CSS px Mobile Safari auto-zooms a focused editable, which moves
    // the exact geometry the Shell-owned editing system reads.
    const sizes = [...stripComments(veyraCss).matchAll(/\.veyra-input[^{]*{([^}]*)}/g)]
      .map((rule) => declaredFontSizePx(rule[1]))
      .filter((size): size is number => size !== undefined)
    expect(sizes.length).toBeGreaterThan(0)
    expect(sizes.filter((size) => size < 16)).toEqual([])
  })

  it('lets no application shrink an editable below the Shell mobile safety size', () => {
    /*
     * Mobile Safari auto-zooms a focused editable set below 16 CSS px, which
     * changes viewport scale and geometry — the exact inputs the Shell-owned
     * editing system reads. The Shell holds that floor at the mobile/coarse
     * breakpoint, but only at `.os-shell input` specificity, so any
     * two-class application rule silently outranks it. Wallet's
     * `.dollar-form--secondary .node-input` did, at .74rem.
     *
     * A larger size is fine: only shrinking below the floor invites the zoom.
     */
    const shellFloor = shellCss.match(/@media \(max-width: 700px\), \(max-width: 900px\) and \(pointer: coarse\)\s*{[\s\S]*?\.os-shell input,[\s\S]*?{([^}]*)}/)?.[1]
    expect(shellFloor, 'the Shell mobile editable rule moved').toMatch(/font-size:\s*16px/)

    const editableClasses = new Set(applicationSources.flatMap((source) =>
      [...source.matchAll(/<(?:input|textarea)\b[^>]*className="([^"]*)"/g)]
        .flatMap((match) => match[1].split(/\s+/))
        .filter(Boolean)))
    // The classes below are what the applications actually put on an editable;
    // an empty set would make this test pass while checking nothing.
    expect(editableClasses.size).toBeGreaterThan(0)

    const tooSmall: string[] = []
    for (const [name, css] of [['apps', appsCss], ['network', networkCss], ['processes', processesCss], ['mail', mailCss], ['terminal', terminalCss], ['wallet', walletCss], ['flipper', flipperCss]] as const) {
      for (const rule of stripComments(css).matchAll(/([^{}]+){([^}]*)}/g)) {
        const [, selector, body] = rule
        // A pseudo-element is not the control itself, and the zoom decision
        // reads the control's own computed size.
        if (selector.includes('::') || !selector.includes('.')) continue
        if (![...editableClasses].some((editable) => selector.includes(`.${editable}`))) continue
        if (!outSpecifiesShellEditableRule(selector)) continue

        const size = declaredFontSizePx(body)
        if (size !== undefined && size < 16) tooSmall.push(`${name}: ${selector.trim()} → ${size}px`)
      }
    }
    expect(tooSmall).toEqual([])
  })
})

/**
 * Whether a selector outranks `.os-shell input` — one class plus one element.
 * Only such a rule can defeat the Shell's mobile editable floor.
 */
function outSpecifiesShellEditableRule(selector: string): boolean {
  const last = selector.split(',').map((part) => part.trim()).filter(Boolean)
  return last.some((part) => {
    const classes = (part.match(/[.:[]/g) ?? []).length
    const elements = (part.match(/(^|[\s>+~])[a-z]/g) ?? []).length
    return classes > 1 || (classes === 1 && elements > 1)
  })
}

/** The px a rule declares through `font-size` or the `font` shorthand, at the 16px root. */
function declaredFontSizePx(body: string): number | undefined {
  const declared = /font-size:\s*([\d.]+)(rem|px)/.exec(body) ?? /font:\s*[^;]*?\b([\d.]+)(rem|px)/.exec(body)
  if (!declared) return undefined
  return Number(declared[1]) * (declared[2] === 'rem' ? 16 : 1)
}
