import { describe, expect, it } from 'vitest'
import terminalSource from '../apps/terminal/Terminal.tsx?raw'
import terminalCss from '../apps/terminal/terminal.css?raw'
import css from './shell.css?raw'
import hook from './useEditingViewport.ts?raw'

describe('mobile editing presentation contract', () => {
  it('keeps normal editing absolute and overrides only standalone with fixed', () => {
    expect(css).toMatch(
      /@media \(max-width: 700px\)[\s\S]*?data-editing="true"[^}]+position: absolute;/,
    )
    expect(css).toMatch(
      /@media \(max-width: 700px\)[\s\S]*?data-standalone="true"[^}]+position: fixed;[^}]+top: var\(--node-edit-top, 0px\);[^}]+height: var\(--node-edit-height/,
    )
    expect(css).toContain('top: var(--node-edit-top, 0px)')
    expect(css).toContain(
      'height: var(--node-edit-height, var(--node-host-height, 100dvh))',
    )
  })

  it('does not add timer or polling state to useEditingViewport', () => {
    expect(hook).not.toContain('setInterval')
    expect(hook).not.toContain('window.scrollTo')
    // Two timer declarations and two calls are the existing focus-close and
    // orientation-rebase behavior. Diagnostics live outside this hook.
    expect(hook.match(/setTimeout/g)).toHaveLength(4)
  })

  it('keeps the terminal input mounted as the final terminal grid row', () => {
    expect(terminalSource).toMatch(/<div[\s\S]*className="terminal-output"[\s\S]*<form className="terminal-input"/)
    expect(terminalSource.lastIndexOf('className="terminal-input"')).toBeGreaterThan(
      terminalSource.lastIndexOf('className="terminal-output"'),
    )
    expect(terminalCss).toMatch(/\.terminal\s*{[^}]*grid-template-rows:\s*minmax\(0, 1fr\) auto;/)
  })

  it('keeps viewport manipulation out of Terminal', () => {
    expect(terminalSource).not.toContain('visualViewport')
    expect(terminalSource).not.toContain('window.scrollTo')
    expect(terminalSource).not.toContain('scrollIntoView')
    expect(terminalSource).not.toContain('setInterval')
  })
})
