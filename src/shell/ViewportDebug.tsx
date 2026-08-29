import { useEffect, useState } from 'react'
import type { EditingViewportState } from './useEditingViewport'
import {
  exportViewportDiagnosticCapture,
  summarizeFocus,
  type ViewportDiagnosticCapture,
  type ViewportDiagnosticEntry,
  type ViewportDiagnosticsRecorder,
} from './viewportDiagnostics'

const DOCUMENT_EVENTS = ['pointerdown', 'touchstart', 'focusin', 'focusout', 'selectionchange'] as const

function browserDetail(event: Event | null) {
  const visual = window.visualViewport
  return {
    active: summarizeFocus(document.activeElement),
    target: summarizeFocus(event?.target ?? null),
    relatedTarget: summarizeFocus(event instanceof FocusEvent ? event.relatedTarget : null),
    vv: visual ? `${visual.height}/${visual.offsetTop}/${visual.pageTop}/${visual.pageLeft}@${visual.scale}` : '—',
    window: `${window.innerHeight}/${document.documentElement.clientHeight}/${window.scrollY}`,
    visibility: document.visibilityState,
  }
}

function meaningful(entries: readonly ViewportDiagnosticEntry[]) {
  return entries.filter((entry) => entry.kind !== 'REACT' || entry.name !== 'VIEWPORT COMMIT').slice(-24)
}

function latestBlocker(entries: readonly ViewportDiagnosticEntry[]) {
  return [...entries].reverse().find((entry) => entry.name === 'RECOVERY BLOCKED')
}

export function ViewportDebug({ viewport, diagnostics, standalone }: {
  viewport: EditingViewportState
  diagnostics?: ViewportDiagnosticsRecorder
  standalone?: boolean
}) {
  const [capture, setCapture] = useState<ViewportDiagnosticCapture>()

  useEffect(() => {
    if (!diagnostics) return
    const record = (name: string, event: Event) => diagnostics.record('BROWSER', name, browserDetail(event))
    const documentHandlers = DOCUMENT_EVENTS.map((name) => {
      const handler = (event: Event) => record(name, event)
      document.addEventListener(name, handler, true)
      return [name, handler] as const
    })
    const windowEvents = ['resize', 'scroll', 'orientationchange', 'pagehide', 'pageshow'] as const
    const windowHandlers = windowEvents.map((name) => {
      const handler = (event: Event) => record(name, event)
      window.addEventListener(name, handler, true)
      return [name, handler] as const
    })
    const visibility = (event: Event) => record('visibilitychange', event)
    document.addEventListener('visibilitychange', visibility, true)
    const visualEvents = ['resize', 'scroll', 'scrollend'] as const
    const visualHandlers = visualEvents.map((name) => {
      const handler = (event: Event) => record(`visualViewport.${name}`, event)
      window.visualViewport?.addEventListener(name, handler)
      return [name, handler] as const
    })
    diagnostics.record('BROWSER', 'DIAGNOSTICS START', browserDetail(null))
    return () => {
      documentHandlers.forEach(([name, handler]) => document.removeEventListener(name, handler, true))
      windowHandlers.forEach(([name, handler]) => window.removeEventListener(name, handler, true))
      document.removeEventListener('visibilitychange', visibility, true)
      visualHandlers.forEach(([name, handler]) => window.visualViewport?.removeEventListener(name, handler))
    }
  }, [diagnostics])

  useEffect(() => {
    diagnostics?.record('REACT', 'VIEWPORT COMMIT', { ...viewport })
  }, [diagnostics, viewport])

  if (!diagnostics) return null

  const openCapture = () => {
    // Freeze synchronously in pointer-down, before the button can move focus or
    // opening the panel can produce browser/React diagnostic activity.
    if (!capture) setCapture(diagnostics.freeze(viewport, Boolean(standalone)))
  }
  if (!capture) {
    return <button type="button" className="viewport-debug-trigger" onPointerDown={openCapture} aria-label="Freeze viewport diagnostics">DBG</button>
  }

  const blocker = latestBlocker(capture.entries)
  return (
    <section className="viewport-debug" aria-label="Viewport diagnostics">
      <header><strong>MOBILE EDITING DIAGNOSTICS V2</strong></header>
      <h2>CURRENT</h2>
      <p>presentation={capture.viewport.presentationPhase} lifecycle={capture.viewport.viewportLifecycle} geometry={capture.viewport.editing ? 'editing' : 'normal'} ready={String(capture.viewport.recoveryReady)}</p>
      <p>focus={capture.focus.element} connected={String(capture.focus.connected)} editable={String(capture.focus.editable)} shell={String(capture.focus.insideShell)}</p>
      <h2>BLOCKED BY</h2>
      <p>{blocker ? `${blocker.detail.reason ?? 'unknown'} (${blocker.detail.detail ?? ''})` : 'No explicit recovery blocker recorded.'}</p>
      <h2>RECENT</h2>
      <ol>{meaningful(capture.entries).map((entry) => <li key={entry.id}>+{entry.elapsed.toFixed(0)} {entry.kind} {entry.name} {String(entry.detail.reason ?? '')}</li>)}</ol>
      <footer>
        <button type="button" onClick={() => navigator.clipboard.writeText(exportViewportDiagnosticCapture(capture))}>COPY TRACE</button>
        <button type="button" onClick={() => setCapture(undefined)}>RESUME</button>
      </footer>
    </section>
  )
}
