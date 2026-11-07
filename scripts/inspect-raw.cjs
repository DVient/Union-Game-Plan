// Inspect both databases: latest preserved club response (mock vs live) and player counts.
const { DatabaseSync } = require("node:sqlite");
for (const path of ["data/gameplan.db", "data/acceptance/gameplan.db"]) {
  console.log("===", path, "exists:", require("fs").existsSync(path));
  if (!require("fs").existsSync(path)) continue;
  const db = new DatabaseSync(path);
  const c = db.prepare("SELECT body, fetched_at FROM raw_responses WHERE endpoint='clubs' ORDER BY fetched_at DESC LIMIT 1").get();
  if (c) {
    const j = JSON.parse(c.body);
    console.log("  club:", Array.isArray(j) ? (j[0]?.name ?? "(empty list)") : "(non-list)", "| fetched:", c.fetched_at);
  } else console.log("  no clubs raw row");
  console.log("  players:", db.prepare("SELECT COUNT(*) n FROM players").get().n,
    "| matches:", db.prepare("SELECT COUNT(*) n FROM matches").get().n,
    "| teams:", db.prepare("SELECT COUNT(*) n FROM teams").get().n);
}
