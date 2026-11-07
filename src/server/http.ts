// Local-only HTTP server (plan §3): serves the selection UI and a small JSON
// API. Binds to 127.0.0.1 only — reachable from this machine alone.
import { join } from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { loadConfig } from "../config.js";
import { openDb } from "../store/db.js";
import { sync, saveInsights } from "../sync/sync.js";
import { SuperstatClient } from "../superstat/client.js";
import { computePlayerStats } from "../stats/compute.js";
import { buildEvidencePack } from "../ai/evidence.js";
import { runAnalysis } from "../ai/factory.js";
import { buildPriorities } from "../report/priorities.js";
import { buildTeamFocus } from "../report/team-focus.js";
import type { TeamInsightMatch, TeamTotalsInput } from "../report/team-focus.js";
import { teamShotMixPct } from "../stats/compute.js";
import { generateReportPdf } from "../report/pdf.js";
import { compareReports } from "../report/compare.js";
import type { ReportSnapshot } from "../report/compare.js";
import type { PlayerStats } from "../stats/compute.js";
import { createReadStream } from "node:fs";
import type { MatchInsights } from "../superstat/types.js";
import type { BoxScorePlayer, MatchEvent } from "../superstat/types.js";

/** Load a player's team-side box-score rows and events for the given matches. */
function loadStatsInputs(playerId: string, matchIds: string[]): { rows: Array<{ matchId: string; playedAt: string; opponentName: string; teamScore: number | null; opponentScore: number | null; row: BoxScorePlayer }>; events: MatchEvent[] } {
  const placeholders = matchIds.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT m.id AS matchId, m.played_at AS playedAt, m.opponent_name AS opponentName,
            m.team_score AS teamScore, m.opponent_score AS opponentScore, b.*
       FROM box_score_players b JOIN matches m ON m.id = b.match_id
      WHERE b.side = 'team' AND b.player_id = ? AND b.match_id IN (${placeholders})
      ORDER BY m.played_at`,
  ).all(playerId, ...matchIds) as Array<Record<string, unknown>>;
  const eventRows = db.prepare(
    `SELECT * FROM events WHERE side = 'team' AND match_id IN (${placeholders}) ORDER BY match_seconds`,
  ).all(...matchIds) as Array<Record<string, unknown>>;
  const events: MatchEvent[] = eventRows.map((e) => ({
    id: String(e.id),
    type: String(e.type),
    success: Number(e.success) === 1,
    side: e.side === null ? null : String(e.side) as "team" | "opponent" | null,
    matchSeconds: Number(e.match_seconds),
    periodId: String(e.period_id),
    periodNumber: e.period_number === null ? null : Number(e.period_number),
    periodType: e.period_type === null ? null : String(e.period_type) as "quarter" | "half" | null,
    periodSeconds: Number(e.period_seconds),
    player: e.player_id === null ? null : { id: String(e.player_id), rosterEntryId: null, name: e.player_name === null ? null : String(e.player_name), jerseyNumber: e.jersey_number === null ? null : String(e.jersey_number) },
    location: e.x === null || e.y === null ? null : {
      court: { standard: "FIBA", lengthMetres: 28, widthMetres: 15 },
      x: Number(e.x), y: Number(e.y),
      fromLeftBaselineMetres: Number(e.x) * 28, fromTopSidelineMetres: Number(e.y) * 15,
    },
    customEventName: e.custom_event_name === null ? null : String(e.custom_event_name),
  }));
  return {
    rows: rows.map((r) => ({
      matchId: String(r.matchId),
      playedAt: String(r.playedAt),
      opponentName: String(r.opponentName),
      teamScore: r.teamScore === null ? null : Number(r.teamScore),
      opponentScore: r.opponentScore === null ? null : Number(r.opponentScore),
      row: {
        playerId: r.player_id === null ? null : String(r.player_id),
        rosterEntryId: r.roster_entry_id === null ? null : String(r.roster_entry_id),
        name: String(r.name),
        jerseyNumber: r.jersey_number === null ? null : String(r.jersey_number),
        minutes: r.minutes === null ? null : Number(r.minutes),
        points: Number(r.points),
        fieldGoalsMade: Number(r.fgm), fieldGoalsAttempted: Number(r.fga), fieldGoalPercentage: Number(r.fg_pct),
        threePointersMade: Number(r.tpm), threePointersAttempted: Number(r.tpa), threePointPercentage: Number(r.tp_pct),
        freeThrowsMade: Number(r.ftm), freeThrowsAttempted: Number(r.fta), freeThrowPercentage: Number(r.ft_pct),
        offensiveRebounds: Number(r.oreb), defensiveRebounds: Number(r.dreb), rebounds: Number(r.reb),
        assists: Number(r.ast), steals: Number(r.stl), blocks: Number(r.blk),
        turnovers: Number(r.tov), fouls: Number(r.fouls),
        efficiency: Number(r.efficiency), trueShootingPercentage: Number(r.ts_pct),
      } satisfies BoxScorePlayer,
    })),
    events,
  };
}

const webDir = join(dirname(fileURLToPath(import.meta.url)), "../../web");

const config = loadConfig();
const { db } = openDb(config.dataDir);

const app = Fastify({ logger: true });
await app.register(fastifyStatic, { root: webDir, prefix: "/" });

app.get("/api/state", async () => {
  const teams = db.prepare(
    "SELECT id, name, age_group AS ageGroup, division FROM teams ORDER BY name",
  ).all();
  const players = db.prepare(
    "SELECT id, team_id AS teamId, first_name AS firstName, last_name AS lastName, jersey_number AS jerseyNumber " +
      "FROM players ORDER BY CAST(jersey_number AS INTEGER)",
  ).all();
  const matches = db.prepare(
    "SELECT id, team_id AS teamId, played_at AS playedAt, status, team_score AS teamScore, " +
      "opponent_name AS opponentName, opponent_score AS opponentScore " +
      "FROM matches ORDER BY played_at DESC",
  ).all();
  return { mockMode: config.mockMode, lastSync: db.prepare("SELECT value FROM meta WHERE key='lastSync'").get()?.value ?? null, teams, players, matches };
});

app.post("/api/sync", async () => {
  const result = await sync(config, db);
  return result;
});

// Stage 3: report creation computes and stores the statistical snapshot.
app.post("/api/reports", async (request, reply) => {
  const body = request.body as { playerId?: string; matchIds?: string[]; label?: string };
  const playerId = body.playerId ?? "";
  const matchIds = Array.isArray(body.matchIds) ? body.matchIds : [];
  if (playerId.length === 0 || matchIds.length === 0) {
    return reply.code(400).send({ error: "playerId and at least one matchId are required" });
  }
  const player = db.prepare("SELECT id FROM players WHERE id = ?").get(playerId);
  if (player === undefined) return reply.code(404).send({ error: "Unknown player" });
  const { rows, events } = loadStatsInputs(playerId, matchIds);
  const stats = computePlayerStats(playerId, rows, events);

  // Live only: if a selected match's player insights are missing or stale,
  // generate them now (plan §5/§8: POST the insights URL, poll until ready).
  let insightNote: string | null = null;
  if (!config.mockMode && config.superstatApiKey !== null) {
    const client = new SuperstatClient({ apiKey: config.superstatApiKey, baseUrl: config.superstatBaseUrl });
    for (const matchId of matchIds) {
      const existing = db.prepare("SELECT status FROM insights WHERE match_id = ? AND player_id = ?").get(matchId, playerId) as { status: string } | undefined;
      if (existing !== undefined && !["not_generated", "failed"].includes(existing.status)) continue;
      try {
        await client.generatePlayerInsights(matchId, playerId);
        let settled: MatchInsights | null = null;
        for (let i = 0; i < 25 && settled === null; i++) {
          await new Promise((resolve) => setTimeout(resolve, 6000));
          const poll = await client.getPlayerInsights(matchId, playerId);
          if (["ready", "failed", "unavailable"].includes(poll.data.status)) settled = poll.data;
        }
        if (settled === null) {
          insightNote = "Superstat insights are still generating — regenerate this report in a minute or two to include them.";
          break;
        }
        saveInsights(db, matchId, playerId, settled, new Date().toISOString());
        if (settled.status === "failed") insightNote = "Superstat insight generation failed for one game; the report continues without it.";
      } catch (e) {
        insightNote = `Superstat insight generation failed: ${String(e)}`;
        break;
      }
    }
  }
  // Graceful missing-data note (plan §5): record when fewer games than
  // selected actually carried box-score data, so the coach is told.
  const missingGames = matchIds.length - rows.length;
  if (missingGames > 0) {
    (stats as PlayerStats & { requestedGames: number }).requestedGames = matchIds.length;
  }

  // Stage 4: build the PII-minimized evidence pack and run the AI analysis.
  const playerRow = db.prepare("SELECT first_name, jersey_number FROM players WHERE id = ?").get(playerId) as { first_name: string; jersey_number: string | null } | undefined;
  const insightRows = db.prepare(
    `SELECT match_id, player_id, status, message, stale, summary_json, ratings_json, generated_at
       FROM insights WHERE match_id IN (${matchIds.map(() => "?").join(",")}) AND player_id = ?`,
  ).all(...matchIds, playerId) as Array<Record<string, unknown>>;
  const insights: Record<string, MatchInsights> = {};
  for (const r of insightRows) {
    const statusText = String(r.status);
    insights[String(r.match_id)] = {
      status: (["ready", "not_generated", "generating", "failed", "unavailable"].includes(statusText) ? statusText : "unavailable") as MatchInsights["status"],
      message: String(r.message), stale: Number(r.stale) === 1,
      recordedBy: "team",
      summary: r.summary_json === null ? null : JSON.parse(String(r.summary_json)),
      ratings: r.ratings_json === null ? null : JSON.parse(String(r.ratings_json)),
      generatedAt: r.generated_at === null ? null : String(r.generated_at),
    };
  }
  const pack = buildEvidencePack({
    firstName: playerRow?.first_name ?? "The player",
    jerseyNumber: playerRow?.jersey_number ?? null,
    stats, events, insights,
  });

  // Team Focus snapshot: team insights (player_id IS NULL) + team box-score
  // totals for the selected matches, aggregated with badge classification.
  const teamInsightRows = db.prepare(
    `SELECT i.match_id, i.status, i.summary_json, i.ratings_json, m.played_at
       FROM insights i JOIN matches m ON m.id = i.match_id
      WHERE i.player_id IS NULL AND i.match_id IN (${matchIds.map(() => "?").join(",")})`,
  ).all(...matchIds) as Array<Record<string, unknown>>;
  const teamInsightMatches: TeamInsightMatch[] = teamInsightRows.map((r) => ({
    matchId: String(r.match_id), playedAt: String(r.played_at), status: String(r.status),
    summary: r.summary_json === null ? null : JSON.parse(String(r.summary_json)),
    ratings: r.ratings_json === null ? null : JSON.parse(String(r.ratings_json)),
  }));
  const teamTotalRows = db.prepare(
    `SELECT t.match_id, t.points, t.fga, t.fgm, t.ast, t.tov, t.reb, t.stl, t.blk,
            o.points AS opponent_points
       FROM box_score_totals t
       LEFT JOIN box_score_totals o ON o.match_id = t.match_id AND o.side = 'opponent'
      WHERE t.side = 'team' AND t.match_id IN (${matchIds.map(() => "?").join(",")})`,
  ).all(...matchIds) as Array<Record<string, unknown>>;
  const teamTotals: TeamTotalsInput[] = teamTotalRows.map((r) => ({
    matchId: String(r.match_id),
    points: Number(r.points), fga: Number(r.fga), fgm: Number(r.fgm),
    ast: Number(r.ast), tov: Number(r.tov), reb: Number(r.reb),
    stl: Number(r.stl), blk: Number(r.blk),
    opponentPoints: r.opponent_points === null ? null : Number(r.opponent_points),
  }));
  const teamFocus = buildTeamFocus(teamInsightMatches, teamTotals, teamShotMixPct(events));
  const analysis = await runAnalysis(config, pack);
  const combinedNote = [analysis.note, insightNote].filter((x): x is string => x !== null).join(" ") || null;
  const aiSnapshot = { ...analysis.result, note: combinedNote, citations: pack.citations };
  const priorities = buildPriorities(stats, pack.citations, insights);

  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO reports (id, created_at, player_id, match_ids_json, stats_json, ai_json, priorities_json, team_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(id, new Date().toISOString(), playerId, JSON.stringify(matchIds), JSON.stringify(stats),
    JSON.stringify(aiSnapshot), JSON.stringify(priorities), JSON.stringify(teamFocus));
  return { id, stats, ai: aiSnapshot, priorities, teamFocus };
});

// Stage 5: PDF is always regenerated from the stored snapshot — no API calls.
app.get("/api/reports/:id/pdf", async (request, reply) => {
  const { id } = request.params as { id: string };
  const row = db.prepare(
    "SELECT r.*, p.first_name, p.last_name, p.jersey_number, t.name AS team_name " +
      "FROM reports r JOIN players p ON p.id = r.player_id JOIN teams t ON t.id = p.team_id WHERE r.id = ?",
  ).get(id) as Record<string, unknown> | undefined;
  if (row === undefined) return reply.code(404).send({ error: "Report not found" });
  const matchIds = JSON.parse(String(row.match_ids_json)) as string[];
  const gameRows = db.prepare(
    `SELECT id, played_at AS playedAt, opponent_name AS opponentName, team_score AS teamScore, opponent_score AS opponentScore
       FROM matches WHERE id IN (${matchIds.map(() => "?").join(",")}) ORDER BY played_at`,
  ).all(...matchIds) as Array<Record<string, unknown>>;
  const outPath = join(config.dataDir, "reports", `${id}.pdf`);
  const playerIdForPdf = String(row.player_id);
  // All team located shots (for per-period attacking-side inference), then the
  // player's own shots tagged with their period's side. Teams switch ends every
  // period and the API court is not rotated to the shooting team's basket.
  const teamShotRows = db.prepare(
    `SELECT id, type, success, x, y, player_id, period_number FROM events
      WHERE side = 'team' AND match_id IN (${matchIds.map(() => "?").join(",")})
        AND type IN ('two_point','three_point') AND x IS NOT NULL
      ORDER BY match_seconds`,
  ).all(...matchIds) as Array<Record<string, unknown>>;
  const periodAgg = new Map<string, { sum: number; n: number }>();
  let allSum = 0, allN = 0;
  for (const r of teamShotRows) {
    const xf = Number(r.x);
    const key = r.period_number === null ? "none" : String(r.period_number);
    const agg = periodAgg.get(key) ?? { sum: 0, n: 0 };
    agg.sum += xf; agg.n++;
    periodAgg.set(key, agg);
    allSum += xf; allN++;
  }
  const sideFor = (periodNumber: unknown): boolean => {
    const key = periodNumber === null ? "none" : String(periodNumber);
    const agg = periodAgg.get(key);
    if (agg && agg.n > 0) return agg.sum / agg.n > 0.5;
    return allN > 0 ? allSum / allN > 0.5 : false;
  };
  const shotRows = teamShotRows.filter((r) => String(r.player_id) === playerIdForPdf);
  await generateReportPdf({
    reportId: id,
    generatedAt: String(row.created_at),
    playerName: `${row.first_name} ${row.last_name}`,
    jerseyNumber: row.jersey_number === null ? null : String(row.jersey_number),
    teamName: String(row.team_name),
    mode: config.mockMode ? "mock" : "live",
    games: gameRows.map((g) => ({
      playedAt: String(g.playedAt), opponentName: String(g.opponentName),
      teamScore: g.teamScore === null ? null : Number(g.teamScore),
      opponentScore: g.opponentScore === null ? null : Number(g.opponentScore),
    })),
    stats: JSON.parse(String(row.stats_json)),
    ai: JSON.parse(String(row.ai_json)),
    priorities: JSON.parse(String(row.priorities_json ?? "[]")),
    teamFocus: row.team_json === null ? undefined : JSON.parse(String(row.team_json)),
    outPath,
    logoPath: join(webDir, "assets", "ue-logo.jpg"),
    logoBandPath: join(webDir, "assets", "ue-logo-white.png"),
    shotEvents: shotRows.map((r) => ({
      id: String(r.id), type: String(r.type), success: Number(r.success) === 1,
      x: Number(r.x), y: Number(r.y),
      periodNumber: r.period_number === null ? null : Number(r.period_number),
      attacksRight: sideFor(r.period_number),
    })),
  });
  db.prepare("UPDATE reports SET pdf_path = ? WHERE id = ?").run(outPath, id);
  reply.type("application/pdf").header("content-disposition", `inline; filename="development-report-${id.slice(0, 8)}.pdf"`);
  return reply.send(createReadStream(outPath));
});

app.get("/api/reports/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (row === undefined) return reply.code(404).send({ error: "Report not found" });
  return {
    id: row.id, createdAt: row.created_at, playerId: row.player_id,
    matchIds: JSON.parse(String(row.match_ids_json)) as string[],
    stats: row.stats_json === null ? null : JSON.parse(String(row.stats_json)),
    ai: row.ai_json === null ? null : JSON.parse(String(row.ai_json)),
    priorities: row.priorities_json === null ? [] : JSON.parse(String(row.priorities_json)),
    teamFocus: row.team_json === null ? null : JSON.parse(String(row.team_json)),
    pdfPath: row.pdf_path,
  };
});

// Stage 6: compare two report snapshots (earlier first).
app.get("/api/compare", async (request, reply) => {
  const { a, b } = request.query as { a?: string; b?: string };
  if (!a || !b) return reply.code(400).send({ error: "Two report ids are required (a = earlier, b = later)" });
  const load = (id: string): ReportSnapshot | null => {
    const row = db.prepare("SELECT id, created_at, stats_json, priorities_json FROM reports WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (row === undefined || row.stats_json === null) return null;
    return {
      id: String(row.id), createdAt: String(row.created_at),
      stats: JSON.parse(String(row.stats_json)),
      priorities: row.priorities_json === null ? [] : JSON.parse(String(row.priorities_json)),
    };
  };
  const earlier = load(a);
  const later = load(b);
  if (earlier === null || later === null) return reply.code(404).send({ error: "One or both reports not found" });
  return compareReports(earlier, later);
});

// §12: permanently delete a player's data and reports. Removes the player
// profile, their per-game box-score rows and insights, every report snapshot,
// and the generated PDF files. Match/team totals are club data and remain.
app.delete("/api/players/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const player = db.prepare("SELECT id, first_name FROM players WHERE id = ?").get(id) as { id: string; first_name: string } | undefined;
  if (player === undefined) return reply.code(404).send({ error: "Unknown player" });
  const reportRows = db.prepare("SELECT id, pdf_path FROM reports WHERE player_id = ?").all(id) as Array<{ id: string; pdf_path: string | null }>;
  const { rmSync } = await import("node:fs");
  let pdfsRemoved = 0;
  for (const r of reportRows) {
    if (r.pdf_path !== null) {
      try { rmSync(r.pdf_path, { force: true }); pdfsRemoved++; } catch { /* file already gone */ }
    }
  }
  const run = db.prepare("DELETE FROM reports WHERE player_id = ?");
  const reportsRemoved = run.run(id).changes;
  db.prepare("DELETE FROM box_score_players WHERE player_id = ?").run(id);
  db.prepare("DELETE FROM insights WHERE player_id = ?").run(id);
  db.prepare("DELETE FROM players WHERE id = ?").run(id);
  return { deleted: player.first_name, reportsRemoved, pdfsRemoved };
});

app.get("/api/reports", async () => {
  return db.prepare(
    "SELECT r.id, r.created_at AS createdAt, r.player_id AS playerId, " +
      "p.first_name AS firstName, p.last_name AS lastName " +
      "FROM reports r JOIN players p ON p.id = r.player_id ORDER BY r.created_at DESC",
  ).all();
});

await app.listen({ host: "127.0.0.1", port: config.port });
console.log(`Union GamePlan running at http://127.0.0.1:${config.port} (mode: ${config.mockMode ? "MOCK" : "live"})`);
