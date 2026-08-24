# Wallets, Currency, and Economic Recipients

Status: Accepted
Scope: The separation of Wallet, currency, Device and wallet software, and the rules
for represented economic recipients and routing.

Normative owner for architecture invariants A18. `docs/ARCHITECTURE.md` is the
index and precedence entry point; it summarizes these invariants and must not
redefine them.


## A18 — Wallet, currency, Device, and wallet software are separate

A Wallet is a represented economic entity or account controlled through
represented authority.

It is not:

- the Player
- a Device
- the Wallet application
- a wallet address
- a displayed balance
- a generic inventory of money

A Device may contain software that presents or operates a Wallet.

That software does not own the Wallet’s economic truth.

Wallet addresses are mutable or externally visible addressing attributes and
must not become stable Wallet identity.

Secret or key material may authorize Wallet operations when a concrete mechanic
represents that authority.

Possessing a Device, Wallet application, address, or remembered Wallet
information must not automatically imply possession of the Wallet’s secret
authority.

Currency balances, transfers, mining payouts, and later market activity must
derive from canonical economic state rather than interface-local counters.

More than one represented economic recipient now exists. Every destination
that actually receives currency must be represented economic state with its
own stable identity, separate from the mutable address that currently
addresses it — a destination must not be reduced to interface text, a log
line, or currency that simply disappears. Resolving a destination is an exact
match against represented recipients: when no represented recipient holds an
address, nothing is credited, and no fallback recipient may absorb it.

A Wallet's own activity history is what that Wallet actually received. It is
not a ledger of a payer's behavior and must not reveal a payer's other
destinations. Where currency was routed is truth owned by whatever performed
the routing, and reaches the player only through that thing's own represented
consequences.

Payout behavior can be a property of a concrete represented software release
rather than a law of the economy: two releases of the same product may route
production differently. This does not license a fee engine, payout-policy
registry, ledger, transaction network, or generic economy framework.

Conceptually:

PLAYER
   ↓ relationship / authority
WALLET
   ↓
CURRENCY / LEDGER STATE

DEVICE
   ↓
WALLET SOFTWARE
   ↓
AUTHORIZED WALLET OPERATIONS

Wallet compromise should arise from concrete represented authority or secret
exposure rather than a generic `walletHacked` flag.
