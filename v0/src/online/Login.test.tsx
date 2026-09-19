import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Login } from './Login'

describe('online entry', () => {
  it('presents the single create-or-login action and submits authentication input', async () => {
    const enter = vi.fn(async () => undefined); render(<Login onEnter={enter} />)
    expect(screen.getByLabelText('NAME')).toBeVisible(); expect(screen.getByLabelText('PASSWORD')).toHaveAttribute('type', 'password')
    await userEvent.type(screen.getByLabelText('NAME'), 'Alice'); await userEvent.type(screen.getByLabelText('PASSWORD'), 'correct-horse-1'); await userEvent.click(screen.getByRole('button', { name: 'ENTER SYNTHESIS' }))
    expect(enter).toHaveBeenCalledWith('Alice', 'correct-horse-1')
  })

  it('shows a restrained authentication failure', async () => {
    render(<Login onEnter={async () => { throw new Error('Name or password is incorrect.') }} />)
    await userEvent.type(screen.getByLabelText('NAME'), 'Alice'); await userEvent.type(screen.getByLabelText('PASSWORD'), 'wrong-password-1'); await userEvent.click(screen.getByRole('button', { name: 'ENTER SYNTHESIS' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('incorrect')
  })
})
