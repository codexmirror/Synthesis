import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GameProvider } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { Files } from './Files'

describe('Files', () => {
  it('lists and reads the supplied canonical local-device filesystem without fake size metadata', async () => {
    const state = createInitialGameState()
    const initialState = {
      ...state,
      player: {
        ...state.player,
        localDevice: {
          ...state.player.localDevice,
          filesystem: { files: [{ path: '/home/user/proof.txt', content: 'Changed canonical content.' }] },
        },
      },
    }
    render(<GameProvider initialState={initialState}><Files /></GameProvider>)
    expect(screen.getByText('/home/user')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /proof\.txt/ })).toBeInTheDocument()
    expect(screen.queryByText('welcome.txt')).not.toBeInTheDocument()
    expect(screen.queryByText('1 KB')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /proof\.txt/ }))
    expect(screen.getByText('Changed canonical content.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to /home/user' })).toBeInTheDocument()
  })
})
