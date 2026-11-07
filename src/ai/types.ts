// AI analysis vocabulary (plan §8, §12). The AI receives ONLY the evidence
// pack — validated statistics, event summaries and Superstat insights, with
// the player identified by first name only. It never receives API credentials
// or unrestricted raw data.
import type { PlayerStats } from "../stats/compute.js";

/** One evidence fact the AI may cite. Keys are mechanically resolvable. */
export interface EvidenceFact {
  key: string;
  /** Human-readable statement of the fact (shown in the report if cited). */
  fact: string;
}

export interface EvidencePack {
  /** First name only (plan §12: minimize personal data in AI prompts). */
  player: { firstName: string; jerseyNumber: string | null };
  stats: PlayerStats;
  /** Derived event summaries (counts and distributions — no forbidden metrics). */
  events: {
    turnoverCount: number;
    assistsCount: number;
    turnoversPerPeriod: Record<string, number>;
    pointsPerQuarter: Record<string, number>;
  };
  /** Superstat's own per-match insights for this player, keyed by match id. */
  insights: Record<string, {
    status: string;
    summary: { whatsWorking: string[]; focusAreas: string[]; suggestions: string[] } | null;
    ratings: Record<string, { value: number; comment: string }> | null;
  }>;
  /** key → fact map; every AI citation must be one of these keys. */
  citations: Record<string, string>;
}

export type FindingCategory = "scoring" | "ballhandling" | "offense" | "defense" | "iq";
export type FindingConfidence = "confirmed" | "possible" | "unverified";

export interface AnalysisFinding {
  category: FindingCategory;
  /** The claim, in development-focused language. */
  claim: string;
  /** One or more citation keys from the evidence pack, joined by '; '. */
  citation: string;
  confidence: FindingConfidence;
}

export interface AnalysisResult {
  providerId: string;
  findings: AnalysisFinding[];
}

export interface AiAnalysisProvider {
  id: string;
  /** Cheap local check; must not make network calls. */
  available(): boolean;
  analyze(pack: EvidencePack, signal?: AbortSignal): Promise<AnalysisResult>;
}
