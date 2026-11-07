// SQLite storage (node:sqlite — no native build step needed on the coach's PC).
// Raw API responses are preserved verbatim so reports can be regenerated
// without re-fetching (plan §5). PII (roster emails) is kept only inside the
// preserved raw JSON, never as queryable columns.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface OpenDbResult {
  db: DatabaseSync;
  path: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS raw_responses (
  endpoint TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (endpoint, ref_id)
);

CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id),
  name TEXT NOT NULL,
  age_group TEXT NOT NULL,
  gender TEXT,
  competition_level TEXT,
  league TEXT,
  division TEXT
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  jersey_number TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  played_at TEXT NOT NULL,
  status TEXT NOT NULL,
  team_score INTEGER,
  opponent_name TEXT NOT NULL,
  opponent_score INTEGER,
  recorded_by TEXT NOT NULL,
  opponent_stats_tracked INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS box_score_players (
  match_id TEXT NOT NULL REFERENCES matches(id),
  side TEXT NOT NULL CHECK (side IN ('team','opponent')),
  player_id TEXT,
  roster_entry_id TEXT,
  name TEXT NOT NULL,
  jersey_number TEXT,
  minutes REAL,
  points INTEGER NOT NULL,
  fgm INTEGER NOT NULL, fga INTEGER NOT NULL, fg_pct REAL NOT NULL,
  tpm INTEGER NOT NULL, tpa INTEGER NOT NULL, tp_pct REAL NOT NULL,
  ftm INTEGER NOT NULL, fta INTEGER NOT NULL, ft_pct REAL NOT NULL,
  oreb INTEGER NOT NULL, dreb INTEGER NOT NULL, reb INTEGER NOT NULL,
  ast INTEGER NOT NULL, stl INTEGER NOT NULL, blk INTEGER NOT NULL,
  tov INTEGER NOT NULL, fouls INTEGER NOT NULL,
  efficiency REAL NOT NULL,
  ts_pct REAL NOT NULL,
  PRIMARY KEY (match_id, side, player_id, roster_entry_id, name)
);

CREATE TABLE IF NOT EXISTS box_score_totals (
  match_id TEXT NOT NULL REFERENCES matches(id),
  side TEXT NOT NULL CHECK (side IN ('team','opponent')),
  points INTEGER NOT NULL,
  fgm INTEGER NOT NULL, fga INTEGER NOT NULL, fg_pct REAL NOT NULL,
  tpm INTEGER NOT NULL, tpa INTEGER NOT NULL, tp_pct REAL NOT NULL,
  ftm INTEGER NOT NULL, fta INTEGER NOT NULL, ft_pct REAL NOT NULL,
  oreb INTEGER NOT NULL, dreb INTEGER NOT NULL, reb INTEGER NOT NULL,
  ast INTEGER NOT NULL, stl INTEGER NOT NULL, blk INTEGER NOT NULL,
  tov INTEGER NOT NULL, fouls INTEGER NOT NULL,
  PRIMARY KEY (match_id, side)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id),
  type TEXT NOT NULL,
  success INTEGER NOT NULL,
  side TEXT,
  match_seconds REAL NOT NULL,
  period_id TEXT NOT NULL,
  period_number INTEGER,
  period_type TEXT,
  period_seconds REAL NOT NULL,
  player_id TEXT,
  player_name TEXT,
  jersey_number TEXT,
  x REAL, y REAL,
  custom_event_name TEXT
);

CREATE TABLE IF NOT EXISTS insights (
  match_id TEXT NOT NULL REFERENCES matches(id),
  player_id TEXT,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  stale INTEGER NOT NULL,
  summary_json TEXT,
  ratings_json TEXT,
  generated_at TEXT,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES players(id),
  match_ids_json TEXT NOT NULL,
  stats_json TEXT,
  ai_json TEXT,
  priorities_json TEXT,
  team_json TEXT,
  pdf_path TEXT
);

CREATE INDEX IF NOT EXISTS idx_matches_team ON matches(team_id, played_at);
CREATE INDEX IF NOT EXISTS idx_box_player ON box_score_players(player_id);
CREATE INDEX IF NOT EXISTS idx_events_match ON events(match_id);
CREATE INDEX IF NOT EXISTS idx_reports_player ON reports(player_id, created_at);
`;

export function openDb(dataDir: string): OpenDbResult {
  mkdirSync(dataDir, { recursive: true });
  const path = join(dataDir, "gameplan.db");
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  // Upgrade databases created before the priorities/team columns existed.
  try { db.exec("ALTER TABLE reports ADD COLUMN priorities_json TEXT"); } catch { /* already present */ }
  try { db.exec("ALTER TABLE reports ADD COLUMN team_json TEXT"); } catch { /* already present */ }
  return { db, path };
}

export function getMeta(db: DatabaseSync, key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(db: DatabaseSync, key: string, value: string): void {
  db.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

/** Preserve (or refresh) the original response body for one endpoint hit. */
export function saveRaw(db: DatabaseSync, endpoint: string, refId: string, raw: string, fetchedAt: string): void {
  db.prepare(
    "INSERT INTO raw_responses (endpoint, ref_id, fetched_at, body) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(endpoint, ref_id) DO UPDATE SET fetched_at = excluded.fetched_at, body = excluded.body",
  ).run(endpoint, refId, fetchedAt, raw);
}
