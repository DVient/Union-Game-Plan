// Live date-sync verification: fresh sync, then compare the API's current
// match dates with what the database stores.
const base = "http://127.0.0.1:3777";
const sync = await (await fetch(base + "/api/sync", { method: "POST" })).json();
console.log("sync notes:", JSON.stringify(sync.notes));
const state = await (await fetch(base + "/api/state")).json();
console.log("=== match dates after fresh sync ===");
for (const m of state.matches) {
  console.log(` ${m.id.slice(0, 8)}  playedAt=${m.playedAt}  ${m.status}  vs ${m.opponentName}`);
}
const stamp = new Date().toISOString();
console.log("verified at:", stamp);
