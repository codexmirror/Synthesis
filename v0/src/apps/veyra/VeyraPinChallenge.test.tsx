import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { VeyraPinChallenge } from './VeyraPinChallenge'

const props = { verify: vi.fn(() => false), onSuccess: vi.fn(), onCancel: vi.fn() }

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

function challenge() {
  return screen.getByRole('region', { name: 'Enter Device PIN' })
}

function filledIndicators() {
  return challenge().querySelectorAll('.veyra-pin__dot[data-filled]').length
}

function activeKey() {
  return challenge().querySelector<HTMLButtonElement>('.veyra-key[data-rattler-active]')
}

it('keeps the upper PIN indicators masked while pressing a sampled candidate\'s keypad digits in four steps', () => {
  vi.useFakeTimers()
  render(<VeyraPinChallenge {...props} observedCandidate="6064" observedAttemptNumber={1000} />)

  expect(Array.from(challenge().querySelectorAll('.veyra-pin__dot')).every((dot) => dot.textContent === '')).toBe(true)
  expect(challenge()).not.toHaveTextContent('6064')
  expect(filledIndicators()).toBe(1)
  expect(activeKey()).toHaveTextContent('6')

  act(() => vi.advanceTimersByTime(125))
  expect(filledIndicators()).toBe(2)
  expect(activeKey()).toHaveTextContent('0')

  act(() => vi.advanceTimersByTime(125))
  expect(filledIndicators()).toBe(3)
  expect(activeKey()).toHaveTextContent('6')

  act(() => vi.advanceTimersByTime(125))
  expect(filledIndicators()).toBe(4)
  expect(activeKey()).toHaveTextContent('4')
  expect(challenge().querySelector('output')).toHaveTextContent('4 of 4 digits entered')
})

it('resamples the real canonical candidate on a fixed interval and is unaffected by how often canonical state changes in between', () => {
  vi.useFakeTimers()
  const view = render(<VeyraPinChallenge {...props} observedCandidate="6064" observedAttemptNumber={1000} />)
  expect(filledIndicators()).toBe(1)
  expect(activeKey()).toHaveTextContent('6')

  // Canonical Process state races ahead of the visible reveal several times inside one sample window.
  view.rerender(<VeyraPinChallenge {...props} observedCandidate="6065" observedAttemptNumber={1001} />)
  view.rerender(<VeyraPinChallenge {...props} observedCandidate="6066" observedAttemptNumber={1002} />)

  act(() => vi.advanceTimersByTime(125))
  expect(filledIndicators()).toBe(2)
  expect(activeKey()).toHaveTextContent('0')
  expect(challenge()).toHaveTextContent('RATTLER · ATTEMPT 1000')

  act(() => vi.advanceTimersByTime(250))
  expect(filledIndicators()).toBe(4)
  expect(challenge()).toHaveTextContent('RATTLER · ATTEMPT 1000')

  // At the next sample boundary, a fresh snapshot of the then-current live candidate is taken.
  act(() => vi.advanceTimersByTime(125))
  expect(filledIndicators()).toBe(1)
  expect(activeKey()).toHaveTextContent('6')
  expect(challenge()).toHaveTextContent('RATTLER · ATTEMPT 1002')

  act(() => vi.advanceTimersByTime(125))
  expect(filledIndicators()).toBe(2)
  expect(activeKey()).toHaveTextContent('0')
})

it('disables the manual keypad while an observed RATTLER candidate is playing, never running as a second cracking mechanism', () => {
  vi.useFakeTimers()
  const verify = vi.fn(() => true)
  const onSuccess = vi.fn()
  render(<VeyraPinChallenge {...props} verify={verify} onSuccess={onSuccess} observedCandidate="6064" observedAttemptNumber={1000} />)

  for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
    expect(screen.getByRole('button', { name: digit })).toBeDisabled()
  }
  expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()

  act(() => challenge().querySelectorAll<HTMLButtonElement>('.veyra-key').forEach((key) => key.click()))
  expect(verify).not.toHaveBeenCalled()
  expect(onSuccess).not.toHaveBeenCalled()
})

it('stops observed keypad activity without fabricating a successor after canonical completion', () => {
  vi.useFakeTimers()
  const view = render(<VeyraPinChallenge {...props} observedCandidate="7042" observedAttemptNumber={7043} />)
  view.rerender(<VeyraPinChallenge {...props} />)
  act(() => vi.advanceTimersByTime(1_000))

  expect(challenge().querySelector('[data-rattler-attempt]')).toBeNull()
  expect(activeKey()).toBeNull()
  expect(filledIndicators()).toBe(0)
  expect(challenge()).not.toHaveTextContent('RATTLER')
  expect(screen.getByRole('button', { name: '1' })).not.toBeDisabled()
})

it('preserves ordinary masked manual entry and verification', async () => {
  const verify = vi.fn((pin: string) => pin === '7042')
  const onSuccess = vi.fn()
  const user = userEvent.setup()
  render(<VeyraPinChallenge {...props} verify={verify} onSuccess={onSuccess} />)

  for (const digit of '7042') await user.click(screen.getByRole('button', { name: digit }))

  expect(verify).toHaveBeenCalledOnce()
  expect(verify).toHaveBeenCalledWith('7042')
  expect(onSuccess).toHaveBeenCalledOnce()
  expect(activeKey()).toBeNull()
  expect(Array.from(challenge().querySelectorAll('.veyra-pin__dot')).every((dot) => dot.textContent === '')).toBe(true)
})
