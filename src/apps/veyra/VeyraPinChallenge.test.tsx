import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { VeyraPinChallenge } from './VeyraPinChallenge'

const props = { verify: vi.fn(() => false), onSuccess: vi.fn(), onCancel: vi.fn() }

it('types each canonical candidate prefix inside its one attempt slot', () => {
  vi.useFakeTimers()
  const view = render(<VeyraPinChallenge {...props} observedCandidate="6999" observedAttemptNumber={1000} />)
  const challenge = screen.getByRole('region', { name: 'Enter Device PIN' })
  const visibleCandidate = () => challenge.querySelector('[data-rattler-input]')?.textContent ?? ''
  expect(visibleCandidate()).toBe('6')
  expect(challenge).toHaveTextContent('RATTLER · ATTEMPT 1000')
  act(() => vi.advanceTimersByTime(125))
  expect(visibleCandidate()).toBe('69')
  act(() => vi.advanceTimersByTime(125))
  expect(visibleCandidate()).toBe('699')
  act(() => vi.advanceTimersByTime(125))
  expect(visibleCandidate()).toBe('6999')

  view.rerender(<VeyraPinChallenge {...props} observedCandidate="7000" observedAttemptNumber={1001} />)
  expect(visibleCandidate()).toBe('7')
  expect(challenge).toHaveTextContent('RATTLER · ATTEMPT 1001')
  act(() => vi.advanceTimersByTime(125))
  expect(visibleCandidate()).toBe('70')
  act(() => vi.advanceTimersByTime(125))
  expect(visibleCandidate()).toBe('700')
  act(() => vi.advanceTimersByTime(125))
  expect(visibleCandidate()).toBe('7000')
  vi.useRealTimers()
})

it('cancels stale prefix timers when canonical attempt identity changes', () => {
  vi.useFakeTimers()
  const view = render(<VeyraPinChallenge {...props} observedCandidate="6999" observedAttemptNumber={1000} />)
  const visibleCandidate = () => screen.getByRole('region', { name: 'Enter Device PIN' }).querySelector('[data-rattler-input]')?.textContent ?? ''
  act(() => vi.advanceTimersByTime(125))
  expect(visibleCandidate()).toBe('69')
  view.rerender(<VeyraPinChallenge {...props} observedCandidate="7000" observedAttemptNumber={1001} />)
  expect(visibleCandidate()).toBe('7')
  act(() => vi.advanceTimersByTime(125))
  expect(visibleCandidate()).toBe('70')
  vi.useRealTimers()
})

it('stops observed playback without fabricating a successor after canonical completion', () => {
  vi.useFakeTimers()
  const view = render(<VeyraPinChallenge {...props} observedCandidate="7042" observedAttemptNumber={1043} />)
  view.rerender(<VeyraPinChallenge {...props} />)
  act(() => vi.advanceTimersByTime(500))
  expect(screen.getByRole('region', { name: 'Enter Device PIN' }).querySelector('[data-rattler-attempt]')).toBeNull()
  expect(screen.getByRole('region', { name: 'Enter Device PIN' }).querySelector('[data-rattler-input]')).toBeNull()
  vi.useRealTimers()
})

it('keeps the ordinary manual challenge free of RATTLER projection', () => {
  render(<VeyraPinChallenge {...props} />)
  const challenge = screen.getByRole('region', { name: 'Enter Device PIN' })
  expect(challenge).not.toHaveTextContent('RATTLER')
  expect(challenge.querySelector('[data-rattler-attempt]')).toBeNull()
  expect(challenge.querySelector('[data-rattler-input]')).toBeNull()
})
