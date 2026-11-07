// Mock-mode acceptance pass (plan §14/§15): drives the full coach workflow in
// order — sync → select team → select player → select games → generate →
// download PDF → previous reports → compare — plus missing-data and
// idempotency checks. Exits non-zero on any failure.
const base = "http://127.0.0.1:3777";

// SAFETY INTERLOCK: this suite deletes players and must only ever run against
// a mock-forced server. Refuse to continue against live data.
const preflight = await (await fetch(base + "/api/state")).json();
if (preflight.mockMode !== true) {
  console.error("REFUSING TO RUN: the server on " + base + " is in LIVE mode.");
  console.error("This suite deletes player data. Start the server with UNION_GAMEPLAN_MOCK=1");
  console.error("and a throwaway UNION_GAMEPLAN_DATA_DIR, in the SAME command as the server.");
  process.exit(3);
}
console.log("interlock: server is mock-forced — continuing.");

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
const post = async (p, body) => (await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

// 1. Sync (twice — idempotency). On a fresh DB the first sync seeds everything;
// on an already-populated DB both syncs report zero new rows. Both are valid.
const s1 = await post("/api/sync", {});
const s2 = await post("/api/sync", {});
const freshSeed = s1.teams === 1 && s1.players === 8 && s1.matches === 5 && s2.matches === 0 && s2.teams === 0 && s2.players === 0;
const alreadyPopulated = s1.teams === 0 && s1.players === 0 && s1.matches === 0 && s2.matches === 0;
check("sync produces data / is idempotent", freshSeed || alreadyPopulated, JSON.stringify({ s1: { t: s1.teams, p: s1.players, m: s1.matches }, s2: { t: s2.teams, m: s2.matches } }));

// 2. Select team → player → games (as the UI does)
const state = await (await fetch(base + "/api/state")).json();
const team = state.teams[0];
const players = state.players.filter((p) => p.teamId === team.id);
check("team select offers players", players.length === 8);
const complete = state.matches.filter((m) => m.teamId === team.id && m.status === "complete");
check("last-5 preset yields 5 complete games", complete.length === 5);

// 3. Full selection → generate → PDF
const player = players[0];
const allIds = complete.map((m) => m.id);
const full = await post("/api/reports", { playerId: player.id, matchIds: allIds });
check("report generated", Boolean(full.id) && full.stats.gamesUsed === 5);
check("AI findings all cited", full.ai.findings.length > 0 && full.ai.findings.every((f) => f.citation.length > 0));
check("priorities <= 3 with evidence", full.priorities.length >= 1 && full.priorities.length <= 3 && full.priorities.every((p) => p.evidenceKeys.length > 0 && p.recommendations.length >= 3 && p.measure.length > 0 && p.reassessment.length > 0), `${full.priorities.length} priorities`);
const pdfRes = await fetch(`${base}/api/reports/${full.id}/pdf`);
const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
check("PDF downloads", pdfRes.status === 200 && pdfBuf.subarray(0, 5).toString() === "%PDF-" && pdfBuf.length > 5000, `${pdfBuf.length} bytes`);

// 4. Exclusion flow (deselect one game → 4 games → overall low-confidence must flag)
const four = await post("/api/reports", { playerId: player.id, matchIds: allIds.slice(0, 4) });
check("excluded-game report flags small sample", four.stats.gamesUsed === 4 && four.stats.confidence.overall.low, four.stats.confidence.overall.reason);

// 5. Previous reports + compare
const reports = await (await fetch(base + "/api/reports")).json();
check("previous reports listed", reports.length >= 2, `${reports.length} snapshots`);
const cmp = await (await fetch(`${base}/api/compare?a=${full.id}&b=${four.id}`)).json();
check("compare works across snapshots", !cmp.error && cmp.metrics.length === 14 && cmp.sampleNote !== null, cmp.sampleNote ?? "");

// 6. Missing / incomplete data (§14)
const empty = await post("/api/reports", { playerId: player.id, matchIds: [] });
check("empty game selection rejected cleanly", empty.error === "playerId and at least one matchId are required");
const bogus = await post("/api/reports", { playerId: player.id, matchIds: ["no-such-match", allIds[0]] });
check("missing box score handled gracefully", !bogus.error && bogus.stats.gamesUsed === 1 && bogus.stats.requestedGames === 2, "1 of 2 games had data; note recorded");
const bogusPdf = await fetch(`${base}/api/reports/${bogus.id}/pdf`);
const bogusBuf = Buffer.from(await bogusPdf.arrayBuffer());
console.log(`  bogus-pdf diagnostics: status=${bogusPdf.status} type=${bogusPdf.headers.get("content-type")} bytes=${bogusBuf.length} head=${bogusBuf.subarray(0, 20).toString("latin1").replace(/\n/g, " ")}`);
check("PDF still renders with missing data", bogusPdf.status === 200 && bogusBuf.subarray(0, 5).toString() === "%PDF-", `${bogusBuf.length} bytes`);
const badPlayer = await post("/api/reports", { playerId: "no-such-player", matchIds: allIds });
check("unknown player rejected cleanly", badPlayer.error === "Unknown player");

// 7. Minutes-null handling (compute level)
const { computePlayerStats } = await import("../dist/stats/compute.js");
const bundle = (await import("../dist/superstat/mock.js")).buildMockBundle();
const box = bundle.boxScores.get("m1");
const row = { ...box.team.players[0], minutes: null };
const nullStats = computePlayerStats("p1", [{ matchId: "m1", playedAt: "2026-05-09", opponentName: "X", teamScore: 60, opponentScore: 55, row }], []);
check("null minutes excluded from average", nullStats.aggregates.minutesPerGame === null && nullStats.aggregates.minutesMissingGames === 1 && nullStats.aggregates.pointsPerGame === row.points);

// 8. §12 deletion: permanently remove a player's data and reports (mock only!)
const other = players[1];
const otherReport = await post("/api/reports", { playerId: other.id, matchIds: allIds });
const otherPdf = await fetch(`${base}/api/reports/${otherReport.id}/pdf`);
await otherPdf.arrayBuffer(); // ensure the PDF file exists on disk
const del = await (await fetch(`${base}/api/players/${other.id}`, { method: "DELETE" })).json();
check("player deletion removes reports and PDFs", del.deleted !== undefined && del.reportsRemoved >= 1 && del.pdfsRemoved >= 1, JSON.stringify(del));
const stateAfter = await (await fetch(base + "/api/state")).json();
check("player gone from roster after deletion", stateAfter.players.every((p) => p.id !== other.id), `${stateAfter.players.length} players remain`);
const delAgain = await (await fetch(`${base}/api/players/${other.id}`, { method: "DELETE" })).json();
check("repeated deletion rejected cleanly", delAgain.error === "Unknown player");

console.log(failures === 0 ? "\nACCEPTANCE: ALL PASS" : `\nACCEPTANCE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
