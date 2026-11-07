// Builds the evidence pack: validated statistics, event summaries and
// Superstat insights, with a key → fact citation map. PII is minimized to the
// player's first name and jersey number (plan §12).
import type { EvidencePack, EvidenceFact } from "./types.js";
import type { PlayerStats } from "../stats/compute.js";
import type { MatchEvent, MatchInsights } from "../superstat/types.js";

export interface EvidenceInput {
  firstName: string;
  jerseyNumber: string | null;
  stats: PlayerStats;
  events: MatchEvent[];
  insights: Record<string, MatchInsights>;
}

const pct = (n: number | null): string => (n === null ? "not available" : `${n}%`);

export function buildEvidencePack(input: EvidenceInput): EvidencePack {
  const { stats, events, insights } = input;
  const facts: EvidenceFact[] = [];
  const add = (key: string, fact: string): void => { facts.push({ key, fact }); };

  const a = stats.aggregates;
  add("stats.gamesUsed", `${stats.gamesUsed} game(s) included in this report.`);
  add("stats.pointsPerGame", `Points per game: ${a.pointsPerGame}.`);
  add("stats.minutesPerGame", a.minutesPerGame === null ? "Minutes per game: not tracked." : `Minutes per game: ${a.minutesPerGame}.`);
  add("stats.fgPct", `Field-goal percentage (all games): ${pct(a.fgPct)}.`);
  add("stats.threePct", `Three-point percentage (all games): ${pct(a.threePct)}.`);
  add("stats.ftPct", `Free-throw percentage (all games): ${pct(a.ftPct)}.`);
  add("stats.effectiveFgPct", `Effective field-goal percentage: ${pct(a.effectiveFgPct)}.`);
  add("stats.trueShootingPct", `True shooting percentage: ${pct(a.trueShootingPct)}.`);
  add("stats.pointsPerFga", a.pointsPerFga === null ? "Points per field-goal attempt: not available." : `Points per field-goal attempt: ${a.pointsPerFga}.`);
  add("stats.assistsPerGame", `Assists per game: ${a.assistsPerGame}.`);
  add("stats.turnoversPerGame", `Turnovers per game: ${a.turnoversPerGame}.`);
  add("stats.assistToTurnover", a.assistToTurnover === null ? "Assist-to-turnover ratio: not available (no turnovers recorded)." : `Assist-to-turnover ratio: ${a.assistToTurnover}.`);
  add("stats.reboundsPerGame", `Rebounds per game: ${a.reboundsPerGame}.`);
  add("stats.stealsPerGame", `Steals per game: ${a.stealsPerGame}.`);
  add("stats.blocksPerGame", `Blocks per game: ${a.blocksPerGame}.`);
  add("stats.consistency.points.cv", `Scoring consistency (coefficient of variation of game points): ${stats.consistency.points.coefficientOfVariation} (σ ${stats.consistency.points.stdev}).`);
  if (stats.consistency.trueShooting !== null) {
    add("stats.consistency.trueShooting.cv", `Shooting-efficiency consistency (CV of per-game TS%): ${stats.consistency.trueShooting.coefficientOfVariation}.`);
  }
  const z = stats.shootingZones.zones;
  const paint = z.find((x) => x.zone === "Paint/restricted area");
  const mid = z.find((x) => x.zone === "Mid-range");
  const three = z.find((x) => x.zone === "Three-point");
  if (paint) add("stats.zones.paint", `Approximate shot distribution: paint/restricted ${paint.attempts} attempts (${paint.pctOfAttempts}% of attempts), ${paint.made} made.`);
  if (mid) add("stats.zones.midrange", `Approximate shot distribution: mid-range ${mid.attempts} attempts (${mid.pctOfAttempts}%), ${mid.made} made.`);
  if (three) add("stats.zones.three", `Approximate shot distribution: three-point ${three.attempts} attempts (${three.pctOfAttempts}%), ${three.made} made.`);

  for (const g of stats.games) {
    const base = `game.${g.matchId}`;
    add(`${base}.points`, `${g.opponentName} (${new Date(g.playedAt).toISOString().slice(0, 10)}): ${g.points} points.`);
    add(`${base}.minutes`, g.minutes === null ? `${g.opponentName}: minutes not tracked.` : `${g.opponentName}: ${g.minutes} minutes.`);
    add(`${base}.fgPct`, `${g.opponentName}: FG% ${g.fgPct}, 3P% ${g.threePct}, FT% ${g.ftPct}.`);
    add(`${base}.assistsTurnovers`, `${g.opponentName}: ${g.assists} assists, ${g.turnovers} turnovers.`);
    add(`${base}.rebounds`, `${g.opponentName}: ${g.rebounds} rebounds, ${g.steals} steals, ${g.blocks} blocks.`);
  }

  const turnovers = events.filter((e) => e.type === "turnover" && e.player?.id === stats.playerId);
  const assists = events.filter((e) => e.type === "assist" && e.player?.id === stats.playerId);
  add("events.turnoverCount", `Recorded turnover events in the selected games: ${turnovers.length}.`);
  add("events.assistsCount", `Recorded assist events in the selected games: ${assists.length}.`);
  const perPeriod: Record<string, number> = {};
  const pointsPerQuarter: Record<string, number> = {};
  for (const e of events) {
    if (e.player?.id !== stats.playerId) continue;
    const label = e.periodNumber === null ? "unnumbered" : `Q${e.periodNumber}`;
    if (e.type === "turnover") perPeriod[label] = (perPeriod[label] ?? 0) + 1;
    if (e.type === "two_point" && e.success) pointsPerQuarter[label] = (pointsPerQuarter[label] ?? 0) + 2;
    if (e.type === "three_point" && e.success) pointsPerQuarter[label] = (pointsPerQuarter[label] ?? 0) + 3;
    if (e.type === "free_throw" && e.success) pointsPerQuarter[label] = (pointsPerQuarter[label] ?? 0) + 1;
  }
  for (const [k, v] of Object.entries(perPeriod)) add(`events.turnoversInPeriod.${k}`, `Turnovers in ${k}: ${v}.`);
  for (const [k, v] of Object.entries(pointsPerQuarter)) add(`events.pointsInPeriod.${k}`, `Points scored in ${k}: ${v}.`);

  for (const [matchId, ins] of Object.entries(insights)) {
    const base = `insights.${matchId}`;
    if (ins.summary) {
      ins.summary.whatsWorking.forEach((s, i) => add(`${base}.whatsWorking.${i}`, `Superstat insight (${matchId}, what's working): ${s}`));
      ins.summary.focusAreas.forEach((s, i) => add(`${base}.focusAreas.${i}`, `Superstat insight (${matchId}, focus area): ${s}`));
      ins.summary.suggestions.forEach((s, i) => add(`${base}.suggestions.${i}`, `Superstat insight (${matchId}, suggestion): ${s}`));
    }
    if (ins.ratings) {
      for (const [rating, r] of Object.entries(ins.ratings)) {
        add(`${base}.ratings.${rating}.value`, `Superstat ${rating} rating (${matchId}): ${r.value}.`);
        add(`${base}.ratings.${rating}.comment`, `Superstat ${rating} comment (${matchId}): ${r.comment}`);
      }
    }
  }

  const citations: Record<string, string> = {};
  for (const f of facts) citations[f.key] = f.fact;

  return {
    player: { firstName: input.firstName, jerseyNumber: input.jerseyNumber },
    stats,
    events: {
      turnoverCount: turnovers.length,
      assistsCount: assists.length,
      turnoversPerPeriod: perPeriod,
      pointsPerQuarter,
    },
    insights: Object.fromEntries(Object.entries(insights).map(([k, v]) => [k, {
      status: v.status, summary: v.summary,
      ratings: v.ratings === null ? null : Object.fromEntries(Object.entries(v.ratings).map(([rk, rv]) => [rk, { value: rv.value, comment: rv.comment }])),
    }])),
    citations,
  };
}

/** §8 enforcement: keep only findings whose citation keys resolve in the pack. */
export function filterCitations(findings: Array<{ category: string; claim: string; citation: string; confidence: string }>, pack: EvidencePack): Array<{ category: string; claim: string; citation: string; confidence: string }> {
  return findings.filter((f) => {
    const keys = f.citation.split(";").map((s) => s.trim()).filter(Boolean);
    return keys.length > 0 && keys.every((k) => k in pack.citations);
  });
}
