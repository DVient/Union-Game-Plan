// Mock-mode fixtures: one club, one U16 team, eight players and five completed
// games — the plan's prototype scope. Events are generated FROM the box-score
// numbers so the two always agree (plan §7: validate calculations against box
// scores). A deterministic PRNG keeps fixtures stable across runs.
import type {
  Club,
  Match,
  MatchBoxScore,
  MatchEvent,
  MatchEvents,
  MatchInsights,
  MatchPeriod,
  MatchStatus,
  BoxScorePlayer,
  BoxScoreStats,
  RosterPlayer,
  Team,
} from "./types.js";

/** mulberry32 — small deterministic PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLUB: Club = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Union Basketball Club",
  country: "Australia",
  state: "VIC",
  logoUrl: null,
  createdAt: "2025-02-14T03:21:07.000Z",
};

const TEAM: Team = {
  id: "22222222-2222-4222-8222-222222222222",
  clubId: CLUB.id,
  name: "Union U16 Boys",
  ageGroup: "u16",
  gender: "boys",
  competitionLevel: "representative",
  league: "Victorian Junior Basketball League",
  division: "division_1",
  createdAt: "2025-02-14T03:25:44.000Z",
};

interface PlayerSeed {
  id: string;
  first: string;
  last: string;
  jersey: string;
  /** shooting tendency 0..1 */
  threeRate: number;
  /** free-throw skill 0..1 */
  ftSkill: number;
  /** tendency to turn the ball over per touch */
  toRate: number;
  /** rebound/defense activity */
  activity: number;
}

const PLAYERS: PlayerSeed[] = [
  { id: "p1", first: "Ava",     last: "Nguyen",    jersey: "7",  threeRate: 0.42, ftSkill: 0.78, toRate: 0.10, activity: 0.5 },
  { id: "p2", first: "Marcus",  last: "Chen",      jersey: "4",  threeRate: 0.18, ftSkill: 0.62, toRate: 0.22, activity: 0.6 },
  { id: "p3", first: "Jonah",   last: "Petrov",    jersey: "11", threeRate: 0.08, ftSkill: 0.55, toRate: 0.15, activity: 0.9 },
  { id: "p4", first: "Tama",    last: "Wiremu",    jersey: "23", threeRate: 0.35, ftSkill: 0.71, toRate: 0.12, activity: 0.55 },
  { id: "p5", first: "Leo",     last: "O'Brien",   jersey: "9",  threeRate: 0.25, ftSkill: 0.66, toRate: 0.18, activity: 0.7 },
  { id: "p6", first: "Sam",     last: "Kaur",      jersey: "14", threeRate: 0.30, ftSkill: 0.74, toRate: 0.11, activity: 0.45 },
  { id: "p7", first: "Diego",   last: "Fernandez", jersey: "21", threeRate: 0.05, ftSkill: 0.50, toRate: 0.20, activity: 0.95 },
  { id: "p8", first: "Ivan",    last: "Sokolov",   jersey: "33", threeRate: 0.12, ftSkill: 0.58, toRate: 0.14, activity: 0.8 },
];

const OPPONENTS = ["Riverside Rovers", "Hillside Hawks", "Northside Celtics", "Bayside Bulls", "Westgate Wolves"];

function r2(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(made: number, att: number): number {
  return att === 0 ? 0 : r2((made / att) * 100);
}

function statLine(seed: PlayerSeed, rand: () => number): BoxScorePlayer {
  const minutes = r2(18 + rand() * 14);
  const fga = 5 + Math.floor(rand() * 8);
  const fgm = Math.max(1, Math.round(fga * (0.38 + rand() * 0.18)));
  const tpa = Math.round(fga * seed.threeRate);
  const tpm = Math.min(fgm, Math.round(tpa * (0.28 + rand() * 0.14)));
  const twoMade = fgm - tpm;
  const twoAtt = fga - tpa;
  const fta = 1 + Math.floor(rand() * 5);
  const ftm = Math.round(fta * seed.ftSkill);
  const oreb = Math.round(seed.activity * rand() * 3);
  const dreb = Math.round(seed.activity * rand() * 5);
  const ast = Math.floor(rand() * 5);
  const stl = Math.round(seed.activity * rand() * 2.5);
  const blk = Math.round(seed.activity * rand() * 1.5);
  const tov = Math.max(0, Math.round(rand() * 6 * (0.5 + seed.toRate)));
  const fouls = Math.floor(rand() * 4);
  const points = twoMade * 2 + tpm * 3 + ftm;
  const tsPct = fta === 0 ? (fga === 0 ? 0 : (points / (2 * fga)) * 100) : (points / (2 * (fga + 0.44 * fta))) * 100;
  return {
    points,
    fieldGoalsMade: fgm, fieldGoalsAttempted: fga, fieldGoalPercentage: pct(fgm, fga),
    threePointersMade: tpm, threePointersAttempted: tpa, threePointPercentage: pct(tpm, tpa),
    freeThrowsMade: ftm, freeThrowsAttempted: fta, freeThrowPercentage: pct(ftm, fta),
    offensiveRebounds: oreb, defensiveRebounds: dreb, rebounds: oreb + dreb,
    assists: ast, steals: stl, blocks: blk, turnovers: tov, fouls,
    playerId: seed.id, rosterEntryId: `re-${seed.id}`, name: `${seed.first} ${seed.last}`,
    jerseyNumber: seed.jersey, minutes, efficiency: 0, trueShootingPercentage: r2(tsPct),
  };
}

function efficiency(p: BoxScorePlayer): number {
  return p.points + p.rebounds + p.assists + p.steals + p.blocks - p.turnovers - (p.fieldGoalsAttempted - p.fieldGoalsMade) - (p.freeThrowsAttempted - p.freeThrowsMade);
}

function sumTotals(players: BoxScorePlayer[]): BoxScoreStats {
  const zero: BoxScoreStats = {
    points: 0, fieldGoalsMade: 0, fieldGoalsAttempted: 0, fieldGoalPercentage: 0,
    threePointersMade: 0, threePointersAttempted: 0, threePointPercentage: 0,
    freeThrowsMade: 0, freeThrowsAttempted: 0, freeThrowPercentage: 0,
    offensiveRebounds: 0, defensiveRebounds: 0, rebounds: 0,
    assists: 0, steals: 0, blocks: 0, turnovers: 0, fouls: 0,
  };
  const t = { ...zero };
  for (const p of players) {
    t.points += p.points; t.fieldGoalsMade += p.fieldGoalsMade; t.fieldGoalsAttempted += p.fieldGoalsAttempted;
    t.threePointersMade += p.threePointersMade; t.threePointersAttempted += p.threePointersAttempted;
    t.freeThrowsMade += p.freeThrowsMade; t.freeThrowsAttempted += p.freeThrowsAttempted;
    t.offensiveRebounds += p.offensiveRebounds; t.defensiveRebounds += p.defensiveRebounds; t.rebounds += p.rebounds;
    t.assists += p.assists; t.steals += p.steals; t.blocks += p.blocks; t.turnovers += p.turnovers; t.fouls += p.fouls;
  }
  t.fieldGoalPercentage = pct(t.fieldGoalsMade, t.fieldGoalsAttempted);
  t.threePointPercentage = pct(t.threePointersMade, t.threePointersAttempted);
  t.freeThrowPercentage = pct(t.freeThrowsMade, t.freeThrowsAttempted);
  return t;
}

function buildEvents(matchId: string, box: MatchBoxScore, periods: MatchPeriod[], rand: () => number): MatchEvents {
  const events: MatchEvent[] = [];
  let clock = 0;
  const push = (type: string, success: boolean, side: "team" | "opponent", player: BoxScorePlayer | null, location: { x: number; y: number } | null, customName: string | null = null): void => {
    const idx = Math.min(periods.length - 1, Math.floor((clock / (40 * 60)) * periods.length));
    const period = periods[idx] ?? periods[0]!;
    events.push({
      id: `${matchId}-e${events.length + 1}`,
      type, success, side, matchSeconds: Math.round(clock * 10) / 10,
      periodId: period.id, periodNumber: period.number, periodType: period.type,
      periodSeconds: Math.round((clock % (40 * 60 / periods.length)) * 10) / 10,
      player: player === null ? null : { id: player.playerId, rosterEntryId: player.rosterEntryId, name: player.name, jerseyNumber: player.jerseyNumber },
      location: location === null ? null : { court: { standard: "FIBA", lengthMetres: 28, widthMetres: 15 }, x: location.x, y: location.y, fromLeftBaselineMetres: r2(location.x * 28), fromTopSidelineMetres: r2(location.y * 15) },
      customEventName: customName,
    });
    clock += 8 + rand() * 20;
  };
  const all = [...box.team.players, ...(box.opponent?.players ?? [])];
  // Emit events that sum exactly to each player's box score.
  for (const p of all) {
    const side: "team" | "opponent" = box.team.players.includes(p) ? "team" : "opponent";
    let twoMade = p.fieldGoalsMade - p.threePointersMade;
    let twoMissed = (p.fieldGoalsAttempted - p.threePointersAttempted) - twoMade;
    let threeMade = p.threePointersMade;
    let threeMissed = p.threePointersAttempted - threeMade;
    let ftMade = p.freeThrowsMade;
    let ftMissed = p.freeThrowsAttempted - ftMade;
    // Shots first, alternating make/miss to hit exact counts.
    while (twoMade > 0 || twoMissed > 0 || threeMade > 0 || threeMissed > 0) {
      const preferThree = (threeMade + threeMissed) > 0 && rand() < 0.5;
      const wantMake = rand() < 0.5;
      if (preferThree && (wantMake ? threeMade > 0 : threeMissed > 0)) {
        push("three_point", wantMake, side, p, { x: 0.6 + rand() * 0.3, y: 0.2 + rand() * 0.6 });
        if (wantMake) threeMade--; else threeMissed--;
      } else if (wantMake ? twoMade > 0 : twoMissed > 0) {
        push("two_point", wantMake, side, p, { x: 0.62 + rand() * 0.25, y: 0.35 + rand() * 0.3 });
        if (wantMake) twoMade--; else twoMissed--;
      } else if (wantMake ? threeMade > 0 : threeMissed > 0) {
        push("three_point", wantMake, side, p, { x: 0.6 + rand() * 0.3, y: 0.2 + rand() * 0.6 });
        if (wantMake) threeMade--; else threeMissed--;
      } else if (twoMade > 0 || twoMissed > 0) {
        push("two_point", twoMade > 0, side, p, { x: 0.62 + rand() * 0.25, y: 0.35 + rand() * 0.3 });
        if (twoMade > 0) twoMade--; else twoMissed--;
      } else break;
    }
    while (ftMade > 0) { push("free_throw", true, side, p, null); ftMade--; }
    while (ftMissed > 0) { push("free_throw", false, side, p, null); ftMissed--; }
    for (let i = 0; i < p.offensiveRebounds; i++) push("offensive_rebound", true, side, p, null);
    for (let i = 0; i < p.defensiveRebounds; i++) push("defensive_rebound", true, side, p, null);
    for (let i = 0; i < p.assists; i++) push("assist", true, side, p, null);
    for (let i = 0; i < p.steals; i++) push("steal", true, side, p, null);
    for (let i = 0; i < p.blocks; i++) push("block", true, side, p, null);
    for (let i = 0; i < p.turnovers; i++) push("turnover", true, side, p, null);
    for (let i = 0; i < p.fouls; i++) push("foul", true, side, p, null);
  }
  events.sort((a, b) => a.matchSeconds - b.matchSeconds);
  return { roster: box.team.players.map((p) => ({ rosterEntryId: p.rosterEntryId ?? "", playerId: p.playerId, firstName: p.name.split(" ")[0] ?? "", lastName: p.name.split(" ").slice(1).join(" "), jerseyNumber: p.jerseyNumber, side: "team" as const })), events };
}

function buildInsights(matchId: string, box: MatchBoxScore, playerId: string, name: string): MatchInsights {
  const p = box.team.players.find((x) => x.playerId === playerId);
  if (!p) throw new Error(`mock: player ${playerId} not in box score`);
  const closeShots = Math.round(p.fieldGoalsAttempted * 0.6);
  const shotMix = Math.round((closeShots / Math.max(1, p.fieldGoalsAttempted)) * 100);
  const pointsPerShot = r2(p.points / Math.max(1, p.fieldGoalsAttempted + 0.44 * p.freeThrowsAttempted));
  const assistRate = Math.round((p.assists / Math.max(1, p.fieldGoalsMade)) * 100);
  const summaries = {
    whatsWorking: [`${name.split(" ")[0]} shot ${p.fieldGoalPercentage}% from the field this game.`],
    focusAreas: [p.turnovers >= 4 ? "Ball security under pressure." : "Finishing through contact."],
    suggestions: [p.turnovers >= 4 ? "Sweep the ball low and wide before the pivot." : "One-dribble pull-ups from the elbow."],
  };
  return {
    status: "ready", message: "Insights are up to date.", stale: false, recordedBy: "team",
    summary: summaries,
    ratings: {
      shotMix: { value: shotMix, comment: "Share of shots taken close to the basket." },
      pointsPerShot: { value: pointsPerShot, comment: "Points per shot attempt." },
      assistRate: { value: assistRate, comment: "Share of made field goals that were assisted." },
      turnovers: { value: p.turnovers, comment: "Turnovers recorded." },
      rebounds: { value: p.rebounds, comment: "Total rebounds." },
      defensiveImpact: { value: p.steals + p.blocks, comment: "Steals and blocks combined." },
    },
    generatedAt: new Date().toISOString(),
    ...{ matchId },
  } as MatchInsights;
}

export interface MockBundle {
  club: Club;
  team: Team;
  roster: RosterPlayer[];
  matches: Match[];
  boxScores: Map<string, MatchBoxScore>;
  events: Map<string, MatchEvents>;
  insights: Map<string, MatchInsights>; // key: `${matchId}:${playerId}`
  teamInsights: Map<string, MatchInsights>; // key: matchId
}

export function buildMockBundle(): MockBundle {
  const roster: RosterPlayer[] = PLAYERS.map((p) => ({
    id: p.id, firstName: p.first, lastName: p.last, jerseyNumber: p.jersey,
    email: `${p.first.toLowerCase()}.${p.last.toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
    createdAt: "2025-02-20T09:12:00.000Z",
  }));
  const matches: Match[] = [];
  const boxScores = new Map<string, MatchBoxScore>();
  const eventsMap = new Map<string, MatchEvents>();
  const insights = new Map<string, MatchInsights>();
  const teamInsights = new Map<string, MatchInsights>();
  const start = Date.UTC(2026, 4, 9, 4, 0, 0); // five weekly Saturday games
  for (let g = 0; g < 5; g++) {
    const rand = rng(1000 + g * 17);
    const matchId = `m${g + 1}`;
    const periods: MatchPeriod[] = [0, 1, 2, 3].map((i) => ({
      id: `${matchId}-q${i + 1}`, number: i + 1, type: "quarter" as const,
      startedAt: new Date(start + g * 7 * 86400000 + i * 7200000).toISOString(),
      endedAt: null,
    }));
    const players = PLAYERS.map((seed) => statLine(seed, rand)).sort((a, b) => efficiency(b) - efficiency(a));
    for (const p of players) p.efficiency = efficiency(p);
    const teamTotals = sumTotals(players);
    // Opponent totals only (documented: opponent players may be untracked).
    const oppPoints = Math.max(30, teamTotals.points + Math.floor(rand() * 15) - 7);
    const opponentTotals: BoxScoreStats = { ...teamTotals, points: oppPoints };
    const box: MatchBoxScore = {
      matchId,
      team: { name: TEAM.name, totals: teamTotals, players },
      opponent: { name: OPPONENTS[g] ?? "Opponent", totals: opponentTotals, players: [] },
    };
    const playedAt = new Date(start + g * 7 * 86400000).toISOString();
    const status: MatchStatus = "complete";
    matches.push({
      id: matchId, playedAt, status,
      team: { id: TEAM.id, name: TEAM.name, score: teamTotals.points },
      opponent: { id: null, name: OPPONENTS[g] ?? "Opponent", score: oppPoints },
      recordedBy: "team", opponentStatsTracked: false, thumbnailUrl: null, failureReason: null,
      periods, createdAt: playedAt,
    });
    boxScores.set(matchId, box);
    eventsMap.set(matchId, buildEvents(matchId, box, periods, rng(2000 + g * 23)));
    for (const p of players) insights.set(`${matchId}:${p.playerId}`, buildInsights(matchId, box, p.playerId ?? "", p.name));
    teamInsights.set(matchId, buildTeamInsights(matchId, box));
  }
  return { club: CLUB, team: TEAM, roster, matches, boxScores, events: eventsMap, insights, teamInsights };
}

/** Team-level insights derived from the match's team totals (mock of the API's team insights). */
function buildTeamInsights(matchId: string, box: MatchBoxScore): MatchInsights {
  const t = box.team.totals;
  const opp = box.opponent?.totals;
  const won = opp != null && t.points > opp.points;
  const pps = t.fieldGoalsAttempted === 0 ? 0 : t.points / t.fieldGoalsAttempted;
  const assistRate = t.fieldGoalsMade === 0 ? 0 : (t.assists / t.fieldGoalsMade) * 100;
  const closeShots = Math.round(t.fieldGoalsAttempted * 0.55);
  return {
    status: "ready",
    message: "Insights are up to date.",
    stale: false,
    recordedBy: "team",
    summary: {
      whatsWorking: [won ? `The team won with ${t.points} points and strong defensive activity.` : `Ball movement produced ${t.assists} assists as a team.`],
      focusAreas: [t.turnovers >= 15 ? "Ball security as a group cost the team possessions." : "Defensive rebounding needs more consistency."],
      suggestions: [t.turnovers >= 15 ? "Add a pass-count rule to scrimmage play: three passes before a shot." : "Five-man rebounding drills with contact every session."],
    },
    ratings: {
      shotMix: { value: Math.round((closeShots / Math.max(1, t.fieldGoalsAttempted)) * 100), comment: "Share of the team's shots taken close to the basket." },
      pointsPerShot: { value: Math.round(pps * 100) / 100, comment: `The team scored ${Math.round(pps * 100) / 100} points per shot attempt.` },
      assistRate: { value: Math.round(assistRate), comment: `${Math.round(assistRate)}% of made field goals were assisted.` },
      turnovers: { value: t.turnovers, comment: `${t.turnovers} team turnovers in this game.` },
      rebounds: { value: t.rebounds, comment: `${t.rebounds} total team rebounds (${t.offensiveRebounds} offensive).` },
      defensiveImpact: { value: t.steals + t.blocks, comment: `${t.steals} steals and ${t.blocks} blocks combined.` },
    },
    generatedAt: new Date().toISOString(),
    ...{ matchId },
  } as MatchInsights;
}
