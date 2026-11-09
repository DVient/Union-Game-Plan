// Team Focus page data (team-level context, included in every player's
// report). Values prefer Superstat's own team-insight ratings; when team
// insights are not ready for a match, the same metrics are computed from team
// box-score totals (documented derivations, never invented). The GOOD / SUPER /
// POOR badges are OUR editorial classification against youth-team benchmarks —
// the API does not provide them; thresholds are documented below.
import type { MatchInsights } from "../superstat/types.js";

export interface TeamInsightMatch {
  matchId: string;
  playedAt: string;
  status: string;
  summary: { whatsWorking: string[]; focusAreas: string[]; suggestions: string[] } | null;
  ratings: Record<string, { value: number; comment: string }> | null;
}

export interface TeamTotalsInput {
  matchId: string;
  points: number;
  fga: number;
  fgm: number;
  ast: number;
  tov: number;
  reb: number;
  stl: number;
  blk: number;
  opponentPoints: number | null;
}

export type Badge = "GOOD" | "SUPER" | "POOR";

export interface MetricCard {
  label: string;
  value: string;
  badge: Badge;
  sub: string;
  description: string;
  /** superstat = API rating; computed = derived from team box scores. */
  source: "superstat" | "computed";
}

export interface TeamFocus {
  gamesConsidered: number;
  insightsReady: number;
  /** Per-match insight items, as stored (fallback for older snapshots). */
  summary: { whatsWorking: string[]; focusAreas: string[]; suggestions: string[] };
  /** Cross-game synthesis: recurring themes consolidated across the selected
   * games, each with the games that support it (deterministic frequency
   * analysis over the per-match team insights). */
  synthesis: { whatsWorking: string[]; focusAreas: string[]; suggestions: string[] };
  metrics: MetricCard[];
  note: string | null;
}

const dedupe = (items: Array<{ text: string; date: string }>, cap: number): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { text, date } of items) {
    const key = text.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`${text} (${date})`);
    if (out.length >= cap) break;
  }
  return out;
};

/** Keep card descriptions bounded (long API comments otherwise overflow cards). */
const clamp = (text: string, max = 200): string => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

export function buildTeamFocus(
  insights: TeamInsightMatch[],
  totals: TeamTotalsInput[],
  teamShotMixPct: number | null,
): TeamFocus {
  const games = totals.length || insights.length;
  const ready = insights.filter((i) => i.status === "ready" && i.ratings !== null);
  const notes: string[] = [];

  const summary = {
    whatsWorking: dedupe(ready.flatMap((i) => (i.summary?.whatsWorking ?? []).map((t) => ({ text: t, date: i.playedAt.slice(0, 10) }))), 4),
    focusAreas: dedupe(ready.flatMap((i) => (i.summary?.focusAreas ?? []).map((t) => ({ text: t, date: i.playedAt.slice(0, 10) }))), 4),
    suggestions: dedupe(ready.flatMap((i) => (i.summary?.suggestions ?? []).map((t) => ({ text: t, date: i.playedAt.slice(0, 10) }))), 4),
  };

  // Averages across ready matches; computed fallbacks from team totals.
  const avg = (pick: (r: Record<string, { value: number; comment: string }>) => number | undefined): number | null => {
    const vals = ready.map((i) => pick(i.ratings!)).filter((v): v is number => typeof v === "number");
    return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const sum = (f: (t: TeamTotalsInput) => number): number => totals.reduce((a, t) => a + f(t), 0);
  const perGame = (f: (t: TeamTotalsInput) => number): number | null => (games === 0 ? null : sum(f) / games);

  const shotMix = avg((r) => r.shotMix?.value) ?? teamShotMixPct;
  const pps = avg((r) => r.pointsPerShot?.value) ?? (sum((t) => t.fga) === 0 ? null : sum((t) => t.points) / sum((t) => t.fga));
  const assistRate = avg((r) => r.assistRate?.value) ?? (sum((t) => t.fgm) === 0 ? null : (sum((t) => t.ast) / sum((t) => t.fgm)) * 100);
  const tovPg = perGame((t) => t.tov);
  const rebPg = perGame((t) => t.reb);
  const defPg = perGame((t) => t.stl + t.blk);

  const r1 = (n: number): number => Math.round(n * 10) / 10;

  const metrics: MetricCard[] = [
    {
      label: "Shot mix",
      value: shotMix === null ? "—" : `${Math.round(shotMix)}%`,
      badge: shotMix === null ? "POOR" : shotMix >= 30 && shotMix <= 70 ? "GOOD" : "POOR",
      sub: "Shots near the basket",
      description: shotMix === null ? "No located team shots for this selection." : `About ${Math.round(shotMix)}% of the team's shots came from inside the paint radius.`,
      source: avg((r) => r.shotMix?.value) !== null ? "superstat" : "computed",
    },
    {
      label: "Points per shot",
      value: pps === null ? "—" : r1(pps).toFixed(2),
      badge: pps === null ? "POOR" : pps >= 1.2 ? "SUPER" : pps >= 1.0 ? "GOOD" : "POOR",
      sub: "Scoring efficiency",
      description: pps === null ? "No shot attempts recorded." : `The team scored ${r1(pps)} points per shot attempt across ${games} game(s).`,
      source: avg((r) => r.pointsPerShot?.value) !== null ? "superstat" : "computed",
    },
    {
      label: "Assist rate",
      value: assistRate === null ? "—" : `${Math.round(assistRate)}%`,
      badge: assistRate === null ? "POOR" : assistRate >= 35 ? "SUPER" : assistRate >= 22 ? "GOOD" : "POOR",
      sub: "Team play",
      description: assistRate === null ? "No field goals recorded." : `${Math.round(assistRate)}% of the team's made field goals were assisted.`,
      source: avg((r) => r.assistRate?.value) !== null ? "superstat" : "computed",
    },
    {
      label: "Turnovers",
      value: tovPg === null ? "—" : String(Math.round(tovPg)),
      badge: tovPg === null ? "POOR" : tovPg <= 10 ? "SUPER" : tovPg <= 15 ? "GOOD" : "POOR",
      sub: "Ball security, per game",
      description: tovPg === null ? "No games in this selection." : `${r1(tovPg)} turnovers per game across ${games} game(s).`,
      source: avg((r) => r.turnovers?.value) !== null ? "superstat" : "computed",
    },
    {
      label: "Rebounds",
      value: rebPg === null ? "—" : String(Math.round(rebPg)),
      badge: rebPg === null ? "POOR" : rebPg >= 38 ? "SUPER" : rebPg >= 28 ? "GOOD" : "POOR",
      sub: "Per game",
      description: rebPg === null ? "No games in this selection." : `${r1(rebPg)} rebounds per game across ${games} game(s).`,
      source: avg((r) => r.rebounds?.value) !== null ? "superstat" : "computed",
    },
    {
      label: "Defensive impact",
      value: defPg === null ? "—" : String(Math.round(defPg)),
      badge: defPg === null ? "POOR" : defPg >= 10 ? "SUPER" : defPg >= 6 ? "GOOD" : "POOR",
      sub: "Steals + blocks, per game",
      description: defPg === null ? "No games in this selection." : `${r1(defPg)} combined steals and blocks per game.`,
      source: avg((r) => r.defensiveImpact?.value) !== null ? "superstat" : "computed",
    },
  ];

  if (ready.length < insights.length) notes.push(`Team insights were available for ${ready.length} of ${insights.length} selected game(s).`);
  if (metrics.some((m) => m.source === "computed")) notes.push("Some team metrics were calculated from box-score totals because Superstat's team insights were not ready for every game.");
  if (summary.whatsWorking.length === 0 && summary.focusAreas.length === 0 && summary.suggestions.length === 0) notes.push("No team insight summaries were available for this selection.");

  // Cross-game synthesis: short, data-derived claims built from the team
  // ratings and the per-match summaries. Each line stays short enough for the
  // landscape cards (no ellipsis truncation) and cites its basis.
  const trim = (text: string, max: number): string => {
    const s = text.replace(/\s+/g, " ").trim();
    if (s.length <= max) return s;
    const cutWords = s.slice(0, max).split(" ").slice(0, -1).join(" ");
    return cutWords.length > 0 ? cutWords : s.slice(0, max);
  };
  const consolidate = (
    items: Array<{ text: string; date: string }>,
    totalGames: number,
    cap: number,
  ): string[] => {
    const groups = new Map<string, { text: string; dates: string[] }>();
    const order: string[] = [];
    for (const { text, date } of items) {
      const trimmed = trim(text, 120);
      const key = trimmed.toLowerCase();
      const g = groups.get(key);
      if (g) { g.dates.push(date); continue; }
      groups.set(key, { text: trimmed, dates: [date] });
      order.push(key);
    }
    const parts = order.map((key) => {
      const g = groups.get(key)!;
      const n = g.dates.length;
      const dates = g.dates.join(", ");
      if (totalGames > 1 && n === totalGames) return `${g.text} — flagged in every game analysed (${dates}).`;
      if (n > 1) return `${g.text} — flagged in ${n} of ${totalGames} games (${dates}).`;
      return `${g.text} (${dates}).`;
    });
    const recurringFirst = [...parts].sort((a, b) => {
      const na = a.includes("every game") ? 2 : a.includes("of " + totalGames + " games") ? 1 : 0;
      const nb = b.includes("every game") ? 2 : b.includes("of " + totalGames + " games") ? 1 : 0;
      return nb - na;
    });
    return recurringFirst.slice(0, cap);
  };

  const perMatch = {
    whatsWorking: ready.flatMap((i) => (i.summary?.whatsWorking ?? []).map((t) => ({ text: t, date: i.playedAt.slice(0, 10) }))),
    focusAreas: ready.flatMap((i) => (i.summary?.focusAreas ?? []).map((t) => ({ text: t, date: i.playedAt.slice(0, 10) }))),
    suggestions: ready.flatMap((i) => (i.summary?.suggestions ?? []).map((t) => ({ text: t, date: i.playedAt.slice(0, 10) }))),
  };

  // Data-derived synthesis lines from the aggregated team metrics.
  const synth = {
    whatsWorking: [] as string[],
    focusAreas: [] as string[],
    suggestions: [] as string[],
  };
  if (rebPg !== null && rebPg >= 28) synth.whatsWorking.push(`Rebounding is a team strength at ${r1(rebPg)} per game.`);
  if (pps !== null && pps >= 1.0) synth.whatsWorking.push(`Shot quality is solid at ${r1(pps)} points per shot.`);
  if (assistRate !== null && assistRate >= 22) synth.whatsWorking.push(`Team play shows in an assist rate of ${Math.round(assistRate)}%.`);
  if (tovPg !== null && tovPg > 15) synth.focusAreas.push(`Ball security: ${r1(tovPg)} turnovers per game is the clear team focus.`);
  if (defPg !== null && defPg < 6) synth.focusAreas.push(`Defensive activity: ${r1(defPg)} steals + blocks per game needs work.`);
  if (shotMix !== null && shotMix < 30) synth.focusAreas.push(`Shot mix leans to the perimeter (${Math.round(shotMix)}% close).`);

  const synthesis = {
    whatsWorking: [
      ...synth.whatsWorking.slice(0, 2),
      ...consolidate(perMatch.whatsWorking, games, Math.max(0, 2 - synth.whatsWorking.length)),
    ],
    focusAreas: [
      ...synth.focusAreas.slice(0, 2),
      ...consolidate(perMatch.focusAreas, games, Math.max(0, 2 - synth.focusAreas.length)),
    ],
    suggestions: consolidate(perMatch.suggestions, games, 2),
  };

  return {
    gamesConsidered: games,
    insightsReady: ready.length,
    summary,
    synthesis,
    metrics,
    note: notes.length > 0 ? notes.join(" ") : null,
  };
}
