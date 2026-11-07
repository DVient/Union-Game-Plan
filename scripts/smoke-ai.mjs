// Stage 4 smoke test: AI analysis with citation enforcement.
const base = "http://127.0.0.1:3777";
const post = async (p, body) => (await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

console.log("OPENROUTER_API_KEY visible to app env:", process.env.OPENROUTER_API_KEY ? "yes" : "no");
await post("/api/sync", {});
const state = await (await fetch(base + "/api/state")).json();
const player = state.players.find((p) => p.jerseyNumber === "4"); // Marcus — high-TO profile
const allIds = state.matches.filter((m) => m.status === "complete").map((m) => m.id);

const r = await post("/api/reports", { playerId: player.id, matchIds: allIds });
const ai = r.ai;
console.log("provider:", ai.providerId, "| note:", ai.note ?? "(none)");
console.log("findings:", ai.findings.length);
for (const f of ai.findings) console.log(`  [${f.confidence}] (${f.category}) ${f.claim}  ⟵ {${f.citation}}`);
const bad = ai.findings.filter((f) => !f.citation || /undefined|null/.test(f.citation));
console.log("findings with empty/invalid citations:", bad.length);
const snapshot = await (await fetch(`${base}/api/reports/${r.id}`)).json();
console.log("snapshot ai persisted:", snapshot.ai && snapshot.ai.findings.length === ai.findings.length ? "OK" : "FAIL");
