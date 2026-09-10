# Network reconnaissance and access

Status: Accepted
Scope: Current Network World Truth, reconnaissance, remembered Player Information, endpoint analysis, techniques, access, and sessions.

## Reconnaissance model

NodeScan and Terminal are two interfaces over the same canonical operations and
`GameState.discovery`. Neither interface owns scan results. Browsing Known Space
or prior Terminal output performs no observation.

The current compressed causal model is:

```text
ip
→ scan network
→ choose host
→ scan host
→ choose endpoint
→ analyze endpoint
→ available technique / attempt
```

This is an evidence-driven interaction, not a stored mandatory stage machine.
`ping` is an optional reachability observation and is never required before a
scan or analysis.

The generic Recon `INSPECT` operation is retired. Recon does not bundle Device
identity, Firmware, compute class, Network relationships, endpoint fingerprints,
authentication evidence, and protection evidence into one operation. OS and
Firmware host fingerprinting are not represented by this slice.

## Network configuration and `ip`

The local Device owns its address. A represented `LocalNetwork` owns its CIDR
and gateway/routing address. The gateway address does not imply a synthetic
Device. Terminal `ip` reads this SELF World Truth directly and presents address,
network CIDR, and gateway. It creates no Discovery or Knowledge.

The initial local configuration is `198.51.100.23` on
`198.51.100.0/24`, gateway `198.51.100.1`.

## Scan and remembered Discovery

Network Scan accepts a known represented Network name and observes its currently
reachable member Devices. Host Scan accepts SELF or a remembered Device address
and observes that Device's currently open endpoints. An endpoint observation is
the compressed Service name, port, protocol, stable Service identity, stable
Device identity, and the endpoint string captured at observation time.

SELF follows the same host-surface rule as any Device. An empty SELF result means
the local Device represents no open Services; it is not a SELF-specific scan
exception.

Positive observations update canonical `DiscoveryState`. Failed observations do
not erase remembered evidence. Address, endpoint, names, ports, and labels remain
observation attributes rather than stable identity. A later World change never
silently refreshes memory. An operation started from remembered evidence validates
the supplied endpoint and stable identities against current World Truth.

A positive PING remembers only stable Device identity and the address observed at
that moment. It observes no topology, endpoint, product, weakness, or access.

## Endpoint analysis

`analyze <ipv4:port>` and NodeScan's endpoint ANALYZE action start the same
canonical finite Service Analysis Process. Terminal admits only an endpoint in
canonical Discovery; it cannot use hidden World Truth as an endpoint directory.
NodeScan supplies the same stable Device, Service, and captured endpoint
observation to the shared operation.

Completion validates the current canonical Device and Service. A successful
analysis remembers the endpoint's represented implementation name/version and
its narrow authentication or package-submission interface evidence in Discovery.
Unavailable or stale endpoints produce only the Process's unavailable result.
Analysis never creates or updates `knowledge.discoveredVulnerabilities`.

Technique availability derives from remembered endpoint evidence together with
the concrete tools/modules installed on the local Device. It does not predict
success. KeyProbe can form from analyzed concrete GateSSH implementation evidence
without Vulnerability Knowledge. The specialized Credential Access Module and
Rollback remain vulnerability-specific attempt providers; their attack owners
validate current canonical surfaces when attempts begin and complete.

## World Truth, information, capability, and access

Network/Device/Service World Truth remains distinct from Discovery, Knowledge,
Capability, DeviceAccess, and RemoteSession. NetworkManagementAuthority is a
separate relationship and never fills gaps in reconnaissance memory.

An attempt can fail when remembered evidence is stale. Successful Credential
Access creates the existing stable `DeviceAccess` relationship. A
`RemoteSession` remains a distinct active operating context built on that access.
RackUpdate success grants only its own package-submission authority and never
DeviceAccess.

## Processes

Endpoint analysis, Credential Access, and RackUpdate exploit attempts retain
their existing canonical Process mechanics. The mechanic that created a Process
owns completion and its concrete result. Interfaces display canonical progress;
they do not simulate scan duration, latency, confidence, or Nmap-style detail.

## NodeScan releases

Every installed NodeScan release supplies the same core network scan, host scan,
endpoint analysis, and optional ping operations. Release identity may still own
separate live-topology and integrated-intelligence presentation capabilities,
but no release restores the retired generic INSPECT path. Removing or replacing
a release never erases remembered Discovery.

## Gotchas

- IP addresses, ports, names, CIDRs, gateway addresses, and labels are not entity identity.
- `ip` reads SELF configuration; it is not an observation.
- PING is optional and deliberately shallow.
- Network Scan discovers hosts; Host Scan discovers endpoints.
- Browse is not Observe.
- SELF is not a special empty-scan branch.
- Analyze begins only from remembered endpoint evidence and revalidates stable identity/current surface.
- Reconnaissance creates Discovery evidence, never Vulnerability Knowledge.
- NodeScan and Terminal never own separate reconnaissance state or mechanics.
- DeviceAccess, RemoteSession, and RackUpdate submission authority remain distinct consequences owned by their existing domains.
