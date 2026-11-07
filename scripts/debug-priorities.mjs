// Isolate why buildPriorities returned 0 candidates for the mock player.
import { buildMockBundle } from "../dist/superstat/mock.js";
import { computePlayerStats } from "../dist/stats/compute.js";
import { buildPriorities } from "../dist/report/priorities.js";
import { buildEvidencePack } from "../dist/ai/evidence.js";

const bundle = buildMockBundle();
const jerseyFirst = [...bundle.roster].sort((x, y) => Number(x.jerseyNumber) - Number(y.jerseyNumber))[0];
const player = bundle.boxScores.get("m1").team.players.find((p) => p.playerId === jerseyFirst.id);
console.log("testing jersey-first player:", player.name, "#" + player.jerseyNumber);
const games = bundle.matches.map((m) => ({
  matchId: m.id, playedAt: m.playedAt, opponentName: m.opponent.name,
  teamScore: m.team.score, opponentScore: m.opponent.score,
  row: bundle.boxScores.get(m.id).team.players.find((p) => p.playerId === player.playerId),
}));
const events = bundle.matches.flatMap((m) => bundle.events.get(m.id).events);
const stats = computePlayerStats(player.playerId, games, events);
console.log("player:", player.name);
console.log("aggregates:", JSON.stringify(stats.aggregates));
console.log("confidence:", JSON.stringify(stats.confidence));
const ins = {};
for (const [k, v] of bundle.insights) if (k.endsWith(":" + player.playerId)) ins[k.split(":")[0]] = v;
const pack = buildEvidencePack({ firstName: player.name.split(" ")[0], jerseyNumber: player.jerseyNumber, stats, events, insights: ins });
const priorities = buildPriorities(stats, pack.citations, ins);
console.log("priorities:", priorities.length, priorities.map((p) => p.area));
