// Manual sync pipeline (plan §5): the coach clicks "Sync now"; the app
// incrementally fetches new matches since the last sync. Raw responses are
// preserved verbatim; missing data and API errors are collected, never fatal.
import { saveRaw, setMeta } from "../store/db.js";
import type { DatabaseSync } from "node:sqlite";
import { SuperstatClient } from "../superstat/client.js";
import { buildMockBundle } from "../superstat/mock.js";
import type { AppConfig } from "../config.js";
import type { Match, MatchBoxScore, MatchEvents, MatchInsights, RosterPlayer, Team } from "../superstat/types.js";

export interface SyncResult {
  mode: "mock" | "live";
  teams: number;
  players: number;
  matches: number;
  boxScores: number;
  eventSets: number;
  insights: number;
  /** Non-fatal problems collected during sync (shown to the coach). */
  notes: string[];
}

const now = (): string => new Date().toISOString();

function upsertTeam(db: DatabaseSync, team: Team): void {
  db.prepare(
    "INSERT INTO teams (id, club_id, name, age_group, gender, competition_level, league, division) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET name=excluded.name, age_group=excluded.age_group, gender=excluded.gender, " +
      "competition_level=excluded.competition_level, league=excluded.league, division=excluded.division",
  ).run(team.id, team.clubId, team.name, team.ageGroup,
    team.gender === null ? null : String(team.gender),
    team.competitionLevel === null ? null : String(team.competitionLevel),
    team.league === null ? null : String(team.league),
    team.division === null ? null : String(team.division));
}

function upsertPlayer(db: DatabaseSync, teamId: string, p: RosterPlayer): void {
  db.prepare(
    "INSERT INTO players (id, team_id, first_name, last_name, jersey_number) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET team_id=excluded.team_id, first_name=excluded.first_name, " +
      "last_name=excluded.last_name, jersey_number=excluded.jersey_number",
  ).run(p.id, teamId, p.firstName, p.lastName, p.jerseyNumber);
}

function upsertMatch(db: DatabaseSync, teamId: string, m: Match): void {
  db.prepare(
    "INSERT INTO matches (id, team_id, played_at, status, team_score, opponent_name, opponent_score, recorded_by, opponent_stats_tracked) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET status=excluded.status, team_score=excluded.team_score, " +
      "opponent_name=excluded.opponent_name, opponent_score=excluded.opponent_score, " +
      "opponent_stats_tracked=excluded.opponent_stats_tracked",
  ).run(m.id, teamId, m.playedAt, m.status, m.team.score, m.opponent.name, m.opponent.score,
    m.recordedBy, m.opponentStatsTracked ? 1 : 0);
}

function saveBoxScore(db: DatabaseSync, box: MatchBoxScore, ts: string): void {
  saveRaw(db, "box-score", box.matchId, JSON.stringify(box), ts);
  db.prepare("DELETE FROM box_score_players WHERE match_id = ?").run(box.matchId);
  db.prepare("DELETE FROM box_score_totals WHERE match_id = ?").run(box.matchId);
  for (const side of ["team", "opponent"] as const) {
    const teamBox = side === "team" ? box.team : box.opponent;
    if (teamBox === null) continue;
    const t = teamBox.totals;
    db.prepare(
      "INSERT INTO box_score_totals (match_id, side, points, fgm, fga, fg_pct, tpm, tpa, tp_pct, ftm, fta, ft_pct, oreb, dreb, reb, ast, stl, blk, tov, fouls) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(box.matchId, side, t.points, t.fieldGoalsMade, t.fieldGoalsAttempted, t.fieldGoalPercentage,
      t.threePointersMade, t.threePointersAttempted, t.threePointPercentage,
      t.freeThrowsMade, t.freeThrowsAttempted, t.freeThrowPercentage,
      t.offensiveRebounds, t.defensiveRebounds, t.rebounds, t.assists, t.steals, t.blocks, t.turnovers, t.fouls);
    for (const p of teamBox.players) {
      db.prepare(
        "INSERT INTO box_score_players (match_id, side, player_id, roster_entry_id, name, jersey_number, minutes, points, fgm, fga, fg_pct, tpm, tpa, tp_pct, ftm, fta, ft_pct, oreb, dreb, reb, ast, stl, blk, tov, fouls, efficiency, ts_pct) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(box.matchId, side, p.playerId, p.rosterEntryId, p.name, p.jerseyNumber, p.minutes,
        p.points, p.fieldGoalsMade, p.fieldGoalsAttempted, p.fieldGoalPercentage,
        p.threePointersMade, p.threePointersAttempted, p.threePointPercentage,
        p.freeThrowsMade, p.freeThrowsAttempted, p.freeThrowPercentage,
        p.offensiveRebounds, p.defensiveRebounds, p.rebounds, p.assists, p.steals, p.blocks, p.turnovers, p.fouls,
        p.efficiency, p.trueShootingPercentage);
    }
  }
}

function saveEvents(db: DatabaseSync, events: MatchEvents, matchId: string, ts: string): void {
  saveRaw(db, "events", matchId, JSON.stringify(events), ts);
  db.prepare("DELETE FROM events WHERE match_id = ?").run(matchId);
  for (const e of events.events) {
    db.prepare(
      "INSERT INTO events (id, match_id, type, success, side, match_seconds, period_id, period_number, period_type, period_seconds, player_id, player_name, jersey_number, x, y, custom_event_name) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(e.id, matchId, e.type, e.success ? 1 : 0, e.side, e.matchSeconds, e.periodId,
      e.periodNumber, e.periodType, e.periodSeconds,
      e.player?.id ?? null, e.player?.name ?? null, e.player?.jerseyNumber ?? null,
      e.location?.x ?? null, e.location?.y ?? null, e.customEventName);
  }
}

export function saveInsights(db: DatabaseSync, matchId: string, playerId: string | null, ins: MatchInsights, ts: string): void {
  saveRaw(db, playerId === null ? "team-insights" : `player-insights:${playerId}`, matchId, JSON.stringify(ins), ts);
  db.prepare(
    "INSERT INTO insights (match_id, player_id, status, message, stale, summary_json, ratings_json, generated_at, fetched_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(match_id, player_id) DO UPDATE SET status=excluded.status, message=excluded.message, " +
      "stale=excluded.stale, summary_json=excluded.summary_json, ratings_json=excluded.ratings_json, " +
      "generated_at=excluded.generated_at, fetched_at=excluded.fetched_at",
  ).run(matchId, playerId, ins.status, ins.message, ins.stale ? 1 : 0,
    ins.summary === null ? null : JSON.stringify(ins.summary),
    ins.ratings === null ? null : JSON.stringify(ins.ratings),
    ins.generatedAt, ts);
}

/** Manual sync. Mock mode seeds the fixture bundle; live mode fetches incrementally. */
export async function sync(config: AppConfig, db: DatabaseSync): Promise<SyncResult> {
  const result: SyncResult = { mode: config.mockMode ? "mock" : "live", teams: 0, players: 0, matches: 0, boxScores: 0, eventSets: 0, insights: 0, notes: [] };
  const ts = now();

  if (config.mockMode) {
    const bundle = buildMockBundle();
    saveRaw(db, "clubs", "list", JSON.stringify([bundle.club]), ts);
    db.prepare("INSERT INTO clubs (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name").run(bundle.club.id, bundle.club.name);
    const teamExisting = db.prepare("SELECT id FROM teams WHERE id = ?").get(bundle.team.id);
    upsertTeam(db, bundle.team);
    if (teamExisting === undefined) result.teams++;
    for (const p of bundle.roster) {
      const pExisting = db.prepare("SELECT id FROM players WHERE id = ?").get(p.id);
      upsertPlayer(db, bundle.team.id, p);
      if (pExisting === undefined) result.players++;
    }
    for (const m of bundle.matches) {
      const mExisting = db.prepare("SELECT id FROM matches WHERE id = ?").get(m.id);
      upsertMatch(db, bundle.team.id, m);
      if (mExisting === undefined) result.matches++;
    }
    for (const [matchId, box] of bundle.boxScores) { saveBoxScore(db, box, ts); result.boxScores++; }
    for (const [matchId, events] of bundle.events) { saveEvents(db, events, matchId, ts); result.eventSets++; }
    for (const [matchId, ins] of bundle.teamInsights) { saveInsights(db, matchId, null, ins, ts); result.insights++; }
    for (const [key, ins] of bundle.insights) {
      const [matchId, playerId] = key.split(":");
      if (matchId !== undefined && playerId !== undefined) { saveInsights(db, matchId, playerId, ins, ts); result.insights++; }
    }
    setMeta(db, "lastSync", ts);
    return result;
  }

  const client = new SuperstatClient({ apiKey: config.superstatApiKey ?? "", baseUrl: config.superstatBaseUrl });
  try {
    const clubs = await client.listClubs();
    saveRaw(db, "clubs", "list", clubs.raw, ts);
    const club = clubs.data[0];
    if (club === undefined) { result.notes.push("The API key returned no club."); return result; }
    db.prepare("INSERT INTO clubs (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name").run(club.id, club.name);

    const teams = await client.listTeamsInClub(club.id);
    saveRaw(db, "teams", club.id, teams.raw, ts);
    for (const team of teams.data) {
      upsertTeam(db, team); result.teams++;
      try {
        const roster = await client.listTeamRoster(team.id);
        saveRaw(db, "roster", team.id, roster.raw, ts);
        for (const p of roster.data) { upsertPlayer(db, team.id, p); result.players++; }
      } catch (e) { result.notes.push(`Roster for ${team.name} failed: ${String(e)}`); }

      try {
        const matches = await client.listTeamMatches(team.id);
        saveRaw(db, "matches", team.id, matches.raw, ts);
        for (const m of matches.data) {
          const existing = db.prepare("SELECT id FROM matches WHERE id = ?").get(m.id);
          upsertMatch(db, team.id, m);
          if (existing === undefined) result.matches++;
          if (m.status !== "complete") continue;
          const haveBox = db.prepare("SELECT match_id FROM box_score_totals WHERE match_id = ? AND side = 'team'").get(m.id);
          if (haveBox === undefined) {
            try {
              const box = await client.getBoxScore(m.id);
              saveBoxScore(db, box.data, ts);
              result.boxScores++;
            } catch (e) { result.notes.push(`Box score for match ${m.id} failed: ${String(e)}`); }
            try {
              const ev = await client.listPlayByPlayEvents(m.id);
              saveEvents(db, ev.data, m.id, ts); result.eventSets++;
            } catch (e) { result.notes.push(`Events for match ${m.id} failed: ${String(e)}`); }
            // Insights: only fetch when already generated; generation happens on demand at report time.
            try {
              const ins = await client.getTeamInsights(m.id);
              if (ins.data.status === "ready") { saveInsights(db, m.id, null, ins.data, ts); result.insights++; }
            } catch { /* insights are optional during sync */ }
          }
        }
      } catch (e) { result.notes.push(`Matches for ${team.name} failed: ${String(e)}`); }
    }
    setMeta(db, "lastSync", ts);
  } catch (e) {
    result.notes.push(`Sync failed: ${String(e)}`);
  }
  return result;
}
