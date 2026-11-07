// Validate that mock play-by-play events sum exactly to the box scores
// (plan §7: validate calculated statistics against Superstat's box scores).
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("data/gameplan.db");
const boxRow = db.prepare(
  "SELECT fgm,tpm,ftm,oreb,dreb,reb,ast,stl,blk,tov,fouls FROM box_score_players WHERE match_id=? AND side='team' AND player_id='p1'",
);
const evRow = db.prepare(
  "SELECT SUM(CASE WHEN type='two_point' AND success=1 THEN 1 ELSE 0 END) tw, " +
    "SUM(CASE WHEN type='three_point' AND success=1 THEN 1 ELSE 0 END) th, " +
    "SUM(CASE WHEN type='free_throw' AND success=1 THEN 1 ELSE 0 END) ft, " +
    "SUM(CASE WHEN type='offensive_rebound' THEN 1 ELSE 0 END) o, " +
    "SUM(CASE WHEN type='defensive_rebound' THEN 1 ELSE 0 END) d, " +
    "SUM(CASE WHEN type='assist' THEN 1 ELSE 0 END) a, " +
    "SUM(CASE WHEN type='steal' THEN 1 ELSE 0 END) s, " +
    "SUM(CASE WHEN type='block' THEN 1 ELSE 0 END) b, " +
    "SUM(CASE WHEN type='turnover' THEN 1 ELSE 0 END) t, " +
    "SUM(CASE WHEN type='foul' THEN 1 ELSE 0 END) f " +
    "FROM events WHERE match_id=? AND player_id='p1'",
);
let allPass = true;
for (const m of ["m1", "m2", "m3", "m4", "m5"]) {
  const box = boxRow.get(m);
  const ev = evRow.get(m);
  const checks = [
    ["FGM-3PM=2P makes", box.fgm - box.tpm === ev.tw],
    ["3PM", box.tpm === ev.th],
    ["FTM", box.ftm === ev.ft],
    ["OREB", box.oreb === ev.o],
    ["DREB", box.dreb === ev.d],
    ["REB", box.reb === ev.o + ev.d],
    ["AST", box.ast === ev.a],
    ["STL", box.stl === ev.s],
    ["BLK", box.blk === ev.b],
    ["TO", box.tov === ev.t],
    ["PF", box.fouls === ev.f],
  ];
  const pass = checks.every(([, ok]) => ok);
  if (!pass) allPass = false;
  console.log(m, "p1:", pass ? "PASS" : "FAIL — " + checks.filter(([, ok]) => !ok).map(([n]) => n).join(", "));
}
console.log(allPass ? "ALL CONSISTENT" : "INCONSISTENCIES FOUND");
process.exit(allPass ? 0 : 1);
