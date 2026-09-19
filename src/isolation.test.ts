// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect } from "vitest";
import config from "../vite.config";
test("V1 build, test, dev server and source cannot walk frozen V0", () => {
  const ts = JSON.parse(readFileSync("tsconfig.json", "utf8"));
  expect(ts.include).toEqual(["src", "vite.config.ts"]);
  expect(ts.exclude).toContain("v0");
  expect(config.test?.include).toEqual(["src/**/*.test.{ts,tsx}"]);
  expect(config.server?.fs?.deny).toContain("**/v0/**");
  const walk = (path: string): string[] =>
    readdirSync(path, { withFileTypes: true }).flatMap((f) =>
      f.isDirectory() ? walk(resolve(path, f.name)) : [resolve(path, f.name)],
    );
  for (const path of walk("src").filter(
    (p) => /\.(ts|tsx)$/.test(p) && !p.includes(".test."),
  )) {
    expect(readFileSync(path, "utf8")).not.toMatch(
      /(?:from\s*|import\s*\()['"][^'"]*v0\//,
    );
  }
  expect(readFileSync(".github/workflows/v1.yml", "utf8")).not.toMatch(
    /docs:check|test:ci|online|server:/,
  );
});
