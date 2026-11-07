// Stage 3 smoke test: stats computation over the mock data, low-confidence
// rules, zone accounting, and box-score validation.
const base = "http://127.0.0.1:3777";
const post = async (p, body) => (await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

await post("/api/sync", {});
const state = await (await fetch(base + "/api/state")).json();
const player = state.players[0];
const allIds = state.matches.filter((m) => m.status === "complete").map((m) => m.id);

// Full selection (5 games)
const full = await post("/api/reports", { playerId: player.id, matchIds: allIds });
console.log("full games:", full.stats.gamesUsed);
console.log("aggregates:", JSON.stringify(full.stats.aggregates));
console.log("zones:", JSON.stringify(full.stats.shootingZones.zones), "unlocated:", full.stats.shootingZones.unlocatedAttempts);
console.log("confidence flags low:", Object.entries(full.stats.confidence).filter(([, c]) => c.low).map(([k]) => k).join(",") || "(none)");
console.log("validation:", JSON.stringify(full.stats.validation));
const zoneSum = full.stats.shootingZones.zones.reduce((a, z) => a + z.attempts, 0) + full.stats.shootingZones.unlocatedAttempts;
console.log("zone attempts total:", zoneSum, "(should equal 5-game FGA sum)");

// Short selection (3 games) — overall confidence must flag
const short = await post("/api/reports", { playerId: player.id, matchIds: allIds.slice(0, 3) });
console.log("short games:", short.stats.gamesUsed, "overall low:", short.stats.confidence.overall.low, "-", short.stats.confidence.overall.reason);

// Snapshot retrieval
const got = await (await fetch(`${base}/api/reports/${full.id}`)).json();
console.log("snapshot retrieve:", got.id === full.id && got.stats !== null ? "OK" : "FAIL");
