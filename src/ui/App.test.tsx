import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { decode, SAVE_KEY } from "../persistence";
afterEach(() => {
  cleanup();
  localStorage.clear();
});
test("real UI: three consecutive cycles; no hidden names; reload resumes the operating target", async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  expect(screen.queryByText("Cinder relay")).toBeNull();
  expect(screen.queryByText("KeyProbe 2")).toBeNull();
  for (const [signal, name, loot] of [
    ["Signal 01", "Cinder relay", "KeyProbe 2"],
    ["Signal 03", "Morrow archive", "KeyProbe 3"],
    ["Signal 05", "Foundry build host", "NodeScan 3"],
  ]) {
    await user.click(screen.getByRole("button", { name: signal }));
    await user.click(screen.getByRole("button", { name: "SCAN" }));
    expect(screen.getByRole("heading", { name })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "HACK" }));
    expect(screen.queryByText("KEEP GOING")).toBeNull();
    await user.click(await screen.findByRole("button", { name: "CONNECT" }));
    await user.click(screen.getByRole("button", { name: `TAKE ${loot}` }));
    await user.click(
      await screen.findByRole(
        "button",
        { name: `INSTALL ${loot}` },
        { timeout: 6000 },
      ),
    );
  }
  expect(decode(localStorage.getItem(SAVE_KEY)!).access).toHaveLength(3);
  view.unmount();
  render(<App />);
  expect(
    within(screen.getByRole("region", { name: "Target context" })).getByRole(
      "heading",
      { name: "Foundry build host" },
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "NodeScan 3 installed. Reveals identities and manifests through masking up to 3.",
    ),
  ).toBeTruthy();
}, 15000);
test("masked target keeps identity and manifest hidden, yet a free attempt can establish access", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Signal 04" }));
  await user.click(screen.getByRole("button", { name: "SCAN" }));
  expect(screen.queryByText("Veil switch")).toBeNull();
  expect(screen.queryByText("Tunnel")).toBeNull();
  expect(screen.getByText("IDENTITY MASKED")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "HACK" }));
  expect(await screen.findByRole("button", { name: "CONNECT" })).toBeTruthy();
  expect(screen.queryByText("Veil switch")).toBeNull();
  await user.click(await screen.findByRole("button", { name: "CONNECT" }));
  expect(screen.getByRole("heading", { name: "Veil switch" })).toBeTruthy();
});
