// Development priorities (plan §9): the three highest-priority areas, each
// with weakness, cited evidence, why it matters, specific age-appropriate
// recommendations, a measurement, and a reassessment period. Selection is
// deterministic and severity-ordered; language is development-focused.
import type { PlayerStats } from "../stats/compute.js";

export interface DevelopmentPriority {
  area: string;
  weakness: string;
  evidenceKeys: string[];
  /** Resolved from the evidence pack's citation map at build time. */
  evidenceFacts: string[];
  whyItMatters: string;
  recommendations: string[];
  measure: string;
  reassessment: string;
}

interface Candidate {
  severity: number;
  priority: Omit<DevelopmentPriority, "evidenceFacts">;
}

export function buildPriorities(
  stats: PlayerStats,
  citations: Record<string, string>,
  insights: Record<string, { ratings: Record<string, { value: number; comment: string }> | null }>,
): DevelopmentPriority[] {
  const a = stats.aggregates;
  const conf = stats.confidence;
  const games = stats.gamesUsed;
  const threeAttempts = stats.games.reduce((x, g) => x + g.threePointAttempts, 0);
  const ftAttempts = stats.games.reduce((x, g) => x + g.freeThrowAttempts, 0);
  const candidates: Candidate[] = [];

  const defRatings = Object.values(insights).map((i) => i.ratings?.defensiveImpact?.value).filter((v): v is number => typeof v === "number");
  const defAvg = defRatings.length > 0 ? defRatings.reduce((x, y) => x + y, 0) / defRatings.length : null;

  if ((a.turnoversPerGame ?? 0) >= 3 || (a.assistToTurnover !== null && a.assistToTurnover < 1 && !conf.assistTurnover.low)) {
    const ato = a.assistToTurnover === null ? "not available" : String(a.assistToTurnover);
    candidates.push({
      severity: 5 + Math.max(0, 3 - (a.turnoversPerGame ?? 0)) + (a.assistToTurnover !== null && a.assistToTurnover < 1 ? 2 : 0),
      priority: {
        area: "Ball security and decision-making",
        weakness: `Turnovers (${a.turnoversPerGame} per game) currently outweigh assists (assist-to-turnover ratio ${ato}).`,
        evidenceKeys: ["stats.turnoversPerGame", "stats.assistToTurnover", "stats.assistsPerGame"],
        whyItMatters: "Every turnover is a possession the team cannot score with — and the fastest stat for a young player to improve with focused practice.",
        recommendations: [
          "Two-ball dribbling, 10 minutes a day, eyes up — builds the ball-handling base.",
          "In scrimmages, decide before every catch: pass-first or drive-first — then commit.",
          "Review one turnover per game on video with your coach and name what the defence did.",
          "Sweep the ball low and wide on drives; finish with the same footwork every time.",
        ],
        measure: "Assist-to-turnover ratio — aim for 1.0 or better within six weeks; turnovers per game trending below 2.5.",
        reassessment: "Reassess after 4–6 games (about four weeks).",
      },
    });
  }

  if (a.threePct !== null && a.threePct < 30 && !conf.threePoint.low) {
    candidates.push({
      severity: (30 - a.threePct) / 10 + 2,
      priority: {
        area: "Three-point shooting",
        weakness: `Three-point percentage is ${a.threePct}% on ${threeAttempts} attempts — below the 30% benchmark for this age group.`,
        evidenceKeys: ["stats.threePct", "stats.zones.three"],
        whyItMatters: "At U16 level a reliable three keeps defences honest and opens driving lanes for teammates.",
        recommendations: [
          "Form shooting from five spots inside your comfortable range before any game-speed shooting.",
          "200 game-speed catch-and-shoot threes a week, tracked on a shot chart.",
          "Practise the 1-2 step and the hop landing until both feel natural; pick one for games.",
          "Only take game threes from the spots you make 40%+ from in practice this month.",
        ],
        measure: "3P% in games trending toward 30%+; practice chart at 40%+ from your range spots.",
        reassessment: "Reassess after 5 games (about four weeks).",
      },
    });
  }

  if (a.ftPct !== null && a.ftPct < 60 && !conf.freeThrow.low) {
    candidates.push({
      severity: (60 - a.ftPct) / 10 + 1.5,
      priority: {
        area: "Free-throw shooting",
        weakness: `Free-throw percentage is ${a.ftPct}% (${ftAttempts} attempts) — free points left on the line.`,
        evidenceKeys: ["stats.ftPct"],
        whyItMatters: "Late-game minutes often come down to free throws; it is also the most trainable shot in basketball.",
        recommendations: [
          "One pre-shot routine (two dribbles, breathe, shoot) used for every attempt in practice and games.",
          "50 free throws after every practice, tracked in a simple log — never finish on a miss.",
          "Practise tired: end-of-session free throws simulate fourth-quarter legs.",
        ],
        measure: "FT% trending toward 65%+; practice log at 75%+ by the reassessment date.",
        reassessment: "Reassess after 5 games (about four weeks).",
      },
    });
  }

  if (a.pointsPerFga !== null && a.pointsPerFga < 0.95 && !conf.fieldGoal.low) {
    candidates.push({
      severity: (0.95 - a.pointsPerFga) * 10 + 1,
      priority: {
        area: "Shot selection and finishing",
        weakness: `Each field-goal attempt returns ${a.pointsPerFga} points — below the ~1.0 mark, so shot quality is the issue, not volume.`,
        evidenceKeys: ["stats.pointsPerFga", "stats.fgPct", "stats.zones.paint", "stats.zones.midrange"],
        whyItMatters: "Better shots are the quickest route to more points without needing a better shot yet.",
        recommendations: [
          "Finish-through-contact package: Mikan series, reverse Mikan, and one-foot floaters, 10 minutes a day.",
          "In games, hunt two shots you rehearse: catch-and-shoot from your range spots, and one-dribble pull-up from the elbow.",
          "Play 2-on-1 and 3-on-2 advantage games in practice to practise the right early attack.",
        ],
        measure: "Points per FGA trending toward 1.0+; FG% toward 45%+.",
        reassessment: "Reassess after 5 games (about four weeks).",
      },
    });
  }

  if (defAvg !== null && defAvg < 2) {
    candidates.push({
      severity: (2 - defAvg) + 1.5,
      priority: {
        area: "Defensive activity",
        weakness: `Defensive-impact events (steals + blocks) average ${Math.round(defAvg * 10) / 10} per game — low activity on the ball.`,
        evidenceKeys: ["stats.stealsPerGame", "stats.blocksPerGame", "stats.reboundsPerGame"],
        whyItMatters: "Steals, blocks and defensive rebounds create extra possessions — defence that creates offence gets you more court time.",
        recommendations: [
          "Closeout technique work: sprint two steps, chop the last two, one hand high one hand low.",
          "In practice scrimmages, set a personal goal: two deflections per game (tip or steal).",
          "Box out every shot for one full quarter each game — count your defensive rebounds.",
        ],
        measure: "Steals + blocks per game trending toward 2+; defensive rebounds steady at 3+.",
        reassessment: "Reassess after 4 games (about three weeks).",
      },
    });
  }

  const cv = stats.consistency.points.coefficientOfVariation;
  if (cv >= 0.4 && games >= 5) {
    candidates.push({
      severity: (cv - 0.4) * 10 + 1,
      priority: {
        area: "Consistency",
        weakness: `Scoring swings between games (variation index ${cv}) — some games produce, others do not.`,
        evidenceKeys: ["stats.consistency.points.cv", "stats.consistency.trueShooting.cv"],
        whyItMatters: "Coaches trust players they can rely on every game; consistency comes from routine and shot diet, not talent jumps.",
        recommendations: [
          "Keep the same pre-game warm-up routine for every game this month.",
          "After each game, write two lines: what worked, what to adjust next game.",
          "Compare your shot chart across games — if your good games share shot types, make those your first options.",
        ],
        measure: "Coefficient of variation of game points trending below 0.35.",
        reassessment: "Reassess after 6 games (about six weeks).",
      },
    });
  }

  const resolve = (c: Omit<DevelopmentPriority, "evidenceFacts">): DevelopmentPriority => ({
    ...c,
    evidenceFacts: c.evidenceKeys.map((k) => citations[k]).filter((f): f is string => typeof f === "string"),
  });
  return candidates.sort((x, y) => y.severity - x.severity).slice(0, 3).map((c) => resolve(c.priority));
}
