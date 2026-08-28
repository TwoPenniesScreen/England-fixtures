import { fixtureSemanticKey, isCalendarDate } from "../../../fixture-schema.js";
import { parseIcsDateTime } from "../../../london-time.js";

const FIXTURE_FIELDS = ["opponent", "date", "time", "dateMode", "competition", "venue"];
const EXCLUDED_STATUSES = new Set(["CANCELLED", "POSTPONED", "ABANDONED"]);
const MAX_CALENDAR_BYTES = 500_000;
const SENIOR_ENGLAND_NAMES = new Set(["england", "england men", "england senior", "england senior men", "england men's", "england men's senior team", "england men's national team", "england national team"]);

export function parseCalendar(ics) {
  const text = String(ics);
  if (text.length > MAX_CALENDAR_BYTES) throw new Error("The TV calendar response is too large");
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  if (!/(?:^|\r?\n)BEGIN:VCALENDAR(?:\r?\n|$)/.test(unfolded)) throw new Error("The TV calendar response is not a calendar");
  const parsed = [...unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT/g)].map((match, index) => parseEvent(match[1], index)).filter(Boolean);
  if (parsed.length > 100) throw new Error("The TV calendar contains too many fixtures");
  const byUid = new Map();
  for (const event of parsed) {
    const existing = byUid.get(event.uid);
    if (!existing || compareRevision(event, existing) > 0) byUid.set(event.uid, event);
  }
  const semantic = new Map();
  for (const event of byUid.values()) {
    if (!event.defaults || EXCLUDED_STATUSES.has(event.status)) continue;
    const key = fixtureSemanticKey({ id: event.uid, hidden: false, pinned: false, ...event.defaults });
    const existing = semantic.get(key);
    const comparison = existing ? compareRevision(event, existing) : 1;
    if (!existing || comparison > 0 || (comparison === 0 && event.uid.localeCompare(existing.uid) < 0)) semantic.set(key, event);
  }
  return [...semantic.values()].sort((a, b) => compareDefaults(a.defaults, b.defaults) || a.uid.localeCompare(b.uid)).map(({ uid, defaults }) => ({ uid, defaults }));
}

export function isAuthoritativeEmptyCalendar(text) {
  const events = [...String(text).replace(/\r?\n[ \t]/g, "").matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT/g)];
  let validEvent = false;
  for (const match of events) {
    const block = match[1];
    const uid = unescapeIcs(readProperty(block, "UID")?.value || "").trim();
    const summary = unescapeIcs(readProperty(block, "SUMMARY")?.value || "").replace(/^[^A-Za-z0-9]+/u, "").trim();
    const teams = summary.match(/^(.+?)\s+v\s+(.+?)\s+-\s+.+$/i);
    if (!uid || !teams || !parseIcsDateTime(readProperty(block, "DTSTART"))) continue;
    validEvent = true;
    if ([englandTeamCategory(teams[1]), englandTeamCategory(teams[2])].includes("ambiguous")) return false;
  }
  return validEvent;
}

function parseEvent(block, sourceOrder) {
  const uid = unescapeIcs(readProperty(block, "UID")?.value || "").trim();
  if (!uid) return null;
  const status = String(readProperty(block, "STATUS")?.value || "CONFIRMED").trim().toUpperCase();
  const sequenceText = readProperty(block, "SEQUENCE")?.value || "0";
  const sequence = /^\d+$/.test(sequenceText) ? Number(sequenceText) : 0;
  const revisionTime = parseRevisionTime(readProperty(block, "LAST-MODIFIED")?.value) ?? parseRevisionTime(readProperty(block, "DTSTAMP")?.value) ?? 0;
  const event = { uid, status, sequence, revisionTime, sourceOrder, defaults: null };
  if (EXCLUDED_STATUSES.has(status)) return event;
  const summary = unescapeIcs(readProperty(block, "SUMMARY")?.value || "").replace(/^[^A-Za-z0-9]+/u, "").trim();
  const match = summary.match(/^(.+?)\s+v\s+(.+?)\s+-\s+(.+)$/i);
  const starts = parseIcsDateTime(readProperty(block, "DTSTART"));
  if (!match || !starts) return null;
  const home = cleanTeam(match[1]), away = cleanTeam(match[2]);
  const homeIsEngland = isSeniorEngland(home), awayIsEngland = isSeniorEngland(away);
  if (homeIsEngland === awayIsEngland) return null;
  event.defaults = { opponent: homeIsEngland ? away : home, date: starts.date, time: starts.time, dateMode: "exact", competition: competitionKey(unescapeIcs(match[3]).trim()), venue: homeIsEngland ? "home" : "away" };
  return event;
}

export function isSeniorEngland(value) {
  return englandTeamCategory(value) === "senior";
}

export function englandTeamCategory(value) {
  const name = cleanTeam(value).toLowerCase().replace(/[’']/g, "'");
  if (SENIOR_ENGLAND_NAMES.has(name)) return "senior";
  if (/^new england(?:\b|$)/.test(name)) return "non-senior";
  if (/^england(?: women(?:'s)?| ladies| (?:u\s?\d{2}|under[- ]?\d{2})| youth| b(?: team)?| reserves?)(?:\b|$)/.test(name)) return "non-senior";
  return /\bengland\b/.test(name) ? "ambiguous" : "unrelated";
}

export function mergeCalendarData(current = {}, events = [], now = new Date()) {
  const currentFixtures = Array.isArray(current.fixtures) ? current.fixtures : [];
  const ignored = new Set(Array.isArray(current.ignoredCalendarUids) ? current.ignoredCalendarUids : []);
  const matchedIds = new Set(), imported = [];
  for (const event of events) {
    if (ignored.has(event.uid)) continue;
    const existing = currentFixtures.find(fixture => fixture.calendarUid === event.uid)
      || currentFixtures.find(fixture => !matchedIds.has(fixture.id) && sameFixture(fixture, event.defaults))
      || currentFixtures.find(fixture => !matchedIds.has(fixture.id) && samePlayingWindow(fixture, event.defaults))
      || currentFixtures.find(fixture => !matchedIds.has(fixture.id) && sameOpponentFixture(fixture, event.defaults));
    if (existing) matchedIds.add(existing.id);
    const overrides = existing?.manualOverrides && typeof existing.manualOverrides === "object" ? existing.manualOverrides : {};
    imported.push({ id: existing?.id || calendarId(event.uid), ...event.defaults, ...pickOverrides(overrides), hidden: Boolean(existing?.hidden), pinned: Boolean(existing?.pinned), source: "calendar", calendarUid: event.uid, calendarDefaults: event.defaults, manualOverrides: pickOverrides(overrides) });
  }
  const manual = currentFixtures.filter(fixture => !fixture.calendarUid && !matchedIds.has(fixture.id));
  const fixtures = [...manual, ...imported].sort(compareFixtures);
  let keptPin = false;
  for (const fixture of fixtures) if (fixture.pinned) { if (keptPin) fixture.pinned = false; keptPin = true; }
  return { fixtures, ignoredCalendarUids: [...ignored], updatedAt: now.toISOString(), calendar: { provider: "Live Football On TV", lastSyncedAt: now.toISOString(), imported: imported.length } };
}

export function applyAdminUpdate(current = {}, fixtures = [], now = new Date()) {
  const existingFixtures = Array.isArray(current.fixtures) ? current.fixtures : [];
  const existingById = new Map(existingFixtures.map(fixture => [fixture.id, fixture]));
  const submittedIds = new Set(fixtures.map(fixture => fixture.id));
  const ignored = new Set(Array.isArray(current.ignoredCalendarUids) ? current.ignoredCalendarUids : []);
  for (const existing of existingFixtures) if (existing.calendarUid && !submittedIds.has(existing.id)) ignored.add(existing.calendarUid);
  const updated = fixtures.map(fixture => {
    const existing = existingById.get(fixture.id);
    if (!existing?.calendarUid) return fixture;
    const defaults = existing.calendarDefaults || pickFixtureFields(existing), manualOverrides = {};
    for (const field of FIXTURE_FIELDS) if (fixture[field] !== defaults[field]) manualOverrides[field] = fixture[field];
    return { ...fixture, source: "calendar", calendarUid: existing.calendarUid, calendarDefaults: defaults, manualOverrides };
  });
  return { ...current, fixtures: updated, ignoredCalendarUids: [...ignored], updatedAt: now.toISOString() };
}

function readProperty(block, name) {
  const line = block.split(/\r?\n/).find(value => value.slice(0, Math.max(0, value.indexOf(":"))).split(";", 1)[0].toUpperCase() === name);
  if (!line) return null;
  const separator = line.indexOf(":"), header = line.slice(0, separator).split(";"), parameters = {};
  for (const part of header.slice(1)) { const equals = part.indexOf("="); if (equals > 0) parameters[part.slice(0, equals).toUpperCase()] = part.slice(equals + 1).replace(/^"|"$/g, ""); }
  return { name: header[0].toUpperCase(), parameters, value: line.slice(separator + 1) };
}
function compareRevision(a, b) { return a.sequence - b.sequence || a.revisionTime - b.revisionTime || a.sourceOrder - b.sourceOrder; }
function parseRevisionTime(value) { return /^\d{8}T\d{6}Z$/.test(value || "") ? Date.parse(`${value.slice(0,4)}-${value.slice(4,6)}-${value.slice(6,8)}T${value.slice(9,11)}:${value.slice(11,13)}:${value.slice(13,15)}Z`) : null; }
function unescapeIcs(value) { return String(value).replace(/\\[nN]/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\"); }
function cleanTeam(value) { return String(value).trim().replace(/\s+/g, " "); }
function normaliseTeam(value) { return cleanTeam(value).toLowerCase().replace(/\b(?:afc|fc)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
function competitionKey(value) { const name = value.toLowerCase(), qualifier = name.includes("qualif"); if (name.includes("world cup") && qualifier) return "world-cup-qualifier"; if ((name.includes("euro") || name.includes("european championship")) && qualifier) return "euro-qualifier"; if (name.includes("nations league")) return "nations-league"; if (name.includes("world cup")) return "world-cup"; if (name.includes("euro") || name.includes("european championship")) return "euros"; if (name.includes("friendly")) return "friendly"; return "other"; }
function sameFixture(fixture, defaults) { return normaliseTeam(fixture.opponent) === normaliseTeam(defaults.opponent) && fixture.date === defaults.date && (fixture.time || "") === defaults.time && (fixture.dateMode || "exact") === defaults.dateMode && fixture.venue === defaults.venue && fixture.competition === defaults.competition; }
function sameOpponentFixture(fixture, defaults) { return fixture.venue === defaults.venue && fixture.competition === defaults.competition && normaliseTeam(fixture.opponent) === normaliseTeam(defaults.opponent) && isCalendarDate(fixture.date) && Math.abs(new Date(`${fixture.date}T12:00:00Z`) - new Date(`${defaults.date}T12:00:00Z`)) <= 14 * 86400000; }
function samePlayingWindow(fixture, defaults) { if (fixture.dateMode !== "window" || fixture.competition !== defaults.competition || normaliseTeam(fixture.opponent) !== normaliseTeam(defaults.opponent)) return false; const starts = new Date(`${fixture.date}T00:00:00Z`), ends = new Date(starts); ends.setUTCDate(ends.getUTCDate() + 7); const confirmed = new Date(`${defaults.date}T12:00:00Z`); return confirmed >= starts && confirmed < ends; }
function calendarId(uid) { return `lfotv:${uid}`.slice(0, 80); }
function pickFixtureFields(fixture) { return Object.fromEntries(FIXTURE_FIELDS.map(field => [field, fixture[field]])); }
function pickOverrides(value) { return Object.fromEntries(FIXTURE_FIELDS.filter(field => Object.hasOwn(value, field)).map(field => [field, value[field]])); }
function compareDefaults(a, b) { return `${a.date}${a.time || "23:59"}`.localeCompare(`${b.date}${b.time || "23:59"}`); }
function compareFixtures(a, b) { return compareDefaults(a, b) || String(a.id || "").localeCompare(String(b.id || "")); }
