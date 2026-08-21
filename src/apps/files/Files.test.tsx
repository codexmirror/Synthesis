import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GameProvider } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { Files } from './Files'
import { Terminal } from '../terminal/Terminal'

describe('Files', () => {
  it('presents one supplied canonical filesystem through both Files and Terminal', async () => {
    const state = createInitialGameState()
    const initialState = {
      ...state,
      player: {
        ...state.player,
        localDevice: {
          ...state.player.localDevice,
          filesystem: { files: [{ kind: 'text' as const, path: '/home/user/proof.txt', content: 'line one\nline two\nline three' }] },
        },
      },
    }
    const { container } = render(<GameProvider initialState={initialState}><Files /><Terminal /></GameProvider>)
    expect(screen.getByText('/home/user')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /proof\.txt/ })).toBeInTheDocument()
    expect(screen.queryByText('welcome.txt')).not.toBeInTheDocument()
    expect(screen.queryByText('1 KB')).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /proof\.txt/ }))
    expect(container.querySelector('.file-content')).toHaveTextContent('line one\nline two\nline three', { normalizeWhitespace: false })
    expect(screen.getByRole('button', { name: 'Back to /home/user' })).toBeInTheDocument()

    const input = screen.getByLabelText('Command input')
    await user.type(input, 'ls /home/user{enter}')
    const terminal = within(screen.getByRole('region', { name: 'Terminal' }))
    expect(terminal.getByText('proof.txt')).toBeInTheDocument()
    await user.type(input, 'cat /home/user/proof.txt{enter}')
    expect(terminal.getByText('line one')).toBeInTheDocument()
    expect(terminal.getByText('line two')).toBeInTheDocument()
    expect(terminal.getByText('line three')).toBeInTheDocument()
  })

  it('installs a supported local package through canonical state and derives the installed presentation on reopen', async () => {
    const state = createInitialGameState()
    const packageFile = { kind: 'software_package' as const, path: '/home/user/release.bin', releaseId: 'altered-release', productId: 'nodescan', name: 'Canonical Scanner', version: '4.2', channel: 'testing' }
    const initialState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { files: [packageFile] } } } }
    render(<GameProvider initialState={initialState}><Files /><Terminal /></GameProvider>)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /release\.bin/ }))
    expect(screen.getByText('SOFTWARE PACKAGE')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Canonical Scanner' })).toBeInTheDocument()
    expect(screen.getByText('4.2 Testing')).toBeInTheDocument()
    expect(screen.getByText('RELEASE')).toBeInTheDocument()
    expect(screen.getByText('altered-release')).toBeInTheDocument()
    expect(screen.getByText('CURRENT')).toBeInTheDocument()
    expect(screen.getByText('NodeScan 1.0 Standard')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'INSTALL' }))
    expect(screen.getByRole('button', { name: 'INSTALLED ✓' })).toBeDisabled()
    expect(screen.getByText(/INSTALLED RELEASE/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to /home/user' }))
    await user.click(screen.getByRole('button', { name: /release\.bin/ }))
    expect(screen.getByRole('button', { name: 'INSTALLED ✓' })).toBeDisabled()

    await user.type(screen.getByLabelText('Command input'), 'cat /home/user/release.bin{enter}')
    expect(within(screen.getByRole('region', { name: 'Terminal' })).getByText('NOT A TEXT FILE')).toBeInTheDocument()
    expect(state.player.localDevice.installedSoftware[0]).toMatchObject({ name: 'NodeScan', version: '1.0', channel: 'standard' })
    expect(state.process.processes).toEqual([])
  })

  it('does not expose install for an unsupported represented package', async () => {
    const state = createInitialGameState()
    const file = { kind: 'software_package' as const, path: '/home/user/other.bin', releaseId: 'opaque', productId: 'other', name: 'Other', version: '1', channel: 'test' }
    render(<GameProvider initialState={{ ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { files: [file] } } } }}><Files /></GameProvider>)
    await userEvent.setup().click(screen.getByRole('button', { name: /other\.bin/ }))
    expect(screen.getByText('UNSUPPORTED PACKAGE')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
  })
})
