import { afterEach, expect, test, vi } from "vitest";
import {
  fresh,
  probeCredentials as startProbe,
  advanceProbe,
  connect,
  take,
  advanceTransfer,
} from "./game/game";
import { decode, encode, load, save, SAVE_KEY } from "./persistence";
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
const probeCredentials = (s: ReturnType<typeof fresh>, id: string) =>
  advanceProbe(startProbe(s, id), 1000);

test("partial transfer, access and session survive storage and finish after reload", () => {
  let s = advanceTransfer(
    take(connect(probeCredentials(fresh(), "relay"), "relay"), "keyprobe-2"),
    500,
  );
  expect(save(s)).toBe(true);
  s = load().state;
  expect(s.transfer?.bytes).toBe(400000);
  s = advanceTransfer(s, 10000);
  expect(s.local.files).toHaveLength(1);
});
test("damaged saves are preserved and saving failure is surfaced", () => {
  localStorage.setItem(SAVE_KEY, '{"version":1}');
  expect(load().warning).toContain("preserved");
  expect(localStorage.getItem(SAVE_KEY)).toBe('{"version":1}');
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("quota");
  });
  expect(save(fresh())).toBe(false);
});
test("rejects malformed relationships and nested values instead of crashing presentation", () => {
  for (const change of [
    (s: any) => (s.local.installed = [null]),
    (s: any) => (s.known.relay = null),
    (s: any) => (s.session = { id: "x", accessId: "missing" }),
    (s: any) => (s.transfer = { bytes: -1 }),
  ]) {
    const s = fresh();
    change(s);
    expect(() => decode(encode(s))).toThrow();
  }
});

test("save contains player progress, while immutable firmware and world content come from source", () => {
  const s = fresh();
  const raw = encode(s);
  expect(JSON.parse(raw).world).toBeUndefined();
  expect(decode(raw)).toEqual(s);
  const invalid = JSON.parse(raw);
  invalid.local.firmware = null;
  expect(() => decode(JSON.stringify(invalid))).toThrow();
});
