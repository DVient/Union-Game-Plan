// Timeline of stored match dates across every preserved matches-list response.
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("data/gameplan.db");
const rows = db.prepare("SELECT body, fetched_at FROM raw_responses WHERE endpoint='matches' ORDER BY fetched_at").all();
for (const r of rows) {
  let parsed;
  try { parsed = JSON.parse(r.body); } catch { continue; }
  const list = Array.isArray(parsed) ? parsed : parsed.data ?? [];
  const stamp = r.fetched_at.slice(0, 19);
  for (const m of list) {
    console.log(`fetched ${stamp}  ${m.id?.slice(0, 8)}  playedAt=${m.playedAt}  vs ${m.opponent?.name ?? m.opponentName}`);
  }
}
