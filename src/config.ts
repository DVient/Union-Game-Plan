// Application configuration. Credentials live on the coach's PC only — either
// in the process environment or in %USERPROFILE%\.union-gameplan\credentials.json.
// Nothing secret is ever stored in the repository or the database.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface AppConfig {
  /** Superstat club API key (ss_live_…), or null in mock mode. */
  superstatApiKey: string | null;
  /** Superstat API base (per audited docs; override only for testing). */
  superstatBaseUrl: string;
  /** SQLite database directory. */
  dataDir: string;
  /** True when running without a real API key (fixture data). */
  mockMode: boolean;
  /** Local server port (never 3080 — that belongs to the harness GUI). */
  port: number;
  /** AI provider selection: auto (openrouter if keyed, else rule-based), or forced. */
  aiProvider: "auto" | "rule-based" | "openrouter";
  /** OpenRouter credential + model (plan §8: stored on the coach's PC only). */
  openRouterApiKey: string | null;
  openRouterModel: string;
}

function readCredentialsFile(): { superstatApiKey?: string; openRouterApiKey?: string } | null {
  try {
    const path = join(homedir(), ".union-gameplan", "credentials.json");
    return JSON.parse(readFileSync(path, "utf8")) as { superstatApiKey?: string; openRouterApiKey?: string };
  } catch {
    return null; // absent or unreadable credentials file is a normal mock-mode path
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const file = readCredentialsFile();
  const superstatApiKey =
    env.SUPERSTAT_API_KEY?.trim() || file?.superstatApiKey?.trim() || null;
  const dataDir =
    env.UNION_GAMEPLAN_DATA_DIR?.trim() || join(process.cwd(), "data");
  const aiProvider = env.UNION_GAMEPLAN_AI_PROVIDER?.trim();
  return {
    superstatApiKey,
    superstatBaseUrl: env.SUPERSTAT_BASE_URL?.trim() || "https://api.superstatsport.com",
    dataDir,
    // UNION_GAMEPLAN_MOCK=1 forces fixture data even when a key exists — a
    // testing seam so the acceptance suite never touches real players.
    mockMode: superstatApiKey === null || env.UNION_GAMEPLAN_MOCK?.trim() === "1",
    port: Number.parseInt(env.UNION_GAMEPLAN_PORT ?? "3777", 10) || 3777,
    aiProvider: aiProvider === "rule-based" || aiProvider === "openrouter" ? aiProvider : "auto",
    openRouterApiKey: env.OPENROUTER_API_KEY?.trim() || file?.openRouterApiKey?.trim() || null,
    openRouterModel: env.UNION_GAMEPLAN_AI_MODEL?.trim() || "z-ai/glm-5.3-flash",
  };
}
