import test from "node:test";
import assert from "node:assert/strict";
import { CACHE_KEY, loadCurrentFixtures, readValidatedCache } from "../display-runtime.js";

const data = { fixtures: [{ id: "one", opponent: "Spain", date: "2099-09-26", time: "19:45", dateMode: "exact", competition: "nations-league", venue: "home", hidden: false, pinned: false }] };

test("poison cache shapes and storage exceptions are cache misses", () => {
  for (const value of ["{", "null", '"x"', "1", '{"fixtures":{}}', '{"fixtures":[null]}']) {
    assert.equal(readValidatedCache({ getItem: () => value }), null);
  }
  assert.equal(readValidatedCache({ getItem: () => { throw new Error("denied"); } }), null);
});

test("valid schema-versioned cache restores", () => {
  const cache = JSON.stringify({ schemaVersion: 2, receivedAt: "2099-01-01T00:00:00Z", data });
  assert.equal(readValidatedCache({ getItem: () => cache }, new Date("2099-01-02T00:00:00Z")).fixtures[0].id, "one");
});

test("valid network data renders even when localStorage write fails", async () => {
  let delivered;
  const result = await loadCurrentFixtures({
    fetchImpl: async () => ({ ok: true, json: async () => data }),
    storage: { setItem: () => { throw new Error("quota"); } },
    onData: value => { delivered = value; },
    timeoutMs: 20
  });
  assert.equal(result.ok, true);
  assert.equal(delivered.fixtures[0].id, "one");
});

test("malformed network data never overwrites LKG", async () => {
  let writes = 0;
  const result = await loadCurrentFixtures({ fetchImpl: async () => ({ ok: true, json: async () => ({ fixtures: {} }) }), storage: { setItem: () => { writes += 1; } }, onData: () => {}, timeoutMs: 20 });
  assert.equal(result.ok, false);
  assert.equal(writes, 0);
});

test("non-2xx, offline and timeout fail without retrying", async () => {
  assert.equal((await loadCurrentFixtures({ fetchImpl: async () => ({ ok: false, status: 502 }), storage: null, onData: () => {}, timeoutMs: 20 })).ok, false);
  assert.equal((await loadCurrentFixtures({ fetchImpl: async () => { throw new Error("offline"); }, storage: null, onData: () => {}, timeoutMs: 20 })).ok, false);
  let calls = 0;
  const hanging = (_url, { signal }) => new Promise((_resolve, reject) => { calls += 1; signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))); });
  assert.equal((await loadCurrentFixtures({ fetchImpl: hanging, storage: null, onData: () => {}, timeoutMs: 5 })).ok, false);
  assert.equal(calls, 1);
});

test("validated network response is written as versioned cache", async () => {
  const writes = new Map();
  await loadCurrentFixtures({ fetchImpl: async () => ({ ok: true, json: async () => data }), storage: { setItem: (key, value) => writes.set(key, value) }, onData: () => {}, now: () => new Date("2026-08-01T00:00:00Z"), timeoutMs: 20 });
  const saved = JSON.parse(writes.get(CACHE_KEY));
  assert.equal(saved.schemaVersion, 2);
  assert.equal(saved.receivedAt, "2026-08-01T00:00:00.000Z");
});
