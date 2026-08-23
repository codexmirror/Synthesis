import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GameProvider } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import type { FilesystemFile, GameState } from '../../core/game/types'
import { Files } from './Files'
import { Terminal } from '../terminal/Terminal'

describe('Files', () => {
  it('navigates canonical directories and presents file kinds, sizes, and executable details without future actions', async () => {
    const state = createInitialGameState()
    const files = [
      { kind: 'text' as const, id: 'file-text', path: '/home/user/docs/café.txt', content: 'café 🚀' },
      { kind: 'software_package' as const, id: 'file-package', path: '/home/user/nodescan.pkg', releaseId: 'nodescan-1.1-experimental', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 18_400_000 },
      { kind: 'executable' as const, id: 'file-executable', path: '/home/user/tool.bin', programId: 'diagnostic-tool', releaseId: 'diagnostic-tool-2', name: 'Diagnostic Tool', version: '2.0', sizeBytes: 4_096 },
    ]
    render(<GameProvider initialState={{ ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 4, files } } } }}><Files /></GameProvider>)
    expect(screen.getByText('/home/user')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /\.\.\/.*DIRECTORY/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nodescan\.pkg.*SOFTWARE PACKAGE.*18\.4 MB/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tool\.bin.*EXECUTABLE.*4\.1 KB/ })).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /docs.*DIRECTORY/ }))
    expect(screen.getByText('/home/user/docs')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /café\.txt.*TEXT.*10 B/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /\.\.\/.*DIRECTORY/ }))
    await user.click(screen.getByRole('button', { name: /tool\.bin/ }))
    expect(screen.getByText('Diagnostic Tool (diagnostic-tool)')).toBeInTheDocument()
    expect(screen.getByText('diagnostic-tool-2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'RUN' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'UPLOAD' })).not.toBeInTheDocument()
  })

  it('presents one supplied canonical filesystem through both Files and Terminal', async () => {
    const state = createInitialGameState()
    const initialState = {
      ...state,
      player: {
        ...state.player,
        localDevice: {
          ...state.player.localDevice,
          filesystem: { nextFileId: 50, files: [{ kind: 'text' as const, id: 'file-fixture-text', path: '/home/user/proof.txt', content: 'line one\nline two\nline three' }] },
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
    const packageFile = { kind: 'software_package' as const, id: 'file-fixture-package', path: '/home/user/release.bin', releaseId: 'altered-release', productId: 'nodescan', name: 'Canonical Scanner', version: '4.2', channel: 'testing', sizeBytes: 1_000 }
    const initialState = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 50, files: [packageFile] } } } }
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
    const file = { kind: 'software_package' as const, id: 'file-fixture-package', path: '/home/user/other.bin', releaseId: 'opaque', productId: 'other', name: 'Other', version: '1', channel: 'test', sizeBytes: 1_000 }
    render(<GameProvider initialState={{ ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 50, files: [file] } } } }}><Files /></GameProvider>)
    await userEvent.setup().click(screen.getByRole('button', { name: /other\.bin/ }))
    expect(screen.getByText('UNSUPPORTED PACKAGE')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
  })
})

describe('Files filesystem and software state', () => {
  const withFiles = (files: FilesystemFile[]) => {
    const state = createInitialGameState()
    return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 50, files } } } }
  }

  it('states an unresolved location rather than rendering nothing', () => {
    render(<GameProvider initialState={withFiles([{ kind: 'text', id: 'file-elsewhere', path: '/srv/other.txt', content: 'x' }])}><Files /></GameProvider>)
    expect(screen.getByText('DIRECTORY NOT FOUND')).toBeInTheDocument()
    expect(screen.getByText('UNRESOLVED')).toBeInTheDocument()
  })

  it('derives package listing state from the Device-owned installed software', () => {
    const experimental = { kind: 'software_package' as const, id: 'file-pkg', path: '/home/user/nodescan.pkg', releaseId: 'nodescan-1.1-experimental', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 1_000 }
    const state = withFiles([experimental])
    const { unmount } = render(<GameProvider initialState={state}><Files /></GameProvider>)
    expect(screen.getByText('INSTALLABLE')).toBeInTheDocument()
    unmount()

    const installed = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: [{ id: 'nodescan' as const, releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental' }] } } }
    render(<GameProvider initialState={installed}><Files /></GameProvider>)
    expect(screen.getByText('INSTALLED')).toBeInTheDocument()
    expect(screen.queryByText('INSTALLABLE')).not.toBeInTheDocument()
  })

  it('presents an inbound transfer as pending runtime rather than as a filesystem entry', () => {
    const base = withFiles([{ kind: 'text', id: 'file-welcome', path: '/home/user/welcome.txt', content: 'hi' }])
    const state: GameState = {
      ...base,
      deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
      fileTransfer: { nextId: 2, active: {
        id: 'transfer-0001', accessId: 'access-0001', sourceDeviceId: 'host-lan-001', sourceFileId: 'file-0002',
        destinationDeviceId: base.player.localDevice.id, destinationPath: '/home/user/downloads/nodescan-exp-1.1.pkg',
        bytesTotal: 18_400_000, bytesTransferred: 13_800_000,
      } },
    }
    render(<GameProvider initialState={state}><Files /></GameProvider>)

    // Derived from canonical bytes, so a hardcoded percentage would fail here.
    expect(screen.getByText(/INCOMING · 13\.8 \/ 18\.4 MB · 75%/)).toBeInTheDocument()
    expect(screen.getByText('downloads/nodescan-exp-1.1.pkg')).toBeInTheDocument()
    // It is not an entry: not navigable, not counted, and explicitly unwritten.
    expect(screen.queryByRole('button', { name: /downloads\/nodescan/ })).not.toBeInTheDocument()
    expect(screen.getByText('1 ENTRY')).toBeInTheDocument()
    expect(screen.getByText(/not written to this filesystem until it completes/)).toBeInTheDocument()
  })

  it('shows no inbound transfer when none is represented', () => {
    render(<GameProvider initialState={withFiles([{ kind: 'text', id: 'file-welcome', path: '/home/user/welcome.txt', content: 'hi' }])}><Files /></GameProvider>)
    expect(screen.queryByText(/INCOMING/)).not.toBeInTheDocument()
  })
})
