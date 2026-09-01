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

it('keeps candidate 6064 masked while pressing its keypad digits in four steps', () => {
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

it('immediately resets and rebinds playback when canonical attempt identity changes', () => {
  vi.useFakeTimers()
  const view = render(<VeyraPinChallenge {...props} observedCandidate="6064" observedAttemptNumber={1000} />)
  act(() => vi.advanceTimersByTime(250))
  expect(filledIndicators()).toBe(3)
  expect(activeKey()).toHaveTextContent('6')

  view.rerender(<VeyraPinChallenge {...props} observedCandidate="7812" observedAttemptNumber={1001} />)
  expect(filledIndicators()).toBe(1)
  expect(activeKey()).toHaveTextContent('7')
  expect(challenge()).toHaveTextContent('RATTLER · ATTEMPT 1001')

  act(() => vi.advanceTimersByTime(125))
  expect(filledIndicators()).toBe(2)
  expect(activeKey()).toHaveTextContent('8')
  act(() => vi.advanceTimersByTime(125))
  expect(activeKey()).toHaveTextContent('1')
  act(() => vi.advanceTimersByTime(125))
  expect(activeKey()).toHaveTextContent('2')
})

it('cancels stale candidate timers when rebinding before their next step', () => {
  vi.useFakeTimers()
  const view = render(<VeyraPinChallenge {...props} observedCandidate="6999" observedAttemptNumber={1000} />)
  act(() => vi.advanceTimersByTime(100))
  view.rerender(<VeyraPinChallenge {...props} observedCandidate="1234" observedAttemptNumber={1001} />)

  act(() => vi.advanceTimersByTime(25))
  expect(filledIndicators()).toBe(1)
  expect(activeKey()).toHaveTextContent('1')
  act(() => vi.advanceTimersByTime(100))
  expect(filledIndicators()).toBe(2)
  expect(activeKey()).toHaveTextContent('2')
})

it('stops observed keypad activity without fabricating a successor after canonical completion', () => {
  vi.useFakeTimers()
  const view = render(<VeyraPinChallenge {...props} observedCandidate="7042" observedAttemptNumber={1043} />)
  view.rerender(<VeyraPinChallenge {...props} />)
  act(() => vi.advanceTimersByTime(500))

  expect(challenge().querySelector('[data-rattler-attempt]')).toBeNull()
  expect(activeKey()).toBeNull()
  expect(filledIndicators()).toBe(0)
  expect(challenge()).not.toHaveTextContent('RATTLER')
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
