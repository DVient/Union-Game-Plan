// Stage 5 smoke test: generate a report, download the PDF, verify structure.
import { writeFileSync } from "node:fs";
const base = "http://127.0.0.1:3777";
const post = async (p, body) => (await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

await post("/api/sync", {});
const state = await (await fetch(base + "/api/state")).json();
const player = state.players[0];
const allIds = state.matches.filter((m) => m.status === "complete").map((m) => m.id);
const r = await post("/api/reports", { playerId: player.id, matchIds: allIds });
console.log("report:", r.id ? "created" : "FAIL", "| priorities:", r.priorities.length);
for (const p of r.priorities) console.log(`  ${p.area} — evidence facts: ${p.evidenceFacts.length}`);

const pdfRes = await fetch(`${base}/api/reports/${r.id}/pdf`);
const buf = Buffer.from(await pdfRes.arrayBuffer());
console.log("pdf http:", pdfRes.status, "| type:", pdfRes.headers.get("content-type"));
console.log("pdf bytes:", buf.length, "| header:", buf.subarray(0, 5).toString());
const pageCount = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
console.log("pdf pages:", pageCount);
writeFileSync("data/sample-report.pdf", buf);
console.log("saved copy: data/sample-report.pdf");
