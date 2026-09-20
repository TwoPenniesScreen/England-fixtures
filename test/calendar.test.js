import test from "node:test";
import assert from "node:assert/strict";
import { applyAdminUpdate, isSeniorEngland, mergeCalendarData, parseCalendar } from "../netlify/functions/_shared/calendar.js";

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

test("senior England identity is explicit and rejects women, youth, B teams and false positives", () => {
  for (const name of ["England", "England Men", "England Senior", "England Senior Men", "England Men's", "England Men's Senior Team", "England Men's National Team", "England National Team"]) assert.equal(isSeniorEngland(name), true, name);
  for (const name of ["England Women", "England Women's", "England U21", "England U20", "England U19", "England U18", "England U17", "England Youth", "England B", "New England", "New England Revolution"]) assert.equal(isSeniorEngland(name), false, name);
});

test("an opponent containing England does not become the senior team", () => {
  assert.equal(parseCalendar(calendarEvent("New England v Spain", "20260926T194500", "new-england")).length, 0);
  assert.equal(parseCalendar(calendarEvent("England Men v New England Revolution", "20260926T194500", "senior")).at(0).defaults.opponent, "New England Revolution");
});

test("UTC DTSTART is converted to Europe/London and can cross a calendar boundary", () => {
  const summer = parseCalendar(calendarEvent("England v Spain", "20260926T184500Z", "utc-summer"))[0];
  assert.deepEqual([summer.defaults.date, summer.defaults.time], ["2026-09-26", "19:45"]);
  const midnight = parseCalendar(calendarEvent("England v Spain", "20260630T233000Z", "utc-midnight"))[0];
  assert.deepEqual([midnight.defaults.date, midnight.defaults.time], ["2026-07-01", "00:30"]);
});

test("Europe/London TZID and all-day DTSTART are supported", () => {
  const london = parseCalendar(calendarEvent("England v Spain", "20260926T194500", "london", ";TZID=Europe/London"))[0];
  assert.deepEqual([london.defaults.date, london.defaults.time], ["2026-09-26", "19:45"]);
  const providerAlias = parseCalendar(calendarEvent("England v Spain", "20260926T194500", "provider", ";TZID=/ics.py/2020.1/Europe/London"))[0];
  assert.deepEqual([providerAlias.defaults.date, providerAlias.defaults.time], ["2026-09-26", "19:45"]);
  const allDay = parseCalendar(calendarEvent("England v Spain", "20260926", "all-day", ";VALUE=DATE"))[0];
  assert.deepEqual([allDay.defaults.date, allDay.defaults.time, allDay.defaults.dateMode], ["2026-09-26", "", "exact"]);
});

test("unsupported TZID and malformed or nonexistent timestamps are rejected", () => {
  assert.equal(parseCalendar(calendarEvent("England v Spain", "20260926T194500", "foreign", ";TZID=America/New_York")).length, 0);
  assert.equal(parseCalendar(calendarEvent("England v Spain", "20260926T194500", "foreign-alias", ";TZID=/ics.py/2020.1/America/New_York")).length, 0);
  assert.equal(parseCalendar(calendarEvent("England v Spain", "20260230T194500", "invalid")).length, 0);
  assert.equal(parseCalendar(calendarEvent("England v Spain", "20260329T013000", "nonexistent", ";TZID=Europe/London")).length, 0);
});

test("cancelled, postponed and abandoned events are excluded", () => {
  for (const status of ["CANCELLED", "POSTPONED", "ABANDONED"]) {
    assert.equal(parseCalendar(calendarEvent("England v Spain", "20260926T194500", status, "", `STATUS:${status}`)).length, 0);
  }
});

test("a newest cancellation removes a previously active imported fixture", () => {
  const current = mergeCalendarData({}, parseCalendar(calendarEvent("England v Spain", "20260926T194500", "same")));
  const cancelled = parseCalendar(calendarEvent("England v Spain", "20260926T194500", "same", "", "SEQUENCE:2\nSTATUS:CANCELLED"));
  assert.equal(mergeCalendarData(current, cancelled).fixtures.length, 0);
});

test("newest duplicate UID wins and a newest cancellation suppresses the event", () => {
  const oldEvent = eventBlock("England v Spain", "20260926T194500", "same", "", "SEQUENCE:1\nLAST-MODIFIED:20260801T120000Z");
  const newEvent = eventBlock("England v Spain", "20260926T200000", "same", "", "SEQUENCE:2\nLAST-MODIFIED:20260802T120000Z");
  assert.equal(parseCalendar(wrapCalendar(oldEvent + newEvent))[0].defaults.time, "20:00");
  const cancelled = eventBlock("England v Spain", "20260926T200000", "same", "", "SEQUENCE:3\nSTATUS:CANCELLED");
  assert.equal(parseCalendar(wrapCalendar(oldEvent + newEvent + cancelled)).length, 0);
});

test("semantic duplicate entries with different UIDs render once", () => {
  const one = eventBlock("England v Spain", "20260926T194500", "one");
  const two = eventBlock("England v Spain", "20260926T194500", "two");
  assert.equal(parseCalendar(wrapCalendar(one + two)).length, 1);
});

test("folded CRLF lines parse and missing summary or UID do not", () => {
  const folded = wrapCalendar(eventBlock("England v Spain", "20260926T194500", "folded")).replace("England v Spain - UEFA Nations League", "England v Spain - UEFA Nations\r\n League");
  assert.equal(parseCalendar(folded).length, 1);
  assert.equal(parseCalendar(wrapCalendar(eventBlock("England v Spain", "20260926T194500", ""))).length, 0);
  assert.equal(parseCalendar(wrapCalendar("BEGIN:VEVENT\nDTSTART:20260926T194500\nUID:x\nEND:VEVENT\n")).length, 0);
});

test("oversized and non-calendar input are rejected while a valid empty calendar is safe", () => {
  assert.throws(() => parseCalendar(`BEGIN:VCALENDAR\n${"x".repeat(500001)}\nEND:VCALENDAR`), /too large/);
  assert.throws(() => parseCalendar("not a calendar"), /not a calendar/);
  assert.deepEqual(parseCalendar("BEGIN:VCALENDAR\nEND:VCALENDAR"), []);
});

test("an unrelated manual fixture at the same kickoff is not adopted", () => {
  const current = { fixtures: [{ id: "manual", opponent: "Germany", date: "2026-09-26", time: "19:45", dateMode: "exact", competition: "nations-league", venue: "home", hidden: false, pinned: false }] };
  const saved = mergeCalendarData(current, parseCalendar(calendarEvent("England v Spain", "20260926T194500", "spain")));
  assert.equal(saved.fixtures.length, 2);
  assert.equal(saved.fixtures.find(value => value.opponent === "Spain").id.startsWith("lfotv:"), true);
});

function calendarEvent(summary, start, uid, parameter = "", extra = "") { return wrapCalendar(eventBlock(summary, start, uid, parameter, extra)); }
function eventBlock(summary, start, uid, parameter = "", extra = "") {
  return `BEGIN:VEVENT\nDTSTART${parameter}:${start}\nSUMMARY:${summary} - UEFA Nations League\n${uid ? `UID:${uid}\n` : ""}${extra ? `${extra}\n` : ""}END:VEVENT\n`;
}
function wrapCalendar(events) { return `BEGIN:VCALENDAR\n${events}END:VCALENDAR`; }
