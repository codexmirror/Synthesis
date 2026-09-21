import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState } from '../../app/GameContext'
import { connectRemoteFromObservation } from '../../core/game/remoteSession'
import { installRemoteSoftwarePackage } from '../../core/game/softwareInstallation'
import { createInitialGameState } from '../../core/game/initialState'
import { RACK_OS_1_1_BUSINESS_FIRMWARE_ID, RACK_OS_FIRMWARE_ID } from '../../core/game/firmwareIdentity'
import { RACK_OS_1_1_BUSINESS_RELEASE, RACK_OS_FIRMWARE_UPDATE_DURATION_MS } from '../../core/game/rackOsFirmwareUpdate'
import { Shell } from '../../shell/Shell'
import type { ExecutableFile, GameProcess, GameState, NetworkHost, NodeMinerProcess } from '../../core/game/types'
import { rememberScan } from '../../core/game/discovery'
import { scanNetworkTarget } from '../../core/game/scan'
import { Terminal } from '../terminal/Terminal'
import { withoutBookstoreBackgroundTiming } from '../../test/canonicalSnapshot'
import rackSource from './RackOS.tsx?raw'
import rackUpdateSource from './RackFirmwareUpdate.tsx?raw'
import rackCss from './rackos.css?raw'
import { executeBookstoreSale } from '../../core/game/bookstoreSale'
import { BOOKSTORE_BRANCH_ID } from '../../core/game/business'
import { BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, placeBookstoreRestockOrder, proposeBookstoreRestockOrder } from '../../core/game/bookstoreRestock'

function StateSnapshot() { return <output data-testid="game-state">{JSON.stringify(useGameState())}</output> }

function discoveredAccessState(): GameState {
  const state = createInitialGameState()
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  let discovery = rememberScan(state.discovery, scanNetworkTarget(targets, state.player.localDevice.network.ip), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, 'home-net'), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, '198.51.100.47'), state.player.localDevice.id)
  return { ...state, discovery, deviceAccess: { nextId: 2, established: [{ id: 'access-roundtrip', sourceDeviceId: state.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] } }
}

function connectedState(): GameState {
  const base = createInitialGameState()
  const host = base.world.network.hosts[0]
  const altered = { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, displayName: 'live-server', ip: '192.0.2.99', firmware: { id: RACK_OS_FIRMWARE_ID, name: 'STATE-OS', version: '7.4' }, filesystem: { nextFileId: 50, files: [{ kind: 'text' as const, id: 'file-fixture-text', path: '/srv/proof.txt', content: 'Foreign canonical proof.' }] } }, ...base.world.network.hosts.slice(1)] } }, deviceAccess: { nextId: 2, established: [{ id: 'access-test', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: 'service-http-001', privilege: 'USER' as const }] } }
  const connected = connectRemoteFromObservation(altered, { targetDeviceId: host.id, address: '192.0.2.99' }).state
  return { ...connected, remoteSession: { ...connected.remoteSession, active: { ...connected.remoteSession.active!, connectedAddress: '198.51.100.47' } } }
}

/** `connectedState` plus a represented remote `/home/user` directory, so the
 *  remote-first Upload workflow can start from a non-root remote directory. */
function connectedStateWithRemoteHome(): GameState {
  const base = connectedState()
  const host = base.world.network.hosts[0]
  const files = [...host.filesystem!.files, { kind: 'text' as const, id: 'file-fixture-remote-home', path: '/home/user/notes.txt', content: 'Remote workspace notes.' }]
  return { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, filesystem: { nextFileId: 60, files } }, ...base.world.network.hosts.slice(1)] } } }
}

async function enterRemote(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^ENTER .+ →$/ }))
}

afterEach(() => vi.useRealTimers())


/** srv-02, authorized and connected, with the exact represented firmware installer already on it. */
function srv02WithInstaller(firmwareId: string = RACK_OS_FIRMWARE_ID): GameState {
  const base = createInitialGameState()
  const installer = {
    kind: 'firmware_package' as const, id: 'file-firmware', path: INSTALLER_PATH,
    firmwareId: RACK_OS_1_1_BUSINESS_RELEASE.firmware.id, buildId: RACK_OS_1_1_BUSINESS_RELEASE.buildId,
    name: RACK_OS_1_1_BUSINESS_RELEASE.firmware.name, version: RACK_OS_1_1_BUSINESS_RELEASE.firmware.version,
    publisher: RACK_OS_1_1_BUSINESS_RELEASE.publisher, sizeBytes: RACK_OS_1_1_BUSINESS_RELEASE.installerSizeBytes,
  }
  const hosts = base.world.network.hosts.map((host) => host.id === 'host-lan-002'
    ? {
      ...host,
      firmware: firmwareId === RACK_OS_FIRMWARE_ID ? host.firmware : { ...RACK_OS_1_1_BUSINESS_RELEASE.firmware },
      filesystem: { nextFileId: host.filesystem!.nextFileId + 1, files: [...host.filesystem!.files, installer] },
    }
    : host)
  const access = { id: 'access-firmware', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-ssh-002', privilege: 'USER' as const }
  const authorized = { ...base, deviceAccess: { nextId: 2, established: [access] }, world: { ...base.world, network: { ...base.world.network, hosts } } }
  return connectRemoteFromObservation(authorized, { targetDeviceId: 'host-lan-002', address: '203.0.113.42' }).state
}

const INSTALLER_PATH = '/opt/rack-os-1.1-business.fwpkg'

/**
 * The exact stale-Session precondition the canonical `target_offline` refusal
 * defends against: a Remote Session that is still fully established, over a
 * target Device whose own operational truth has already become network-
 * unusable. Reachability advancement clears a Session like this on its next
 * tick; this fixture captures the state before that tick runs, so presentation
 * can be proven never to offer what the canonical operation would refuse in
 * that gap.
 */
function srv02WithInstallerOffline(): GameState {
  const online = srv02WithInstaller()
  return {
    ...online,
    world: { ...online.world, network: { ...online.world.network, hosts: online.world.network.hosts.map((host) =>
      host.id === 'host-lan-002' ? { ...host, operational: { lifecycle: 'RUNNING' as const, connectivity: 'DISCONNECTED' as const } } : host) } },
  }
}

/** srv-01 already on RACK-OS 1.1 Business: a compatible Device on home-net, which has no associated Business Branch at all. */
function srv01OnBusiness(): GameState {
  const base = createInitialGameState()
  const hosts = base.world.network.hosts.map((host) => host.id === 'host-lan-001'
    ? { ...host, firmware: { ...RACK_OS_1_1_BUSINESS_RELEASE.firmware } }
    : host)
  const access = { id: 'access-srv-01', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' as const }
  const authorized = { ...base, deviceAccess: { nextId: 2, established: [access] }, world: { ...base.world, network: { ...base.world.network, hosts } } }
  return connectRemoteFromObservation(authorized, { targetDeviceId: 'host-lan-001', address: '198.51.100.47' }).state
}

/**
 * ops-01 (`host-lan-003`), already reached: fresh `createInitialGameState()`
 * grants this Device no DeviceAccess or Remote Session of its own, so this
 * establishes both the same canonical way `srv01OnBusiness` above does for
 * srv-01 — a plain `DeviceAccess` record over its real GateSSH Service and
 * `connectRemoteFromObservation` — rather than through any Device-specific
 * shortcut. `host-lan-003` starts directly on RACK-OS 1.1 Business, so unlike
 * `srv02WithInstaller` this fixture performs no Firmware installation at all.
 */
function ops01Connected(): GameState {
  const base = createInitialGameState()
  // ops-01 sits on Bookstore's private segment, reachable only through its Gateway's own public edge.
  const access = { id: 'access-ops-01', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-003', viaServiceId: 'service-ssh-004', privilege: 'USER' as const }
  const authorized = { ...base, deviceAccess: { nextId: 2, established: [access] } }
  return connectRemoteFromObservation(authorized, { targetDeviceId: 'host-lan-003', address: '203.0.113.42' }).state
}

function ops01WithIncomingRestock(): GameState {
  let state = createInitialGameState()
  for (let index = 0; index < 7; index += 1) {
    const samples = [0, 0.999999]
    const sale = executeBookstoreSale(state, BOOKSTORE_BRANCH_ID, () => samples.shift() ?? 0)
    if (sale.status !== 'sold') throw new Error('expected fixture sale')
    state = sale.state
  }
  const restockProposal = proposeBookstoreRestockOrder(state, BOOKSTORE_BRANCH_ID, BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, { caseCount: 1 })
  if (restockProposal.status !== 'proposed') throw new Error('expected fixture proposal')
  const order = placeBookstoreRestockOrder(state, BOOKSTORE_BRANCH_ID, { caseCount: 1 }, restockProposal.proposal)
  if (order.status !== 'ordered') throw new Error('expected fixture restock order')
  // ops-01 sits on Bookstore's private segment, reachable only through its Gateway's own public edge.
  const access = { id: 'access-ops-01', sourceDeviceId: order.state.player.localDevice.id, targetDeviceId: 'host-lan-003', viaServiceId: 'service-ssh-004', privilege: 'USER' as const }
  return connectRemoteFromObservation({ ...order.state, deviceAccess: { nextId: 2, established: [access] } }, { targetDeviceId: 'host-lan-003', address: '203.0.113.42' }).state
}

function ReconnectControl() {
  const actions = useGameActions()
  return <button onClick={() => actions.connectRemoteFromObservation({ targetDeviceId: 'host-lan-002', address: '203.0.113.42' })}>test reconnect</button>
}

/** The Applications home entries, in listed order, as a player reads them. */
function applicationNames() {
  return [...document.querySelectorAll('.rack-appitem__name')].map((name) => name.textContent)
}

/** Each application's own note line, in listed order (SYSTEM for a built-in, INSTALLED · <version> for real InstalledSoftware). */
function applicationNotes() {
  return [...document.querySelectorAll('.rack-appitem__note')].map((note) => note.textContent)
}

describe('RACK-OS 1.1 Business application shell', () => {
  it('opens on an Applications home instead of the 1.0 section bar', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={srv02WithInstaller(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)}><Shell /></GameProvider>)
    await enterRemote(user)

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('RACK-OS 1.1 Business')
    expect(rackOs.dataset.release).toBe('business')
    // The 1.0 technical section bar is gone entirely.
    expect(screen.queryByRole('navigation', { name: /sections/ })).toBeNull()
    expect(screen.getByRole('region', { name: 'Applications' })).toBeInTheDocument()
    // Terminal, Files, System and BUSINESS are all Firmware-owned built-ins of
    // this release, always listed regardless of whether this Device's Network
    // context resolves any Business Branch.
    expect(applicationNames()).toEqual(['TERMINAL', 'FILES', 'SYSTEM', 'BUSINESS'])
    expect(screen.getByText('APPLICATIONS · 4')).toBeInTheDocument()
    expect(screen.queryByText(/INSTALLED APPLICATIONS/)).toBeNull()
    // None of the four built-ins is InstalledSoftware, so none carries an INSTALLED note.
    expect(applicationNotes()).toEqual(['SYSTEM', 'SYSTEM', 'SYSTEM', 'SYSTEM'])
  })

  it('opens BUSINESS and returns to Applications without touching canonical state', async () => {
    const user = userEvent.setup()
    const initial = srv02WithInstaller(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)
    render(<GameProvider initialState={initial}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    const before = withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState)

    await user.click(screen.getByRole('button', { name: /^BUSINESS/ }))
    const business = screen.getByRole('region', { name: 'Business' })
    expect(business).toHaveTextContent('BUSINESS BRANCH')
    expect(business).toHaveTextContent('Bookstore Branch 01')
    expect(business).toHaveTextContent('Bookstore')
    expect(business).toHaveTextContent('remote-segment-01')
    // Recent Sales explains the actual historical purchase through its captured line items, never a generic label.
    expect(business).toHaveTextContent('Systems of Dust ×1')
    expect(business).toHaveTextContent('$20.00')
    // The current merchandise catalog is inspectable: name, current price, and current stock.
    expect(business).toHaveTextContent('Night Transit')
    expect(business).toHaveTextContent('$8.99')
    expect(business).toHaveTextContent('45 in stock')
    // The seeded Branch's own represented current location.
    expect(within(business).getByText('LOCATION').closest('div')).toHaveTextContent('18 Mercer Street')
    // The seeded Branch has both a commerce record and an operations record represented.
    expect(business).toHaveTextContent('OPEN')
    expect(business).toHaveTextContent('360 / 480')
    expect(within(business).getByText('CHECKOUTS').closest('div')).toHaveTextContent('2')
    // Demand is presented as opportunities, never as guaranteed sales, and derives from the represented cadence configuration (10/hour × 1.00).
    expect(within(business).getByText('DEMAND OPPORTUNITIES').closest('div')).toHaveTextContent('~10 / HOUR')
    expect(within(business).getByText('ATTRACTIVENESS').closest('div')).toHaveTextContent('1.00×')
    expect(within(business).getByText('TREASURY ACCOUNT').closest('div')).toHaveTextContent('CD-4827-6109')
    expect(within(business).getByText('SETTLEMENT ACCOUNT').closest('div')).toHaveTextContent('CD-4827-6109')
    expect(business.textContent).not.toMatch(/expected sales|guaranteed/i)
    // The seeded Branch also has a concrete backend represented, resolved from the real srv-02 Device/Service it references by stable ID.
    expect(business).toHaveTextContent('BACKEND')
    expect(business).toHaveTextContent('Bookstore Backend 1.0')
    expect(within(business).getByText('BACKEND STATUS').closest('div')).toHaveTextContent('ONLINE')
    // Read-only: no internal identifiers, credentials, or Player identity.
    expect(business.textContent).not.toContain('dollar-account-veyra-phone-v0')
    expect(within(business).getByText('TREASURY ACCOUNT').closest('div')).not.toHaveTextContent('CD-3318-2204')
    expect(within(business).getByText('SETTLEMENT ACCOUNT').closest('div')).not.toHaveTextContent('CD-3318-2204')
    expect(business.textContent).not.toContain('host-lan-002')
    expect(business.textContent).not.toContain('service-bookstore-backend-002')
    expect(business.textContent).not.toMatch(/credential|session|violet-orbit|player-local/i)
    expect(business.textContent).not.toMatch(/\b(pay|buy|transfer|switch account)\b/i)
    expect(business.textContent).not.toMatch(/treasury balance/i)
    // Internal simulation countdown truth, not player-facing Business information.
    expect(business.textContent).not.toMatch(/remainingUntilOpportunity/i)

    await user.click(screen.getByRole('button', { name: /APPLICATIONS$/ }))
    expect(screen.getByRole('region', { name: 'Applications' })).toBeInTheDocument()

    // Terminal reaches exactly the same canonical mechanics through the new shell.
    await user.click(screen.getByRole('button', { name: /^TERMINAL/ }))
    await user.type(screen.getByLabelText('Remote command'), 'cat /srv/backup-manifest.txt{enter}')
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('Backup manifest for srv-02.')
    expect(withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? ''))).toEqual(before)
  })

  it('observes incoming Bookstore stock read-only without exposing Treasury balance or purchase controls', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={ops01WithIncomingRestock()}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: /^BUSINESS/ }))
    const business = screen.getByRole('region', { name: 'Business' })
    expect(within(business).getByText('INCOMING STOCK').closest('div')).toHaveTextContent('16')
    expect(within(business).getByText('RESTOCK ORDERS').closest('div')).toHaveTextContent('1 IN TRANSIT')
    expect(business.textContent).not.toMatch(/treasury balance/i)
    expect(within(business).queryByRole('button')).toBeNull()
  })

  it('keeps the current settlement Account distinct from the completed sale historical settlement', async () => {
    const user = userEvent.setup()
    const base = srv02WithInstaller(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)
    const redirected = { ...base, bookstoreCommerce: { ...base.bookstoreCommerce, records: base.bookstoreCommerce.records.map((record) => record.branchId === 'bookstore-branch-01' ? { ...record, settlementAccountId: 'dollar-account-local-v0' } : record) } }
    render(<GameProvider initialState={redirected}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: /^BUSINESS/ }))

    const business = screen.getByRole('region', { name: 'Business' })
    expect(within(business).getByText('SETTLEMENT ACCOUNT').closest('div')).toHaveTextContent('CD-1042-7781')
    expect(within(business).getByText('SETTLED TO').closest('div')).toHaveTextContent('CD-3318-2204')
  })

  it('presents a truthful NO BUSINESS CONFIGURED state on a 1.1 Business Device whose Network has no associated Business Branch', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={srv01OnBusiness()}><Shell /></GameProvider>)
    await enterRemote(user)

    expect(screen.getByRole('region', { name: 'Applications' })).toBeInTheDocument()
    // BUSINESS is still a listed built-in even though this Device's Network has no Business Branch.
    expect(applicationNames()).toEqual(['TERMINAL', 'FILES', 'SYSTEM', 'BUSINESS'])

    await user.click(screen.getByRole('button', { name: /^BUSINESS/ }))
    const business = screen.getByRole('region', { name: 'Business' })
    expect(business).toHaveTextContent('NETWORK')
    expect(business).toHaveTextContent('home-net')
    expect(business).toHaveTextContent('NO BUSINESS CONFIGURED')
    // Truthfully empty, never an invented Company, error, or missing-installation message.
    expect(business.textContent).not.toContain('Bookstore Branch 01')
    expect(business.textContent).not.toMatch(/error|not installed|not found/i)
  })

  it('presents a structurally valid Branch with neither concrete subsystem beside one that has commerce, without inventing settlement, sale, or operations data', async () => {
    const user = userEvent.setup()
    const base = srv02WithInstaller(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)
    // A second Branch on the same Network, owned by the same Company, with no
    // bookstoreCommerce or bookstoreOperations record at all — a legitimate
    // structural Branch for a future concrete subsystem (hosting,
    // distribution, ...) this slice does not implement.
    const noCommerceBranch = { id: 'branch-fixture-hosting', displayName: 'Fixture Hosting Branch', companyId: base.business.companies[0].id, networkId: 'network-foreign-001' }
    const initial = { ...base, business: { ...base.business, branches: [...base.business.branches, noCommerceBranch] } }
    render(<GameProvider initialState={initial}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: /^BUSINESS/ }))

    const business = screen.getByRole('region', { name: 'Business' })
    // The bookstore Branch still shows its own concrete commerce, unaffected by the sibling Branch.
    expect(business).toHaveTextContent('Bookstore Branch 01')
    expect(business).toHaveTextContent('$20.00')
    // The structurally valid Branch presents its own Company/Branch/Network identity...
    expect(business).toHaveTextContent('Fixture Hosting Branch')
    const fixtureHeading = within(business).getByRole('heading', { name: 'Fixture Hosting Branch' })
    const fixtureBlock = fixtureHeading.closest('.rack-artifact')!
    // ...but invents no settlement, sale, status, backend, or error state for the subsystems it does not have.
    expect(fixtureBlock).not.toHaveTextContent('SETTLEMENT ACCOUNT')
    expect(fixtureBlock).not.toHaveTextContent('RECENT SALES')
    expect(fixtureBlock).not.toHaveTextContent('STATUS')
    expect(fixtureBlock).not.toHaveTextContent('STOCK')
    expect(fixtureBlock).not.toHaveTextContent('CHECKOUTS')
    expect(fixtureBlock).not.toHaveTextContent('BACKEND')
    expect(fixtureBlock.textContent).not.toMatch(/error|not configured|missing/i)
  })

  it('presents a Branch with operations but no commerce, and a Branch with commerce but no operations, each independently and without fabricating the missing subsystem', async () => {
    const user = userEvent.setup()
    const base = srv02WithInstaller(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)
    const companyId = base.business.companies[0].id
    const operationsOnlyBranch = { id: 'branch-fixture-operations-only', displayName: 'Fixture Operations-Only Branch', companyId, networkId: 'network-foreign-001' }
    const commerceOnlyBranch = { id: 'branch-fixture-commerce-only', displayName: 'Fixture Commerce-Only Branch', companyId, networkId: 'network-foreign-001' }
    const initial = {
      ...base,
      business: { ...base.business, branches: [...base.business.branches, operationsOnlyBranch, commerceOnlyBranch] },
      bookstoreOperations: {
        records: [...base.bookstoreOperations.records, {
          branchId: operationsOnlyBranch.id, shelfCapacity: 150, checkoutCapacity: 1, open: false, stock: [{ merchandiseId: 'fixture-merch-001', quantity: 90 }],
        }],
      },
      bookstoreCommerce: {
        ...base.bookstoreCommerce,
        records: [...base.bookstoreCommerce.records, {
          branchId: commerceOnlyBranch.id, settlementAccountId: 'dollar-account-local-v0', assortment: ['fixture-merch-002'], completedSales: [],
        }],
      },
    }
    render(<GameProvider initialState={initial}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: /^BUSINESS/ }))

    const business = screen.getByRole('region', { name: 'Business' })

    const operationsHeading = within(business).getByRole('heading', { name: 'Fixture Operations-Only Branch' })
    const operationsBlock = operationsHeading.closest('.rack-artifact') as HTMLElement
    expect(operationsBlock).toHaveTextContent('CLOSED')
    expect(operationsBlock).toHaveTextContent('90 / 150')
    expect(within(operationsBlock).getByText('CHECKOUTS').closest('div')).toHaveTextContent('1')
    expect(operationsBlock).not.toHaveTextContent('SETTLEMENT ACCOUNT')
    expect(operationsBlock).not.toHaveTextContent('RECENT SALES')
    expect(operationsBlock).not.toHaveTextContent('BACKEND')

    const commerceHeading = within(business).getByRole('heading', { name: 'Fixture Commerce-Only Branch' })
    const commerceBlock = commerceHeading.closest('.rack-artifact') as HTMLElement
    expect(within(commerceBlock).getByText('SETTLEMENT ACCOUNT').closest('div')).toHaveTextContent('CD-1042-7781')
    expect(commerceBlock).not.toHaveTextContent('STATUS')
    expect(commerceBlock).not.toHaveTextContent('STOCK')
    expect(commerceBlock).not.toHaveTextContent('CHECKOUTS')
    expect(commerceBlock).not.toHaveTextContent('BACKEND')
  })

  it('presents the backend as truthfully OFFLINE when the referenced Device is not currently network-usable, without inventing an error state', async () => {
    const user = userEvent.setup()
    const base = srv02WithInstaller(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)
    // The backend's referenced Device (srv-02 itself) is temporarily unusable; the Branch and its other subsystems are untouched.
    const initial = {
      ...base,
      world: { ...base.world, network: { ...base.world.network, hosts: base.world.network.hosts.map((host) =>
        host.id === 'host-lan-002' ? { ...host, services: host.services!.map((service) => service.id === 'service-bookstore-backend-002' ? { ...service, open: false } : service) } : host) } },
    }
    render(<GameProvider initialState={initial}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: /^BUSINESS/ }))

    const business = screen.getByRole('region', { name: 'Business' })
    expect(business).toHaveTextContent('Bookstore Backend 1.0')
    expect(within(business).getByText('BACKEND STATUS').closest('div')).toHaveTextContent('OFFLINE')
    expect(business.textContent).not.toMatch(/error|not found|missing/i)
    // The Branch, its operations, and its commerce remain unaffected by the backend's own availability.
    expect(business).toHaveTextContent('Bookstore Branch 01')
    expect(business).toHaveTextContent('OPEN')
  })

  it('presents no BACKEND section for a Branch with no represented backend record, without fabricating one', async () => {
    const user = userEvent.setup()
    const base = srv02WithInstaller(RACK_OS_1_1_BUSINESS_FIRMWARE_ID)
    const noBackendBranch = { id: 'branch-fixture-no-backend', displayName: 'Fixture No-Backend Branch', companyId: base.business.companies[0].id, networkId: 'network-foreign-001' }
    const initial = { ...base, business: { ...base.business, branches: [...base.business.branches, noBackendBranch] } }
    render(<GameProvider initialState={initial}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: /^BUSINESS/ }))

    const business = screen.getByRole('region', { name: 'Business' })
    const heading = within(business).getByRole('heading', { name: 'Fixture No-Backend Branch' })
    const block = heading.closest('.rack-artifact') as HTMLElement
    expect(block).not.toHaveTextContent('BACKEND')
    // The seeded Branch's own backend is unaffected by the sibling Branch having none.
    expect(business).toHaveTextContent('Bookstore Backend 1.0')
  })

  /*
   * ops-01 (`host-lan-003`): a small operations-oriented RACK-OS 1.1 Business
   * server on `network-foreign-001`, the LocalNetwork Bookstore Branch 01
   * explicitly operates through — not a Device owned by or assigned to that
   * Branch; no such relationship is represented anywhere in this slice.
   * Seeded directly on the canonical RACK-OS 1.1 Business Firmware release
   * rather than reached through a Firmware installation. DeviceAccess
   * is established the same canonical way `srv01OnBusiness` above already
   * establishes it for srv-01 — no Device-specific mechanic exists to grant
   * it, and fresh `createInitialGameState()` grants none of it by itself
   * (`src/test/initialState.test.ts` proves that absence at the state level).
   */
  it('resolves Bookstore Branch 01 and current Purchase Composition V1 truth from ops-01, on its own seeded RACK-OS 1.1 Business Firmware and with no Firmware installation performed', async () => {
    const user = userEvent.setup()
    const initial = ops01Connected()
    // Never installed: this Device starts on the release directly.
    expect(initial.world.network.hosts.find(({ id }) => id === 'host-lan-003')?.firmwareUpdate).toBeUndefined()

    render(<GameProvider initialState={initial}><Shell /></GameProvider>)
    await enterRemote(user)
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('RACK-OS 1.1 Business')

    await user.click(screen.getByRole('button', { name: /^BUSINESS/ }))
    const business = screen.getByRole('region', { name: 'Business' })
    // Resolved through ops-01's own real membership in network-foreign-001 — the same Network Bookstore Branch 01 references — never a Device-specific Business link.
    expect(business).toHaveTextContent('BUSINESS BRANCH')
    expect(business).toHaveTextContent('Bookstore Branch 01')
    expect(business).toHaveTextContent('remote-segment-01')
    // Current Purchase Composition V1 truth, read from the same canonical owners srv-02 presents it from — never duplicated onto ops-01.
    expect(business).toHaveTextContent('Systems of Dust ×1')
    expect(business).toHaveTextContent('$20.00')
    expect(business).toHaveTextContent('Night Transit')
    expect(business).toHaveTextContent('45 in stock')
    expect(business).toHaveTextContent('OPEN')
    // The Bookstore backend remains srv-02's own concrete record; ops-01 carries no backend state of its own.
    expect(business).toHaveTextContent('BACKEND')
    expect(business).toHaveTextContent('Bookstore Backend 1.0')
    expect(within(business).getByText('BACKEND STATUS').closest('div')).toHaveTextContent('ONLINE')
    expect(business.textContent).not.toContain('host-lan-002')
    expect(business.textContent).not.toContain('host-lan-003')
  })

  it('still reflects real srv-02 backend truth when BUSINESS is opened from ops-01', async () => {
    const user = userEvent.setup()
    const base = ops01Connected()
    // srv-02's own backend Service goes unavailable; nothing about ops-01 or the Branch itself changes.
    const initial = {
      ...base,
      world: { ...base.world, network: { ...base.world.network, hosts: base.world.network.hosts.map((host) =>
        host.id === 'host-lan-002' ? { ...host, services: host.services!.map((service) => service.id === 'service-bookstore-backend-002' ? { ...service, open: false } : service) } : host) } },
    }
    render(<GameProvider initialState={initial}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: /^BUSINESS/ }))

    const business = screen.getByRole('region', { name: 'Business' })
    expect(business).toHaveTextContent('Bookstore Backend 1.0')
    expect(within(business).getByText('BACKEND STATUS').closest('div')).toHaveTextContent('OFFLINE')
    // The Branch itself remains unaffected by its backend's own availability.
    expect(business).toHaveTextContent('Bookstore Branch 01')
    expect(business).toHaveTextContent('OPEN')
  })
})
