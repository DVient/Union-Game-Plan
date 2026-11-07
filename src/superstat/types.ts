// Typed Superstat API vocabulary, transcribed strictly from the audited
// documentation (audit/capability-assessment.md; audit/md/*.md). No field is
// invented: every name below appears in the fetched endpoint schemas.

/** Every response is the envelope { data, error } with the documented error codes. */
export interface Envelope<T> {
  data: T;
  error: { code: "BAD_REQUEST" | "UNAUTHORIZED" | "NOT_FOUND" | "INTERNAL_ERROR"; message: string } | null;
}

export interface Club {
  id: string;
  name: string;
  /** Docs type these `object | null` while examples show plain strings; keep unasserted. */
  country: unknown;
  state: unknown;
  logoUrl: unknown;
  createdAt: string;
}

export interface Team {
  id: string;
  clubId: string;
  name: string;
  ageGroup: string;
  gender: unknown;
  competitionLevel: unknown;
  league: unknown;
  division: unknown;
  createdAt: string;
}

export interface RosterPlayer {
  /** Player id — use for player insights and to match box score rows. */
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: string;
  /** PII: kept only inside preserved raw responses, never sent to the AI. */
  email: string | null;
  createdAt: string;
}

export type MatchStatus = "not_started" | "in_progress" | "processing" | "complete" | "failed";

export interface MatchPeriod {
  id: string;
  number: number | null;
  type: "quarter" | "half" | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface MatchTeamRef {
  id: string | null;
  name: string;
  score: number | null;
}

export interface Match {
  id: string;
  playedAt: string;
  status: MatchStatus;
  team: MatchTeamRef;
  opponent: MatchTeamRef;
  recordedBy: "team" | "opponent";
  opponentStatsTracked: boolean;
  thumbnailUrl: string | null;
  failureReason: string | null;
  periods: MatchPeriod[];
  createdAt: string;
}

export interface BoxScoreStats {
  points: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  fieldGoalPercentage: number;
  threePointersMade: number;
  threePointersAttempted: number;
  threePointPercentage: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  freeThrowPercentage: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
}

export interface BoxScorePlayer extends BoxScoreStats {
  playerId: string | null;
  rosterEntryId: string | null;
  name: string;
  jerseyNumber: string | null;
  minutes: number | null;
  efficiency: number;
  trueShootingPercentage: number;
}

export interface BoxScoreTeam {
  name: string;
  totals: BoxScoreStats;
  players: BoxScorePlayer[];
}

export interface MatchBoxScore {
  matchId: string;
  team: BoxScoreTeam;
  opponent: BoxScoreTeam | null;
}

export type EventType =
  | "two_point"
  | "three_point"
  | "free_throw"
  | "offensive_rebound"
  | "defensive_rebound"
  | "assist"
  | "steal"
  | "block"
  | "turnover"
  | "foul"
  | (string & {}); // custom events exist; keep the door open without lying about them

export interface CourtLocation {
  court: { standard: string; lengthMetres: number; widthMetres: number };
  x: number;
  y: number;
  fromLeftBaselineMetres: number;
  fromTopSidelineMetres: number;
}

export interface MatchEvent {
  id: string;
  type: EventType;
  success: boolean;
  side: "team" | "opponent" | null;
  matchSeconds: number;
  periodId: string;
  periodNumber: number | null;
  periodType: "quarter" | "half" | null;
  periodSeconds: number;
  player: { id: string | null; rosterEntryId: string | null; name: string | null; jerseyNumber: string | null } | null;
  location: CourtLocation | null;
  customEventName: string | null;
}

export interface MatchEvents {
  roster: Array<{
    rosterEntryId: string;
    playerId: string | null;
    firstName: string | null;
    lastName: string | null;
    jerseyNumber: string | null;
    side: "team" | "opponent";
  }>;
  events: MatchEvent[];
}

export type InsightsStatus = "ready" | "not_generated" | "generating" | "failed" | "unavailable";

export interface InsightRating {
  value: number;
  comment: string;
}

export interface MatchInsights {
  status: InsightsStatus;
  message: string;
  stale: boolean;
  recordedBy: "team" | "opponent";
  summary: { whatsWorking: string[]; focusAreas: string[]; suggestions: string[] } | null;
  ratings: {
    shotMix: InsightRating;
    pointsPerShot: InsightRating;
    assistRate: InsightRating;
    turnovers: InsightRating;
    rebounds: InsightRating;
    defensiveImpact: InsightRating;
  } | null;
  generatedAt: string | null;
}
