import test from "node:test";
import assert from "node:assert/strict";

global.document = { createElement: () => ({ textContent:"", get innerHTML(){ return this.textContent; } }) };
const { eligibleFixtures, formatWhen, renderScreen, selectFixtures, tidyName } = await import("../fixture-core.js");
const f = (id, date, time, extra={}) => ({ id, date, time, opponent:id, venue:"home", ...extra });

test("expires a timed fixture 45 minutes after kickoff", () => {
  const fixture = f("one", "2026-08-09", "15:00");
  assert.equal(eligibleFixtures([fixture], new Date("2026-08-09T14:44:59Z")).length, 1);
  assert.equal(eligibleFixtures([fixture], new Date("2026-08-09T14:45:01Z")).length, 0);
});
test("keeps TBC fixtures until the end of their date", () => assert.equal(eligibleFixtures([f("one","2026-08-09","")], new Date("2026-08-09T21:00:00Z")).length, 1));
test("keeps a playing-window fixture through its seven-day window", () => {
  const fixture = f("one", "2026-08-24", "", { dateMode: "window" });
  assert.equal(eligibleFixtures([fixture], new Date("2026-08-30T22:59:59Z")).length, 1);
  assert.equal(eligibleFixtures([fixture], new Date("2026-08-30T23:00:00Z")).length, 0);
  assert.equal(formatWhen(fixture), "W/C 24 AUG TBC");
});
test("uses London-local today and tomorrow labels before returning to day and date", () => {
  const now = new Date("2026-06-19T23:30:00Z");
  assert.equal(formatWhen(f("today", "2026-06-20", "19:45"), now), "TODAY 19:45");
  assert.equal(formatWhen(f("tomorrow", "2026-06-21", "15:00"), now), "TOMORROW 15:00");
  assert.equal(formatWhen(f("later", "2026-06-22", "20:00"), now), "MON 22 JUN 20:00");
});
test("rendering uses its supplied time for relative fixture labels", () => {
  const target = { innerHTML: "" };
  renderScreen(target, { fixtures: [f("Spain", "2026-06-20", "19:45")] }, new Date("2026-06-19T23:30:00Z"));
  assert.match(target.innerHTML, /<time>TODAY 19:45<\/time>/);
});
test("pin becomes featured and is not duplicated below", () => { const all=[f("a","2026-09-01","15:00"),f("b","2026-09-02","15:00",{pinned:true}),f("c","2026-09-03","15:00")]; const r=selectFixtures(all,new Date("2026-08-01")); assert.equal(r.featured.id,"b"); assert.deepEqual(r.upcoming.map(x=>x.id),["a","c"]); });
test("hidden fixtures are excluded", () => assert.equal(selectFixtures([f("a","2026-09-01","15:00",{hidden:true})],new Date("2026-08-01")).featured,null));
test("tidyName follows the live-score shortening philosophy", () => { assert.equal(tidyName("England"),"ENGLAND"); assert.equal(tidyName("Korea Republic"),"SOUTH KOREA"); });
test("no eligible fixtures renders the televised-games fallback", () => { const target={innerHTML:""}; renderScreen(target,{fixtures:[]},new Date("2026-08-01")); assert.match(target.innerHTML,/EVERY TELEVISED/); assert.match(target.innerHTML,/ENGLAND GAME/); });
test("competition types render clean plain text labels", () => {
  const target={innerHTML:""};
  renderScreen(target,{fixtures:[f("Germany","2026-09-01","19:45",{competition:"nations-league"})]},new Date("2026-08-01"));
  assert.match(target.innerHTML,/class="competition-name">UEFA NATIONS LEAGUE/);
  assert.doesNotMatch(target.innerHTML,/competition-logo|\.png/);
});
test("friendlies use a plain text label", () => {
  const target={innerHTML:""};
  renderScreen(target,{fixtures:[f("Germany","2026-09-01","19:45",{competition:"friendly"})]},new Date("2026-08-01"));
  assert.match(target.innerHTML,/class="competition-name">INTERNATIONAL FRIENDLY/);
  assert.doesNotMatch(target.innerHTML,/competition-logo|\.png/);
});
test("other leaves the competition slot blank", () => {
  const target={innerHTML:""};
  renderScreen(target,{fixtures:[f("Germany","2026-09-01","19:45",{competition:"other"})]},new Date("2026-08-01"));
  assert.match(target.innerHTML,/class="competition competition-other"[^>]*><\/div>/);
  assert.doesNotMatch(target.innerHTML,/other\.png|>INTERNATIONAL</);
});

test("selection is chronological, deduplicated and deterministic", () => {
  const fixtures = [
    f("later", "2026-09-02", "15:00"),
    f("same-b", "2026-09-01", "15:00", { opponent: "Spain" }),
    f("same-a", "2026-09-01", "15:00", { opponent: "Albania" }),
    f("same-a", "2026-09-01", "15:00", { opponent: "Albania" })
  ];
  const result = selectFixtures(fixtures, new Date("2026-08-01T00:00:00Z"));
  assert.equal(result.featured.id, "same-a");
  assert.deepEqual(result.upcoming.map(value => value.id), ["same-b", "later"]);
});

test("multiple pins resolve deterministically by fixture order", () => {
  const fixtures = [f("b", "2026-09-02", "15:00", { pinned: true }), f("a", "2026-09-01", "15:00", { pinned: true })];
  assert.equal(selectFixtures(fixtures, new Date("2026-08-01T00:00:00Z")).featured.id, "a");
});

test("kickoff cutoff uses Europe/London independently of process timezone", () => {
  const fixture = f("summer", "2026-06-20", "19:45");
  assert.equal(eligibleFixtures([fixture], new Date("2026-06-20T19:29:59Z")).length, 1);
  assert.equal(eligibleFixtures([fixture], new Date("2026-06-20T19:30:00Z")).length, 0);
  const winter = f("winter", "2026-01-15", "19:45");
  assert.equal(eligibleFixtures([winter], new Date("2026-01-15T20:30:00Z")).length, 0);
});

test("kickoff is eligible exactly now and expires at exactly 45 minutes", () => {
  const fixture = f("one", "2026-08-09", "15:00");
  assert.equal(eligibleFixtures([fixture], new Date("2026-08-09T14:00:00Z")).length, 1);
  assert.equal(eligibleFixtures([fixture], new Date("2026-08-09T14:45:00Z")).length, 0);
  assert.equal(eligibleFixtures([fixture], new Date("2026-08-09T14:45:00.001Z")).length, 0);
});
