import type { EditingViewportState } from './useEditingViewport'

export const VIEWPORT_DIAGNOSTICS_VERSION = 2
export const VIEWPORT_DEBUG_TIMELINE_LIMIT = 280

export type ViewportDiagnosticKind = 'BROWSER' | 'CONTROLLER' | 'REACT'

export interface FocusEvidence {
  element: string
  editable: boolean
  connected: boolean
  insideShell: boolean
}

export interface ViewportDiagnosticEntry {
  id: number
  elapsed: number
  kind: ViewportDiagnosticKind
  name: string
  detail: Record<string, unknown>
}

export interface ViewportDiagnosticCapture {
  capturedAt: string
  entries: readonly ViewportDiagnosticEntry[]
  viewport: EditingViewportState
  focus: FocusEvidence
  standalone: boolean
  userAgent: string
  window: string
}

const NON_EDITABLE_INPUT_TYPES = new Set([
  'checkbox', 'radio', 'range', 'color', 'file', 'button', 'submit',
  'reset', 'image', 'hidden',
])

function isEditable(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly
  if (element instanceof HTMLInputElement) {
    return !element.disabled && !element.readOnly && !NON_EDITABLE_INPUT_TYPES.has(element.type)
  }
  return element instanceof HTMLElement && element.isContentEditable
}

function safeToken(value: string | null): string | undefined {
  if (!value) return undefined
  return value.replace(/\s+/g, ' ').slice(0, 48)
}

export function summarizeFocus(target: EventTarget | null): FocusEvidence {
  if (!(target instanceof Element)) {
    return { element: '—', editable: false, connected: false, insideShell: false }
  }
  const bits = [target.tagName.toLowerCase()]
  if (target instanceof HTMLInputElement) bits.push(`type=${target.type}`)
  const id = safeToken(target.id); if (id) bits.push(`#${id}`)
  const name = safeToken(target.getAttribute('name')); if (name) bits.push(`name=${name}`)
  const label = safeToken(target.getAttribute('aria-label')); if (label) bits.push(`aria=${label}`)
  const classes = [...target.classList].slice(0, 2).map((value) => `.${value}`).join('')
  if (classes) bits.push(classes)
  const surface = target.closest('[data-testid], main, [role="dialog"]')
  if (surface && surface !== target) {
    const identifier = safeToken(surface.getAttribute('data-testid')) || surface.tagName.toLowerCase()
    bits.push(`surface=${identifier}`)
  }
  return {
    element: bits.join(' '),
    editable: isEditable(target),
    connected: target.isConnected,
    insideShell: Boolean(target.closest('.os-shell')),
  }
}

function compactDetail(detail: Record<string, unknown>): string {
  return Object.entries(detail)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' ')
}

export class ViewportDiagnosticsRecorder {
  private entries: ViewportDiagnosticEntry[] = []
  private nextId = 1
  private readonly started = performance.now()

  record(kind: ViewportDiagnosticKind, name: string, detail: Record<string, unknown> = {}) {
    this.entries.push({ id: this.nextId++, elapsed: performance.now() - this.started, kind, name, detail })
    if (this.entries.length > VIEWPORT_DEBUG_TIMELINE_LIMIT) this.entries.splice(0, this.entries.length - VIEWPORT_DEBUG_TIMELINE_LIMIT)
  }

  snapshot() { return [...this.entries] }

  freeze(viewport: EditingViewportState, standalone: boolean): ViewportDiagnosticCapture {
    const viewportApi = window.visualViewport
    return Object.freeze({
      capturedAt: new Date().toISOString(),
      entries: Object.freeze(this.entries.map((entry) => Object.freeze({ ...entry, detail: Object.freeze({ ...entry.detail }) }))),
      viewport: Object.freeze({ ...viewport }),
      focus: Object.freeze(summarizeFocus(document.activeElement)),
      standalone,
      userAgent: navigator.userAgent,
      window: `inner=${window.innerWidth}x${window.innerHeight} clientH=${document.documentElement.clientHeight} scrollY=${window.scrollY} vv=${viewportApi ? `${viewportApi.width}x${viewportApi.height}@${viewportApi.offsetTop}/${viewportApi.pageTop} scale=${viewportApi.scale}` : '—'}`,
    })
  }
}

export function viewportDiagnosticsEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('viewportDebug') === '1'
}

export function createViewportDiagnostics(): ViewportDiagnosticsRecorder | undefined {
  return viewportDiagnosticsEnabled() ? new ViewportDiagnosticsRecorder() : undefined
}

export function exportViewportDiagnosticCapture(capture: ViewportDiagnosticCapture): string {
  const focus = capture.focus
  const lines = [
    `SYNTHESIS MOBILE EDITING DIAGNOSTICS V${VIEWPORT_DIAGNOSTICS_VERSION}`,
    `captured=${capture.capturedAt} presentation=${capture.standalone ? 'standalone' : 'browser-tab'}`,
    `window ${capture.window}`,
    `focus ${focus.element} connected=${focus.connected} editable=${focus.editable} shell=${focus.insideShell}`,
    `userAgent=${capture.userAgent}`,
    'TRACE',
    ...capture.entries.map((entry) =>
      `${String(entry.id).padStart(4, '0')} +${entry.elapsed.toFixed(1)}ms ${entry.kind} ${entry.name}${Object.keys(entry.detail).length ? ` ${compactDetail(entry.detail)}` : ''}`,
    ),
  ]
  return lines.join('\n')
}
