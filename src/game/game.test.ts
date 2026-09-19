// @vitest-environment node
import { expect, test } from "vitest";
import {
  fresh,
  scan,
  probeCredentials as startProbe,
  advanceProbe,
  connect,
  remote,
  take,
  advanceTransfer,
  install,
  capability,
  disconnect,
  targets,
} from "./game";
import { encode, decode } from "../persistence";
const probeCredentials = (s: ReturnType<typeof fresh>, id: string) =>
  advanceProbe(startProbe(s, id), 1000);

test("one real target: observation → access → session → transfer → possession → installation → reload", () => {
  let s = fresh();
  expect(JSON.stringify(targets(s))).not.toContain("Cinder");
  s = scan(s, "relay");
  expect(targets(s)[0].label).toBe("Cinder relay");
  expect(connect(s, "relay").session).toBeUndefined();
  s = probeCredentials(s, "relay");
  expect(s.access).toHaveLength(1);
  expect(s.session).toBeUndefined();
  s = connect(s, "relay");
  expect(remote(s)?.id).toBe("relay");
  s = take(s, "keyprobe-2");
  s = advanceTransfer(s, 500);
  expect(s.local.files).toHaveLength(0);
  s = advanceTransfer(s, 2000);
  expect(s.local.files[0].path).toBe("/downloads/keyprobe-2.pkg");
  expect(capability(s).probe).toBe(1);
  s = install(s, "keyprobe-2");
  expect(capability(s).probe).toBe(2);
  s = decode(encode(s));
  expect(capability(s).probe).toBe(2);
  s = disconnect(s);
  expect(s.session).toBeUndefined();
  expect(s.access).toHaveLength(1);
  expect(connect(s, "relay").session).toBeDefined();
});

test("three consecutive loot cycles unlock stronger authentication and preserve every relationship", () => {
  let s = fresh();
  for (const [id, file, power] of [
    ["relay", "keyprobe-2", 2],
    ["archive", "keyprobe-3", 3],
    ["foundry", "nodescan-3", 3],
  ] as const) {
    s = scan(s, id);
    s = probeCredentials(s, id);
    s = connect(s, id);
    expect(remote(s)?.id).toBe(id);
    s = take(s, file);
    s = advanceTransfer(s, 10000);
    s = install(s, file);
    s = disconnect(s);
    expect(capability(s).probe).toBe(power);
  }
  expect(s.access).toHaveLength(3);
  expect(capability(s).trace).toBe(3);
  expect(decode(encode(s))).toEqual(s);
});
test("masking does not block an attack; failed protection reveals only its actual cause", () => {
  let s = fresh();
  s = scan(s, "switch");
  expect(s.known.switch.name).toBeUndefined();
  expect(s.known.switch.auth).toBeUndefined();
  s = probeCredentials(s, "switch");
  expect(s.access.some((a) => a.target === "switch")).toBe(true);
  s = probeCredentials(s, "vault");
  expect(s.known.vault.firewall).toBe(true);
  expect(s.known.vault.auth).toBeUndefined();
  expect(s.known.vault.name).toBeUndefined();
  s = probeCredentials(s, "archive");
  expect(s.known.archive.auth).toBe(2);
  expect(s.known.archive.name).toBeUndefined();
  expect(s.access.some((a) => a.target === "archive")).toBe(false);
});
test("no possession or installation before completed session-bound transfer; interrupted transfers retain no partial file", () => {
  let s = fresh();
  expect(install(s, "keyprobe-2")).toBe(s);
  expect(take(s, "keyprobe-2")).toBe(s);
  s = connect(probeCredentials(s, "relay"), "relay");
  s = take(s, "keyprobe-2");
  expect(connect(s, "archive")).toBe(s);
  s = advanceTransfer(s, 100);
  s = disconnect(s);
  s = advanceTransfer(s, 10000);
  expect(s.local.files).toHaveLength(0);
  s = connect(s, "relay");
  s = advanceTransfer(take(s, "keyprobe-2"), 10000);
  expect(take(s, "keyprobe-2")).toBe(s);
  expect(s.world[0].files).toHaveLength(1);
});
test("projection depends solely on earned observations even when hidden devices differ", () => {
  const a = fresh(),
    b = fresh();
  b.world[0].name = "secret";
  b.world[0].auth = 99;
  b.world[0].files = [];
  expect(targets(a)).toEqual(targets(b));
  const c = scan(a, "relay");
  expect(targets(c)).not.toEqual(targets(b));
});

test("all eight targets are attainable; tunnel and recon independently unlock routes and information", () => {
  let s = fresh();
  const loot = (id: string, file: string) => {
    s = scan(s, id);
    s = connect(probeCredentials(s, id), id);
    expect(remote(s)?.id).toBe(id);
    s = install(advanceTransfer(take(s, file), 20000), file);
    s = disconnect(s);
  };
  loot("relay", "keyprobe-2");
  loot("print", "nodescan-2");
  s = scan(s, "switch");
  expect(s.known.switch.name).toBe("Veil switch");
  s = probeCredentials(s, "vault");
  expect(s.access.some((a) => a.target === "vault")).toBe(false);
  loot("archive", "keyprobe-3");
  loot("switch", "tunnel");
  loot("foundry", "nodescan-3");
  loot("foundry", "burst");
  loot("vault", "keyprobe-4");
  loot("observatory", "nodescan-4");
  loot("mirror", "burst-2");
  expect(s.access).toHaveLength(8);
  expect(capability(s)).toEqual({
    probe: 4,
    trace: 4,
    tunnel: true,
    rate: 4800000,
  });
});
test("observation cannot change protection and repeated access cannot duplicate relationships", () => {
  let s = fresh();
  const original = structuredClone(s.world);
  s = scan(s, "archive");
  expect(s.world).toEqual(original);
  s = probeCredentials(s, "archive");
  expect(s.access).toHaveLength(0);
  s = probeCredentials(s, "relay");
  expect(probeCredentials(s, "relay")).toBe(s);
  expect(scan(s, "missing")).toBe(s);
  expect(probeCredentials(s, "missing")).toBe(s);
});

test("acquiring an older package does not promise a capability upgrade", () => {
  let s = fresh();
  s.local.installed.push({ name: "NodeScan 4", trace: 4 });
  s = advanceTransfer(
    take(connect(probeCredentials(s, "print"), "print"), "nodescan-2"),
    10000,
  );
  expect(s.local.files[0].id).toBe("nodescan-2");
  expect(s.message).toContain("already stronger");
  expect(capability(s).trace).toBe(4);
});

test("credential work is represented, reloadable, and cannot grant premature access", () => {
  let s = startProbe(fresh(), "relay");
  expect(s.credentialAttempt?.work).toBe(0);
  expect(s.access).toHaveLength(0);
  s = advanceProbe(s, 400);
  expect(s.access).toHaveLength(0);
  expect(connect(s, "relay").session).toBeUndefined();
  s = decode(encode(s));
  s = advanceProbe(s, 500);
  expect(s.credentialAttempt).toBeUndefined();
  expect(s.access).toHaveLength(1);
  expect(s.session).toBeUndefined();
});
test("firmware and device-owned paths become available only over a connected session", () => {
  let s = fresh();
  expect(remote(s)).toBeUndefined();
  expect(JSON.stringify(targets(scan(s, "relay")))).not.toContain("RACK-OS");
  s = probeCredentials(s, "relay");
  expect(remote(s)).toBeUndefined();
  s = connect(s, "relay");
  expect(remote(s)?.firmware.name).toBe("RACK-OS");
  expect(s.world.find((d) => d.id === "archive")?.files[0].path).toBe(
    "/recovery/packages/keyprobe-3.pkg",
  );
  expect(s.world.find((d) => d.id === "foundry")?.firmware.name).toBe(
    "FORGE/OS",
  );
});
