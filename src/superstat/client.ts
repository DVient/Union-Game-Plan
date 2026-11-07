// Superstat API client, built strictly against the audited endpoints
// (13 routes, all GET except the two insight-generation POSTs).
import type {
  Club,
  Envelope,
  Match,
  MatchBoxScore,
  MatchEvents,
  MatchInsights,
  RosterPlayer,
  Team,
} from "./types.js";

export class SuperstatApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "SuperstatApiError";
    this.code = code;
    this.status = status;
  }
}

export interface SuperstatClientOptions {
  apiKey: string;
  baseUrl: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
}

/** Raw transport result so the store can preserve the original response. */
export interface RawResult<T> {
  data: T;
  /** The original JSON body exactly as the API returned it. */
  raw: string;
}

export class SuperstatClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: SuperstatClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  private async get<T>(path: string): Promise<RawResult<T>> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body: unknown): Promise<RawResult<T>> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<RawResult<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const raw = await response.text();
    if (!response.ok) {
      // Documented error envelope: { data: null, error: { code, message } }
      let code = `HTTP_${response.status}`;
      let message = `Superstat API error (HTTP ${response.status})`;
      try {
        const parsed = JSON.parse(raw) as Envelope<unknown>;
        if (parsed.error) {
          code = parsed.error.code;
          message = parsed.error.message;
        }
      } catch {
        // keep the generic message when the body is not the documented envelope
      }
      throw new SuperstatApiError(code, message, response.status);
    }
    let parsed: Envelope<T>;
    try {
      parsed = JSON.parse(raw) as Envelope<T>;
    } catch {
      throw new SuperstatApiError("BAD_RESPONSE", "Superstat API returned a non-JSON body.", response.status);
    }
    if (parsed.error) throw new SuperstatApiError(parsed.error.code, parsed.error.message, response.status);
    return { data: parsed.data, raw };
  }

  /** GET /v1/clubs — keys are club-scoped, so this returns exactly one club. */
  listClubs(): Promise<RawResult<Club[]>> {
    return this.get<Club[]>("/v1/clubs");
  }

  getClub(clubId: string): Promise<RawResult<Club>> {
    return this.get<Club>(`/v1/clubs/${clubId}`);
  }

  listTeamsInClub(clubId: string): Promise<RawResult<Team[]>> {
    return this.get<Team[]>(`/v1/clubs/${clubId}/teams`);
  }

  getTeam(teamId: string): Promise<RawResult<Team>> {
    return this.get<Team>(`/v1/teams/${teamId}`);
  }

  listTeamRoster(teamId: string): Promise<RawResult<RosterPlayer[]>> {
    return this.get<RosterPlayer[]>(`/v1/teams/${teamId}/roster`);
  }

  listTeamMatches(teamId: string): Promise<RawResult<Match[]>> {
    return this.get<Match[]>(`/v1/teams/${teamId}/matches`);
  }

  getMatch(matchId: string): Promise<RawResult<Match>> {
    return this.get<Match>(`/v1/matches/${matchId}`);
  }

  getBoxScore(matchId: string): Promise<RawResult<MatchBoxScore>> {
    return this.get<MatchBoxScore>(`/v1/matches/${matchId}/box-score`);
  }

  listPlayByPlayEvents(matchId: string): Promise<RawResult<MatchEvents>> {
    return this.get<MatchEvents>(`/v1/matches/${matchId}/events`);
  }

  getTeamInsights(matchId: string): Promise<RawResult<MatchInsights>> {
    return this.get<MatchInsights>(`/v1/matches/${matchId}/insights`);
  }

  getPlayerInsights(matchId: string, playerId: string): Promise<RawResult<MatchInsights>> {
    return this.get<MatchInsights>(`/v1/matches/${matchId}/player-insights/${playerId}`);
  }

  /** POST — generates team insights AND every rostered player's insights (poll until ready). */
  generateTeamInsights(matchId: string, regenerate = false): Promise<RawResult<MatchInsights>> {
    return this.post<MatchInsights>(`/v1/matches/${matchId}/insights`, regenerate ? { regenerate } : {});
  }

  generatePlayerInsights(matchId: string, playerId: string, regenerate = false): Promise<RawResult<MatchInsights>> {
    return this.post<MatchInsights>(`/v1/matches/${matchId}/player-insights/${playerId}`, regenerate ? { regenerate } : {});
  }
}
