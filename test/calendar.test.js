import test from "node:test";
import assert from "node:assert/strict";
import { applyAdminUpdate, mergeCalendarData, parseCalendar } from "../netlify/functions/_shared/calendar.js";

const ICS = `BEGIN:VCALENDAR\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/London:20260812T171500\r
SUMMARY:⚽️📺 Scotland v England - International Friendly\r
UID:friendly-1@live-footballontv.com\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/London:20260823T163000\r
SUMMARY:⚽️📺 England v Spain - UEFA Nations League\r
UID:nations-1@live-footballontv.com\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/London:20260905T194500\r
SUMMARY:England v Albania - FIFA World Cup Qualifying\r
UID:qualifier-1@live-footballontv.com\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/London:20260823T120000\r
SUMMARY:Germany v France - UEFA Nations League\r
UID:unrelated@live-footballontv.com\r
END:VEVENT\r
END:VCALENDAR`;

test("parses only England fixtures from the subscribed TV calendar", () => {
  const events = parseCalendar(ICS);
  assert.equal(events.length, 3);
  assert.deepEqual(events[0].defaults, { opponent: "Scotland", date: "2026-08-12", time: "17:15", dateMode: "exact", competition: "friendly", venue: "away" });
  assert.equal(events[1].defaults.competition, "nations-league");
  assert.equal(events[2].defaults.competition, "world-cup-qualifier");
});

test("accepts an England label but rejects fixtures that do not contain England", () => {
  const events = parseCalendar(ICS.replace("England v Spain", "England Senior v Spain"));
  assert.equal(events.some(event => event.defaults.opponent === "Spain"), true);
  assert.equal(events.some(event => event.uid === "unrelated@live-footballontv.com"), false);
});

test("first sync adopts matching manual fixtures and adds new TV games", () => {
  const current = { fixtures: [{ id: "existing", opponent: "Spain", date: "2026-08-23", time: "16:30", competition: "nations-league", venue: "home", hidden: true, pinned: false }] };
  const saved = mergeCalendarData(current, parseCalendar(ICS), new Date("2026-08-09T12:00:00Z"));
  assert.equal(saved.fixtures.length, 3);
  const spain = saved.fixtures.find(fixture => fixture.opponent === "Spain");
  assert.equal(spain.id, "existing");
  assert.equal(spain.hidden, true);
  assert.equal(spain.source, "calendar");
});

test("a confirmed calendar fixture replaces its provisional playing window", () => {
  const current = { fixtures: [{ id: "window", opponent: "Spain", date: "2026-08-17", time: "", dateMode: "window", competition: "nations-league", venue: "away", hidden: false, pinned: true }] };
  const saved = mergeCalendarData(current, parseCalendar(ICS));
  const spain = saved.fixtures.find(fixture => fixture.opponent === "Spain");
  assert.equal(saved.fixtures.filter(fixture => fixture.opponent === "Spain").length, 1);
  assert.equal(spain.id, "window");
  assert.equal(spain.dateMode, "exact");
  assert.equal(spain.date, "2026-08-23");
  assert.equal(spain.time, "16:30");
  assert.equal(spain.venue, "home");
  assert.equal(spain.pinned, true);
  assert.equal(spain.source, "calendar");
});

test("first sync replaces an old opponent typo instead of making a duplicate", () => {
  const polandIcs = ICS.replace("Spain - UEFA Nations League", "Poland - UEFA Nations League");
  const current = { fixtures: [{ id: "old", opponent: "POLAND", date: "2026-08-23", time: "16:30", competition: "nations-league", venue: "home", hidden: false, pinned: false }] };
  const saved = mergeCalendarData(current, parseCalendar(polandIcs));
  assert.equal(saved.fixtures.filter(fixture => fixture.date === "2026-08-23").length, 1);
  assert.equal(saved.fixtures.find(fixture => fixture.date === "2026-08-23").opponent, "Poland");
});

test("admin hides and corrections survive later calendar changes", () => {
  const synced = mergeCalendarData({ fixtures: [] }, parseCalendar(ICS), new Date("2026-08-09T12:00:00Z"));
  const editedFixtures = synced.fixtures.map(fixture => fixture.opponent === "Spain" ? { ...fixture, opponent: "Spain Senior", hidden: true } : fixture);
  const edited = applyAdminUpdate(synced, editedFixtures, new Date("2026-08-09T13:00:00Z"));
  const changedCalendar = parseCalendar(ICS.replace("20260823T163000", "20260823T170000"));
  const resynced = mergeCalendarData(edited, changedCalendar, new Date("2026-08-10T12:00:00Z"));
  const spain = resynced.fixtures.find(fixture => fixture.calendarUid === "nations-1@live-footballontv.com");
  assert.equal(spain.opponent, "Spain Senior");
  assert.equal(spain.time, "17:00");
  assert.equal(spain.hidden, true);
});

test("a provider UID and kickoff change still preserve the hidden choice", () => {
  const synced = mergeCalendarData({ fixtures: [] }, parseCalendar(ICS));
  const hidden = applyAdminUpdate(synced, synced.fixtures.map(fixture => fixture.opponent === "Spain" ? { ...fixture, hidden: true } : fixture));
  const changed = parseCalendar(ICS.replace("nations-1@", "nations-reissued@").replace("20260823T163000", "20260824T200000"));
  const resynced = mergeCalendarData(hidden, changed);
  const spain = resynced.fixtures.find(fixture => fixture.opponent === "Spain");
  assert.equal(spain.hidden, true);
  assert.equal(spain.date, "2026-08-24");
  assert.equal(spain.time, "20:00");
});

test("deleting an imported fixture keeps it out of later syncs", () => {
  const synced = mergeCalendarData({ fixtures: [] }, parseCalendar(ICS));
  const kept = synced.fixtures.filter(fixture => fixture.opponent !== "Scotland");
  const edited = applyAdminUpdate(synced, kept);
  const resynced = mergeCalendarData(edited, parseCalendar(ICS));
  assert.equal(resynced.fixtures.some(fixture => fixture.opponent === "Scotland"), false);
});
