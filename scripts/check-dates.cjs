// Read-only check: stored match dates vs the last matches-list sync time.
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("data/gameplan.db");
console.log("=== stored match dates ===");
for (const r of db.prepare("SELECT id, played_at, status, opponent_name FROM matches ORDER BY played_at").all()) {
  console.log(" ", r.id.slice(0, 8), r.played_at, r.status, r.opponent_name);
}
const c = db.prepare("SELECT fetched_at FROM raw_responses WHERE endpoint='matches' ORDER BY fetched_at DESC LIMIT 1").get();
console.log("matches list last fetched:", c?.fetched_at ?? "(never)");
const reports = db.prepare("SELECT COUNT(*) n FROM reports").get().n;
console.log("stored report snapshots:", reports);
