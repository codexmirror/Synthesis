# Documentation portal

Status: Accepted
Scope: Routing only. This document answers "I am working on X — what should I
read?" and nothing else.

This portal is **not** a knowledge base. It defines no product, architecture,
gameplay, or workflow truth of its own. Every statement of truth belongs to the
owner it routes to.


## How to use this portal

1. Inspect current `main` — accepted code is canonical repository truth.
2. Read [`AGENTS.md`](../AGENTS.md) (the repository-wide agent contract).
3. Classify the task domain in the routes below.
4. Resolve the **smallest sufficient Read Set** for that task.
5. Read the normative current owner for the domain.
6. Read only the Architecture and Design contracts the task actually depends on.
7. Inspect the named implementation and focused tests.
8. Implement the smallest requested delta.
9. Resolve documentation impact explicitly before the change is complete.

Normal implementation agents **must not** read the entire documentation tree by
default. Read Sets are not fixed-size: read what the task needs and no more.

Repository or knowledge audits are an explicit exception and may require broad
inspection.


## Authority model

```text
CURRENT IMPLEMENTED BASELINE
= current accepted code/tests + normative docs/current domain owner

DURABLE CONSTRAINTS
= AGENTS.md + docs/ARCHITECTURE.md + owning architecture module

REQUESTED DELTA
= explicitly selected Work Order

ACTIVE DESIGN AUTHORITY
= relevant Accepted design contract when the task depends on it

SUMMARY / INDEX
= docs/V0.md

FUTURE DIRECTION
= docs/FUTURE.md
```

A selected work order defines the requested delta. It does not override
`AGENTS.md` or the architecture invariants.

If accepted sources materially conflict, surface the conflict rather than
silently choosing one.

These are distinct authority axes, not a linear hierarchy. Current code that
appears to violate a durable Architecture invariant is a conflict or bug to
inspect; it does not silently supersede Architecture merely because it is the
current implementation.


## Documents that own truth

| Document | Owns |
| — | — |
| [`../README.md`](../README.md) | Project entry point, setup, commands, navigation |
| [`../AGENTS.md`](../AGENTS.md) | Repository-wide implementation-agent contract |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Architecture index, invariant register, repository boundaries, canonical ownership |
| [`architecture/`](architecture/) | The durable invariants themselves (A01–A18) |
| [`current/`](current/) | Detailed current implemented truth, per domain |
| [`V0.md`](V0.md) | Non-exhaustive current product snapshot and index |
| [`FUTURE.md`](FUTURE.md) | Confirmed future direction (not implementation authority) |
| [`HANDBOOK.md`](HANDBOOK.md) | Development workflow, agent/tool roles, review, integration, parallel work |
| [`design/`](design/) | Feature-specific accepted design contracts |
| [`work-orders/`](work-orders/) | Planned implementation deltas and their lifecycle |
| [`MIGRATION_NOTES_KNOWLEDGE_V1.md`](MIGRATION_NOTES_KNOWLEDGE_V1.md) | Historical record of the V1 knowledge migration and surfaced conflicts |


## Domain routes

### Network, reconnaissance, and access

Scan, NodeScan, Inspect, Discovery, Service Analysis, Knowledge, Credential
Access, DeviceAccess, Remote Session, RACK-OS, Authentication History.

- CURRENT TRUTH → [`current/NETWORK_ACCESS.md`](current/NETWORK_ACCESS.md)
- ARCHITECTURE → A01–A04, A09 in
  [`architecture/IDENTITY_AND_INFORMATION.md`](architecture/IDENTITY_AND_INFORMATION.md);
  A07–A08 in [`architecture/DEVICES_AND_ACCESS.md`](architecture/DEVICES_AND_ACCESS.md)
- DESIGN → [`design/HACKING_AND_OBSERVATION_V1.md`](design/HACKING_AND_OBSERVATION_V1.md),
  [`design/SCAN_INFORMATION_ARCHITECTURE_V1.md`](design/SCAN_INFORMATION_ARCHITECTURE_V1.md),
  [`design/REMOTE_SERVER_OS_V1.md`](design/REMOTE_SERVER_OS_V1.md) (RACK-OS work only)
- CODE → `src/core/game/scan.ts`, `src/core/game/inspect.ts`,
  `src/core/game/discovery.ts`, `src/core/game/serviceAnalysis.ts`,
  `src/core/game/credentialAccess.ts`, `src/core/game/remoteSession.ts`,
  `src/core/game/authenticationHistory.ts`, `src/app/localScanOperation.ts`,
  `src/app/localInspectOperation.ts`, `src/app/targetSweepOperation.ts`,
  `src/apps/network/`, `src/apps/rackos/`
- TESTS → `src/core/game/scan.test.ts`, `src/core/game/inspect.test.ts`,
  `src/core/game/discovery.test.ts`, `src/core/game/credentialAccess.test.ts`,
  `src/core/game/remoteSession.test.ts`,
  `src/app/targetSweepOperation.test.ts`, `src/apps/network/Network.test.tsx`,
  `src/apps/rackos/RackOS.test.tsx`
- DOCUMENTATION IMPACT OWNER → [`current/NETWORK_ACCESS.md`](current/NETWORK_ACCESS.md)
- NOT REQUIRED BY DEFAULT → `FUTURE.md`, unrelated domains, archived work orders

### Communication and mail

The player's in-world mail account, correspondents, threads and messages, read
state, authored replies, NodeMail.

- CURRENT TRUTH → [`current/COMMUNICATION.md`](current/COMMUNICATION.md)
- ARCHITECTURE → A03–A04, A09 in
  [`architecture/IDENTITY_AND_INFORMATION.md`](architecture/IDENTITY_AND_INFORMATION.md);
  A16 in [`architecture/SIMULATION_EVOLUTION.md`](architecture/SIMULATION_EVOLUTION.md)
- DESIGN → [`design/NODEMAIL_V1.md`](design/NODEMAIL_V1.md)
- CODE → `src/core/game/mail.ts`,
  `src/core/game/miraStagingCorrespondence.ts`, `src/apps/mail/`
- TESTS → `src/core/game/mail.test.ts`, `src/apps/mail/Mail.test.tsx`
- DOCUMENTATION IMPACT OWNER → [`current/COMMUNICATION.md`](current/COMMUNICATION.md)
  (NodeMail presentation impact → [`current/INTERFACE_SHELL.md`](current/INTERFACE_SHELL.md))
- NOT REQUIRED BY DEFAULT → `FUTURE.md`, unrelated domains, archived work orders

### Files, transfer, and software

Filesystem, Files, Download/Upload, packages, installation, removal,
executables, software management.

- CURRENT TRUTH → [`current/FILES_SOFTWARE.md`](current/FILES_SOFTWARE.md)
- ARCHITECTURE → A17 (and A07) in
  [`architecture/DEVICES_AND_ACCESS.md`](architecture/DEVICES_AND_ACCESS.md)
- DESIGN → [`design/FILES_AND_TRANSFER_V1.md`](design/FILES_AND_TRANSFER_V1.md),
  [`design/SOFTWARE_AUTHORING.md`](design/SOFTWARE_AUTHORING.md)
- CODE → `src/core/game/filesystem.ts`, `src/core/game/fileTransfer.ts`,
  `src/core/game/software.ts`, `src/core/game/softwareInstallation.ts`,
  `src/core/game/softwareRemoval.ts`, `src/apps/files/`,
  `src/apps/softwareReleaseInformation.ts`, `src/apps/rackos/`
- TESTS → `src/core/game/filesystem.test.ts`,
  `src/core/game/fileTransfer.test.ts`,
  `src/core/game/software.test.ts`,
  `src/core/game/softwareInstallation.test.ts`,
  `src/core/game/softwareRemoval.test.ts`, `src/apps/files/Files.test.tsx`,
  `src/apps/softwareReleaseInformation.test.ts`
- DOCUMENTATION IMPACT OWNER → [`current/FILES_SOFTWARE.md`](current/FILES_SOFTWARE.md)
- NOT REQUIRED BY DEFAULT → `FUTURE.md`, unrelated domains, archived work orders

### Processes and activity

GameProcess runtime, executor scheduling, cancellation, Activity Monitor.

- CURRENT TRUTH → [`current/PROCESSES_ACTIVITY.md`](current/PROCESSES_ACTIVITY.md)
- ARCHITECTURE → A10–A13 in
  [`architecture/RUNTIME_AND_CONSEQUENCES.md`](architecture/RUNTIME_AND_CONSEQUENCES.md)
- DESIGN → none currently
- CODE → `src/core/game/processes.ts`, `src/core/game/gameAdvancement.ts`,
  `src/core/game/recentActivity.ts`, `src/apps/processes/`
- TESTS → `src/core/game/processes.test.ts`,
  `src/core/game/gameAdvancement.test.ts`,
  `src/core/game/recentActivity.test.ts`, `src/apps/processes/Processes.test.tsx`
- DOCUMENTATION IMPACT OWNER → [`current/PROCESSES_ACTIVITY.md`](current/PROCESSES_ACTIVITY.md)
- NOT REQUIRED BY DEFAULT → `FUTURE.md`, unrelated domains, archived work orders

### Dollar finance, NODE economy, and Wallet

Dollar Provider Accounts, Credentials, Financial Sessions, transfers, Transactions, activity, saved sign-in and Wallet presentation; plus NODE units, mining production and payout, economic recipients, and `node-miner` CLI.

- CURRENT TRUTH → [`current/DOLLAR_FINANCE.md`](current/DOLLAR_FINANCE.md) for Dollars; [`current/NODE_ECONOMY.md`](current/NODE_ECONOMY.md) for NODE
- ARCHITECTURE → A18 in
  [`architecture/ECONOMY_AND_WALLETS.md`](architecture/ECONOMY_AND_WALLETS.md)
- DESIGN → [`design/SOFTWARE_AUTHORING.md`](design/SOFTWARE_AUTHORING.md) when a
  software release's represented behavior changes
- DESIGN → [`design/DOLLAR_FINANCIAL_PROVIDER_V1.md`](design/DOLLAR_FINANCIAL_PROVIDER_V1.md)
  (Dollar Financial Provider, Account, Credential and Financial Session identity
  and authority work only; design authority, not current truth)
- DESIGN → [`design/DOLLAR_TRANSFERS_FINANCE_CLIENT_V1.md`](design/DOLLAR_TRANSFERS_FINANCE_CLIENT_V1.md)
  (Dollar transfers, Transactions, Account activity, Device saved sign-in,
  Account switching and the Finance client; design authority, not current truth)
- DESIGN → [`design/NODE_OS_WALLET_PRODUCT_POLISH_V1.md`](design/NODE_OS_WALLET_PRODUCT_POLISH_V1.md)
  (Wallet presentation work only: hierarchy, modules, action hierarchy, balance
  trajectory, Dollar/NODE visual relationship, focused sub-surfaces, mobile
  priorities, and how `assets/node-os-wallet-v1-reference.png` is to be read;
  Presentation authority, not financial or economic truth)
- CODE → `src/core/game/dollarFinance.ts`, `src/core/game/nodeMiner.ts`, `src/core/game/nodeEconomy.ts`,
  `src/core/game/nodeMinerPayoutLog.ts`, `src/apps/wallet/`,
  `src/apps/dollarFormat.ts`,
  `src/apps/terminal/commands/nodeMiner.ts`
- TESTS → `src/core/game/nodeMiner.test.ts`,
  `src/core/game/dollarFinance.test.ts`, `src/core/game/nodeEconomy.test.ts`,
  `src/apps/dollarFormat.test.ts`, `src/apps/wallet/Wallet.test.tsx`,
  `src/apps/wallet/balanceTrajectory.test.ts`
- DOCUMENTATION IMPACT OWNER → [`current/DOLLAR_FINANCE.md`](current/DOLLAR_FINANCE.md) for Dollars; [`current/NODE_ECONOMY.md`](current/NODE_ECONOMY.md) for NODE
- NOT REQUIRED BY DEFAULT → `FUTURE.md`, unrelated domains, archived work orders

### Devices, world, and System

GameState areas, local Device, represented servers and services, hardware and
runtime, network transfer capacity, System application.

- CURRENT TRUTH → [`current/DEVICE_SYSTEM.md`](current/DEVICE_SYSTEM.md)
- ARCHITECTURE → A07, A08, A17 in
  [`architecture/DEVICES_AND_ACCESS.md`](architecture/DEVICES_AND_ACCESS.md);
  A01–A02 in [`architecture/IDENTITY_AND_INFORMATION.md`](architecture/IDENTITY_AND_INFORMATION.md)
- DESIGN → none currently
- CODE → `src/core/game/types.ts`, `src/core/game/initialState.ts`,
  `src/core/game/networkTransferCapacity.ts`,
  `src/core/game/serviceImplementations.ts`, `src/apps/system/`
- TESTS → `src/test/initialState.test.ts`,
  `src/core/game/networkTransferCapacity.test.ts`,
  `src/core/game/serviceImplementations.test.ts`, `src/apps/system/System.test.tsx`
- DOCUMENTATION IMPACT OWNER → [`current/DEVICE_SYSTEM.md`](current/DEVICE_SYSTEM.md)
- NOT REQUIRED BY DEFAULT → `FUTURE.md`, unrelated domains, archived work orders

### Shell, Home, Terminal interface, and mobile presentation

NODE-OS Shell and Home, the shared presentation language, Terminal as an
interface, Notes, editing/viewport presentation.

- CURRENT TRUTH → [`current/INTERFACE_SHELL.md`](current/INTERFACE_SHELL.md)
- ARCHITECTURE → A05–A06 and the interface/mobile boundaries in
  [`architecture/INTERFACES_AND_PRESENTATION.md`](architecture/INTERFACES_AND_PRESENTATION.md)
- DESIGN → [`design/TERMINAL_INTERACTION_V1.md`](design/TERMINAL_INTERACTION_V1.md)
  (terminal surfaces), [`design/NODE_OS_HOME_V1.md`](design/NODE_OS_HOME_V1.md)
  (Home and normal Shell presentation)
- CODE → `src/shell/`, `src/styles/`, `src/apps/terminal/`, `src/apps/notes/`
- TESTS → `src/shell/Shell.test.tsx`,
  `src/shell/editingViewportGeometry.test.ts`,
  `src/shell/editingPresentationContract.test.ts`,
  `src/App.test.tsx` (editing viewport lifecycle and leaving editing),
  `src/apps/terminal/Terminal.test.tsx`,
  `src/styles/presentationLanguage.test.ts`
- DOCUMENTATION IMPACT OWNER → [`current/INTERFACE_SHELL.md`](current/INTERFACE_SHELL.md)
- NOT REQUIRED BY DEFAULT → `FUTURE.md`, unrelated domains, archived work orders

### VEYRA company and consumer-product identity

VEYRA corporate/product identity, VEYRA OS product philosophy, and ordinary
VEYRA Device presentation direction.

- PARENT DESIGN AUTHORITY →
  [`design/VEYRA_COMPANY_PRODUCT_IDENTITY_V1.md`](design/VEYRA_COMPANY_PRODUCT_IDENTITY_V1.md)
  (company identity, ecosystem philosophy, and VEYRA OS Firmware-family
  direction)
- FIRST ORDINARY PHONE DESIGN AUTHORITY →
  [`design/VEYRA_FIRST_ORDINARY_PHONE_V1.md`](design/VEYRA_FIRST_ORDINARY_PHONE_V1.md)
  (first ordinary-phone product structure, conventional consumer app Home,
  application / system-surface navigation, Communication / Wallet / Settings
  direction, and first-phone truthfulness / absence behavior)
- FIRST ORDINARY PHONE VISUAL EXPLORATION →
  [`design/VEYRA_FIRST_ORDINARY_PHONE_VISUAL_EXPLORATION_V1.md`](design/VEYRA_FIRST_ORDINARY_PHONE_VISUAL_EXPLORATION_V1.md)
  (Draft historical exploration only, not Accepted and not a product-structure
  authority: its Personal Index Home was rejected; internal-screen work may
  still inform a revised pass)
- ARCHITECTURE → A02 in
  [`architecture/IDENTITY_AND_INFORMATION.md`](architecture/IDENTITY_AND_INFORMATION.md);
  A05–A07 in
  [`architecture/INTERFACES_AND_PRESENTATION.md`](architecture/INTERFACES_AND_PRESENTATION.md)
  and [`architecture/DEVICES_AND_ACCESS.md`](architecture/DEVICES_AND_ACCESS.md);
  A16 in [`architecture/SIMULATION_EVOLUTION.md`](architecture/SIMULATION_EVOLUTION.md);
  A17 in [`architecture/DEVICES_AND_ACCESS.md`](architecture/DEVICES_AND_ACCESS.md);
  A18 in [`architecture/ECONOMY_AND_WALLETS.md`](architecture/ECONOMY_AND_WALLETS.md)
- CURRENT TRUTH → [`current/VEYRA_OS.md`](current/VEYRA_OS.md) (the implemented
  VEYRA OS operating surface and how it is selected); the represented phone
  Device → [`current/DEVICE_SYSTEM.md`](current/DEVICE_SYSTEM.md); the access
  loop and Remote Session that reach it →
  [`current/NETWORK_ACCESS.md`](current/NETWORK_ACCESS.md); its Civic Dollar
  Account, Session and transfers →
  [`current/DOLLAR_FINANCE.md`](current/DOLLAR_FINANCE.md)
- CODE → `src/apps/veyra/`, `src/shell/remoteOperatingSurface.ts`,
  `src/core/game/firmwareIdentity.ts`
- TESTS → `src/apps/veyra/Veyra.test.tsx`,
  `src/shell/remoteOperatingSurface.test.ts`,
  `src/core/game/veyraPhoneAccess.test.ts`
- DOCUMENTATION IMPACT OWNER →
  [`current/VEYRA_OS.md`](current/VEYRA_OS.md) for implemented VEYRA behavior,
  or the design authority owning the changed VEYRA product direction above
- NOT REQUIRED BY DEFAULT → `FUTURE.md`, unrelated current-truth domains,
  archived work orders

### Workflow, review, delivery, and work orders

How work is selected, implemented, validated, reviewed, delivered, and
parallelized.

- CURRENT TRUTH → [`HANDBOOK.md`](HANDBOOK.md)
- CONTRACT → [`../AGENTS.md`](../AGENTS.md)
- TEMPLATE → [`work-orders/TEMPLATE.md`](work-orders/TEMPLATE.md)
- LIFECYCLE → [`work-orders/README.md`](work-orders/README.md)
- DOCUMENTATION IMPACT OWNER → [`HANDBOOK.md`](HANDBOOK.md) (workflow) or
  [`../AGENTS.md`](../AGENTS.md) (agent contract)
- NOT REQUIRED BY DEFAULT → domain current-truth documents, `FUTURE.md`

### Adding or changing a represented software product or release

- DESIGN CONTRACT → [`design/SOFTWARE_AUTHORING.md`](design/SOFTWARE_AUTHORING.md)
- CURRENT TRUTH → [`current/FILES_SOFTWARE.md`](current/FILES_SOFTWARE.md), plus
  [`current/NODE_ECONOMY.md`](current/NODE_ECONOMY.md) when the release has
  represented economic behavior
- ARCHITECTURE → A06 in
  [`architecture/INTERFACES_AND_PRESENTATION.md`](architecture/INTERFACES_AND_PRESENTATION.md),
  A07 in [`architecture/DEVICES_AND_ACCESS.md`](architecture/DEVICES_AND_ACCESS.md)
- CODE → `src/apps/softwareReleaseInformation.ts`, `src/core/game/software.ts`
- TESTS → `src/core/game/software.test.ts`,
  `src/apps/softwareReleaseInformation.test.ts`


## When to read FUTURE.md

[`FUTURE.md`](FUTURE.md) is confirmed direction, not implementation authority
and not current truth. It is **not** part of a default implementation Read Set.

Read it only when:

- the selected task explicitly concerns confirmed future direction;
- product or architecture planning requires it;
- another accepted owner explicitly points to a Future section.


## Archived work orders

Everything under [`work-orders/archived/`](work-orders/archived/) is historical.

Archived work orders are never current truth, never a default Read Set, and
never override current code or current-truth documents. Read one only to
understand the history of a decision, and verify anything it claims against
current `main`.
