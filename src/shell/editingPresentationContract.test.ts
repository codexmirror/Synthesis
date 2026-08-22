import { describe, expect, it } from 'vitest'
import terminalSource from '../apps/terminal/Terminal.tsx?raw'
import terminalCss from '../apps/terminal/terminal.css?raw'
import css from './shell.css?raw'
import hook from './useEditingViewport.ts?raw'
import rackCss from '../apps/rackos/rackos.css?raw'
import terminalInteraction from '../apps/terminal/useTerminalInteraction.ts?raw'
import nodeCommandAdapter from '../apps/terminal/nodeCommandAdapter.ts?raw'
import shellSource from './Shell.tsx?raw'
import handoffSource from './RemoteSessionHandoff.tsx?raw'

describe('mobile editing presentation contract', () => {
  it('keeps viewport diagnostics tap-transparent and visibly translucent', () => {
    const debugRule = css.match(/\.viewport-debug\s*\{([^}]+)\}/)?.[1] ?? ''
    expect(debugRule).toMatch(/pointer-events:\s*none/)
    const opacity = Number(debugRule.match(/background:\s*rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1])
    expect(opacity).toBeLessThan(.88)
    expect(opacity).toBeGreaterThanOrEqual(.55)
  })

  it('uses presentation mapping in browser tabs and accepted geometry for standalone fixed', () => {
    expect(css).toMatch(
      /data-standalone="false"[^}]+data-editing-presentation="true"[^}]+\.app-view\s*{[^}]+position: absolute;/,
    )
    expect(css).toMatch(
      /data-standalone="true"[^}]+data-editing-geometry="true"[^}]+\.app-view\s*{[^}]+position: fixed;[^}]+inset-inline: 0;[^}]+top: var\(--node-edit-top, 0px\);[^}]+height: var\(--node-edit-height/,
    )
    expect(css).toContain('top: var(--node-presentation-top, 0px)')
    expect(css).toContain(
      'height: var(--node-presentation-height, var(--node-host-height, 100dvh))',
    )
  })

  it('does not add timer or polling state to useEditingViewport', () => {
    expect(hook).not.toContain('setInterval')
    expect(hook).not.toContain('window.scrollTo')
    // Two timer declarations and two calls are the existing focus-close and
    // orientation-rebase behavior. Diagnostics live outside this hook.
    expect(hook.match(/setTimeout/g)).toHaveLength(4)
  })

  it('keeps the remote handoff free of fake duration and viewport manipulation', () => {
    const handoffBoundary = shellSource + handoffSource
    expect(handoffBoundary).not.toMatch(/setTimeout|setInterval|visualViewport|window\.scrollTo|scrollIntoView/)
  })

  it('keeps the terminal input mounted as the final terminal grid row', () => {
    expect(terminalSource).toMatch(/<div[\s\S]*className="terminal-output"[\s\S]*<form className="terminal-input"/)
    expect(terminalSource.lastIndexOf('className="terminal-input"')).toBeGreaterThan(
      terminalSource.lastIndexOf('className="terminal-output"'),
    )
    expect(terminalCss).toMatch(/\.terminal\s*{[^}]*grid-template-rows:\s*minmax\(0, 1fr\) auto;/)
  })

  it('keeps viewport manipulation out of Terminal', () => {
    const nodeTerminalSources = terminalSource + terminalInteraction + nodeCommandAdapter
    expect(nodeTerminalSources).not.toContain('visualViewport')
    expect(nodeTerminalSources).not.toContain('window.scrollTo')
    expect(nodeTerminalSources).not.toContain('scrollIntoView')
    expect(nodeTerminalSources).not.toContain('setInterval')
    expect(nodeTerminalSources).not.toContain('SCAN_MIN_DISPLAY_MS')
    expect(nodeTerminalSources).not.toContain('waitForPresentation')
    expect(terminalSource).not.toContain('aria-live="polite"')
    expect(terminalCss).not.toContain('72px')
    expect(terminalCss).toContain('touch-action: pan-y pinch-zoom')
  })

  it('keeps wrapped NODE-OS chrome hidden and gives RACK-OS the Shell edit geometry', () => {
    expect(css).toContain('.os-shell[data-editing-presentation="true"] > .node-workspace > .status-bar')
    expect(css).toContain('.os-shell[data-editing-presentation="true"] > .node-workspace > .system-bar')
    expect(rackCss).toMatch(/data-editing-presentation="true"[^}]+\.rack-os\s*{[^}]+position: absolute;[^}]+top: var\(--node-presentation-top, 0px\);[^}]+height: var\(--node-presentation-height/)
    expect(rackCss).toMatch(/data-standalone="true"[^}]+data-editing-geometry="true"[^}]+\.rack-os\s*{[^}]+position: fixed;[^}]+inset-inline: 0;[^}]+top: var\(--node-edit-top, 0px\);[^}]+height: var\(--node-edit-height/)
    expect(shellSource + rackCss).not.toContain('data-reduced-editing-geometry')
    expect(rackCss).not.toMatch(/visualViewport|window\.scrollTo|scrollIntoView|setInterval/)
    expect(shellSource).not.toMatch(/setTimeout|setInterval|visualViewport|window\.scrollTo|scrollIntoView/)
    expect(css).toMatch(/\.os-shell input,[\s\S]*?font-size: 16px;/)
  })
})
