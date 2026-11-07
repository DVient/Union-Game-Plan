// LIVE acceptance: verify real Superstat data end-to-end and produce the
// real-data demonstration report (plan §14).
import { writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const base = "http://127.0.0.1:3777";

// SAFETY INTERLOCK: the live acceptance needs real Superstat data. Refuse to
// run against a mock-forced server (its report would be a fake demo).
const preflight = await (await fetch(base + "/api/state")).json();
if (preflight.mockMode !== false) {
  console.error("REFUSING TO RUN: the server on " + base + " is in MOCK mode.");
  console.error("Start the server WITHOUT UNION_GAMEPLAN_MOCK and with the Superstat key configured.");
  process.exit(3);
}
console.log("interlock: server is live — continuing.");

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const state = await (await fetch(base + "/api/state")).json();
check("app is in LIVE mode", state.mockMode === false);

const sync = await (await fetch(base + "/api/sync", { method: "POST" })).json();
check("live sync succeeds", sync.mode === "live" && sync.notes.length === 0, JSON.stringify({ teams: sync.teams, players: sync.players, matches: sync.matches, boxScores: sync.boxScores, eventSets: sync.eventSets, insights: sync.insights, notes: sync.notes }));

const state2 = await (await fetch(base + "/api/state")).json();
const realTeams = state2.teams;
const realPlayers = state2.players;
const realMatches = state2.matches;
console.log(`  club: ${realTeams.length} team(s), ${realPlayers.length} rostered players, ${realMatches.length} match(es)`);
check("club data present", realTeams.length >= 1 && realPlayers.length > 0 && realMatches.length > 0);

// Attribution check: every team-side box-score player id must exist in that team's roster.
const db = new DatabaseSync("data/gameplan.db");
const rosterIds = new Set(realPlayers.map((p) => p.id));
const boxIds = db.prepare("SELECT DISTINCT player_id FROM box_score_players WHERE side='team' AND player_id IS NOT NULL").all().map((r) => r.player_id);
const unknown = boxIds.filter((id) => !rosterIds.has(id));
check("player/match attribution (box ids ⊆ roster)", unknown.length === 0, unknown.length ? `unknown ids: ${unknown.join(",")}` : `${boxIds.length} distinct box-score players all match the roster`);

const complete = realMatches.filter((m) => m.status === "complete");
check("complete matches have box scores", complete.every((m) => db.prepare("SELECT 1 FROM box_score_totals WHERE match_id=? AND side='team'").get(m.id) !== undefined), `${complete.length} complete`);

// Demo report: the player with the most minutes across complete matches.
const demoPlayer = db.prepare(
  `SELECT b.player_id, b.name, SUM(b.minutes) total_min, COUNT(*) games
     FROM box_score_players b JOIN matches m ON m.id = b.match_id
    WHERE b.side='team' AND b.player_id IS NOT NULL AND m.status='complete'
    GROUP BY b.player_id ORDER BY total_min DESC LIMIT 1`,
).get();
console.log(`  demo player: ${demoPlayer.name} (${demoPlayer.games} game(s), ${Math.round(demoPlayer.total_min)} min)`);
const matchIds = db.prepare(
  `SELECT DISTINCT b.match_id FROM box_score_players b JOIN matches m ON m.id=b.match_id
    WHERE b.player_id=? AND m.status='complete' ORDER BY m.played_at`,
).all(demoPlayer.player_id).map((r) => r.match_id);
const report = await (await fetch(base + "/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerId: demoPlayer.player_id, matchIds }) })).json();
check("real-data report generated", Boolean(report.id), `games=${report.stats?.gamesUsed} small-sample=${report.stats?.confidence?.overall?.low}`);
if (report.ai) {
  console.log(`  AI provider: ${report.ai.providerId}${report.ai.note ? ` (note: ${report.ai.note})` : ""}`);
  check("AI findings all cited", report.ai.findings.length > 0 && report.ai.findings.every((f) => f.citation.length > 0), `${report.ai.findings.length} findings`);
}
check("priorities produced", report.priorities?.length >= 1 && report.priorities.length <= 3, report.priorities?.map((p) => p.area).join(" | "));

const pdfRes = await fetch(`${base}/api/reports/${report.id}/pdf`);
const buf = Buffer.from(await pdfRes.arrayBuffer());
writeFileSync("data/demo-real-report.pdf", buf);
check("real-data PDF downloads", pdfRes.status === 200 && buf.subarray(0, 5).toString() === "%PDF-" && buf.length > 4000, `${buf.length} bytes → data/demo-real-report.pdf`);

// Player insights status after generation attempt
const insRows = db.prepare("SELECT status, COUNT(*) n FROM insights WHERE player_id IS NOT NULL GROUP BY status").all();
console.log("  player-insights statuses:", JSON.stringify(insRows));

console.log(failures === 0 ? "\nLIVE ACCEPTANCE: ALL PASS" : `\nLIVE ACCEPTANCE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
