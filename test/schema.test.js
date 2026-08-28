import test from "node:test";
import assert from "node:assert/strict";
import { DISPLAY_SCHEMA_VERSION, validateDisplayData } from "../fixture-schema.js";

const valid = (extra = {}) => ({ id: "one", opponent: "Spain", date: "2026-09-26", time: "19:45", dateMode: "exact", competition: "nations-league", venue: "home", hidden: false, pinned: false, ...extra });

test("public display validation drops bad records without poisoning good fixtures", () => {
  const result = validateDisplayData({ fixtures: [valid(), null, valid({ id: "", opponent: "" }), valid({ id: "bad-time", time: "99:00" })], updatedAt: "2026-08-01T00:00:00Z" });
  assert.equal(result.schemaVersion, DISPLAY_SCHEMA_VERSION);
  assert.deepEqual(result.fixtures.map(value => value.id), ["one"]);
});

test("invalid top-level display shapes are rejected", () => {
  for (const value of [null, "x", 1, { fixtures: {} }, { fixtures: [null] }]) assert.equal(validateDisplayData(value, { requireFixture: true }), null);
});

test("invalid venue and competition are rejected", () => {
  assert.equal(validateDisplayData({ fixtures: [valid({ venue: "neutral" })] }, { requireFixture: true }), null);
  assert.equal(validateDisplayData({ fixtures: [valid({ competition: "league" })] }, { requireFixture: true }), null);
});

test("duplicate IDs and semantic duplicates are removed deterministically", () => {
  const result = validateDisplayData({ fixtures: [valid(), valid({ opponent: "Germany" }), valid({ id: "two" })] });
  assert.deepEqual(result.fixtures.map(value => value.id), ["one"]);
});

test("fixture count is bounded", () => assert.equal(validateDisplayData({ fixtures: Array.from({ length: 101 }, (_, index) => valid({ id: String(index) })) }), null));
