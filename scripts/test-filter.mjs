// Negative test: the §8 citation filter must drop findings with bogus keys.
import { buildEvidencePack, filterCitations } from "../dist/ai/evidence.js";
import { buildMockBundle } from "../dist/superstat/mock.js";
import { computePlayerStats } from "../dist/stats/compute.js";

const bundle = buildMockBundle();
const matchId = "m1";
const box = bundle.boxScores.get(matchId);
const events = bundle.events.get(matchId);
const player = box.team.players[0];
const stats = computePlayerStats(player.playerId, [{ matchId, playedAt: bundle.matches[0].playedAt, opponentName: bundle.matches[0].opponent.name, teamScore: 60, opponentScore: 55, row: player }], events.events);
const pack = buildEvidencePack({ firstName: player.name.split(" ")[0], jerseyNumber: player.jerseyNumber, stats, events: events.events, insights: {} });

const good = [{ category: "scoring", claim: "x", citation: "stats.pointsPerGame", confidence: "confirmed" }];
const bad = [
  { category: "scoring", claim: "hallucinated", citation: "stats.usageRate", confidence: "confirmed" },
  { category: "iq", claim: "half-valid", citation: "stats.pointsPerGame; stats.contestedShots", confidence: "possible" },
  { category: "iq", claim: "empty citation", citation: "", confidence: "unverified" },
];
const kept = filterCitations([...good, ...bad], pack);
console.log("kept:", kept.length, "(expect 1)");
console.log(kept.length === 1 && kept[0].citation === "stats.pointsPerGame" ? "FILTER PASS" : "FILTER FAIL");
