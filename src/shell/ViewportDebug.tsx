import { useEffect, useRef, useState } from 'react'
import type { EditingViewportState } from './useEditingViewport'

type EntryKind = 'RAW EVENT' | 'HOOK COMMIT'

interface BrowserSample {
  visualHeight: number | '—'
  visualOffsetTop: number | '—'
  visualScale: number | '—'
  innerHeight: number
  clientHeight: number
  scrollY: number
  activeElement: string
  target: string
  rects: Record<string, string>
}

interface TimelineEntry {
  id: number
  kind: EntryKind
  name: string
  elapsed: number
  raw: BrowserSample
  hook: EditingViewportState
}

export const VIEWPORT_DEBUG_TIMELINE_LIMIT = 20

const DOCUMENT_EVENTS = [
  'pointerdown',
  'touchstart',
  'focusin',
  'focusout',
  'selectionchange',
  'beforeinput',
  'input',
] as const

const RECTS = [
  ['app', '.app-view'],
  ['term', '.terminal'],
  ['term-in', '.terminal-input'],
  ['rack', '.rack-os'],
  ['rack-term', '.rack-terminal'],
  ['rack-out', '.rack-output'],
  ['rack-in', '.rack-terminal input[aria-label="Remote command"]'],
] as const

function elementSummary(element: Element | null): string {
  if (!element) return '—'
  const id = element.id ? `#${element.id}` : ''
  const className = element.classList.length ? `.${element.classList[0]}` : ''
  return `${element.tagName.toLowerCase()}${id}${className}`
}

function rectSummary(element: Element | null): string {
  if (!element) return '—'
  const rect = element.getBoundingClientRect()
  return `${rect.top.toFixed(0)}/${rect.bottom.toFixed(0)}/${rect.height.toFixed(0)}`
}

function browserSample(target: EventTarget | null): BrowserSample {
  const visual = window.visualViewport
  return {
    visualHeight: visual?.height ?? '—',
    visualOffsetTop: visual?.offsetTop ?? '—',
    visualScale: visual?.scale ?? '—',
    innerHeight: window.innerHeight,
    clientHeight: document.documentElement.clientHeight,
    scrollY: window.scrollY,
    activeElement: elementSummary(document.activeElement),
    target: target instanceof Element ? elementSummary(target) : '—',
    rects: Object.fromEntries(
      RECTS.map(([label, selector]) => [
        label,
        rectSummary(document.querySelector(selector)),
      ]),
    ),
  }
}

function isDebugEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('viewportDebug') === '1'
}

function compact(value: number | '—'): string {
  return typeof value === 'number' ? value.toFixed(1).replace(/\.0$/, '') : value
}

export function ViewportDebug({ viewport }: { viewport: EditingViewportState }) {
  const enabled = isDebugEnabled()
  const committedViewport = useRef(viewport)
  const startTime = useRef(0)
  const lastInteractionStart = useRef(Number.NEGATIVE_INFINITY)
  const nextId = useRef(0)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])

  const append = (
    kind: EntryKind,
    name: string,
    hook: EditingViewportState,
    target: EventTarget | null,
  ) => {
    const now = performance.now()
    if (
      kind === 'RAW EVENT' &&
      (name === 'pointerdown' || name === 'touchstart') &&
      now - lastInteractionStart.current > 250
    ) {
      startTime.current = now
      lastInteractionStart.current = now
    }
    const entry: TimelineEntry = {
      id: nextId.current++,
      kind,
      name,
      elapsed: now - startTime.current,
      raw: browserSample(target),
      hook: { ...hook },
    }
    setTimeline((entries) =>
      [...entries, entry].slice(-VIEWPORT_DEBUG_TIMELINE_LIMIT),
    )
  }

  useEffect(() => {
    if (!enabled) return
    startTime.current = performance.now()

    const handleDocumentEvent = (event: Event) =>
      append('RAW EVENT', event.type, committedViewport.current, event.target)
    const handleWindowResize = (event: Event) =>
      append('RAW EVENT', 'window.resize', committedViewport.current, event.target)
    const handleOrientation = (event: Event) =>
      append('RAW EVENT', 'orientationchange', committedViewport.current, event.target)
    const handleVisualResize = (event: Event) =>
      append('RAW EVENT', 'visualViewport.resize', committedViewport.current, event.target)
    const handleVisualScroll = (event: Event) =>
      append('RAW EVENT', 'visualViewport.scroll', committedViewport.current, event.target)

    DOCUMENT_EVENTS.forEach((name) =>
      document.addEventListener(name, handleDocumentEvent, true),
    )
    window.addEventListener('resize', handleWindowResize)
    window.addEventListener('orientationchange', handleOrientation)
    window.visualViewport?.addEventListener('resize', handleVisualResize)
    window.visualViewport?.addEventListener('scroll', handleVisualScroll)

    return () => {
      DOCUMENT_EVENTS.forEach((name) =>
        document.removeEventListener(name, handleDocumentEvent, true),
      )
      window.removeEventListener('resize', handleWindowResize)
      window.removeEventListener('orientationchange', handleOrientation)
      window.visualViewport?.removeEventListener('resize', handleVisualResize)
      window.visualViewport?.removeEventListener('scroll', handleVisualScroll)
    }
    // Instrumentation is intentionally installed only when the URL flag changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    committedViewport.current = viewport
    append('HOOK COMMIT', 'viewport', viewport, null)
    // Each viewport identity represents a committed Hook state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, viewport])

  if (!enabled || timeline.length === 0) return null

  return (
    <output className="viewport-debug" aria-label="Viewport diagnostics">
      <strong>VIEWPORT TRANSITIONS · NEWEST FIRST ({timeline.length}/{VIEWPORT_DEBUG_TIMELINE_LIMIT})</strong>
      {[...timeline].reverse().map((entry) => (
        <span className={entry.kind === 'RAW EVENT' ? 'viewport-debug-raw' : 'viewport-debug-hook'} key={entry.id}>
          <b>+{entry.elapsed.toFixed(1)}ms {entry.kind}</b> {entry.name}
          {'\n'}RAW vv={compact(entry.raw.visualHeight)}/{compact(entry.raw.visualOffsetTop)} s={compact(entry.raw.visualScale)} win={entry.raw.innerHeight}/{entry.raw.clientHeight} y={compact(entry.raw.scrollY)}
          {'\n'}HOOK host/top/h={entry.hook.hostHeight}/{entry.hook.editTop}/{entry.hook.editHeight} edit={String(entry.hook.editing)} active={entry.raw.activeElement} target={entry.raw.target}
          {'\n'}RECT {RECTS.map(([label]) => `${label}=${entry.raw.rects[label]}`).join(' ')}
        </span>
      ))}
    </output>
  )
}
