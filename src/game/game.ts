export type Software = {
  name: string;
  probe?: number;
  trace?: number;
  tunnel?: boolean;
  rate?: number;
};
export type File = {
  id: string;
  path: string;
  bytes: number;
  software: Software;
};
export type Firmware = {
  name: string;
  version: string;
  family: "node" | "rack" | "spool" | "archive" | "mesh" | "forge";
};
export type Capabilities = {
  probe: number;
  trace: number;
  tunnel: boolean;
  rate: number;
};
export type CredentialAttempt = {
  target: string;
  work: number;
  required: number;
  tool: Capabilities;
};
export type Device = {
  model: string;
  firmware: Firmware;
  id: string;
  name: string;
  role: string;
  mask: number;
  auth: number;
  firewall: boolean;
  files: File[];
};
export type Observation = {
  scanned: boolean;
  name?: string;
  role?: string;
  auth?: number;
  firewall?: boolean;
  signal?: string;
  traceUsed?: number;
  packages?: Software[];
};
export type Access = {
  id: string;
  source: string;
  target: string;
  service: "files";
  method: "keyprobe";
};
export type Session = { id: string; accessId: string };
export type Transfer = {
  id: string;
  sessionId: string;
  source: string;
  destination: string;
  fileId: string;
  bytes: number;
  total: number;
};
export type State = {
  version: 1;
  world: Device[];
  known: Record<string, Observation>;
  local: {
    id: string;
    model: string;
    firmware: Firmware;
    files: File[];
    installed: Software[];
  };
  access: Access[];
  session?: Session;
  transfer?: Transfer;
  credentialAttempt?: CredentialAttempt;
  upgrade?: {
    id: number;
    name: string;
    before: Capabilities;
    after: Capabilities;
  };
  messageTarget?: string;
  serial: number;
  message: string;
};
export const packageFile = (
  id: string,
  software: Software,
  bytes = 1200000,
): File => ({ id, path: `/packages/${id}.pkg`, bytes, software });
export function fresh(): State {
  const world: Device[] = [
    {
      id: "relay",
      model: "RACK / R12",
      firmware: { name: "RACK-OS", version: "1.6", family: "rack" },
      name: "Cinder relay",
      role: "Community relay · shared package cache",
      mask: 0,
      auth: 1,
      firewall: false,
      files: [packageFile("keyprobe-2", { name: "KeyProbe 2", probe: 2 })],
    },
    {
      id: "print",
      model: "CARBON / P04",
      firmware: { name: "SPOOL/OS", version: "2.0", family: "spool" },
      name: "Carbon print spool",
      role: "Print server · maintenance archive",
      mask: 0,
      auth: 1,
      firewall: false,
      files: [
        packageFile("nodescan-2", { name: "NodeScan 2", trace: 2 }, 900000),
      ],
    },
    {
      id: "archive",
      model: "MORROW / B8",
      firmware: { name: "ARCHIVE/OS", version: "3.2", family: "archive" },
      name: "Morrow archive",
      role: "Backup appliance · recovery tools",
      mask: 1,
      auth: 2,
      firewall: false,
      files: [
        packageFile("keyprobe-3", { name: "KeyProbe 3", probe: 3 }, 1800000),
      ],
    },
    {
      id: "switch",
      model: "VEIL / S2",
      firmware: { name: "MESH/OS", version: "1.4", family: "mesh" },
      name: "Veil switch",
      role: "Masked relay · route engineering",
      mask: 2,
      auth: 1,
      firewall: false,
      files: [packageFile("tunnel", { name: "Tunnel", tunnel: true }, 1600000)],
    },
    {
      id: "foundry",
      model: "FORGE / C64",
      firmware: { name: "FORGE/OS", version: "4.0", family: "forge" },
      name: "Foundry build host",
      role: "Build machine · network diagnostics",
      mask: 1,
      auth: 3,
      firewall: false,
      files: [
        packageFile("nodescan-3", { name: "NodeScan 3", trace: 3 }, 2400000),
        packageFile("burst", { name: "Burst", rate: 2400000 }, 800000),
      ],
    },
    {
      id: "vault",
      model: "GLASS / V2",
      firmware: { name: "ARCHIVE/OS", version: "4.1", family: "archive" },
      name: "Glass vault",
      role: "Filtered archive · authentication research",
      mask: 3,
      auth: 2,
      firewall: true,
      files: [
        packageFile("keyprobe-4", { name: "KeyProbe 4", probe: 4 }, 3600000),
      ],
    },
    {
      id: "observatory",
      model: "NIGHT / R24",
      firmware: { name: "RACK-OS", version: "2.3", family: "rack" },
      name: "Night observatory",
      role: "Telemetry collector · deep route cache",
      mask: 2,
      auth: 4,
      firewall: false,
      files: [
        packageFile("nodescan-4", { name: "NodeScan 4", trace: 4 }, 3200000),
      ],
    },
    {
      id: "mirror",
      model: "NODE / M8",
      firmware: { name: "NODE-OS", version: "1.2", family: "node" },
      name: "Quiet mirror",
      role: "Masked distribution host · transfer research",
      mask: 4,
      auth: 3,
      firewall: true,
      files: [
        packageFile("burst-2", { name: "Burst 2", rate: 4800000 }, 6400000),
      ],
    },
  ];
  // Authored storage layouts belong to these devices, not their presentation themes.
  for (const d of world) {
    const directory =
      d.firmware.family === "spool"
        ? "/spool/maintenance"
        : d.firmware.family === "archive"
          ? "/recovery/packages"
          : d.firmware.family === "forge"
            ? "/build/releases"
            : d.firmware.family === "mesh"
              ? "/routes/tools"
              : "/packages";
    d.files = d.files.map((f) => ({ ...f, path: `${directory}/${f.id}.pkg` }));
  }
  return {
    version: 1,
    world,
    known: Object.fromEntries(world.map((d) => [d.id, { scanned: false }])),
    local: {
      id: "node-01",
      model: "NODE / N1",
      firmware: { name: "NODE-OS", version: "1.0", family: "node" },
      files: [],
      installed: [
        { name: "KeyProbe 1", probe: 1 },
        { name: "NodeScan 1", trace: 1 },
      ],
    },
    access: [],
    serial: 0,
    message: "Choose a signal. Scan to find your way in.",
  };
}
export function capability(s: Pick<State, "local">): Capabilities {
  return {
    probe: Math.max(0, ...s.local.installed.map((x) => x.probe ?? 0)),
    trace: Math.max(0, ...s.local.installed.map((x) => x.trace ?? 0)),
    tunnel: s.local.installed.some((x) => x.tunnel),
    rate: Math.max(800000, ...s.local.installed.map((x) => x.rate ?? 0)),
  };
}
export function isUpgrade(s: Pick<State, "local">, p: Software): boolean {
  const c = capability(s);
  return (
    (p.probe ?? 0) > c.probe ||
    (p.trace ?? 0) > c.trace ||
    (!!p.tunnel && !c.tunnel) ||
    (p.rate ?? 0) > c.rate
  );
}
function copy(s: State): State {
  return structuredClone(s);
}
export function scan(s: State, id: string): State {
  if (!s.known[id]) return s;
  const d = s.world.find((d) => d.id === id);
  if (!d) return s;
  const n = copy(s),
    trace = capability(s).trace;
  n.messageTarget = id;
  n.known[id] = {
    ...n.known[id],
    scanned: true,
    traceUsed: trace,
    ...(trace >= d.mask
      ? {
          name: d.name,
          role: d.role,
          auth: d.auth,
          firewall: d.firewall,
          signal: d.files.map((f) => f.software.name).join(" / "),
          packages: d.files.map((f) => ({ ...f.software })),
        }
      : {}),
  };
  n.message =
    trace >= d.mask
      ? "Scan complete. Protection and package manifest observed."
      : "Identity masked. The file service is reachable; you can still attempt entry.";
  return n;
}
/** Concrete KeyProbe authentication attempt. Masking never participates in resolution. */
function resolveCredentials(s: State, id: string, c: Capabilities): State {
  if (!s.known[id] || s.access.some((a) => a.target === id)) return s;
  const d = s.world.find((d) => d.id === id);
  if (!d) return s;
  const n = copy(s);
  n.messageTarget = id;
  if (d.firewall && !c.tunnel) {
    n.known[id].firewall = true;
    n.message =
      "Connection rejected by packet filter. Tunnel software is required.";
    return n;
  }
  if (d.auth > c.probe) {
    n.known[id].auth = d.auth;
    n.message = `Authentication challenge observed: KeyProbe ${d.auth} required. Find a stronger package.`;
    return n;
  }
  n.access.push({
    id: `access-${++n.serial}`,
    source: n.local.id,
    target: id,
    service: "files",
    method: "keyprobe",
  });
  n.message = "ACCESS GRANTED. Connect to inspect the remote files.";
  return n;
}
/** A short concrete authentication job; progress survives reload and never grants access early. */
export function probeCredentials(s: State, id: string): State {
  if (
    s.credentialAttempt ||
    s.transfer ||
    !s.known[id] ||
    s.access.some((a) => a.target === id)
  )
    return s;
  const n = copy(s);
  n.credentialAttempt = {
    target: id,
    work: 0,
    required: 900,
    tool: capability(s),
  };
  n.messageTarget = id;
  n.message = `KeyProbe ${capability(s).probe} is testing authentication…`;
  return n;
}
export function advanceProbe(s: State, ms: number): State {
  if (!s.credentialAttempt || !Number.isFinite(ms) || ms <= 0) return s;
  const n = copy(s),
    a = n.credentialAttempt!;
  a.work = Math.min(a.required, a.work + ms);
  if (a.work < a.required) return n;
  delete n.credentialAttempt;
  return resolveCredentials(n, a.target, a.tool);
}
export function connect(s: State, id: string): State {
  const a = s.access.find((a) => a.target === id && a.source === s.local.id);
  if (!a || s.transfer || s.credentialAttempt) return s;
  const n = copy(s);
  n.session = { id: `session-${++n.serial}`, accessId: a.id };
  const d = remote(n)!;
  n.messageTarget = id;
  n.known[id] = {
    ...n.known[id],
    name: d.name,
    role: d.role,
    packages: d.files.map((f) => ({ ...f.software })),
    signal: d.files.map((f) => f.software.name).join(" / "),
  };
  n.message = "Connected. Remote packages are ready to take.";
  return n;
}
export function disconnect(s: State): State {
  const n = copy(s);
  delete n.session;
  delete n.transfer;
  delete n.messageTarget;
  n.message = "Disconnected. Access retained; reconnect whenever you want.";
  return n;
}
export function remote(s: State): Device | undefined {
  const a = s.access.find(
    (a) => a.id === s.session?.accessId && a.source === s.local.id,
  );
  return a ? s.world.find((d) => d.id === a.target) : undefined;
}
export function take(s: State, fileId: string): State {
  const d = remote(s),
    f = d?.files.find((f) => f.id === fileId);
  if (
    !d ||
    !f ||
    !s.session ||
    s.transfer ||
    s.local.files.some((x) => x.id === f.id)
  )
    return s;
  const n = copy(s);
  n.transfer = {
    id: `transfer-${++n.serial}`,
    sessionId: s.session.id,
    source: d.id,
    destination: n.local.id,
    fileId,
    bytes: 0,
    total: f.bytes,
  };
  n.messageTarget = d.id;
  n.message = "Transferring to /downloads…";
  return n;
}
export function advanceTransfer(s: State, ms: number): State {
  if (!s.transfer || !Number.isFinite(ms) || ms <= 0) return s;
  const d = remote(s),
    f = d?.files.find((f) => f.id === s.transfer?.fileId);
  if (
    !d ||
    !f ||
    d.id !== s.transfer.source ||
    s.transfer.sessionId !== s.session?.id
  )
    return s;
  const n = copy(s),
    t = n.transfer!;
  t.bytes = Math.min(t.total, t.bytes + (capability(s).rate * ms) / 1000);
  if (t.bytes === t.total) {
    n.local.files.push({ ...copyFile(f), path: `/downloads/${f.id}.pkg` });
    delete n.transfer;
    n.message = `${f.software.name} acquired. ${isUpgrade(n, f.software) ? "Install it to change your capabilities." : "Stored in /downloads; your installed tool is already stronger."}`;
  }
  return n;
}
function copyFile(f: File): File {
  return structuredClone(f);
}
export function install(s: State, fileId: string): State {
  const f = s.local.files.find((f) => f.id === fileId);
  if (!f || s.local.installed.some((x) => x.name === f.software.name)) return s;
  const n = copy(s);
  n.local.installed.push({ ...f.software });
  n.upgrade = {
    id: ++n.serial,
    name: f.software.name,
    before: capability(s),
    after: capability(n),
  };
  delete n.messageTarget;
  n.message = `${f.software.name} installed. ${effect(f.software)}`;
  return n;
}
export function effect(p: Software): string {
  if (p.probe) return `Opens authentication challenges up to ${p.probe}.`;
  if (p.trace)
    return `Reveals identities and manifests through masking up to ${p.trace}.`;
  if (p.tunnel)
    return "Passes packet filters. Authentication still requires KeyProbe.";
  if (p.rate) return `Transfers at ${(p.rate / 1000000).toFixed(1)} MB/s.`;
  return "";
}
/** This projection cannot accept hidden world truth. */
export function targets(
  s: Pick<State, "known" | "local" | "access" | "session">,
) {
  const c = capability(s);
  return Object.entries(s.known).map(([id, o], index) => ({
    id,
    label: o.name ?? `Signal ${String(index + 1).padStart(2, "0")}`,
    observation: o,
    access: s.access.some((a) => a.target === id),
    ready:
      o.auth !== undefined && o.firewall !== undefined
        ? o.auth <= c.probe && (!o.firewall || c.tunnel)
        : undefined,
  }));
}
