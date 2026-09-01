import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { VeyraPinChallenge } from './VeyraPinChallenge'

const props = { verify: vi.fn(() => false), onSuccess: vi.fn(), onCancel: vi.fn() }

it('types all four masked digits inside one canonical RATTLER attempt and rebinds immediately', () => {
  vi.useFakeTimers()
  const view = render(<VeyraPinChallenge {...props} observedCandidate="6999" observedAttemptNumber={1000} />)
  const challenge = screen.getByRole('region', { name: 'Enter Device PIN' })
  const filled = () => Array.from(challenge.querySelectorAll('.veyra-pin__dot')).filter((dot) => dot.hasAttribute('data-filled')).length
  expect(filled()).toBe(1)
  expect(challenge).toHaveTextContent('RATTLER · ATTEMPT 1000')
  expect(challenge).not.toHaveTextContent('6999')
  act(() => vi.advanceTimersByTime(375))
  expect(filled()).toBe(4)

  view.rerender(<VeyraPinChallenge {...props} observedCandidate="7000" observedAttemptNumber={1001} />)
  expect(filled()).toBe(1)
  expect(challenge).toHaveTextContent('RATTLER · ATTEMPT 1001')
  expect(challenge).not.toHaveTextContent('7000')
  act(() => vi.advanceTimersByTime(375))
  expect(filled()).toBe(4)
  vi.useRealTimers()
})

it('stops observed playback without fabricating a successor after canonical completion', () => {
  vi.useFakeTimers()
  const view = render(<VeyraPinChallenge {...props} observedCandidate="7042" observedAttemptNumber={1043} />)
  view.rerender(<VeyraPinChallenge {...props} />)
  act(() => vi.advanceTimersByTime(500))
  expect(screen.getByRole('region', { name: 'Enter Device PIN' }).querySelector('[data-rattler-attempt]')).toBeNull()
  vi.useRealTimers()
})

it('keeps the ordinary manual challenge free of RATTLER projection', () => {
  render(<VeyraPinChallenge {...props} />)
  const challenge = screen.getByRole('region', { name: 'Enter Device PIN' })
  expect(challenge).not.toHaveTextContent('RATTLER')
  expect(challenge.querySelector('[data-rattler-attempt]')).toBeNull()
})
