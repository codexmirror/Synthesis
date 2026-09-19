import { fresh, type State, type Software, type File } from "./game/game";
export const SAVE_KEY = "synthesis-v1-save";
export function encode(s: State): string {
  const { world: _authoredWorld, ...progress } = s;
  return JSON.stringify(progress);
}
const positive = (x: unknown) =>
  typeof x === "number" && Number.isFinite(x) && x > 0;
const optionalText = (x: unknown) => x === undefined || typeof x === "string";
const optionalBool = (x: unknown) => x === undefined || typeof x === "boolean";
function software(x: Software): boolean {
  return (
    !!x &&
    typeof x.name === "string" &&
    [x.probe, x.trace, x.rate].every((v) => v === undefined || positive(v)) &&
    optionalBool(x.tunnel)
  );
}
function file(x: File): boolean {
  return (
    !!x &&
    typeof x.id === "string" &&
    typeof x.path === "string" &&
    positive(x.bytes) &&
    software(x.software)
  );
}
/** One small versioned JSON boundary. Invalid saves are never silently overwritten. */
export function decode(raw: string): State {
  const saved = JSON.parse(raw) as State;
  if (
    !saved?.local ||
    !Array.isArray(saved.local.files) ||
    !Array.isArray(saved.local.installed) ||
    !saved.known
  )
    throw new Error("Missing player progress");
  const authored = fresh();
  // The immutable device content is shipped with the game. Persist player progress only.
  const s: State = {
    ...saved,
    world: authored.world,
    known: { ...authored.known, ...saved.known },
    local: { ...authored.local, ...saved.local },
  };
  try {
    if (
      s.version !== 1 ||
      !Array.isArray(s.world) ||
      s.world.length === 0 ||
      !s.world.every(
        (d) =>
          typeof d.id === "string" &&
          typeof d.name === "string" &&
          typeof d.role === "string" &&
          Number.isInteger(d.mask) &&
          d.mask >= 0 &&
          positive(d.auth) &&
          typeof d.firewall === "boolean" &&
          Array.isArray(d.files) &&
          d.files.every(file),
      )
    )
      throw 0;
    const ids = s.world.map((d) => d.id);
    if (
      new Set(ids).size !== ids.length ||
      !s.known ||
      typeof s.known !== "object" ||
      Object.keys(s.known).length !== ids.length ||
      !ids.every((id) => Object.hasOwn(s.known, id))
    )
      throw 0;
    if (
      !Object.values(s.known).every(
        (o) =>
          typeof o.scanned === "boolean" &&
          optionalText(o.name) &&
          optionalText(o.role) &&
          optionalText(o.signal) &&
          optionalBool(o.firewall) &&
          (o.auth === undefined || positive(o.auth)) &&
          (o.traceUsed === undefined || positive(o.traceUsed)) &&
          (o.packages === undefined ||
            (Array.isArray(o.packages) && o.packages.every(software))),
      )
    )
      throw 0;
    if (
      !s.local ||
      typeof s.local.id !== "string" ||
      !Array.isArray(s.local.files) ||
      !s.local.files.every(file) ||
      !Array.isArray(s.local.installed) ||
      !s.local.installed.every(software)
    )
      throw 0;
    if (
      !Array.isArray(s.access) ||
      !s.access.every(
        (a) =>
          typeof a.id === "string" &&
          a.source === s.local.id &&
          ids.includes(a.target) &&
          a.service === "files" &&
          a.method === "keyprobe",
      )
    )
      throw 0;
    if (
      !Number.isInteger(s.serial) ||
      s.serial < 0 ||
      typeof s.message !== "string"
    )
      throw 0;
    if (
      s.session &&
      (typeof s.session.id !== "string" ||
        !s.access.some((a) => a.id === s.session?.accessId))
    )
      throw 0;
    if (s.transfer) {
      const t = s.transfer,
        a = s.access.find((a) => a.id === s.session?.accessId),
        f = s.world
          .find((d) => d.id === a?.target)
          ?.files.find((f) => f.id === t.fileId);
      if (
        !s.session ||
        t.sessionId !== s.session.id ||
        t.source !== a?.target ||
        t.destination !== s.local.id ||
        !f ||
        t.total !== f.bytes ||
        !Number.isFinite(t.bytes) ||
        t.bytes < 0 ||
        t.bytes >= t.total ||
        typeof t.id !== "string"
      )
        throw 0;
    }
    if (
      typeof s.local.model !== "string" ||
      !s.local.firmware ||
      typeof s.local.firmware.name !== "string" ||
      typeof s.local.firmware.version !== "string" ||
      s.local.firmware.family !== "node"
    )
      throw 0;
    const caps = (c: {
      probe: number;
      trace: number;
      tunnel: boolean;
      rate: number;
    }) =>
      c &&
      positive(c.probe) &&
      positive(c.trace) &&
      positive(c.rate) &&
      typeof c.tunnel === "boolean";
    if (!optionalText(s.messageTarget)) throw 0;
    if (s.credentialAttempt) {
      const a = s.credentialAttempt;
      if (
        !s.known[a.target] ||
        !Number.isFinite(a.work) ||
        a.work < 0 ||
        !positive(a.required) ||
        a.work >= a.required ||
        !caps(a.tool)
      )
        throw 0;
    }
    if (
      s.upgrade &&
      (!positive(s.upgrade.id) ||
        typeof s.upgrade.name !== "string" ||
        !caps(s.upgrade.before) ||
        !caps(s.upgrade.after))
    )
      throw 0;
    return s;
  } catch {
    throw new Error("Unsupported or damaged save");
  }
}
export function load(): { state: State; warning: string } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return { state: raw ? decode(raw) : fresh(), warning: "" };
  } catch {
    return {
      state: fresh(),
      warning:
        "Saved progress could not be read. The original save is preserved; saving is paused.",
    };
  }
}
export function save(s: State): boolean {
  try {
    localStorage.setItem(SAVE_KEY, encode(s));
    return true;
  } catch {
    return false;
  }
}
