// Rule-based analysis provider: a deterministic, locally-computed analysis
// pass over the evidence pack. It is always available (no network, no key) and
// exists so the coach workflow never dead-ends; reports record which provider
// produced the findings. Every finding cites evidence keys from the pack.
import type { AiAnalysisProvider, AnalysisResult, EvidencePack } from "./types.js";

export class RuleBasedProvider implements AiAnalysisProvider {
  readonly id = "rule-based";
  available(): boolean { return true; }

  async analyze(pack: EvidencePack): Promise<AnalysisResult> {
    const findings: AnalysisResult["findings"] = [];
    const a = pack.stats.aggregates;
    const conf = pack.stats.confidence;
    const first = pack.player.firstName;
    const games = pack.stats.gamesUsed;

    if (conf.overall.low) {
      findings.push({ category: "iq", claim: `Only ${games} game(s) are included, so treat every observation below as a starting point rather than a conclusion.`, citation: "stats.gamesUsed", confidence: "unverified" });
    }
    if (a.trueShootingPct !== null && !conf.fieldGoal.low) {
      findings.push(a.trueShootingPct >= 55
        ? { category: "scoring", claim: `${first} scores efficiently for this sample (${a.trueShootingPct}% true shooting).`, citation: "stats.trueShootingPct", confidence: "confirmed" }
        : { category: "scoring", claim: `Shooting efficiency is the first development area to check: ${a.trueShootingPct}% true shooting over ${games} games.`, citation: "stats.trueShootingPct", confidence: "confirmed" });
    }
    if (a.threePct !== null && !conf.threePoint.low) {
      findings.push(a.threePct < 30
        ? { category: "scoring", claim: `Three-point shooting is below the 30% benchmark (${a.threePct}%) — shot-selection work from the arc is a priority.`, citation: "stats.threePct", confidence: "confirmed" }
        : { category: "scoring", claim: `Three-point shooting is at or above the 30% benchmark (${a.threePct}%).`, citation: "stats.threePct", confidence: "confirmed" });
    }
    if (a.fgPct !== null && !conf.fieldGoal.low) {
      findings.push(a.fgPct < 42
        ? { category: "scoring", claim: `Overall field-goal percentage (${a.fgPct}%) suggests finishing and shot-selection practice would pay off.`, citation: "stats.fgPct", confidence: "confirmed" }
        : { category: "scoring", claim: `Field-goal percentage is healthy (${a.fgPct}%).`, citation: "stats.fgPct", confidence: "confirmed" });
    }
    if (a.pointsPerFga !== null && a.pointsPerFga < 0.95 && !conf.fieldGoal.low) {
      findings.push({ category: "offense", claim: `Each field-goal attempt returns ${a.pointsPerFga} points — below the ~1.0 mark, so better shot quality matters more than volume right now.`, citation: "stats.pointsPerFga", confidence: "confirmed" });
    }
    if (!conf.assistTurnover.low) {
      findings.push((a.assistToTurnover ?? 0) < 1
        ? { category: "ballhandling", claim: `Assists (${a.assistsPerGame}/game) do not yet outweigh turnovers (${a.turnoversPerGame}/game). Decision-making with the ball is the priority.`, citation: "stats.assistToTurnover", confidence: "confirmed" }
        : { category: "ballhandling", claim: `Ball security is solid: ${a.assistToTurnover} assists per turnover.`, citation: "stats.assistToTurnover", confidence: "confirmed" });
    } else if (a.turnoversPerGame >= 3) {
      findings.push({ category: "ballhandling", claim: `${a.turnoversPerGame} turnovers per game is high for a development player; watch for pressure situations.`, citation: "stats.turnoversPerGame", confidence: "possible" });
    }
    const q4 = pack.events.turnoversPerPeriod["Q4"] ?? 0;
    if (q4 >= 2 && pack.events.turnoverCount > 0) {
      findings.push({ category: "iq", claim: `${q4} of ${pack.events.turnoverCount} recorded turnovers came in the fourth quarter — fatigue handling in close minutes is worth reviewing.`, citation: `events.turnoversInPeriod.Q4;events.turnoverCount`, confidence: "possible" });
    }
    if (pack.stats.consistency.points.coefficientOfVariation >= 0.4 && games >= 5) {
      findings.push({ category: "offense", claim: `Scoring varies noticeably between games (CV ${pack.stats.consistency.points.coefficientOfVariation}) — consistency, not just quantity, is the growth area.`, citation: "stats.consistency.points.cv", confidence: "confirmed" });
    }
    const defInsights = Object.entries(pack.insights).map(([m, i]) => ({ m, r: i.ratings?.defensiveImpact }));
    const defValues = defInsights.map((d) => d.r?.value).filter((v): v is number => typeof v === "number");
    if (defValues.length > 0) {
      const avg = defValues.reduce((x, y) => x + y, 0) / defValues.length;
      findings.push(avg < 2
        ? { category: "defense", claim: `Superstat's defensive-impact rating (steals + blocks) averages ${Math.round(avg * 10) / 10} across ${defValues.length} games — low activity on the ball.`, citation: `insights.${defInsights.find((d) => d.r !== undefined)?.m}.ratings.defensiveImpact.value`, confidence: "confirmed" }
        : { category: "defense", claim: `Superstat's defensive-impact rating averages ${Math.round(avg * 10) / 10} — active hands on the ball.`, citation: `insights.${defInsights.find((d) => d.r !== undefined)?.m}.ratings.defensiveImpact.value`, confidence: "confirmed" });
    }
    const firstInsight = Object.entries(pack.insights).find(([, i]) => i.summary && i.summary.focusAreas.length > 0);
    if (firstInsight) {
      const [matchId, ins] = firstInsight;
      findings.push({ category: "iq", claim: `Superstat's own analysis flags: “${ins.summary!.focusAreas[0]}”.`, citation: `insights.${matchId}.focusAreas.0`, confidence: "possible" });
    }
    return { providerId: this.id, findings };
  }
}
