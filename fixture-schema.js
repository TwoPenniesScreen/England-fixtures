export const DISPLAY_SCHEMA_VERSION = 2;
export const MAX_FIXTURES = 100;
export const COMPETITIONS = new Set(["world-cup", "euros", "world-cup-qualifier", "euro-qualifier", "nations-league", "friendly", "other"]);

export function validateDisplayFixture(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = strictText(value.id, 80);
  const opponent = strictText(value.opponent, 80);
  const date = strictText(value.date, 10);
  const time = value.time == null ? "" : strictText(value.time, 5);
  const dateMode = value.dateMode === "window" ? "window" : value.dateMode === "exact" || value.dateMode == null ? "exact" : null;
  const competition = strictText(value.competition || "other", 40);
  const venue = value.venue;
  if (!id || !opponent || !isCalendarDate(date) || dateMode == null || !COMPETITIONS.has(competition) || !["home", "away"].includes(venue)) return null;
  if (dateMode === "window" ? time !== "" : time !== "" && !isClockTime(time)) return null;
  if (value.hidden != null && typeof value.hidden !== "boolean") return null;
  if (value.pinned != null && typeof value.pinned !== "boolean") return null;
  return { id, opponent, date, time, dateMode, competition, venue, hidden: Boolean(value.hidden), pinned: Boolean(value.pinned) };
}

export function validateDisplayData(value, { requireFixture = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.fixtures) || value.fixtures.length > MAX_FIXTURES) return null;
  const fixtures = [];
  const ids = new Set();
  const semantics = new Set();
  for (const candidate of value.fixtures) {
    const fixture = validateDisplayFixture(candidate);
    if (!fixture) continue;
    const semantic = fixtureSemanticKey(fixture);
    if (ids.has(fixture.id) || semantics.has(semantic)) continue;
    ids.add(fixture.id);
    semantics.add(semantic);
    fixtures.push(fixture);
  }
  if (requireFixture && value.fixtures.length && !fixtures.length) return null;
  const updatedAt = validIso(value.updatedAt) ? value.updatedAt : null;
  return { schemaVersion: DISPLAY_SCHEMA_VERSION, fixtures, updatedAt };
}

export function fixtureSemanticKey(fixture) {
  return [normaliseText(fixture.opponent), fixture.date, fixture.time || "", fixture.dateMode, fixture.venue, fixture.competition].join("|");
}

export function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function isClockTime(value) { return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value); }

function strictText(value, max) {
  if (typeof value !== "string") return "";
  const text = value.trim().replace(/\s+/g, " ");
  return text && text.length <= max ? text : "";
}

function normaliseText(value) { return String(value).trim().toLocaleLowerCase("en-GB").replace(/[^a-z0-9]+/g, " ").trim(); }
function validIso(value) { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
