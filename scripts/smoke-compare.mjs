// Stage 6 smoke test: two snapshots with different game sets, then compare.
const base = "http://127.0.0.1:3777";
const post = async (p, body) => (await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

await post("/api/sync", {});
const state = await (await fetch(base + "/api/state")).json();
const player = state.players.find((p) => p.jerseyNumber === "2".padStart(0) || p.jerseyNumber === "4");
const allIds = state.matches.filter((m) => m.status === "complete").map((m) => m.id);

const earlier = await post("/api/reports", { playerId: player.id, matchIds: allIds.slice(0, 3) }); // first 3 games
const later = await post("/api/reports", { playerId: player.id, matchIds: allIds });               // all 5
console.log("earlier:", earlier.id?.slice(0, 8), "| later:", later.id?.slice(0, 8));

const cmp = await (await fetch(`${base}/api/compare?a=${earlier.id}&b=${later.id}`)).json();
if (cmp.error) { console.error("COMPARE FAIL:", cmp.error); process.exit(1); }
console.log("sampleNote:", cmp.sampleNote ?? "(same sample size)");
const interesting = cmp.metrics.filter((m) => ["pointsPerGame", "trueShootingPct", "turnoversPerGame", "assistToTurnover"].includes(m.metric));
for (const m of interesting) console.log(`  ${m.metric}: ${m.prev} → ${m.curr} (${m.delta}) ${m.trend}`);
console.log("priorities carriedOver:", cmp.priorities.carriedOver.length, "newFocus:", cmp.priorities.newFocus.length, "dropped:", cmp.priorities.dropped.length);
const reversed = await (await fetch(`${base}/api/compare?a=${later.id}&b=${earlier.id}`)).json();
console.log("reversed sanity: ppg delta flips:", reversed.metrics.find((m) => m.metric === "pointsPerGame").delta === -(interesting.find((m) => m.metric === "pointsPerGame").delta) ? "OK" : "FAIL");
