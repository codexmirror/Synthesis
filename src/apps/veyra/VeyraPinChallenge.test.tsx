import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { VeyraPinChallenge } from './VeyraPinChallenge'

const props = { verify: vi.fn(() => false), onSuccess: vi.fn(), onCancel: vi.fn() }

it('changes the masked Wallet projection only when canonical RATTLER attempt truth changes', () => {
  const view = render(<VeyraPinChallenge {...props} observedCandidate="6999" observedAttemptNumber={1000} />)
  const challenge = screen.getByRole('region', { name: 'Enter Device PIN' })
  const before = Array.from(challenge.querySelectorAll('.veyra-pin__dot')).map((dot) => dot.hasAttribute('data-filled'))
  expect(challenge).toHaveTextContent('RATTLER · ATTEMPT 1000')
  expect(challenge).not.toHaveTextContent('6999')

  view.rerender(<VeyraPinChallenge {...props} observedCandidate="7000" observedAttemptNumber={1001} />)
  const after = Array.from(challenge.querySelectorAll('.veyra-pin__dot')).map((dot) => dot.hasAttribute('data-filled'))
  expect(after).not.toEqual(before)
  expect(challenge).toHaveTextContent('RATTLER · ATTEMPT 1001')
  expect(challenge).not.toHaveTextContent('7000')
})

it('keeps the ordinary manual challenge free of RATTLER projection', () => {
  render(<VeyraPinChallenge {...props} />)
  const challenge = screen.getByRole('region', { name: 'Enter Device PIN' })
  expect(challenge).not.toHaveTextContent('RATTLER')
  expect(challenge.querySelector('[data-rattler-attempt]')).toBeNull()
})
