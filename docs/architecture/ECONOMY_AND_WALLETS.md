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

Represented authority is not the same thing as the secret that can establish
it. Knowing credential or key material permits an authentication attempt; only
a represented authority relationship authorizes an operation. Where such
authority is represented, it is scoped to the economic entity it was
established for and to the concrete context it was established from, it is
revocable, and it is not ownership. Establishing, refreshing, losing or
revoking it must not change economic identity, balances, or the secret
material itself, and it must never be reduced to a stored flag such as
`authenticated` or `walletHacked`.

Currency balances, transfers, mining payouts, and later market activity must
derive from canonical economic state rather than interface-local counters.

Canonical monetary value is an exact integer in that currency's smallest
represented unit. Human-readable amounts, decimal points, currency symbols and
grouping are formatting and input concerns; floating-point or decimal values
must never become canonical balance truth.

More than one represented economic recipient now exists. Every destination
that actually receives currency must be represented economic state with its
own stable identity, separate from the mutable address that currently
addresses it — a destination must not be reduced to interface text, a log
line, or currency that simply disappears. Resolving a destination is an exact
match against represented recipients: when no represented recipient holds an
address, nothing is credited, and no fallback recipient may absorb it.

Represented economic history is attributed to the addressing attributes that
were actually in effect when the value moved. Because addresses and account
references are mutable and are not identity, a record of a completed movement
must preserve the user-facing reference each side carried at that moment;
changing an attribute afterwards must never rewrite what already happened. The
record still names the stable entities involved — the snapshot is presentation
truth about the past, not a second identity.

A Wallet's own activity history is represented balance-changing economic
activity of that Wallet. It is not a general ledger or a view of another
entity's behavior: a received payout must not reveal a payer's other
destinations, and a purchase record must not become entitlement authority.
Where currency was routed is truth owned by whatever performed the routing,
and reaches the player only through that thing's own represented consequences.

Separately represented economic domains stay separate in canonical truth. One
currency's accounts, addresses, credentials, keys or authority never authorize
operations in another's, and no implicit bridge between them exists. One
interface may present several economic domains together; that presentation
never creates a shared canonical account, a universal money owner, or a
combined authority object.

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
