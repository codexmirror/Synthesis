import { describe, expect, it } from 'vitest'
import terminalSource from '../apps/terminal/Terminal.tsx?raw'
import terminalCss from '../apps/terminal/terminal.css?raw'
import css from './shell.css?raw'
import hook from './useEditingViewport.ts?raw'
import rackCss from '../apps/rackos/rackos.css?raw'
import terminalInteraction from '../apps/terminal/useTerminalInteraction.ts?raw'
import nodeCommandAdapter from '../apps/terminal/nodeCommandAdapter.ts?raw'
import rackSource from '../apps/rackos/RackOS.tsx?raw'
import shellSource from './Shell.tsx?raw'
import handoffSource from './RemoteSessionHandoff.tsx?raw'

describe('mobile editing presentation contract', () => {
  it('keeps closed viewport diagnostics to one small fixed trigger', () => {
    expect(css).toMatch(/\.viewport-debug-trigger\s*\{\s*position:\s*fixed;[^}]+padding:\s*4px;[^}]+opacity:\s*\.55/)
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
    expect(hook).toContain("shell.style.setProperty('--node-presentation-top'")
    expect(hook).toContain("shell.style.setProperty('--node-presentation-height'")
    expect(shellSource).not.toMatch(/'--node-presentation-(?:top|height)'\s*:/)
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
    // Output and prompt are placed on explicit rows so the masthead, which the
    // editing presentation hides, can never reflow them into each other.
    expect(terminalCss).toMatch(/\.terminal\s*{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/)
    expect(terminalCss).toMatch(/\.terminal-output\s*{[^}]*grid-row:\s*2;/)
    expect(terminalCss).toMatch(/\.terminal-input\s*{[^}]*grid-row:\s*3;/)
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

  it('keeps leaving editing a Shell-owned intent rather than a second editing state', () => {
    // DONE and every other Shell exit hand the intent to the one editing
    // controller instead of relying on a browser focus side effect alone.
    expect(shellSource).toContain('viewport.endEditing()')
    expect(hook).toContain('endEditingRef.current')
    // The controller may correct held intent against the browser's own focus,
    // but accepting recovered geometry still runs through the recovery gate.
    expect(hook).toContain('reconcileEditingFocusIntent')
    expect(hook).toMatch(/releaseEditingIntent[\s\S]*presentationPhase = 'recovering'/)
    // RACK-OS coordinates with that contract and owns none of it: no viewport
    // reading, no keyboard state, no timing of its own.
    expect(rackSource).toContain('editingRecoveryReady')
    expect(rackSource).not.toMatch(/visualViewport|window\.scrollTo|scrollIntoView|setInterval|setTimeout|matchMedia|requestAnimationFrame/)
    expect(rackSource).not.toMatch(/\b(keyboardOpen|isKeyboardOpen|keyboardHeight|editingActive|editingPresentation)\b/)
    expect(rackSource).not.toMatch(/--node-(edit|presentation|host)-/)
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
