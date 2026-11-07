// Focused repro: bogus-match report → PDF fetch with full diagnostics.
const base = "http://127.0.0.1:3777";
const state = await (await fetch(base + "/api/state")).json();
const player = state.players[0];
const allIds = state.matches.filter((m) => m.status === "complete").map((m) => m.id);
const res = await fetch(base + "/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerId: player.id, matchIds: ["no-such-match", allIds[0]] }) });
const r = await res.json();
console.log("report:", r.id, "gamesUsed:", r.stats?.gamesUsed, "requested:", r.stats?.requestedGames, "priorities:", r.priorities?.length);
const pdfRes = await fetch(`${base}/api/reports/${r.id}/pdf`);
console.log("pdf status:", pdfRes.status, pdfRes.statusText, "content-type:", pdfRes.headers.get("content-type"));
const text = await pdfRes.text();
console.log("pdf body head:", text.slice(0, 400).replace(/\n/g, " | "));
