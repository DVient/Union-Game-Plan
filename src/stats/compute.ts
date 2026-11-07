// Statistical calculations (plan §7). Every metric is computed only where the
// API provides the necessary data; the forbidden list (usage rate, contested
// shot %, live-ball turnover %, defensive efficiency) is never computed.
// Percentage aggregates are weighted from totals, never averaged across games.
// Insufficient-sample rules (plan §7): fewer than 5 games, fewer than 20 shot
// attempts behind any percentage, or fewer than 10 combined assists+turnovers
// mark the affected metric low-confidence; no conclusions are drawn from it.
import type { BoxScorePlayer, MatchEvent } from "../superstat/types.js";

export interface GameInput {
  matchId: string;
  playedAt: string;
  opponentName: string;
  teamScore: number | null;
  opponentScore: number | null;
  row: BoxScorePlayer;
}

export interface Confidence {
  /** true = do not draw conclusions from this metric */
  low: boolean;
  reason: string;
}

export interface GameStats {
  matchId: string;
  playedAt: string;
  opponentName: string;
  teamScore: number | null;
  opponentScore: number | null;
  points: number;
  minutes: number | null;
  fieldGoalAttempts: number;
  threePointAttempts: number;
  freeThrowAttempts: number;
  fgPct: number;
  threePct: number;
  ftPct: number;
  effectiveFgPct: number;
  trueShootingPct: number;
  pointsPerFga: number;
  assists: number;
  turnovers: number;
  assistToTurnover: number | null;
  rebounds: number;
  steals: number;
  blocks: number;
  fouls: number;
}

export interface ShootingZone {
  zone: string;
  attempts: number;
  made: number;
  pctOfAttempts: number;
}

export interface PlayerStats {
  playerId: string;
  games: GameStats[];
  gamesUsed: number;
  aggregates: {
    pointsPerGame: number;
    minutesPerGame: number | null;
    minutesMissingGames: number;
    fgPct: number | null;
    threePct: number | null;
    ftPct: number | null;
    effectiveFgPct: number | null;
    trueShootingPct: number | null;
    pointsPerFga: number | null;
    assistsPerGame: number;
    turnoversPerGame: number;
    assistToTurnover: number | null;
    reboundsPerGame: number;
    stealsPerGame: number;
    blocksPerGame: number;
  };
  shootingZones: { zones: ShootingZone[]; unlocatedAttempts: number; approximate: boolean };
  consistency: {
    points: { mean: number; stdev: number; coefficientOfVariation: number };
    trueShooting: { mean: number; stdev: number; coefficientOfVariation: number } | null;
  };
  confidence: {
    overall: Confidence;
    fieldGoal: Confidence;
    threePoint: Confidence;
    freeThrow: Confidence;
    assistTurnover: Confidence;
  };
  /** Recomputed values cross-checked against Superstat's own box-score fields. */
  validation: { checked: number; mismatches: string[] };
}

const THREE_LINE_M = 6.75; // FIBA arc distance
export const PAINT_RADIUS_M = 4.0; // conservative paint/restricted-zone radius
export const BASKET_FROM_BASELINE_M = 1.575;
const COURT_L = 28;
const COURT_W = 15;

/** Per-period attacking-side resolver: teams switch ends every period and the
 * API court is not rotated to the shooting team's basket, so the side is
 * inferred from all team shots within each period (overall team mean as
 * fallback). */
export function teamAttacksRightResolver(events: MatchEvent[]): (e: MatchEvent) => boolean {
  const teamShots = events.filter(
    (e) => e.side === "team" && (e.type === "two_point" || e.type === "three_point") && e.location !== null,
  );
  const periodAgg = new Map<string, { sum: number; n: number }>();
  let allSum = 0, allN = 0;
  for (const e of teamShots) {
    const key = e.periodNumber === null ? "none" : String(e.periodNumber);
    const agg = periodAgg.get(key) ?? { sum: 0, n: 0 };
    agg.sum += e.location!.x; agg.n++;
    periodAgg.set(key, agg);
    allSum += e.location!.x; allN++;
  }
  return (e: MatchEvent): boolean => {
    const key = e.periodNumber === null ? "none" : String(e.periodNumber);
    const agg = periodAgg.get(key);
    if (agg && agg.n > 0) return agg.sum / agg.n > 0.5;
    return allN > 0 ? allSum / allN > 0.5 : false;
  };
}

/** Share of located team shots taken inside the paint radius (percent). */
export function teamShotMixPct(events: MatchEvent[]): number | null {
  const sideOf = teamAttacksRightResolver(events);
  let inside = 0, total = 0;
  for (const e of events) {
    if (e.side !== "team" || (e.type !== "two_point" && e.type !== "three_point")) continue;
    if (e.location === null) continue;
    const lenM = (sideOf(e) ? 1 - e.location.x : e.location.x) * COURT_L;
    const dx = Math.abs(lenM - BASKET_FROM_BASELINE_M);
    const dy = Math.abs(e.location.y - 0.5) * COURT_W;
    if (Math.hypot(dx, dy) < PAINT_RADIUS_M) inside++;
    total++;
  }
  return total === 0 ? null : Math.round((inside / total) * 100);
}

function stdev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function cv(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return mean === 0 ? 0 : stdev(values) / Math.abs(mean);
}

function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Shooting-distribution zones from event locations (approximate zone model). */
export function shootingZones(events: MatchEvent[], playerId: string | null): PlayerStats["shootingZones"] {
  const zones: Array<{ zone: string; attempts: number; made: number }> = [
    { zone: "Paint/restricted area", attempts: 0, made: 0 },
    { zone: "Mid-range", attempts: 0, made: 0 },
    { zone: "Three-point", attempts: 0, made: 0 },
  ];
  let unlocated = 0;
  // Teams switch ends every period and the API court is not rotated to the
  // shooting team's basket — the attacking side is resolved per period.
  const teamShots = events.filter(
    (e) => e.side === "team" && (e.type === "two_point" || e.type === "three_point") && e.location !== null,
  );
  const attacksRight = teamAttacksRightResolver(events);
  if (teamShots.filter((e) => e.player?.id === playerId).length === 0) {
    return { zones: zones.map((z) => ({ ...z, pctOfAttempts: 0 })), unlocatedAttempts: 0, approximate: true };
  }
  for (const e of events) {
    if (e.side !== "team" || e.player?.id !== playerId) continue;
    if (e.type !== "two_point" && e.type !== "three_point") continue;
    if (e.location === null) { unlocated++; continue; }
    // Metres from the player's attacking baseline along the court length.
    const lenM = (attacksRight(e) ? 1 - e.location.x : e.location.x) * COURT_L;
    const dx = Math.abs(lenM - BASKET_FROM_BASELINE_M);
    const dy = Math.abs(e.location.y - 0.5) * COURT_W;
    const r = Math.hypot(dx, dy);
    const zone = e.type === "three_point" || r >= THREE_LINE_M
      ? "Three-point"
      : r < PAINT_RADIUS_M ? "Paint/restricted area" : "Mid-range";
    const z = zones.find((x) => x.zone === zone)!;
    z.attempts++;
    if (e.success) z.made++;
  }
  const total = zones.reduce((a, z) => a + z.attempts, 0) + unlocated;
  return {
    zones: zones.map((z) => ({ ...z, pctOfAttempts: total === 0 ? 0 : r1((z.attempts / total) * 100) })),
    unlocatedAttempts: unlocated,
    approximate: true, // zone model is an approximation of court areas
  };
}

export function computePlayerStats(playerId: string, games: GameInput[], events: MatchEvent[]): PlayerStats {
  const perGame: GameStats[] = games.map((g) => {
    const row = g.row;
    const efg = row.fieldGoalsAttempted === 0 ? 0 : ((row.fieldGoalsMade + 0.5 * row.threePointersMade) / row.fieldGoalsAttempted) * 100;
    const ts = row.fieldGoalsAttempted + row.freeThrowsAttempted === 0 ? 0
      : (row.points / (2 * (row.fieldGoalsAttempted + 0.44 * row.freeThrowsAttempted))) * 100;
    return {
      matchId: g.matchId,
      playedAt: g.playedAt,
      opponentName: g.opponentName,
      teamScore: g.teamScore,
      opponentScore: g.opponentScore,
      points: row.points,
      minutes: row.minutes,
      fieldGoalAttempts: row.fieldGoalsAttempted,
      threePointAttempts: row.threePointersAttempted,
      freeThrowAttempts: row.freeThrowsAttempted,
      fgPct: row.fieldGoalPercentage,
      threePct: row.threePointPercentage,
      ftPct: row.freeThrowPercentage,
      effectiveFgPct: r1(efg),
      trueShootingPct: r1(ts),
      pointsPerFga: row.fieldGoalsAttempted === 0 ? 0 : r1(row.points / row.fieldGoalsAttempted),
      assists: row.assists,
      turnovers: row.turnovers,
      assistToTurnover: row.turnovers === 0 ? null : r1(row.assists / row.turnovers),
      rebounds: row.rebounds,
      steals: row.steals,
      blocks: row.blocks,
      fouls: row.fouls,
    };
  });

  const n = games.length;
  const sum = (f: (row: BoxScorePlayer) => number): number => games.reduce((a, g) => a + f(g.row), 0);
  const sFGA = sum((r) => r.fieldGoalsAttempted);
  const sFGM = sum((r) => r.fieldGoalsMade);
  const s3PA = sum((r) => r.threePointersAttempted);
  const s3PM = sum((r) => r.threePointersMade);
  const sFTA = sum((r) => r.freeThrowsAttempted);
  const sFTM = sum((r) => r.freeThrowsMade);
  const sPTS = sum((r) => r.points);
  const sAST = sum((r) => r.assists);
  const sTOV = sum((r) => r.turnovers);
  const minutesGames = perGame.filter((g) => g.minutes !== null);

  const pctAgg = (made: number, att: number): number | null => (att === 0 ? null : r1((made / att) * 100));

  const overallLow = n < 5;
  const confidence = {
    overall: { low: overallLow, reason: overallLow ? `Only ${n} game(s) selected; at least 5 required for reliable conclusions.` : "" },
    fieldGoal: { low: sFGA < 20, reason: sFGA < 20 ? `Only ${sFGA} field-goal attempts across the selection (minimum 20).` : "" },
    threePoint: { low: s3PA < 20, reason: s3PA < 20 ? `Only ${s3PA} three-point attempts across the selection (minimum 20).` : "" },
    freeThrow: { low: sFTA < 20, reason: sFTA < 20 ? `Only ${sFTA} free-throw attempts across the selection (minimum 20).` : "" },
    assistTurnover: { low: sAST + sTOV < 10, reason: sAST + sTOV < 10 ? `Only ${sAST + sTOV} combined assists and turnovers (minimum 10).` : "" },
  };

  // Validation: recompute the documented percentage fields and compare to the
  // API-provided values (Superstat rounds to one decimal place).
  const mismatches: string[] = [];
  let checked = 0;
  for (const g of games) {
    const r = g.row;
    if (r.fieldGoalsAttempted > 0) {
      checked++;
      if (Math.abs(r.fieldGoalPercentage - (r.fieldGoalsMade / r.fieldGoalsAttempted) * 100) > 0.11) {
        mismatches.push(`${g.matchId}: FG% ${r.fieldGoalPercentage} vs computed ${r1((r.fieldGoalsMade / r.fieldGoalsAttempted) * 100)}`);
      }
      if (Math.abs(r.trueShootingPercentage - (r.points / (2 * (r.fieldGoalsAttempted + 0.44 * r.freeThrowsAttempted))) * 100) > 0.11) {
        mismatches.push(`${g.matchId}: TS% ${r.trueShootingPercentage} vs computed ${r1((r.points / (2 * (r.fieldGoalsAttempted + 0.44 * r.freeThrowsAttempted))) * 100)}`);
      }
    }
  }

  const pointValues = perGame.map((g) => g.points);
  const tsValues = sFGA + sFTA > 0 ? perGame.map((g) => g.trueShootingPct) : [];

  return {
    playerId,
    games: perGame,
    gamesUsed: n,
    aggregates: {
      pointsPerGame: r1(n === 0 ? 0 : sPTS / n),
      minutesPerGame: minutesGames.length === 0 ? null : r1(minutesGames.reduce((a, g) => a + (g.minutes ?? 0), 0) / minutesGames.length),
      minutesMissingGames: n - minutesGames.length,
      fgPct: pctAgg(sFGM, sFGA),
      threePct: pctAgg(s3PM, s3PA),
      ftPct: pctAgg(sFTM, sFTA),
      effectiveFgPct: pctAgg(sFGM + 0.5 * s3PM, sFGA),
      trueShootingPct: sFGA + sFTA === 0 ? null : r1((sPTS / (2 * (sFGA + 0.44 * sFTA))) * 100),
      pointsPerFga: sFGA === 0 ? null : r1(sPTS / sFGA),
      assistsPerGame: r1(n === 0 ? 0 : sAST / n),
      turnoversPerGame: r1(n === 0 ? 0 : sTOV / n),
      assistToTurnover: sTOV === 0 ? null : r1(sAST / sTOV),
      reboundsPerGame: r1(n === 0 ? 0 : sum((r) => r.rebounds) / n),
      stealsPerGame: r1(n === 0 ? 0 : sum((r) => r.steals) / n),
      blocksPerGame: r1(n === 0 ? 0 : sum((r) => r.blocks) / n),
    },
    shootingZones: shootingZones(events, playerId),
    consistency: {
      points: { mean: r1(pointValues.reduce((a, b) => a + b, 0) / Math.max(1, n)), stdev: r1(stdev(pointValues)), coefficientOfVariation: r1(cv(pointValues)) },
      trueShooting: tsValues.length === 0 ? null : { mean: r1(tsValues.reduce((a, b) => a + b, 0) / tsValues.length), stdev: r1(stdev(tsValues)), coefficientOfVariation: r1(cv(tsValues)) },
    },
    confidence,
    validation: { checked, mismatches },
  };
}

/** Primitive for Stage 6 comparisons: aggregate changes between two snapshots. */
export function diffStats(
  prev: PlayerStats["aggregates"],
  curr: PlayerStats["aggregates"],
): Array<{ metric: string; prev: number | null; curr: number | null; delta: number | null }> {
  const keys: Array<keyof PlayerStats["aggregates"]> = [
    "pointsPerGame", "minutesPerGame", "fgPct", "threePct", "ftPct", "effectiveFgPct",
    "trueShootingPct", "pointsPerFga", "assistsPerGame", "turnoversPerGame", "assistToTurnover",
    "reboundsPerGame", "stealsPerGame", "blocksPerGame",
  ];
  return keys.map((k) => {
    const p = prev[k] as number | null;
    const c = curr[k] as number | null;
    return { metric: k, prev: p, curr: c, delta: p === null || c === null ? null : r1(c - p) };
  });
}
