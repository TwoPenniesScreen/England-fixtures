import { DISPLAY_SCHEMA_VERSION, validateDisplayData } from "./fixture-schema.js";

export const CACHE_KEY = "two-pennies-england-fixtures-v2";
export const REQUEST_TIMEOUT_MS = 9_000;
const MAX_LKG_AGE_MS = 180 * 24 * 60 * 60 * 1000;

export function readValidatedCache(storage = globalThis.localStorage, now = new Date()) {
  try {
    const cached = JSON.parse(storage?.getItem(CACHE_KEY));
    if (!cached || cached.schemaVersion !== DISPLAY_SCHEMA_VERSION || typeof cached.receivedAt !== "string") return null;
    const receivedAt = Date.parse(cached.receivedAt);
    if (!Number.isFinite(receivedAt) || now.getTime() - receivedAt > MAX_LKG_AGE_MS || receivedAt - now.getTime() > 24 * 60 * 60 * 1000) return null;
    return validateDisplayData(cached.data, { requireFixture: true });
  } catch { return null; }
}

export async function loadCurrentFixtures({ fetchImpl = globalThis.fetch, storage = globalThis.localStorage, onData, timeoutMs = REQUEST_TIMEOUT_MS, now = () => new Date() }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl("/api/fixtures", { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Fixture service returned ${response.status || "an error"}`);
    const raw = await response.json();
    const data = validateDisplayData(raw, { requireFixture: true });
    if (!data) throw new Error("Fixture service returned invalid data");
    onData(data);
    try {
      storage?.setItem(CACHE_KEY, JSON.stringify({ schemaVersion: DISPLAY_SCHEMA_VERSION, receivedAt: now().toISOString(), data }));
    } catch { /* A storage failure must not discard a valid network response. */ }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error };
  } finally { clearTimeout(timer); }
}
