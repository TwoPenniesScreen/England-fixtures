import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("display uses one bounded initial request with no polling or visibility refresh", async () => {
  const source = await readFile(new URL("../display.js", import.meta.url), "utf8");
  assert.match(source, /loadCurrentFixtures/);
  assert.doesNotMatch(source, /setInterval|visibilitychange/);
});
