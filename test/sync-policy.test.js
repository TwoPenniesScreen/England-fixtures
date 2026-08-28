import test from "node:test";
import assert from "node:assert/strict";
import { isAuthoritativeEmptyCalendar } from "../netlify/functions/_shared/calendar.js";

test("an empty or malformed feed is not authoritative", () => {
  assert.equal(isAuthoritativeEmptyCalendar("BEGIN:VCALENDAR\nEND:VCALENDAR"), false);
  assert.equal(isAuthoritativeEmptyCalendar("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nEND:VEVENT\nEND:VCALENDAR"), false);
  assert.equal(isAuthoritativeEmptyCalendar("BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260230T194500\nSUMMARY:England Women v Spain Women - Friendly\nUID:bad-date\nEND:VEVENT\nEND:VCALENDAR"), false);
});

test("a structurally valid feed with no senior England event is authoritative empty", () => {
  const calendar = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260926T194500\nSUMMARY:England Women v Spain Women - Friendly\nUID:women\nEND:VEVENT\nEND:VCALENDAR";
  assert.equal(isAuthoritativeEmptyCalendar(calendar), true);
});

test("an unknown England-bearing provider name is not authoritative empty", () => {
  const calendar = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260926T194500\nSUMMARY:England MNT v Spain - Friendly\nUID:unknown-senior-name\nEND:VEVENT\nEND:VCALENDAR";
  assert.equal(isAuthoritativeEmptyCalendar(calendar), false);
});
