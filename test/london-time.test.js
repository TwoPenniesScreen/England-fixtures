import test from "node:test";
import assert from "node:assert/strict";
import { londonDateTimeToEpoch } from "../london-time.js";

test("London wall time resolves winter GMT and summer BST", () => {
  assert.equal(new Date(londonDateTimeToEpoch("2026-01-15", "19:45")).toISOString(), "2026-01-15T19:45:00.000Z");
  assert.equal(new Date(londonDateTimeToEpoch("2026-06-20", "19:45")).toISOString(), "2026-06-20T18:45:00.000Z");
});

test("nonexistent spring time is rejected and repeated autumn time resolves deterministically", () => {
  assert.equal(Number.isNaN(londonDateTimeToEpoch("2026-03-29", "01:30")), true);
  assert.equal(new Date(londonDateTimeToEpoch("2026-10-25", "01:30")).toISOString(), "2026-10-25T00:30:00.000Z");
});
