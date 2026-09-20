/** Product descriptions, never capability authority or hidden target intelligence. */
export function softwarePurpose(productId: string): string {
  const purposes: Record<string, string> = {
    nodescan: 'Find machines and investigate services. Version 1.2 classifies devices, monitors availability and completes Sandbox analyses three times faster.',
    keyprobe: 'A broad credential probe. Works against patched GateSSH too, with uncertain success; protected services resist it.',
    flipper: 'Keep integrated techniques in one installed tool and use deauth.ext to interrupt networks. Loose GhostKey and Rollback modules also work directly.',
    'product-rattler-v0': 'Build a target-bound payload, transfer it to a VEYRA phone and search its Wallet PIN. Access alone does not bypass the PIN.',
    'node-miner': 'Use a machine’s compute to earn NODE. Local mining competes with reconnaissance; remote compute can fund your tool collection. This unofficial build diverts 33%.',
    'gate-ssh': 'SSH service package. An old 1.3.2 build can reopen a GhostKey route through RackUpdate after a real reboot. A patched build closes that route.',
    'credential-access': 'GhostKey: precise credential access against observed GateSSH 1.3.2. Possessing this artifact supplies the technique.',
    rollback: 'Submit a different GateSSH release through vulnerable RackUpdate. The target must reboot before the change takes effect.',
    deauth: 'Interrupt a known network with a compatible Flipper installation. Devices recover according to their own behavior.',
    sentry: 'Remove recognized RATTLER payloads and NODE Miner executables and stop their work. On company servers, Sentry also runs at maintenance. It is a narrow signature cleaner, not universal protection.',
    authguard: 'Protects compatible patched GateSSH authentication against KeyProbe; it does not repair a vulnerable GateSSH 1.3.2 deployment.',
  }
  return purposes[productId] ?? 'A concrete software artifact. Consult its file and release information for compatibility.'
}
