import { FALLBACK_DATA, renderScreen, selectFixtures } from "./fixture-core.js";
import { loadCurrentFixtures, readValidatedCache } from "./display-runtime.js";
import { addCalendarDays, londonDateAtInstant, londonDateTimeToEpoch } from "./london-time.js";

const target = document.querySelector("#display");
const connection = document.querySelector("#connection");
const lkg = readValidatedCache();
const initial = lkg || FALLBACK_DATA;
const displayedFixture = Boolean(selectFixtures(initial.fixtures || []).featured);
let displayedData = initial;

renderScreen(target, initial);
scheduleDateRollover();

loadCurrentFixtures({
  onData(data) {
    connection.hidden = true;
    // Preserve a validated fixture layout for this AbleSign page instance.
    // The branded fallback may be replaced by the first current fixture result.
    if (!displayedFixture) {
      displayedData = data;
      renderScreen(target, data);
    }
  }
}).then(result => {
  if (!result.ok) connection.hidden = !displayedFixture;
});

function scheduleDateRollover() {
  const now = new Date();
  const today = londonDateAtInstant(now).date;
  const nextMidnight = londonDateTimeToEpoch(addCalendarDays(today, 1), "00:00");
  const delay = Math.max(1_000, nextMidnight - now.getTime() + 100);
  setTimeout(() => {
    renderScreen(target, displayedData);
    scheduleDateRollover();
  }, delay);
}
