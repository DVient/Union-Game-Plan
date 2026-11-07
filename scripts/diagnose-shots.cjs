// Diagnose the real match's shot events: what exists, where, made vs missed.
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("data/gameplan.db");

console.log("=== events by type/success (real match) ===");
const rows = db.prepare(
  "SELECT type, success, COUNT(*) n, SUM(CASE WHEN x IS NOT NULL THEN 1 ELSE 0 END) located FROM events WHERE side='team' GROUP BY type, success ORDER BY type",
).all();
for (const r of rows) console.log(`  ${r.type} success=${r.success}: ${r.n} events, ${r.located} with location`);

console.log("=== shot events per player (K J) ===");
const kj = db.prepare("SELECT id, first_name, last_name FROM players WHERE last_name = 'J' OR first_name = 'K'").all();
console.log("candidates:", kj.map((p) => `${p.first_name} ${p.last_name}`).join(", "));
const shotRows = db.prepare(
  "SELECT e.type, e.success, e.x, e.y, e.player_id FROM events e WHERE e.side='team' AND e.type IN ('two_point','three_point') ORDER BY e.player_id, e.match_seconds",
).all();
const byPlayer = new Map();
for (const r of shotRows) {
  const key = r.player_id ?? "(null)";
  const arr = byPlayer.get(key) ?? [];
  arr.push(r);
  byPlayer.set(key, arr);
}
for (const [pid, evts] of byPlayer) {
  const located = evts.filter((e) => e.x !== null);
  const made = evts.filter((e) => e.success === 1);
  const madeLocated = evts.filter((e) => e.success === 1 && e.x !== null);
  console.log(`player ${pid?.slice(0, 8) ?? "null"}: ${evts.length} shots, ${made.length} made, ${located.length} located (madeLocated ${madeLocated.length})`);
  if (located.length > 0 && located.length <= 12) {
    for (const e of located) console.log(`   ${e.type} success=${e.success} x=${e.x?.toFixed(3)} y=${e.y?.toFixed(3)}`);
  }
}

console.log("=== box score FGA vs event counts (team totals) ===");
const totals = db.prepare("SELECT fga, fgm, tpa, tpm FROM box_score_totals WHERE side='team'").all();
for (const t of totals) console.log(`  FGA ${t.fga} (FGM ${t.fgm}), 3PA ${t.tpa} (3PM ${t.tpm})`);
