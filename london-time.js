import { isCalendarDate, isClockTime } from "./fixture-schema.js";

const LONDON = "Europe/London";
const londonParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
});

export function londonDateTimeToEpoch(date, time = "00:00") {
  if (!isCalendarDate(date) || !isClockTime(time)) return NaN;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const nominal = Date.UTC(year, month - 1, day, hour, minute);
  const matches = [];
  for (let offsetMinutes = -120; offsetMinutes <= 120; offsetMinutes += 30) {
    const candidate = nominal + offsetMinutes * 60_000;
    const parts = Object.fromEntries(londonParts.formatToParts(candidate).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    if (`${parts.year}-${parts.month}-${parts.day}` === date && `${parts.hour}:${parts.minute}` === time) matches.push(candidate);
  }
  return matches.length ? Math.min(...matches) : NaN;
}

export function londonDateAtInstant(instant) {
  const parts = Object.fromEntries(londonParts.formatToParts(instant).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function addCalendarDays(date, days) {
  if (!isCalendarDate(date)) return "";
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function parseIcsDateTime(property) {
  if (!property) return null;
  const { parameters, value } = property;
  const valueType = parameters.VALUE?.toUpperCase();
  if (valueType === "DATE" || /^\d{8}$/.test(value)) {
    if (!/^\d{8}$/.test(value)) return null;
    const date = compactDate(value);
    return isCalendarDate(date) ? { date, time: "", dateMode: "exact", instant: null } : null;
  }
  const match = value.match(/^(\d{8})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;
  const rawDate = compactDate(match[1]);
  const rawTime = `${match[2]}:${match[3]}`;
  if (!isCalendarDate(rawDate) || !isClockTime(rawTime) || (match[4] && Number(match[4]) > 59)) return null;
  if (match[5]) {
    const instant = Date.UTC(Number(match[1].slice(0, 4)), Number(match[1].slice(4, 6)) - 1, Number(match[1].slice(6, 8)), Number(match[2]), Number(match[3]), Number(match[4] || 0));
    const london = londonDateAtInstant(instant);
    return { ...london, dateMode: "exact", instant };
  }
  const tzid = parameters.TZID || LONDON;
  if (tzid !== LONDON) return null;
  const instant = londonDateTimeToEpoch(rawDate, rawTime);
  return Number.isFinite(instant) ? { date: rawDate, time: rawTime, dateMode: "exact", instant } : null;
}

function compactDate(value) { return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`; }
