import { useEffect, useState } from 'react'
import type { EditingViewportState } from './useEditingViewport'

interface DebugSnapshot {
  event: string
  timestamp: string
  eventHistory: string[]
  standaloneDisplayMode: boolean
  navigatorStandalone: boolean | 'unavailable'
  visualHeight: number | 'unavailable'
  visualOffsetTop: number | 'unavailable'
  visualScale: number | 'unavailable'
  innerHeight: number
  clientHeight: number
  scrollY: number
  cssHostHeight: string
  cssEditTop: string
  cssEditHeight: string
  appViewRect: string
  terminalInputRect: string
  activeElement: string
}

const DEBUG_EVENTS = [
  'focusin',
  'focusout',
  'selectionchange',
  'beforeinput',
  'input',
] as const

function rectSummary(element: Element | null): string {
  if (!element) return 'unavailable'
  const rect = element.getBoundingClientRect()
  return `top=${rect.top.toFixed(1)} bottom=${rect.bottom.toFixed(1)} height=${rect.height.toFixed(1)}`
}

function isDebugEnabled(): boolean {
  return new URLSearchParams(window.location.search).get('viewportDebug') === '1'
}

export function ViewportDebug({
  viewport,
}: {
  viewport: EditingViewportState
}) {
  const enabled = isDebugEnabled()
  const [snapshot, setSnapshot] = useState<DebugSnapshot | null>(null)

  useEffect(() => {
    if (!enabled) return

    const eventHistory: string[] = []
    let frame = 0
    let delayedSnapshot: ReturnType<typeof setTimeout> | undefined

    const sample = (event: string) => {
      const timestamp = new Date().toISOString()
      eventHistory.push(`${event} @ ${timestamp}`)
      if (eventHistory.length > 12) eventHistory.shift()

      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const shell = document.querySelector<HTMLElement>('.os-shell')
        const computed = shell ? getComputedStyle(shell) : null
        const visual = window.visualViewport
        const active = document.activeElement
        const navigatorWithStandalone = navigator as Navigator & {
          standalone?: boolean
        }

        setSnapshot({
          event,
          timestamp,
          eventHistory: [...eventHistory],
          standaloneDisplayMode: window.matchMedia(
            '(display-mode: standalone)',
          ).matches,
          navigatorStandalone:
            typeof navigatorWithStandalone.standalone === 'boolean'
              ? navigatorWithStandalone.standalone
              : 'unavailable',
          visualHeight: visual ? visual.height : 'unavailable',
          visualOffsetTop: visual ? visual.offsetTop : 'unavailable',
          visualScale: visual ? visual.scale : 'unavailable',
          innerHeight: window.innerHeight,
          clientHeight: document.documentElement.clientHeight,
          scrollY: window.scrollY,
          cssHostHeight:
            computed?.getPropertyValue('--node-host-height').trim() ||
            'unavailable',
          cssEditTop:
            computed?.getPropertyValue('--node-edit-top').trim() ||
            'unavailable',
          cssEditHeight:
            computed?.getPropertyValue('--node-edit-height').trim() ||
            'unavailable',
          appViewRect: rectSummary(document.querySelector('.app-view')),
          terminalInputRect: rectSummary(
            document.querySelector('.terminal-input'),
          ),
          activeElement: active
            ? `${active.tagName.toLowerCase()}${active.id ? `#${active.id}` : ''}`
            : 'none',
        })
      })
    }

    const record = (name: string) => {
      sample(name)
      clearTimeout(delayedSnapshot)
      delayedSnapshot = setTimeout(() => sample(`${name} +100ms`), 100)
    }
    const handleDocumentEvent = (event: Event) => record(event.type)
    const handleWindowResize = () => record('window.resize')
    const handleVisualResize = () => record('visualViewport.resize')
    const handleVisualScroll = () => record('visualViewport.scroll')

    DEBUG_EVENTS.forEach((event) =>
      document.addEventListener(event, handleDocumentEvent, true),
    )
    window.addEventListener('resize', handleWindowResize)
    window.visualViewport?.addEventListener('resize', handleVisualResize)
    window.visualViewport?.addEventListener('scroll', handleVisualScroll)
    sample('debug-enabled')

    return () => {
      DEBUG_EVENTS.forEach((event) =>
        document.removeEventListener(event, handleDocumentEvent, true),
      )
      window.removeEventListener('resize', handleWindowResize)
      window.visualViewport?.removeEventListener('resize', handleVisualResize)
      window.visualViewport?.removeEventListener('scroll', handleVisualScroll)
      cancelAnimationFrame(frame)
      clearTimeout(delayedSnapshot)
    }
  }, [enabled])

  if (!enabled || !snapshot) return null

  return (
    <output className="viewport-debug" aria-label="Viewport diagnostics">
      <strong>VIEWPORT DEBUG</strong>{' '}
      <span>standalone match: {String(snapshot.standaloneDisplayMode)}</span>{' '}
      <span>navigator.standalone: {String(snapshot.navigatorStandalone)}</span>{' '}
      <span>latest: {snapshot.event} @ {snapshot.timestamp}</span>{' '}
      <span>visualViewport.height: {snapshot.visualHeight}</span>{' '}
      <span>visualViewport.offsetTop: {snapshot.visualOffsetTop}</span>{' '}
      <span>visualViewport.scale: {snapshot.visualScale}</span>{' '}
      <span>window.innerHeight: {snapshot.innerHeight}</span>{' '}
      <span>documentElement.clientHeight: {snapshot.clientHeight}</span>{' '}
      <span>window.scrollY: {snapshot.scrollY}</span>{' '}
      <span>hook.hostHeight: {viewport.hostHeight}</span>{' '}
      <span>hook.editTop: {viewport.editTop}</span>{' '}
      <span>hook.editHeight: {viewport.editHeight}</span>{' '}
      <span>hook.editing: {String(viewport.editing)}</span>{' '}
      <span>CSS --node-host-height: {snapshot.cssHostHeight}</span>{' '}
      <span>CSS --node-edit-top: {snapshot.cssEditTop}</span>{' '}
      <span>CSS --node-edit-height: {snapshot.cssEditHeight}</span>{' '}
      <span>.app-view rect: {snapshot.appViewRect}</span>{' '}
      <span>.terminal-input rect: {snapshot.terminalInputRect}</span>{' '}
      <span>active element: {snapshot.activeElement}</span>{' '}
      <span>events: {snapshot.eventHistory.join(' | ')}</span>
    </output>
  )
}
