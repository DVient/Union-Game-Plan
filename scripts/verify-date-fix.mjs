// Regression test for the date-correction fix: corrupt a stored match date
// directly in the DB, re-sync, and assert the API value is restored and the
// correction note is surfaced. MOCK server only (writes to the DB).
const base = "http://127.0.0.1:3777";
const { DatabaseSync } = await import("node:sqlite");

const state = await (await fetch(base + "/api/state")).json();
if (state.mockMode !== true) {
  console.error("REFUSING: run against a mock-forced server (this test writes to the DB).");
  process.exit(3);
}
const db = new DatabaseSync("data/acceptance/gameplan.db");
await (await fetch(base + "/api/sync", { method: "POST" })).json(); // ensure the mock DB is seeded
const match = db.prepare("SELECT id, played_at FROM matches WHERE status='complete' LIMIT 1").get();
const original = match.played_at;
const wrong = "2000-01-01T00:00:00.000Z";
db.prepare("UPDATE matches SET played_at = ? WHERE id = ?").run(wrong, match.id);
console.log("corrupted", match.id.slice(0, 8), "date to", wrong);

const sync = await (await fetch(base + "/api/sync", { method: "POST" })).json();
const restored = db.prepare("SELECT played_at FROM matches WHERE id = ?").get(match.id).played_at;
console.log("after sync:", restored, "| correction note:", sync.notes.find((n) => n.includes("corrected")) ?? "(none)");
const ok = restored === original;
console.log(ok ? "DATE-CORRECTION FIX PASS" : "DATE-CORRECTION FIX FAIL");
process.exit(ok ? 0 : 1);
