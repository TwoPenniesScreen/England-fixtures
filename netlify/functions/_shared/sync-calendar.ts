import type { Context } from "@netlify/functions";
import { isAuthoritativeEmptyCalendar, mergeCalendarData, parseCalendar } from "./calendar.js";
import { getFixtureStore } from "./store.ts";
import { validateDisplayData } from "../../../fixture-schema.js";

const EMPTY = { fixtures: [], updatedAt: null };

export async function syncCalendar(context?: Context) {
  const calendarUrl = Netlify.env.get("LIVE_FOOTBALL_TV_CALENDAR_URL");
  if (!calendarUrl) throw new Error("TV calendar is not configured");

  const response = await fetch(calendarUrl, {
    headers: { Accept: "text/calendar" },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error("TV calendar could not be reached");
  const text = await response.text();
  if (text.length > 500_000) throw new Error("TV calendar response is too large");

  const events = parseCalendar(text);
  if (!events.length && !isAuthoritativeEmptyCalendar(text)) throw new Error("TV calendar contained no verifiable fixtures; keeping the last good copy");
  const store = getFixtureStore(context);
  const current = (await store.get("current", { type: "json" })) || EMPTY;
  const currentDisplay = validateDisplayData(current);
  if (!currentDisplay || currentDisplay.fixtures.length !== current.fixtures.length) throw new Error("Stored fixture data is invalid; refusing to overwrite it");
  const saved = mergeCalendarData(current, events);
  const display = validateDisplayData(saved);
  if (!display || display.fixtures.length !== saved.fixtures.length) throw new Error("TV calendar produced invalid or duplicate fixture data; keeping the last good copy");
  await store.setJSON("current", saved);
  return saved;
}
