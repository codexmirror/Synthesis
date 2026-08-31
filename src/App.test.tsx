import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { GameProvider, useGameState } from './app/GameContext'
import { Shell } from './shell/Shell'
import { ViewportDebug } from './shell/ViewportDebug'
import {
  VIEWPORT_DEBUG_TIMELINE_LIMIT,
  ViewportDiagnosticsRecorder,
  exportViewportDiagnosticCapture,
  summarizeFocus,
} from './shell/viewportDiagnostics'
import { useEditingViewport, type EditingViewportState } from './shell/useEditingViewport'
import { connectRemoteFromObservation } from './core/game/remoteSession'
import { createInitialGameState } from './core/game/initialState'
import { RACK_OS_FIRMWARE_ID } from './core/game/firmwareIdentity'
import type { FileTransfer, GameState } from './core/game/types'

function withActiveTransfer(direction: 'download' | 'upload', base: GameState = createInitialGameState()): GameState {
  const localDeviceId = base.player.localDevice.id
  const sourceFileId = direction === 'download'
    ? 'file-0002'
    : base.player.localDevice.filesystem.files[1].id
  const transfer: FileTransfer = {
    id: 'transfer-0001',
    origin: 'device_access',
    accessId: 'access-0001',
    sourceDeviceId: direction === 'download' ? 'host-lan-001' : localDeviceId,
    sourceFileId,
    destinationDeviceId: direction === 'download' ? localDeviceId : 'host-lan-001',
    destinationPath: direction === 'download' ? '/home/user/downloads/nodescan-exp-1.1.pkg' : '/home/user/node-miner-1.0.pkg',
    bytesTotal: 18_400_000,
    bytesTransferred: 4_600_000,
  }
  return {
    ...base,
    deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: localDeviceId, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
    fileTransfer: { nextId: 2, active: transfer },
  }
}

function viewportState(
  overrides: Partial<EditingViewportState> = {},
): EditingViewportState {
  return {
    hostHeight: 844, editTop: 0, editHeight: 844, editing: false,
    editingPresentation: false, presentationPhase: 'normal',
    targetViewportTop: 0, shellTop: 0, shellBottom: 844,
    presentationTop: 0, presentationHeight: 844, recoveryReady: true,
    viewportLifecycle: 'active',
    ...overrides,
  }
}

function EditingViewportHarness({ standalone = true }: { standalone?: boolean }) {
  const shellRef = useRef<HTMLDivElement>(null)
  const viewport = useEditingViewport({ shellRef, standalone })
  return (
    <div
      ref={shellRef}
      data-testid="editing-viewport-harness"
      data-host-height={viewport.hostHeight}
      data-edit-height={viewport.editHeight}
      data-editing={String(viewport.editing)}
      data-phase={viewport.presentationPhase}
      data-ready={String(viewport.recoveryReady)}
    >
      <input aria-label="Neutral Shell editor" />
    </div>
  )
}

class ViewportStub extends EventTarget {
  height = 844
  width = 390
  offsetTop = 0
  scale = 1
  offsetLeft = 0
  pageLeft = 0
  pageTop = 0
  onresize = null
  onscroll = null
}

class MediaQueryStub extends EventTarget {
  media = ''
  onchange = null

  constructor(public matches: boolean) {
    super()
  }

  addListener(listener: (event: MediaQueryListEvent) => void) {
    this.addEventListener('change', listener as EventListener)
  }

  removeListener(listener: (event: MediaQueryListEvent) => void) {
    this.removeEventListener('change', listener as EventListener)
  }

  dispatchEvent(event: Event): boolean {
    return super.dispatchEvent(event)
  }
}

const originalViewport = window.visualViewport
const originalMatchMedia = window.matchMedia
const originalInnerHeight = window.innerHeight
const originalInnerWidth = window.innerWidth
const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY')
const originalClientHeight = Object.getOwnPropertyDescriptor(
  document.documentElement,
  'clientHeight',
)
const originalNavigatorStandalone = Object.getOwnPropertyDescriptor(
  navigator,
  'standalone',
)
const originalUrl = window.location.href
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

const EDITING_PRESENTATION_QUERY =
  '(max-width: 700px), (max-width: 900px) and (pointer: coarse)'

interface MediaQueryMatches {
  editingPresentation?: boolean
  standalonePresentation?: boolean
}

function installViewport(viewport?: ViewportStub) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  })
}

function installMediaQueries({
  editingPresentation = true,
  standalonePresentation = false,
}: MediaQueryMatches = {}) {
  const editingQuery = new MediaQueryStub(editingPresentation)
  editingQuery.media = EDITING_PRESENTATION_QUERY
  const standaloneQuery = new MediaQueryStub(standalonePresentation)
  standaloneQuery.media = '(display-mode: standalone)'
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => {
      if (query === EDITING_PRESENTATION_QUERY) return editingQuery
      if (query === '(display-mode: standalone)') return standaloneQuery
      const unmatched = new MediaQueryStub(false)
      unmatched.media = query
      return unmatched
    }),
  })
  return { editingQuery, standaloneQuery }
}

function installEditingPresentation(matches = true) {
  return installMediaQueries({ editingPresentation: matches }).editingQuery
}

function setNavigatorStandalone(value: boolean | undefined) {
  if (value === undefined) {
    Reflect.deleteProperty(navigator, 'standalone')
    return
  }
  Object.defineProperty(navigator, 'standalone', {
    configurable: true,
    value,
  })
}

async function updateViewport(
  viewport: ViewportStub,
  values: Partial<Pick<ViewportStub, 'height' | 'width' | 'offsetTop' | 'scale'>>,
  event: 'resize' | 'scroll' = 'resize',
) {
  Object.assign(viewport, values)
  act(() => viewport.dispatchEvent(new Event(event)))
  await new Promise((resolve) => requestAnimationFrame(resolve))
  // The editing controller may take two bounded follow-up sensor samples when
  // an otherwise coherent reduced viewport has only weak corroboration.
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))
}

function dispatchTouch(
  target: EventTarget,
  type: 'touchstart' | 'touchmove',
  clientX: number,
  clientY: number,
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: [{ clientX, clientY }],
  })
  return target.dispatchEvent(event)
}

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: originalViewport,
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: originalInnerHeight,
  })
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: originalInnerWidth,
  })
  if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY)
  else Reflect.deleteProperty(window, 'scrollY')
  if (originalClientHeight) {
    Object.defineProperty(
      document.documentElement,
      'clientHeight',
      originalClientHeight,
    )
  } else {
    Reflect.deleteProperty(document.documentElement, 'clientHeight')
  }
  if (originalNavigatorStandalone) {
    Object.defineProperty(
      navigator,
      'standalone',
      originalNavigatorStandalone,
    )
  } else {
    Reflect.deleteProperty(navigator, 'standalone')
  }
  window.history.replaceState(null, '', originalUrl)
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
  // Only ever an own shadowing property installed by a focus-loss simulation.
  Reflect.deleteProperty(document, 'activeElement')
})

function StateSnapshot() {
  const state = useGameState()
  return <output data-testid="state-snapshot">{JSON.stringify(state)}</output>
}

/** An entered-Session world: one accessed represented host, connected. */
function remoteConnectedState(): GameState {
  const base = createInitialGameState()
  const target = base.world.network.hosts[0]
  const accessed: GameState = {
    ...base,
    world: { network: { ...base.world.network, hosts: [{
      ...target,
      displayName: 'truth-server',
      firmware: { id: RACK_OS_FIRMWARE_ID, name: 'TRUTH-OS', version: '2.4' },
    }, ...base.world.network.hosts.slice(1)] } },
    deviceAccess: { nextId: 2, established: [{
      id: 'access-truth', sourceDeviceId: base.player.localDevice.id,
      targetDeviceId: target.id, viaServiceId: 'service-ssh-001', privilege: 'USER',
    }] },
  }
  return connectRemoteFromObservation(accessed, {
    targetDeviceId: target.id, address: '198.51.100.47',
  }).state
}

async function openTerminal() {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: /open terminal/i }))
  return {
    user,
    input: screen.getByLabelText('Command input'),
    shell: screen.getByTestId('os-shell'),
  }
}

async function command(name: string) {
  const { user, input } = await openTerminal()
  await user.type(input, `${name}{enter}`)
  return user
}

describe('standalone presentation contract', () => {
  it('marks normal Safari as non-standalone', () => {
    installMediaQueries({ standalonePresentation: false })
    setNavigatorStandalone(undefined)

    render(<GameProvider><Shell /></GameProvider>)

    expect(screen.getByTestId('os-shell')).toHaveAttribute(
      'data-standalone',
      'false',
    )
  })

  it('recognizes the iOS Home-Screen capability signal', () => {
    installMediaQueries({ standalonePresentation: false })
    setNavigatorStandalone(true)

    render(<GameProvider><Shell /></GameProvider>)

    expect(screen.getByTestId('os-shell')).toHaveAttribute(
      'data-standalone',
      'true',
    )
  })

  it('recognizes standards-based standalone presentation', () => {
    installMediaQueries({ standalonePresentation: true })
    setNavigatorStandalone(false)

    render(<GameProvider><Shell /></GameProvider>)

    expect(screen.getByTestId('os-shell')).toHaveAttribute(
      'data-standalone',
      'true',
    )
  })

  it('does not install viewport diagnostics without the query flag', () => {
    installMediaQueries()
    render(
      <ViewportDebug
        viewport={viewportState({
          hostHeight: 844,
          editTop: 0,
          editHeight: 844,
          editing: false,
        })}
      />,
    )
    act(() => document.dispatchEvent(new Event('selectionchange')))
    expect(screen.queryByLabelText('Viewport diagnostics')).not.toBeInTheDocument()
  })

  it('records browser lifecycle events in the background and freezes before panel activity', async () => {
    installMediaQueries()
    window.history.replaceState(null, '', '/?viewportDebug=1')
    const viewport = new ViewportStub()
    viewport.height = 455
    viewport.offsetTop = 0
    viewport.pageTop = 320
    viewport.pageLeft = 17
    viewport.scale = 1.25
    installViewport(viewport)
    const scrollY = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(291)

    const recorder = new ViewportDiagnosticsRecorder()
    const layoutRead = vi.spyOn(Element.prototype, 'getBoundingClientRect')
    render(
      <ViewportDebug diagnostics={recorder} viewport={viewportState({
        hostHeight: 775,
        editTop: 0,
        editHeight: 455,
        editing: true,
      })} />,
    )
    act(() => viewport.dispatchEvent(new Event('resize')))
    act(() => viewport.dispatchEvent(new Event('scrollend')))
    act(() => window.dispatchEvent(new Event('pagehide')))
    const before = recorder.snapshot().length
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Freeze viewport diagnostics' }))
    const diagnostics = await screen.findByLabelText('Viewport diagnostics')
    expect(diagnostics).toHaveTextContent('MOBILE EDITING DIAGNOSTICS V2')
    expect(recorder.snapshot().some((entry) => entry.name === 'visualViewport.scrollend')).toBe(true)
    expect(recorder.snapshot().some((entry) => entry.name === 'pagehide')).toBe(true)
    expect(diagnostics.querySelectorAll('li').length).toBeLessThanOrEqual(before)
    expect(layoutRead).not.toHaveBeenCalled()
    layoutRead.mockRestore()
    scrollY.mockRestore()
  })

  it('records structural focus relatedTarget evidence without values or layout reads', () => {
    installMediaQueries()
    const recorder = new ViewportDiagnosticsRecorder()
    const layoutRead = vi.spyOn(Element.prototype, 'getBoundingClientRect')
    render(
      <div className="os-shell">
        <input aria-label="First editor" defaultValue="private first value" />
        <textarea aria-label="Second editor" defaultValue="private second value" />
        <ViewportDebug diagnostics={recorder} viewport={viewportState()} />
      </div>,
    )
    const first = screen.getByLabelText('First editor')
    const second = screen.getByLabelText('Second editor')
    act(() => first.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: second })))
    act(() => first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: second })))

    const focusEntries = recorder.snapshot().filter((entry) => entry.name === 'focusin' || entry.name === 'focusout')
    expect(focusEntries).toHaveLength(2)
    expect(focusEntries[0].detail.relatedTarget).toMatchObject({
      element: expect.stringContaining('textarea'),
      editable: true,
      connected: true,
      insideShell: true,
    })
    expect(JSON.stringify(focusEntries)).not.toContain('private first value')
    expect(JSON.stringify(focusEntries)).not.toContain('private second value')
    expect(layoutRead).not.toHaveBeenCalled()
    layoutRead.mockRestore()
  })

  it('keeps a bounded long-lived chronological trace across interactions', () => {
    installMediaQueries()
    window.history.replaceState(null, '', '/?viewportDebug=1')
    let now = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
    const recorder = new ViewportDiagnosticsRecorder()
    for (let index = 0; index < VIEWPORT_DEBUG_TIMELINE_LIMIT + 5; index += 1) {
      now = index
      recorder.record(index % 2 ? 'BROWSER' : 'CONTROLLER', index === 3 ? 'pointerdown' : `event-${index}`)
    }
    const entries = recorder.snapshot()
    expect(entries).toHaveLength(VIEWPORT_DEBUG_TIMELINE_LIMIT)
    expect(entries[0].id).toBe(6)
    expect(entries.map((entry) => entry.kind)).toContain('BROWSER')
    expect(entries.map((entry) => entry.kind)).toContain('CONTROLLER')
    clock.mockRestore()
  })

  it('freezes immutably, exports privacy-safe focus structure, and resumes for another capture', async () => {
    installMediaQueries()
    window.history.replaceState(null, '', '/?viewportDebug=1')
    const recorder = new ViewportDiagnosticsRecorder()
    recorder.record('CONTROLLER', 'RECOVERY BLOCKED', { reason: 'shell-displacement' })
    const input = document.createElement('input')
    input.value = 'never export me'
    input.name = 'account'
    input.setAttribute('aria-label', 'Safe label')
    document.body.append(input); input.focus()
    expect(summarizeFocus(input)).toMatchObject({ editable: true, connected: true, insideShell: false })
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<ViewportDebug diagnostics={recorder} viewport={viewportState({ presentationPhase: 'recovering', recoveryReady: false })} />)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Freeze viewport diagnostics' }))
    expect(await screen.findByLabelText('Viewport diagnostics')).toHaveTextContent('shell-displacement')
    recorder.record('BROWSER', 'AFTER FREEZE')
    await userEvent.click(screen.getByRole('button', { name: 'COPY TRACE' }))
    const exported = writeText.mock.calls[0][0] as string
    expect(exported).toContain('CONTROLLER RECOVERY BLOCKED')
    expect(exported).not.toContain('AFTER FREEZE')
    expect(exported).not.toContain('never export me')
    await userEvent.click(screen.getByRole('button', { name: 'RESUME' }))
    expect(screen.getByRole('button', { name: 'Freeze viewport diagnostics' })).toBeInTheDocument()
    const later = recorder.freeze(viewportState(), false)
    expect(exportViewportDiagnosticCapture(later)).toContain('AFTER FREEZE')
    input.remove()
  })
})

describe('dedicated editing viewport', () => {
  it('rebases a stable idle normal viewport before editing and recovers to it', async () => {
    const viewport = new ViewportStub()
    viewport.height = 910
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 910 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 910 })
    let scrollY = 0
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
    render(<EditingViewportHarness />)
    const harness = screen.getByTestId('editing-viewport-harness')
    const input = screen.getByLabelText('Neutral Shell editor')

    // Standalone settles to a different, internally coherent normal viewport
    // before any editing interaction. Its lack of position movement makes it a
    // weak candidate relative to NORMAL A, so bounded confirmation must rebase it.
    viewport.height = 846
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 846 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 846 })
    await updateViewport(viewport, {})
    expect(harness).toHaveAttribute('data-host-height', '846')
    expect(harness).toHaveAttribute('data-edit-height', '846')
    expect(harness).toHaveAttribute('data-editing', 'false')
    expect(harness).toHaveAttribute('data-phase', 'normal')
    expect(harness).toHaveAttribute('data-ready', 'true')

    act(() => input.focus())
    viewport.height = 492
    viewport.offsetTop = viewport.pageTop = 354
    scrollY = 354
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 492 })
    await updateViewport(viewport, {})
    expect(harness).toHaveAttribute('data-host-height', '846')
    expect(harness).toHaveAttribute('data-edit-height', '492')
    expect(harness).toHaveAttribute('data-editing', 'true')
    expect(harness).toHaveAttribute('data-phase', 'editing')
    expect(harness).toHaveAttribute('data-ready', 'false')

    act(() => input.blur())
    await Promise.resolve()
    viewport.height = 846
    viewport.offsetTop = viewport.pageTop = 0
    scrollY = 0
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 846 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 846 })
    await updateViewport(viewport, {})
    expect(harness).toHaveAttribute('data-host-height', '846')
    expect(harness).toHaveAttribute('data-edit-height', '846')
    expect(harness).toHaveAttribute('data-editing', 'false')
    expect(harness).toHaveAttribute('data-phase', 'normal')
    expect(harness).toHaveAttribute('data-ready', 'true')
  })

  it('does not rebase a stable weak candidate to normal while an editable is focused and opening', async () => {
    const viewport = new ViewportStub()
    viewport.height = 844
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 844 })
    render(<EditingViewportHarness />)
    const harness = screen.getByTestId('editing-viewport-harness')
    const input = screen.getByLabelText('Neutral Shell editor')

    // Focus keeps the controller on the opening path (phase !== 'normal'), so
    // even a stable weak candidate with no position movement can never take
    // the idle normal-rebase branch, which requires phase === 'normal'.
    act(() => input.focus())
    viewport.height = 780
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 780 })
    await updateViewport(viewport, {})

    expect(harness).toHaveAttribute('data-host-height', '844')
    expect(harness).toHaveAttribute('data-editing', 'true')
    expect(harness).toHaveAttribute('data-phase', 'editing')
    expect(harness).toHaveAttribute('data-ready', 'false')
  })

  it('does not normalize a coherent keyboard-like shrink while an editable is focused', async () => {
    const viewport = new ViewportStub()
    viewport.height = 844
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 844 })
    let scrollY = 0
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
    render(<EditingViewportHarness />)
    const harness = screen.getByTestId('editing-viewport-harness')
    const input = screen.getByLabelText('Neutral Shell editor')

    // A valid normal viewport is accepted first, then the editable is focused
    // and a coherent reduced viewport (position sensors moved, resembling a
    // keyboard opening) is presented. The bounded confirmation flow may
    // legitimately accept this as editing geometry, but it must never publish
    // it as a new normal baseline.
    act(() => input.focus())
    viewport.height = 480
    viewport.offsetTop = viewport.pageTop = 364
    scrollY = 364
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 480 })
    await updateViewport(viewport, {})

    expect(harness).toHaveAttribute('data-editing', 'true')
    expect(harness).not.toHaveAttribute('data-editing', 'false')
    expect(harness).toHaveAttribute('data-host-height', '844')
    expect(harness).toHaveAttribute('data-ready', 'false')
  })

  it('ignores editable focus outside the Shell-owned boundary', () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    render(<><input aria-label="External editor" /><App /></>)

    fireEvent.focus(screen.getByLabelText('External editor'))

    expect(screen.getByTestId('os-shell')).toHaveAttribute('data-editing-presentation', 'false')
  })

  it('holds a split Safari observation until position sensors become coherent', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 775 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    const { user, input, shell } = await openTerminal()
    let shellTop = 0
    vi.spyOn(shell, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: shellTop, top: shellTop, bottom: shellTop + 775, left: 0, right: 390,
      width: 390, height: 775, toJSON: () => ({}),
    }))
    const originalInput = input
    await user.click(input)
    expect(shell).toHaveAttribute('data-editing-presentation', 'true')

    viewport.height = 455
    shellTop = -320
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 455 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 320 })
    act(() => viewport.dispatchEvent(new Event('resize')))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    expect(shell).toHaveAttribute('data-editing-presentation', 'true')
    expect(shell).toHaveStyle({ '--node-edit-height': '775px', '--node-edit-top': '0px' })
    expect(shell).toHaveStyle({ '--node-presentation-top': '320px', '--node-presentation-height': '455px' })
    expect(screen.getByLabelText('Command input')).toBe(originalInput)

    viewport.offsetTop = viewport.pageTop = 320
    await updateViewport(viewport, {})
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveStyle({ '--node-edit-height': '455px', '--node-edit-top': '320px' })
    expect(shell).toHaveStyle({ '--node-presentation-top': '320px', '--node-presentation-height': '455px' })
    expect(screen.getByLabelText('Command input')).toBe(originalInput)
  })

  it('maps browser-tab opening synchronously before the geometry frame', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    const { input, shell } = await openTerminal()
    let shellTop = 0
    vi.spyOn(shell, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: shellTop, top: shellTop, bottom: shellTop + 775, left: 0, right: 390,
      width: 390, height: 775, toJSON: () => ({}),
    }))
    const queuedFrames: FrameRequestCallback[] = []
    const animationFrame = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      queuedFrames.push(callback)
      return queuedFrames.length
    })
    act(() => input.focus())
    shellTop = -320
    viewport.height = 455
    act(() => viewport.dispatchEvent(new Event('resize')))

    expect(queuedFrames).toHaveLength(1)
    expect(shell).toHaveStyle({ '--node-presentation-top': '320px', '--node-presentation-height': '455px' })
    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    expect(shellTop + Number(shell.style.getPropertyValue('--node-presentation-top').replace('px', ''))).toBe(0)
    animationFrame.mockRestore()
  })

  it('maps browser-tab closing synchronously before the recovery geometry frame', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    const { input, shell } = await openTerminal()
    let shellTop = 0
    vi.spyOn(shell, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: shellTop, top: shellTop, bottom: shellTop + 775, left: 0, right: 390,
      width: 390, height: 775, toJSON: () => ({}),
    }))
    act(() => input.focus())
    shellTop = -320
    viewport.height = 455
    viewport.offsetTop = viewport.pageTop = 320
    await updateViewport(viewport, {})
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')

    act(() => input.blur())
    await Promise.resolve()
    shellTop = 0
    viewport.height = 775
    viewport.offsetTop = viewport.pageTop = 0
    act(() => viewport.dispatchEvent(new Event('resize')))

    expect(shell).toHaveStyle({ '--node-presentation-top': '0px', '--node-presentation-height': '455px' })
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
  })

  it('holds a Chrome height-only candidate before accepting coherent sensors', async () => {
    const viewport = new ViewportStub()
    viewport.height = 745
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 745 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 745 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    const { user, input, shell } = await openTerminal()
    let shellTop = 0
    vi.spyOn(shell, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: shellTop, top: shellTop, bottom: shellTop + 745, left: 0, right: 390,
      width: 390, height: 745, toJSON: () => ({}),
    }))
    await user.click(input)
    viewport.height = 437
    shellTop = -308
    act(() => viewport.dispatchEvent(new Event('resize')))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    expect(shell).toHaveStyle({ '--node-presentation-top': '308px', '--node-presentation-height': '437px' })

    viewport.offsetTop = viewport.pageTop = 308
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 437 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 308 })
    await updateViewport(viewport, {})
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveStyle({ '--node-edit-height': '437px', '--node-edit-top': '308px' })
    expect(shell).toHaveStyle({ '--node-presentation-top': '308px', '--node-presentation-height': '437px' })
  })

  it('holds a partial close and accepts coherent recovery at a new position', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 775 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    const { user, input, shell } = await openTerminal()
    await user.click(input)

    viewport.height = 455
    viewport.offsetTop = viewport.pageTop = 320
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 455 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 320 })
    await updateViewport(viewport, {})
    expect(shell).toHaveStyle({ '--node-edit-height': '455px', '--node-edit-top': '320px' })
    fireEvent.blur(input)

    viewport.height = 775
    act(() => viewport.dispatchEvent(new Event('resize')))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveStyle({ '--node-edit-height': '455px', '--node-edit-top': '320px' })

    viewport.offsetTop = viewport.pageTop = 40
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 40 })
    await updateViewport(viewport, {})
    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    expect(shell).toHaveStyle({ '--node-host-height': '815px', '--node-edit-height': '815px' })
  })

  it('keeps recovering presentation mapped until accepted normal geometry and Shell displacement both recover', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 775 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    const { user, input, shell } = await openTerminal()
    let shellTop = 0
    vi.spyOn(shell, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: shellTop, top: shellTop, bottom: shellTop + 775, left: 0, right: 390,
      width: 390, height: 775, toJSON: () => ({}),
    }))
    await user.click(input)

    shellTop = -320
    viewport.height = 455
    viewport.offsetTop = viewport.pageTop = 320
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 455 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 320 })
    await updateViewport(viewport, {})
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')

    act(() => input.blur())
    await Promise.resolve()
    shellTop = -120
    viewport.height = 775
    viewport.offsetTop = viewport.pageTop = 0
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    await updateViewport(viewport, {})

    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    expect(shell).toHaveAttribute('data-editing-presentation', 'true')
    expect(shell).toHaveAttribute('data-editing-phase', 'recovering')
    expect(shell).toHaveAttribute('data-recovery-ready', 'false')
    expect(shell).toHaveStyle({ '--node-presentation-top': '120px', '--node-presentation-height': '655px' })
    expect(screen.getByText('EDITING')).toBeInTheDocument()

    shellTop = 0
    act(() => window.dispatchEvent(new Event('scroll')))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(shell).toHaveAttribute('data-editing-presentation', 'false')
    expect(shell).toHaveAttribute('data-editing-phase', 'normal')
    expect(shell).toHaveAttribute('data-recovery-ready', 'true')
    expect(shell.style.getPropertyValue('--node-presentation-top')).toBe('')
    expect(shell.style.getPropertyValue('--node-presentation-height')).toBe('')
    expect(screen.queryByText('EDITING')).not.toBeInTheDocument()
  })

  it('rearms Safari geometry acquisition on resume without collapsing same-focus editing', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 775 })
    let scrollY = 0
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
    const { user, input, shell } = await openTerminal()
    let shellTop = 0
    vi.spyOn(shell, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: shellTop, top: shellTop, bottom: shellTop + 775, left: 0, right: 390,
      width: 390, height: 775, toJSON: () => ({}),
    }))
    const originalInput = input
    await user.click(input)
    shellTop = -320
    scrollY = 320
    viewport.height = 455
    viewport.offsetTop = viewport.pageTop = 320
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 455 })
    await updateViewport(viewport, {})
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')

    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(shell).toHaveAttribute('data-viewport-lifecycle', 'suspended')

    shellTop = 0
    scrollY = 0
    viewport.height = 775
    viewport.offsetTop = viewport.pageTop = 0
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    act(() => window.dispatchEvent(new Event('pageshow')))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(document.activeElement).toBe(originalInput)
    expect(screen.getByLabelText('Command input')).toBe(originalInput)
    expect(shell).toHaveAttribute('data-viewport-lifecycle', 'resume-acquisition')
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveAttribute('data-editing-presentation', 'true')
    expect(shell).toHaveAttribute('data-recovery-ready', 'false')
    expect(shell).toHaveStyle({ '--node-presentation-height': '455px' })

    shellTop = -320
    scrollY = 320
    viewport.height = 455
    act(() => viewport.dispatchEvent(new Event('resize')))
    expect(shell).toHaveStyle({ '--node-presentation-top': '320px', '--node-presentation-height': '455px' })
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveAttribute('data-viewport-lifecycle', 'resume-acquisition')

    viewport.offsetTop = viewport.pageTop = 320
    await updateViewport(viewport, {})
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveAttribute('data-viewport-lifecycle', 'active')
    expect(document.activeElement).toBe(originalInput)
  })

  it('keeps standalone accepted editing fixed through a same-focus resume transient', async () => {
    const viewport = new ViewportStub()
    viewport.height = 873
    installViewport(viewport)
    installMediaQueries({ editingPresentation: true, standalonePresentation: true })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 873 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 873 })
    let scrollY = 0
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    viewport.height = 487
    viewport.offsetTop = viewport.pageTop = 386
    scrollY = 386
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 487 })
    await updateViewport(viewport, {})
    expect(shell).toHaveStyle({ '--node-edit-top': '386px', '--node-edit-height': '487px' })

    act(() => window.dispatchEvent(new Event('pagehide')))
    viewport.height = 873
    viewport.offsetTop = viewport.pageTop = 0
    scrollY = 0
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 873 })
    act(() => window.dispatchEvent(new Event('pageshow')))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveAttribute('data-editing-presentation', 'true')
    expect(shell).toHaveAttribute('data-viewport-lifecycle', 'resume-acquisition')
    expect(shell).toHaveStyle({ '--node-edit-top': '386px', '--node-edit-height': '487px' })
    expect(input).toHaveFocus()

    viewport.height = 487
    viewport.offsetTop = viewport.pageTop = 386
    scrollY = 386
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 487 })
    await updateViewport(viewport, {})
    expect(shell).toHaveAttribute('data-viewport-lifecycle', 'active')
    expect(shell).toHaveStyle({ '--node-edit-top': '386px', '--node-edit-height': '487px' })
  })

  it('enters conservative recovery when a suspended editing input is no longer focused', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 775 })
    const { user, input, shell } = await openTerminal()
    let shellTop = 0
    vi.spyOn(shell, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: shellTop, top: shellTop, bottom: shellTop + 775, left: 0, right: 390,
      width: 390, height: 775, toJSON: () => ({}),
    }))
    await user.click(input)
    shellTop = -320
    viewport.height = 455
    viewport.offsetTop = viewport.pageTop = 320
    await updateViewport(viewport, {})

    act(() => window.dispatchEvent(new Event('pagehide')))
    act(() => input.blur())
    shellTop = -120
    viewport.height = 775
    viewport.offsetTop = viewport.pageTop = 0
    act(() => window.dispatchEvent(new Event('pageshow')))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(shell).toHaveAttribute('data-editing-phase', 'recovering')
    expect(shell).toHaveAttribute('data-editing-presentation', 'true')
    expect(shell).toHaveAttribute('data-recovery-ready', 'false')
  })

  it('prevents a queued pre-suspend measurement from publishing after epoch invalidation', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 775 })
    const { user, input, shell } = await openTerminal()
    let shellTop = 0
    vi.spyOn(shell, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: shellTop, top: shellTop, bottom: shellTop + 775, left: 0, right: 390,
      width: 390, height: 775, toJSON: () => ({}),
    }))
    await user.click(input)
    shellTop = -320
    viewport.height = 455
    viewport.offsetTop = viewport.pageTop = 320
    await updateViewport(viewport, {})
    expect(shell).toHaveStyle({ '--node-presentation-top': '320px', '--node-presentation-height': '455px' })

    const queuedFrames: FrameRequestCallback[] = []
    const animationFrame = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      queuedFrames.push(callback)
      return queuedFrames.length
    })
    shellTop = -100
    viewport.height = 775
    viewport.offsetTop = viewport.pageTop = 0
    act(() => viewport.dispatchEvent(new Event('resize')))
    expect(queuedFrames).toHaveLength(1)
    expect(shell).toHaveStyle({ '--node-presentation-top': '100px', '--node-presentation-height': '455px' })

    act(() => window.dispatchEvent(new Event('pagehide')))
    act(() => queuedFrames.shift()!(performance.now()))
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveAttribute('data-viewport-lifecycle', 'suspended')
    expect(shell).toHaveStyle({ '--node-presentation-top': '100px', '--node-presentation-height': '455px' })

    act(() => window.dispatchEvent(new Event('pageshow')))
    expect(queuedFrames).toHaveLength(1)
    act(() => queuedFrames.shift()!(performance.now()))
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveAttribute('data-viewport-lifecycle', 'resume-acquisition')
    animationFrame.mockRestore()
  })

  it('accepts a stable no-position opening only after bounded confirmation', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 775 })
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    viewport.height = 455
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 455 })
    act(() => viewport.dispatchEvent(new Event('resize')))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await waitFor(() => expect(shell).toHaveAttribute('data-editing-geometry', 'true'))
    expect(shell).toHaveStyle({ '--node-edit-top': '0px', '--node-edit-height': '455px' })
  })

  it('does not replenish a changing weak opening sampling burst', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 775 })
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await new Promise((resolve) => requestAnimationFrame(resolve))

    const queuedFrames: FrameRequestCallback[] = []
    const animationFrame = vi.spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        queuedFrames.push(callback)
        return queuedFrames.length
      })
    viewport.height = 455
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 455 })
    act(() => viewport.dispatchEvent(new Event('resize')))
    expect(queuedFrames).toHaveLength(1)

    act(() => queuedFrames.shift()!(performance.now()))
    expect(queuedFrames).toHaveLength(1)
    viewport.height = 451
    act(() => queuedFrames.shift()!(performance.now()))
    expect(queuedFrames).toHaveLength(1)
    viewport.height = 447
    act(() => queuedFrames.shift()!(performance.now()))

    expect(queuedFrames).toHaveLength(0)
    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    animationFrame.mockRestore()
  })

  it('keeps recovery active when focus leaves before reduced geometry settles', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    fireEvent.blur(input)
    await Promise.resolve()
    viewport.height = 455
    act(() => viewport.dispatchEvent(new Event('resize')))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(shell).toHaveAttribute('data-editing-presentation', 'true')
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveStyle({ '--node-host-height': '775px', '--node-edit-height': '455px' })
  })

  it('holds accepted editing through rapid blur and new focus epochs', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 455, offsetTop: 320 })
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    act(() => input.blur())
    await user.click(input)
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveStyle({ '--node-edit-top': '320px', '--node-edit-height': '455px' })
    await updateViewport(viewport, {})
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
  })

  it('does not let an editing orientation sample poison the normal baseline', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 775 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    viewport.height = 455
    viewport.offsetTop = viewport.pageTop = 320
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 455 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 320 })
    await updateViewport(viewport, {})
    fireEvent(window, new Event('orientationchange'))
    await new Promise((resolve) => setTimeout(resolve, 300))

    fireEvent.blur(input)
    await user.click(input)
    viewport.offsetTop = viewport.pageTop = 0
    act(() => viewport.dispatchEvent(new Event('resize')))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveStyle({ '--node-edit-height': '455px' })
  })

  it('recovers a blur-before-ready split only after Shell displacement and valid geometry return', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 775 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    const { user, input, shell } = await openTerminal()
    let shellTop = 0
    vi.spyOn(shell, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: shellTop, top: shellTop, bottom: shellTop + 775, left: 0, right: 390,
      width: 390, height: 775, toJSON: () => ({}),
    }))
    await user.click(input)

    shellTop = -320
    viewport.height = 455
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 455 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 320 })
    act(() => viewport.dispatchEvent(new Event('resize')))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    act(() => input.blur())
    await Promise.resolve()

    expect(shell).toHaveAttribute('data-editing-presentation', 'true')
    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    expect(shell).toHaveStyle({ '--node-presentation-top': '320px', '--node-presentation-height': '455px' })

    shellTop = 0
    viewport.height = 775
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 775 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    await updateViewport(viewport, {})

    expect(shell).toHaveAttribute('data-editing-presentation', 'false')
    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
  })

  it('preserves healthy normal host height through browser chrome offset', async () => {
    const viewport = new ViewportStub()
    viewport.height = 760
    viewport.offsetTop = viewport.pageTop = 15
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 760 })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 775 })
    render(<App />)
    await updateViewport(viewport, {})
    expect(screen.getByTestId('os-shell')).toHaveStyle({
      '--node-host-height': '775px',
      '--node-edit-height': '775px',
    })
  })
  it('publishes editing presentation immediately while accepted geometry stays normal', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()

    await user.click(input)

    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    expect(shell).toHaveAttribute('data-editing-presentation', 'true')
    expect(shell).toHaveStyle({
      '--node-host-height': '775px',
      '--node-edit-top': '0px',
      '--node-edit-height': '775px',
    })
    expect(screen.getByText('EDITING')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /finish editing/i })).toBeInTheDocument()
  })

  it('starts editing with the first genuinely reduced keyboard geometry', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)

    await updateViewport(viewport, { height: 455, offsetTop: 320 })

    await waitFor(() =>
      expect(shell).toHaveStyle({
        '--node-host-height': '775px',
        '--node-edit-top': '320px',
        '--node-edit-height': '455px',
      }),
    )
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
  })

  it('maps Safari top pan to editTop without changing host height', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)

    await updateViewport(
      viewport,
      { height: 514, offsetTop: 24 },
      'scroll',
    )

    await waitFor(() =>
      expect(shell).toHaveStyle({
        '--node-host-height': '844px',
        '--node-edit-top': '24px',
        '--node-edit-height': '514px',
      }),
    )
  })

  it('keeps editing active when focus moves while keyboard geometry is already reduced', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 538, offsetTop: 306 })

    const secondInput = document.createElement('input')
    input.parentElement!.append(secondInput)
    await user.click(secondInput)

    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveStyle({
      '--node-host-height': '844px',
      '--node-edit-top': '306px',
      '--node-edit-height': '538px',
    })
  })

  it('does not mistake Safari chrome movement for keyboard recovery', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 538 })

    // Safari toolbar movement can pan the reduced viewport all the way to the
    // host bottom even though the software keyboard remains open.
    await updateViewport(
      viewport,
      { height: 538, offsetTop: 306 },
      'scroll',
    )

    await waitFor(() => expect(shell).toHaveAttribute('data-editing-geometry', 'true'))
    expect(shell).toHaveStyle({
      '--node-host-height': '844px',
      '--node-edit-top': '306px',
      '--node-edit-height': '538px',
    })

    await updateViewport(viewport, { height: 844, offsetTop: 0 })
    await waitFor(() => expect(shell).toHaveAttribute('data-editing-geometry', 'false'))
  })

  it('contains editing gestures outside an app-owned scroll region', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 538 })

    const header = screen.getByText(/terminal/i, { selector: 'h1' }).closest(
      '.app-header',
    )
    expect(header).not.toBeNull()
    dispatchTouch(header!, 'touchstart', 20, 200)
    expect(dispatchTouch(header!, 'touchmove', 20, 150)).toBe(false)

    const prompt = input.closest('.terminal-input')
    expect(prompt).not.toBeNull()
    dispatchTouch(prompt!, 'touchstart', 20, 200)
    expect(dispatchTouch(prompt!, 'touchmove', 20, 150)).toBe(false)
  })

  it('lets Terminal output own only gestures it can scroll', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 538 })
    const output = document.querySelector('.terminal-output') as HTMLDivElement
    expect(output).toHaveAttribute('data-editing-scroll-owner')
    expect(input.closest('.terminal-input')).not.toContainElement(output)

    Object.defineProperties(output, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 500 },
    })
    output.scrollTop = 100
    dispatchTouch(output, 'touchstart', 20, 200)
    expect(dispatchTouch(output, 'touchmove', 20, 150)).toBe(true)

    output.scrollTop = 300
    dispatchTouch(output, 'touchstart', 20, 200)
    expect(dispatchTouch(output, 'touchmove', 20, 150)).toBe(false)
  })

  it('keeps editing latched on blur while the viewport remains reduced', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 538 })

    fireEvent.blur(input)

    await waitFor(() => expect(shell).toHaveAttribute('data-editing-geometry', 'true'))
    expect(shell).toHaveStyle({ '--node-edit-height': '538px' })
  })

  it('closes only after geometric recovery', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 538 })
    fireEvent.blur(input)

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 820 })
    await updateViewport(viewport, { height: 820, offsetTop: 0 })

    await waitFor(() => expect(shell).toHaveAttribute('data-editing-geometry', 'false'))
    expect(shell).toHaveStyle({
      '--node-host-height': '820px',
      '--node-edit-top': '0px',
      '--node-edit-height': '820px',
    })
  })

  it('closes on recovery while focus remains and suppresses stale re-entry', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 538 })

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
    await updateViewport(viewport, { height: 844 })
    await waitFor(() => expect(shell).toHaveAttribute('data-editing-geometry', 'false'))
    expect(input).toHaveFocus()

    await updateViewport(viewport, { height: 538 })
    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    expect(shell).toHaveStyle({ '--node-host-height': '844px' })
  })

  it('starts a fresh editing cycle after blur and refocus', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await updateViewport(viewport, { height: 538 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
    await updateViewport(viewport, { height: 844 })
    await waitFor(() => expect(shell).toHaveAttribute('data-editing-geometry', 'false'))

    input.blur()
    input.focus()
    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await updateViewport(viewport, { height: 538, offsetTop: 306 })
    await waitFor(() => expect(shell).toHaveAttribute('data-editing-geometry', 'true'))
    expect(shell).toHaveStyle({
      '--node-host-height': '844px',
      '--node-edit-height': '538px',
    })
  })

  it('allows healthy host growth outside editing', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    render(<App />)

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    await updateViewport(viewport, { height: 900 })

    await waitFor(() =>
      expect(screen.getByTestId('os-shell')).toHaveStyle({
        '--node-host-height': '900px',
      }),
    )
  })

  it('freezes application geometry during pinch zoom', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    render(<App />)
    const shell = screen.getByTestId('os-shell')

    await updateViewport(viewport, {
      scale: 2,
      height: 300,
      offsetTop: 80,
    })

    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    expect(shell).toHaveStyle({
      '--node-host-height': '844px',
      '--node-edit-top': '0px',
      '--node-edit-height': '844px',
    })

    await updateViewport(viewport, {
      scale: 1,
      height: 844,
      offsetTop: 0,
    })
    expect(shell).toHaveStyle({ '--node-host-height': '844px' })
  })

  it('retains the last unscaled presentation mapping during pinch zoom and rebases afterward', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    let shellTop = 0
    vi.spyOn(shell, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: shellTop, top: shellTop, bottom: shellTop + 775, left: 0, right: 390,
      width: 390, height: 775, toJSON: () => ({}),
    }))
    await user.click(input)

    shellTop = -320
    await updateViewport(viewport, { height: 455 })
    expect(shell).toHaveStyle({ '--node-presentation-top': '320px', '--node-presentation-height': '455px' })

    shellTop = -400
    await updateViewport(viewport, { scale: 1.2, height: 380 })
    expect(shell).toHaveAttribute('data-editing-presentation', 'true')
    expect(shell).toHaveStyle({ '--node-presentation-top': '320px', '--node-presentation-height': '455px' })

    await updateViewport(viewport, { scale: 1 })
    expect(shell).toHaveStyle({ '--node-presentation-top': '400px', '--node-presentation-height': '375px' })
  })

  it('does not apply browser-tab displacement mapping in standalone presentation', async () => {
    const viewport = new ViewportStub()
    viewport.height = 775
    installViewport(viewport)
    installMediaQueries({ editingPresentation: true, standalonePresentation: true })
    const { user, input, shell } = await openTerminal()
    let shellTop = 0
    vi.spyOn(shell, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0, y: shellTop, top: shellTop, bottom: shellTop + 775, left: 0, right: 390,
      width: 390, height: 775, toJSON: () => ({}),
    }))
    await user.click(input)
    shellTop = -320
    await updateViewport(viewport, { height: 455 })

    expect(shell).toHaveAttribute('data-standalone', 'true')
    expect(shell).toHaveAttribute('data-editing-presentation', 'true')
    expect(shell.style.getPropertyValue('--node-presentation-top')).toBe('')
    expect(shell.style.getPropertyValue('--node-presentation-height')).toBe('')
  })

  it('performs one bounded final orientation rebase', async () => {
    vi.useFakeTimers()
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 390,
    })
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 390,
    })
    render(<App />)

    viewport.width = 844
    viewport.height = 500
    fireEvent(window, new Event('orientationchange'))
    viewport.height = 390
    await act(() => vi.advanceTimersByTimeAsync(281))

    expect(screen.getByTestId('os-shell')).toHaveStyle({
      '--node-host-height': '390px',
      '--node-edit-height': '390px',
    })
  })

  it('uses a responsive no-VisualViewport fallback with the same edit plane', async () => {
    installViewport(undefined)
    installEditingPresentation()
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 700,
    })
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    expect(shell).toHaveStyle({
      '--node-host-height': '700px',
      '--node-edit-height': '700px',
    })

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 500,
    })
    fireEvent(window, new Event('resize'))
    await waitFor(() =>
      expect(shell).toHaveStyle({
        '--node-host-height': '700px',
        '--node-edit-height': '500px',
      }),
    )

    fireEvent.blur(input)
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 700,
    })
    fireEvent(window, new Event('resize'))
    await waitFor(() => expect(shell).toHaveAttribute('data-editing-geometry', 'false'))
  })

  it('does not turn an 860px fine-pointer desktop into editing mode', async () => {
    const viewport = new ViewportStub()
    viewport.width = 860
    installViewport(viewport)
    installEditingPresentation(false)
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 860,
    })
    const { user, input, shell } = await openTerminal()

    await user.click(input)
    await updateViewport(viewport, { height: 538 })

    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
  })

  it('releases an active presentation when the mobile editing media query stops matching', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    const editingQuery = installEditingPresentation()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    expect(shell).toHaveAttribute('data-editing-presentation', 'true')

    editingQuery.matches = false
    act(() => editingQuery.dispatchEvent(new Event('change')))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(shell).toHaveAttribute('data-editing-presentation', 'false')
    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    expect(shell).toHaveAttribute('data-recovery-ready', 'true')

    editingQuery.matches = true
    act(() => editingQuery.dispatchEvent(new Event('change')))
    expect(input).toHaveFocus()
    expect(shell).toHaveAttribute('data-editing-presentation', 'true')
    expect(shell).toHaveAttribute('data-editing-phase', 'entering')
  })

  it('shares the editing viewport with Notes and restores after DONE', async () => {
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open notes/i }))
    const notes = screen.getByRole('textbox')
    expect(notes).toHaveAttribute('data-editing-scroll-owner')
    await user.click(notes)
    await user.type(notes, 'abc')
    const shell = screen.getByTestId('os-shell')

    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    expect(screen.getByLabelText('Note character count')).toHaveTextContent('3 CHR')
    await updateViewport(viewport, { height: 538 })
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveStyle({ '--node-edit-height': '538px' })

    await user.click(screen.getByRole('button', { name: /finish editing/i }))
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
    await updateViewport(viewport, { height: 844 })
    await waitFor(() => expect(shell).toHaveAttribute('data-editing-geometry', 'false'))
  })

  it('reports recovery completion only for a real recovery transition', async () => {
    window.history.replaceState(null, '', '/?viewportDebug=1')
    const record = vi.spyOn(ViewportDiagnosticsRecorder.prototype, 'record')
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation()
    const { user, input, shell } = await openTerminal()

    await user.click(input)
    await updateViewport(viewport, { height: 538, offsetTop: 306 })
    await user.click(screen.getByRole('button', { name: /finish editing/i }))
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
    await updateViewport(viewport, { height: 844, offsetTop: 0 })
    await waitFor(() => expect(shell).toHaveAttribute('data-recovery-ready', 'true'))

    expect(record.mock.calls.filter(([, name]) => name === 'RECOVERY COMPLETE')).toHaveLength(1)
    record.mockRestore()
  })

  it('does not report recovery completion for ordinary non-mobile normalization', async () => {
    window.history.replaceState(null, '', '/?viewportDebug=1')
    const record = vi.spyOn(ViewportDiagnosticsRecorder.prototype, 'record')
    const viewport = new ViewportStub()
    installViewport(viewport)
    installEditingPresentation(false)
    render(<App />)
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(record.mock.calls.some(([, name]) => name === 'RECOVERY COMPLETE')).toBe(false)
    record.mockRestore()
  })
})

/**
 * Leaving editing is its own contract. The Shell keeps normal navigation
 * suppressed for as long as an editing presentation is active, so every way an
 * editing interaction can end has to reach the same normal presentation — with
 * the geometry still earned from the physical viewport rather than asserted.
 *
 * These sequences use iOS Safari's real browser-tab shape: the layout viewport
 * is unchanged by the software keyboard and the visual viewport is panned, so
 * corroboration comes from position rather than from a resized window.
 */
describe('leaving editing', () => {
  const HOST_HEIGHT = 844
  const KEYBOARD_TOP = 336
  const KEYBOARD_HEIGHT = HOST_HEIGHT - KEYBOARD_TOP

  function installHostGeometry() {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: HOST_HEIGHT })
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: HOST_HEIGHT })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    const viewport = new ViewportStub()
    viewport.height = HOST_HEIGHT
    installViewport(viewport)
    installEditingPresentation()
    return viewport
  }

  /** The software keyboard opening: the visual viewport pans down and shrinks. */
  async function openKeyboard(viewport: ViewportStub) {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: KEYBOARD_TOP })
    viewport.pageTop = KEYBOARD_TOP
    await updateViewport(viewport, { height: KEYBOARD_HEIGHT, offsetTop: KEYBOARD_TOP })
  }

  /** The software keyboard leaving: the visual viewport returns to the page top. */
  async function closeKeyboard(viewport: ViewportStub) {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    viewport.pageTop = 0
    await updateViewport(viewport, { height: HOST_HEIGHT, offsetTop: 0 })
  }

  /**
   * Mobile Safari can leave `document.activeElement` reporting something that
   * is not the editable the Shell believes it is editing — after the editable
   * is unmounted, or after a native dismissal the page never sees.
   */
  function simulateLostBrowserFocus() {
    Object.defineProperty(document, 'activeElement', {
      configurable: true,
      get: () => document.body,
    })
  }

  async function editingTerminal() {
    const viewport = installHostGeometry()
    const { user, input, shell } = await openTerminal()
    await user.click(input)
    await openKeyboard(viewport)
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveAttribute('data-editing-phase', 'editing')
    expect(shell).toHaveStyle({ '--node-edit-top': `${KEYBOARD_TOP}px`, '--node-edit-height': `${KEYBOARD_HEIGHT}px` })
    return { viewport, user, input, shell }
  }

  function expectNormalPresentation(shell: HTMLElement) {
    expect(shell).toHaveAttribute('data-editing-presentation', 'false')
    expect(shell).toHaveAttribute('data-editing-phase', 'normal')
    expect(shell).toHaveAttribute('data-editing-geometry', 'false')
    expect(shell).toHaveAttribute('data-recovery-ready', 'true')
    expect(screen.queryByText('EDITING')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to home' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /finish editing/i })).not.toBeInTheDocument()
  }

  it('ends editing on DONE while the keyboard still occludes, and only then accepts recovered geometry', async () => {
    const { viewport, user, input, shell } = await editingTerminal()

    await user.click(screen.getByRole('button', { name: /finish editing/i }))
    expect(input).not.toHaveFocus()
    // The intent has landed, but the viewport is still physically occluded, so
    // the accepted edit plane is still the truthful one.
    expect(shell).toHaveAttribute('data-editing-phase', 'recovering')
    expect(shell).toHaveAttribute('data-editing-presentation', 'true')
    expect(shell).toHaveAttribute('data-editing-geometry', 'true')
    expect(shell).toHaveStyle({ '--node-edit-height': `${KEYBOARD_HEIGHT}px` })

    await closeKeyboard(viewport)
    expectNormalPresentation(shell)
    expect(shell).toHaveStyle({ '--node-host-height': `${HOST_HEIGHT}px`, '--node-edit-height': `${HOST_HEIGHT}px` })
  })

  it('ends editing on DONE when the browser no longer reports an editable focus', async () => {
    const { viewport, shell } = await editingTerminal()
    // Nothing left to blur: DONE has to carry the intent by itself.
    simulateLostBrowserFocus()

    fireEvent.click(screen.getByRole('button', { name: /finish editing/i }))
    expect(shell).toHaveAttribute('data-editing-phase', 'recovering')

    await closeKeyboard(viewport)
    expectNormalPresentation(shell)
  })

  it('converges to the same normal presentation from every end-of-editing order', async () => {
    // A) focusout, then the viewport recovers.
    {
      const { viewport, input, shell } = await editingTerminal()
      act(() => { input.blur() })
      await closeKeyboard(viewport)
      expectNormalPresentation(shell)
      cleanup()
    }
    // B) the viewport recovers, then focusout arrives.
    {
      const { viewport, input, shell } = await editingTerminal()
      await closeKeyboard(viewport)
      act(() => { input.blur() })
      await new Promise((resolve) => requestAnimationFrame(resolve))
      await new Promise((resolve) => requestAnimationFrame(resolve))
      expectNormalPresentation(shell)
      cleanup()
    }
    // C) editable focus disappears with no focusout the Shell can attribute,
    //    then the viewport recovers.
    {
      const { viewport, shell } = await editingTerminal()
      simulateLostBrowserFocus()
      await closeKeyboard(viewport)
      expectNormalPresentation(shell)
      Reflect.deleteProperty(document, 'activeElement')
      cleanup()
    }
    // D) explicit DONE while the active element is already not editable,
    //    then the viewport recovers.
    {
      const { viewport, shell } = await editingTerminal()
      simulateLostBrowserFocus()
      fireEvent.click(screen.getByRole('button', { name: /finish editing/i }))
      await closeKeyboard(viewport)
      expectNormalPresentation(shell)
    }
  })

  it('reconciles a native keyboard dismissal that never reports a focus change', async () => {
    const { viewport, shell } = await editingTerminal()
    simulateLostBrowserFocus()

    await closeKeyboard(viewport)

    // No DONE was pressed and no focusout arrived; the Shell still has to give
    // normal navigation back rather than preserve an editing presentation with
    // no editable interaction behind it.
    expectNormalPresentation(shell)
  })

  it('keeps repeated exit and stale editing-epoch events idempotent', async () => {
    const { viewport, user, input, shell } = await editingTerminal()

    const done = screen.getByRole('button', { name: /finish editing/i })
    await user.click(done)
    fireEvent.click(done)
    fireEvent.blur(input)
    fireEvent.focusOut(input)
    expect(shell).toHaveAttribute('data-editing-phase', 'recovering')

    await closeKeyboard(viewport)
    expectNormalPresentation(shell)

    // Everything the previous editing epoch can still emit at a recovered
    // presentation: a stale blur, a stale focusout, and repeated viewport
    // movement. None of it may reopen or corrupt the normal presentation.
    fireEvent.blur(input)
    fireEvent.focusOut(input)
    await closeKeyboard(viewport)
    act(() => { window.dispatchEvent(new Event('scroll')) })
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expectNormalPresentation(shell)
    expect(shell).toHaveStyle({ '--node-host-height': `${HOST_HEIGHT}px` })
  })

  it('does not present a RACK-OS section change into the editing geometry it is leaving', async () => {
    const viewport = installHostGeometry()
    const user = userEvent.setup()
    render(<GameProvider initialState={remoteConnectedState()}><Shell /><StateSnapshot /></GameProvider>)
    await user.click(screen.getByRole('button', { name: /^ENTER .+ →$/ }))
    const shell = screen.getByTestId('os-shell')
    const remoteInput = screen.getByLabelText('Remote command')
    act(() => { remoteInput.focus() })
    await openKeyboard(viewport)
    expect(shell).toHaveAttribute('data-editing-phase', 'editing')
    const beforeSwitch = screen.getByTestId('state-snapshot').textContent

    // iOS Safari does not focus a tapped button, so the tap moves no focus and
    // the outgoing editable would simply be unmounted under the keyboard.
    fireEvent.click(screen.getByRole('button', { name: 'FILES' }))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    // The editable is released and the destination is not mounted yet: it must
    // not inherit the edit plane the outgoing section is leaving.
    expect(remoteInput).not.toHaveFocus()
    expect(shell).toHaveAttribute('data-editing-phase', 'recovering')
    expect(screen.queryByText('EMPTY DIRECTORY')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Remote command')).toBeInTheDocument()

    await closeKeyboard(viewport)

    expect(shell).toHaveAttribute('data-editing-presentation', 'false')
    expect(shell).toHaveAttribute('data-recovery-ready', 'true')
    expect(screen.queryByLabelText('Remote command')).not.toBeInTheDocument()
    expect(screen.getByText('PATH')).toBeInTheDocument()
    // Presentation only: the canonical Session and every other represented
    // truth are untouched by the section change.
    expect(screen.getByTestId('state-snapshot')).toHaveTextContent(beforeSwitch ?? '')
  })

  it('switches a RACK-OS section immediately when no editing interaction is open', async () => {
    installHostGeometry()
    const user = userEvent.setup()
    render(<GameProvider initialState={remoteConnectedState()}><Shell /></GameProvider>)
    await user.click(screen.getByRole('button', { name: /^ENTER .+ →$/ }))
    const shell = screen.getByTestId('os-shell')
    expect(shell).toHaveAttribute('data-recovery-ready', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'FILES' }))
    expect(screen.queryByLabelText('Remote command')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'TERMINAL' }))
    expect(screen.getByLabelText('Remote command')).toBeInTheDocument()
  })
})

describe('NODE-OS shell and applications', () => {
  it('derives Home and status-bar Device context from canonical state', () => {
    const base = createInitialGameState()
    const state = {
      ...base,
      player: {
        ...base.player,
        localDevice: {
          ...base.player.localDevice,
          displayName: 'field-node',
          network: { ip: '203.0.113.77', transferCapacity: { uploadBytesPerSecond: 1_048_576, downloadBytesPerSecond: 2_097_152 } },
          operational: { lifecycle: 'RUNNING' as const, connectivity: 'DISCONNECTED' as const },
          firmware: { ...base.player.localDevice.firmware, name: 'TEST-OS' },
        },
      },
    }

    render(<GameProvider initialState={state}><Shell /></GameProvider>)

    expect(screen.getAllByText(/TEST-OS/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/field-node/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('203.0.113.77').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Network OFFLINE')).toHaveAttribute(
      'data-network-status',
      'OFFLINE',
    )
    expect(screen.getByText('NETWORK').parentElement).toHaveTextContent('OFFLINE')
    expect(screen.queryByText('NODE-OS')).not.toBeInTheDocument()
  })

  it('renders canonical runtime data without Wallet balance in shared chrome', () => {
    render(<App />)
    expect(screen.getByTestId('os-shell')).toBeInTheDocument()
    expect(screen.getAllByText('198.51.100.23')).toHaveLength(2)
    expect(screen.queryByText('$1,250.00')).not.toBeInTheDocument()
    expect(screen.getByText('CPU').parentElement).toHaveTextContent('18%')
    expect(screen.getByText('NET').parentElement).toHaveTextContent('ONLINE')
    expect(screen.getByLabelText('Network ONLINE')).toHaveAttribute(
      'data-network-status',
      'ONLINE',
    )
  })

  it('orders and exposes exactly the nine Home launcher controls, with NodeScan the one network surface', () => {
    render(<App />)
    const launchers = screen.getAllByRole('button', { name: /^open /i })
    expect(launchers.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Open Terminal', 'Open NodeScan', 'Open NodeMail', 'Open Processes',
      'Open Files', 'Open Market', 'Open Wallet', 'Open Notes', 'Open System',
    ])
    // Network administration is reached inside NodeScan, not from a second launcher.
    expect(screen.queryByRole('button', { name: 'Open Network' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open tools/i })).not.toBeInTheDocument()
    expect(screen.queryByText('/ OPEN')).not.toBeInTheDocument()
  })

  it('derives the Processes launcher status from canonical Process state', () => {
    const base = createInitialGameState()
    const state = {
      ...base,
      process: {
        nextId: 3,
        processes: [
          { id: 'process-1', kind: 'generic' as const, label: 'One', executorDeviceId: base.player.localDevice.id, status: 'running' as const, workRequired: 10, workCompleted: 2, ramRequiredMiB: 1 },
          { id: 'process-2', kind: 'generic' as const, label: 'Two', executorDeviceId: base.player.localDevice.id, status: 'completed' as const, workRequired: 10, workCompleted: 10, ramRequiredMiB: 1 },
        ],
      },
    }
    render(<GameProvider initialState={state}><Shell /></GameProvider>)
    expect(screen.getByRole('button', { name: /open processes/i })).toHaveTextContent('1 RUNNING')
  })

  it.each(['download', 'upload'] as const)('counts an active %s in the Processes launcher', (direction) => {
    render(<GameProvider initialState={withActiveTransfer(direction)}><Shell /></GameProvider>)

    expect(screen.getByRole('button', { name: /open processes/i })).toHaveTextContent('1 RUNNING')
  })

  it('counts an active local Process and active transfer in the Processes launcher', () => {
    const base = createInitialGameState()
    const state = withActiveTransfer('download', {
      ...base,
      process: {
        nextId: 2,
        processes: [{ id: 'process-1', kind: 'generic', label: 'Local work', executorDeviceId: base.player.localDevice.id, status: 'running', workRequired: 10, workCompleted: 2, ramRequiredMiB: 1 }],
      },
    })

    render(<GameProvider initialState={state}><Shell /></GameProvider>)

    expect(screen.getByRole('button', { name: /open processes/i })).toHaveTextContent('2 RUNNING')
  })

  it('does not count recent or completed activity in the Processes launcher', () => {
    const base = createInitialGameState()
    const completedProcess = { id: 'process-1', kind: 'generic' as const, label: 'Finished work', executorDeviceId: base.player.localDevice.id, status: 'completed' as const, workRequired: 10, workCompleted: 10, ramRequiredMiB: 1 }
    const completedTransfer: FileTransfer = {
      id: 'transfer-0001', origin: 'device_access', accessId: 'access-0001', sourceDeviceId: 'host-lan-001', sourceFileId: 'file-0002',
      destinationDeviceId: base.player.localDevice.id, destinationPath: '/home/user/downloads/complete.pkg',
      bytesTotal: 100, bytesTransferred: 100,
    }
    const state: GameState = {
      ...base,
      process: { nextId: 2, processes: [completedProcess] },
      recentActivity: { entries: [
        { kind: 'process', id: completedProcess.id, process: completedProcess },
        { kind: 'file_transfer', id: completedTransfer.id, transfer: completedTransfer },
      ] },
    }

    render(<GameProvider initialState={state}><Shell /></GameProvider>)

    expect(screen.getByRole('button', { name: /open processes/i })).toHaveTextContent('0 RUNNING')
  })

  it('opens an app and returns home', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open wallet/i }))
    expect(screen.getByText('Civic Dollar')).toBeInTheDocument()
    expect(screen.getByText('$1,250.00')).toBeInTheDocument()
    expect(screen.queryByText('MODULE')).not.toBeInTheDocument()
    expect(screen.queryByText(/05\s*\/\s*07/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /back to home/i }))
    expect(screen.getByRole('heading', { name: 'HOME' })).toBeInTheDocument()
  })

  it('keeps shell navigation outside canonical game state', async () => {
    const user = userEvent.setup()
    render(
      <GameProvider>
        <StateSnapshot />
        <Shell />
      </GameProvider>,
    )
    const before = screen.getByTestId('state-snapshot').textContent
    await user.click(screen.getByRole('button', { name: /open wallet/i }))
    await user.click(screen.getByRole('button', { name: /back to home/i }))
    expect(screen.getByTestId('state-snapshot')).toHaveTextContent(before ?? '')
  })

  it('shows canonical runtime values in the System app', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /open system/i }))
    expect(screen.getAllByText('198.51.100.23')).toHaveLength(2)
    expect(screen.getAllByText('18%')).toHaveLength(2)
    expect(screen.getAllByText('23%')).toHaveLength(2)
    expect(screen.getAllByText('ONLINE')).toHaveLength(3)
  })

  it('shows Device and Firmware diagnostics from canonical state', async () => {
    const base = createInitialGameState()
    const state = {
      ...base,
      player: {
        ...base.player,
        localDevice: {
          ...base.player.localDevice,
          displayName: 'test-device',
          firmware: {
            id: 'firmware-test-v7',
            name: 'TEST-OS',
            version: '7.4',
          },
        },
      },
    }
    const user = userEvent.setup()
    render(<GameProvider initialState={state}><Shell /></GameProvider>)

    await user.click(screen.getByRole('button', { name: /open system/i }))

    expect(screen.getByText('DEVICE').parentElement).toHaveTextContent('test-device')
    expect(screen.getByText('FIRMWARE').parentElement).toHaveTextContent('TEST-OS')
    expect(screen.getByText('VERSION').parentElement).toHaveTextContent('7.4')
  })
})

describe('Terminal', () => {
  it('runs help', async () => {
    await command('help')
    expect(screen.getByText('AVAILABLE COMMANDS')).toBeInTheDocument()
  })

  it('runs ip', async () => {
    await command('ip')
    expect(screen.getByText('Local address:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy target 198.51.100.23' })).toHaveTextContent('198.51.100.23')
  })

  it('runs status', async () => {
    await command('status')
    expect(screen.getByText('Network: ONLINE')).toBeInTheDocument()
  })

  it('reports an unknown command', async () => {
    await command('hack')
    expect(screen.getByText(/Command not found: hack/)).toBeInTheDocument()
  })

  it('clears terminal output', async () => {
    const { user, input } = await openTerminal()
    await user.type(input, 'ip{enter}')
    expect(screen.getByText(/Local address:/)).toBeInTheDocument()
    await user.type(input, 'clear{enter}')
    expect(screen.queryByText(/Local address:/)).not.toBeInTheDocument()
  })

  it('keeps command focus, exposes the send hint, and navigates history', async () => {
    const { user, input } = await openTerminal()
    expect(input).toHaveAttribute('enterkeyhint', 'send')
    await user.type(input, 'ip{enter}status{enter}')
    expect(input).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('status')
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('ip')
    await user.keyboard('{ArrowDown}')
    expect(input).toHaveValue('status')
    await user.keyboard('{ArrowDown}')
    expect(input).toHaveValue('')
  })

  it('scrolls only the Terminal output container after a command', async () => {
    const { user, input } = await openTerminal()
    const output = document.querySelector('.terminal-output') as HTMLDivElement
    Object.defineProperty(output, 'scrollHeight', {
      configurable: true,
      value: 420,
    })
    output.scrollTop = 0

    await user.type(input, 'ip{enter}')

    await waitFor(() => expect(output.scrollTop).toBe(420))
    expect(input).toHaveFocus()
  })

  it('does not refocus the command input when Terminal output is clicked', async () => {
    const { user, input } = await openTerminal()
    input.focus()
    input.blur()
    await user.click(screen.getByText(/to begin/i))
    expect(input).not.toHaveFocus()
  })

  it('copies an exact target with local feedback without changing input or history', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const { user, input } = await openTerminal()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await user.type(input, 'scan 198.51.100.23{enter}')
    await user.type(input, 'scan home-net{enter}')
    input.blur()
    const token = await screen.findByRole('button', {
  name: 'Copy target 198.51.100.47',
})

    expect(screen.getByText('Scanning home-net...')).not.toHaveAttribute('role', 'button')
    await user.click(token)

    expect(writeText).toHaveBeenCalledExactlyOnceWith('198.51.100.47')
    expect(token).toHaveTextContent('✓')
    expect(input).not.toHaveFocus()
    expect(input).toHaveValue('')
    expect(screen.queryByText('Scanning 198.51.100.47...')).not.toBeInTheDocument()
    input.focus()
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('scan home-net')
  })

  it('preserves focused prompt state on pointer copy and handles clipboard rejection', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    const { user, input } = await openTerminal()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await user.type(input, 'ip{enter}draft')
    const token = screen.getByRole('button', { name: 'Copy target 198.51.100.23' })

    fireEvent.pointerDown(token)
    fireEvent.click(token)
    await waitFor(() => expect(token).toHaveAttribute('data-copy-state', 'failed'))

    expect(input).toHaveFocus()
    expect(input).toHaveValue('draft')
    expect(writeText).toHaveBeenCalledExactlyOnceWith('198.51.100.23')
  })

  it('keeps historical structured targets interactive until clear', async () => {
    const { user, input } = await openTerminal()
    await user.type(input, 'ip{enter}status{enter}')
    expect(screen.getByRole('button', { name: 'Copy target 198.51.100.23' })).toBeEnabled()
    expect(screen.getByText('Network: ONLINE')).toBeInTheDocument()
    await user.type(input, 'clear{enter}')
    expect(screen.queryByRole('button', { name: 'Copy target 198.51.100.23' })).not.toBeInTheDocument()
  })
})
