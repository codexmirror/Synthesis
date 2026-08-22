import { type CSSProperties, type FocusEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './editingPlaneDebug.css'

type Strategy = 'fixed' | 'visual'

interface PlaneSample {
  id: number
  event: string
  planeTop: number
  planeBottom: number
  shellTop: number | '—'
  shellBottom: number | '—'
  visualHeight: number | '—'
  visualOffsetTop: number | '—'
  visualPageTop: number | '—'
  visualScale: number | '—'
  scrollY: number
}

const LOG_LIMIT = 6

function isEnabled() {
  return new URLSearchParams(window.location.search).get('editingPlaneDebug') === '1'
}

function compact(value: number | '—') {
  return typeof value === 'number' ? value.toFixed(1).replace(/\.0$/, '') : value
}

function sample(strategy: Strategy, event: string, id: number): PlaneSample | null {
  const plane = document.querySelector<HTMLElement>(`[data-editing-plane="${strategy}"]`)
  if (!plane) return null
  const planeRect = plane.getBoundingClientRect()
  const shellRect = document.querySelector<HTMLElement>('.os-shell')?.getBoundingClientRect()
  const visual = window.visualViewport

  return {
    id,
    event,
    planeTop: planeRect.top,
    planeBottom: planeRect.bottom,
    shellTop: shellRect?.top ?? '—',
    shellBottom: shellRect?.bottom ?? '—',
    visualHeight: visual?.height ?? '—',
    visualOffsetTop: visual?.offsetTop ?? '—',
    visualPageTop: visual?.pageTop ?? '—',
    visualScale: visual?.scale ?? '—',
    scrollY: window.scrollY,
  }
}

function format(entry: PlaneSample) {
  return `${entry.event} plane=${compact(entry.planeTop)}/${compact(entry.planeBottom)} shell=${compact(entry.shellTop)}/${compact(entry.shellBottom)} vv.h=${compact(entry.visualHeight)} vv.off=${compact(entry.visualOffsetTop)} vv.page=${compact(entry.visualPageTop)} vv.scale=${compact(entry.visualScale)} y=${compact(entry.scrollY)}`
}

export function EditingPlaneDebug() {
  const enabled = isEnabled()
  const nextId = useRef(0)
  const [logs, setLogs] = useState<Record<Strategy, PlaneSample[]>>({ fixed: [], visual: [] })
  const initialVisualPosition = useRef({
    left: window.visualViewport?.pageLeft ?? window.scrollX,
    top: window.visualViewport?.pageTop ?? window.scrollY,
  })

  useEffect(() => {
    if (!enabled) return

    const record = (event: string) => {
      const fixed = sample('fixed', event, nextId.current++)
      const visual = sample('visual', event, nextId.current++)
      if (fixed && visual) {
        setLogs((current) => ({
          fixed: [...current.fixed, fixed].slice(-LOG_LIMIT),
          visual: [...current.visual, visual].slice(-LOG_LIMIT),
        }))
      }
    }
    const positionFromVisualViewport = () => {
      const viewport = window.visualViewport
      const plane = document.querySelector<HTMLElement>('[data-editing-plane="visual"]')
      plane?.style.setProperty(
        '--editing-plane-left',
        `${(viewport?.pageLeft ?? window.scrollX) + 4}px`,
      )
      plane?.style.setProperty(
        '--editing-plane-top',
        `${(viewport?.pageTop ?? window.scrollY) + 164}px`,
      )
    }
    const handleDocument = (event: Event) => record(event.type)
    const handleWindowResize = () => {
      positionFromVisualViewport()
      record('window.resize')
    }
    const handleVisualResize = () => {
      positionFromVisualViewport()
      record('visualViewport.resize')
    }
    const handleVisualScroll = () => {
      positionFromVisualViewport()
      record('visualViewport.scroll')
    }

    record('mount')
    ;(['pointerdown', 'focusin', 'focusout'] as const).forEach((name) =>
      document.addEventListener(name, handleDocument, true),
    )
    window.addEventListener('resize', handleWindowResize)
    window.visualViewport?.addEventListener('resize', handleVisualResize)
    window.visualViewport?.addEventListener('scroll', handleVisualScroll)

    return () => {
      ;(['pointerdown', 'focusin', 'focusout'] as const).forEach((name) =>
        document.removeEventListener(name, handleDocument, true),
      )
      window.removeEventListener('resize', handleWindowResize)
      window.visualViewport?.removeEventListener('resize', handleVisualResize)
      window.visualViewport?.removeEventListener('scroll', handleVisualScroll)
    }
  }, [enabled])

  if (!enabled) return null

  const visualStyle = {
    '--editing-plane-left': `${initialVisualPosition.current.left + 4}px`,
    '--editing-plane-top': `${initialVisualPosition.current.top + 164}px`,
  } as CSSProperties
  const containFocusEvent = (event: FocusEvent<HTMLElement>) => event.stopPropagation()

  return createPortal(
    <>
      <aside className="editing-plane-debug editing-plane-debug--fixed" data-editing-plane="fixed" onFocusCapture={containFocusEvent} onBlurCapture={containFocusEvent}>
        <label>FIXED BODY PLANE<input aria-label="Fixed plane input" /></label>
        <output>{logs.fixed.map((entry) => <span key={entry.id}>{format(entry)}</span>)}</output>
      </aside>
      <aside className="editing-plane-debug editing-plane-debug--visual" data-editing-plane="visual" style={visualStyle} onFocusCapture={containFocusEvent} onBlurCapture={containFocusEvent}>
        <label>VISUAL VIEWPORT PLANE<input aria-label="Visual viewport plane input" /></label>
        <output>{logs.visual.map((entry) => <span key={entry.id}>{format(entry)}</span>)}</output>
      </aside>
    </>,
    document.body,
  )
}
