# Dollar Finance — current truth

Status: Accepted
Scope: The implemented Dollar Financial Provider, its Accounts, Credentials, authentication, Financial Sessions, and Dollar presentation in Wallet.

This document is the normative owner of current implemented Dollar finance truth. Durable separation rules belong to A18, and the selected semantic model belongs to `docs/design/DOLLAR_FINANCIAL_PROVIDER_V1.md`.

## Canonical state

`GameState.dollarFinance` represents exactly one concrete Provider, Civic Dollar. It directly owns Provider identity and display name, Financial Accounts, Credentials, and active Financial Sessions; there is no provider registry or generic financial-access layer.

A Financial Account has a stable internal ID, a distinct Provider-scoped account reference, and an integer `balanceCents`. Initial state contains exactly one Account with 125000 cents ($1,250.00). The Account ID is distinct from Player, Device, Credential, login, Session, and account-reference identity.

One Credential has its own stable ID, references the Account by stable Account ID, and carries an exact login identifier and password as Provider World Truth. Credential material is not authority and is not player knowledge.

## Authentication and authority

`authenticateDollarAccount` accepts a represented client Device ID and exact login identifier/password. Unknown logins and wrong passwords both return `invalid_credentials`; invented Devices return `device_not_found`, and a Credential whose Account cannot resolve returns `account_unavailable`. Failures preserve all existing state, including an existing valid Session.

Success allocates a fresh deterministic Session ID, removes only a prior Session for the same Device, and creates one Device-bound Session authorizing exactly the Credential's Account. Other Devices' Sessions remain. Thus one Device has at most one Session for this Provider while multiple Devices may independently authorize the same Account.

`logoutDollarAccount` removes only the acting Device's Session and otherwise returns `not_signed_in` without changing state. Authentication and logout are immediate transitions: neither creates a Process or modifies Accounts, balances, Credentials, DeviceAccess, RemoteSession, NODE Wallet, or NODE Economy.

Account resolution fails closed and follows only:

```text
represented Device -> exactly one active Financial Session -> stable Account ID -> Financial Account
```

Player identity, DeviceAccess, RemoteSession, the first Account, and NODE state provide no fallback authority.

## Wallet presentation

The combined NODE-OS Wallet remains presentation over two independent domains. For the local Device it resolves Dollar Account truth through that Device's Financial Session. Signed in, it shows the cents-formatted balance, Provider display name, account reference, and status. Signed out, it shows semantic login and password inputs and invokes the GameContext action bound internally to `player.localDevice.id`; invalid credentials produce only local form feedback. Passwords and Credentials are never projected into signed-in presentation, and no Dollar transaction history is invented.

NODE balance, payout address, activity, mining, recipients, formatting, and authority remain independently owned by `NODE_ECONOMY.md` and are unchanged by Dollar authentication or logout.
