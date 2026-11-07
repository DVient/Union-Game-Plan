// Recovery verification: full fresh live sync, then confirm the roster is
// complete again (including the player whose rows were accidentally deleted).
const base = "http://127.0.0.1:3777";
const state = await (await fetch(base + "/api/state")).json();
console.log("mode: live =", state.mockMode === false);
const sync = await (await fetch(base + "/api/sync", { method: "POST" })).json();
console.log("sync:", JSON.stringify({ mode: sync.mode, teams: sync.teams, players: sync.players, matches: sync.matches, boxScores: sync.boxScores, eventSets: sync.eventSets, insights: sync.insights, notes: sync.notes }));

const state2 = await (await fetch(base + "/api/state")).json();
console.log("players after sync:", state2.players.length);
const names = state2.players.map((p) => `${p.firstName} ${p.lastName} (#${p.jerseyNumber})`).join(", ");
console.log("roster:", names);

const { DatabaseSync } = await import("node:sqlite");
const db = new DatabaseSync("data/gameplan.db");
const boxRows = db.prepare("SELECT COUNT(*) n FROM box_score_players WHERE side='team'").get().n;
const complete = db.prepare("SELECT COUNT(*) n FROM matches WHERE status='complete'").get().n;
const insights = db.prepare("SELECT COUNT(*) n FROM insights").get().n;
console.log("box-score player rows:", boxRows, "| complete matches:", complete, "| insight rows:", insights);
const restored = state2.players.length === 10 && boxRows >= 10;
console.log(restored ? "RECOVERY OK" : "RECOVERY INCOMPLETE");
process.exit(restored ? 0 : 1);
