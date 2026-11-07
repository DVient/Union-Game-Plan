// Progress tracking (plan §11): compare two immutable report snapshots.
// Improvements/declines/unchanged use the metric's natural direction
// (fewer turnovers is better). Differences in sample size and minutes are
// reported so the coach can read changes in context.
import { diffStats } from "../stats/compute.js";
import type { PlayerStats } from "../stats/compute.js";
import type { DevelopmentPriority as Priority } from "./priorities.js";

export interface ReportSnapshot {
  id: string;
  createdAt: string;
  stats: PlayerStats;
  priorities: Priority[];
}

export interface MetricChange {
  metric: string;
  prev: number | null;
  curr: number | null;
  delta: number | null;
  trend: "improved" | "declined" | "unchanged" | "n/a";
}

export interface Comparison {
  earlierId: string;
  laterId: string;
  sampleNote: string | null;
  metrics: MetricChange[];
  priorities: { carriedOver: string[]; newFocus: string[]; dropped: string[] };
}

const BETTER_WHEN_LOWER = new Set(["turnoversPerGame"]);

function trendOf(metric: string, delta: number | null): MetricChange["trend"] {
  if (delta === null) return "n/a";
  if (Math.abs(delta) < 0.05) return "unchanged";
  const better = BETTER_WHEN_LOWER.has(metric) ? delta < 0 : delta > 0;
  return better ? "improved" : "declined";
}

export function compareReports(earlier: ReportSnapshot, later: ReportSnapshot): Comparison {
  const metrics = diffStats(earlier.stats.aggregates, later.stats.aggregates).map((d) => ({
    ...d, trend: trendOf(d.metric, d.delta),
  }));
  const sampleNote = earlier.stats.gamesUsed !== later.stats.gamesUsed
    ? `Sample sizes differ (${earlier.stats.gamesUsed} vs ${later.stats.gamesUsed} games) — read changes in that light.`
    : null;
  const earlierAreas = new Set(earlier.priorities.map((p) => p.area));
  const laterAreas = new Set(later.priorities.map((p) => p.area));
  return {
    earlierId: earlier.id,
    laterId: later.id,
    sampleNote,
    metrics,
    priorities: {
      carriedOver: [...laterAreas].filter((x) => earlierAreas.has(x)),
      newFocus: [...laterAreas].filter((x) => !earlierAreas.has(x)),
      dropped: [...earlierAreas].filter((x) => !laterAreas.has(x)),
    },
  };
}
