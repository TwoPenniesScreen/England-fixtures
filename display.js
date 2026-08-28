import { FALLBACK_DATA, renderScreen, selectFixtures } from "./fixture-core.js";
import { loadCurrentFixtures, readValidatedCache } from "./display-runtime.js";

const target = document.querySelector("#display");
const connection = document.querySelector("#connection");
const lkg = readValidatedCache();
const initial = lkg || FALLBACK_DATA;
const displayedFixture = Boolean(selectFixtures(initial.fixtures || []).featured);

renderScreen(target, initial);

loadCurrentFixtures({
  onData(data) {
    connection.hidden = true;
    // Preserve a validated fixture layout for this AbleSign page instance.
    // The branded fallback may be replaced by the first current fixture result.
    if (!displayedFixture) renderScreen(target, data);
  }
}).then(result => {
  if (!result.ok) connection.hidden = !displayedFixture;
});
