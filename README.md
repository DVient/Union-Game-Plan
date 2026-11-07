# Union GamePlan — Superstat Basketball Player Development Report Generator

A local-only application that connects a basketball club's **Superstat** account to an
automated, evidence-based **player development report** — selectable game windows, validated
statistics, AI-assisted analysis with enforced citations, a shot chart, a team-focus page,
and a print-ready branded PDF. Built for a **non-technical coach** of 14–15-year-old players:
the entire workflow is *select player → select games → generate report → download PDF*.

> **Design principle (plan.md §15):** accuracy, usability and actionable development
> recommendations over technical complexity. The coach never handles API keys, servers or
> configuration.

---

## What it does

- **Syncs** the club's Superstat data with one click: teams, rosters, matches, box scores,
  play-by-play events, team & player insights (incremental, rate-limit friendly, raw API
  responses preserved verbatim for offline regeneration).
- **Selects** a team, a player and a game window (last 3 / 5 / 10 or all games, individual
  games excludable).
- **Computes** the full statistical picture — points & minutes per game, FG%/3P%/FT%,
  effective FG%, true shooting, points per shot, assists/turnovers + ratio, rebounds, steals,
  blocks, shooting distribution by court zone, and consistency (coefficient of variation) —
  weighted from totals, cross-validated against Superstat's own box scores.
- **Enforces honesty rules**: insufficient samples (fewer than 5 games, < 20 attempts behind
  any percentage, < 10 combined assists+turnovers) are flagged † and excluded from
  conclusions; forbidden metrics (usage rate, contested-shot %, live-ball turnover %,
  defensive efficiency) are never computed — the API lacks the underlying data.
- **Analyses with AI — with receipts**: a provider-agnostic analysis pass (OpenRouter by
  default, deterministic local rule-based fallback) that must cite the specific statistic,
  event or insight behind every claim; unsupported claims are dropped before the report is
  written. Findings are labelled *confirmed / possible / unverified*.
- **Renders a branded PDF** (Union Elite green/off-white, crest in the header band):
  - BI-style **KPI stat cards** (centred values, small-sample † markers)
  - eleven report sections, plain language for a 14–15-year-old reader
  - a **dashboard-style shot chart** rendered from play-by-play coordinates with exact FIBA
    geometry (the Superstat API has no shot-chart image endpoint — the chart is drawn from
    documented event locations; per-period basket-side inference handles end-switching)
  - a **Team Focus page** closing every report: the team's Superstat insights (What's
    Working / Focus Areas / Suggestions) and six team metric cards with GOOD/SUPER/POOR
    editorial badges
  - three development priorities with drills, measurements and reassessment periods
  - a data limitations & confidence section, and a footer band with page numbering
- **Tracks progress** across reporting periods via immutable snapshots (direction-aware
  trends: fewer turnovers reads as *improved*), with sample-size caveats.
- **Safeguards youth data** (plan §12): everything lives on the coach's PC; personal data is
  minimised in AI prompts (first name only); one click permanently deletes a player's data
  and reports.

---

## Quick start

Prerequisites: **Node.js ≥ 24** (uses the built-in `node:sqlite` — no native builds).

```bash
npm install
npm run build
npm start            # http://127.0.0.1:3777 (localhost only)
```

Without a Superstat key the app runs in **mock mode**: five internally-consistent completed
games (box scores that agree exactly with the play-by-play events, insights included) so the
whole workflow can be exercised before the club key exists.

### Connecting your Superstat club

The API is free for every Superstat club. The **club owner** creates a key in the Superstat
app under **Settings → API keys** (admins/editors cannot). Then provide it either as:

- the environment variable `SUPERSTAT_API_KEY=ss_live_…` **(set it in the same shell that
  starts the app)**, or
- `%USERPROFILE%\.union-gameplan\credentials.json` → `{ "superstatApiKey": "ss_live_…" }`

Restart the app; the mock banner disappears and **Sync now** pulls your real club.

### AI provider (optional)

`UNION_GAMEPLAN_AI_PROVIDER = auto | rule-based | openrouter` (default `auto`).
For live LLM analysis add `"openRouterApiKey": "sk-or-…"` to the credentials file
(model defaults to `z-ai/glm-5.3-flash`, override with `UNION_GAMEPLAN_AI_MODEL`).
When no key exists or the provider fails, the app falls back to the local rule-based
analysis and records a clear note in the report — statistical sections always render.

---

## The report

| # | Section | Source |
|---|---|---|
| 1 | Player performance overview | computed stats |
| 2 | Statistical summary (KPI cards + details) | weighted aggregates, confidence flags |
| 3–4 | Identified strengths / weaknesses | AI findings, each with cited evidence |
| 5 | Scoring & shot selection + **shot chart** | box scores + event coordinates (FIBA geometry) |
| 6 | Turnover & playmaking analysis | box scores + play-by-play |
| 7 | Defensive contribution | recorded events only (no invented defensive ratings) |
| 8 | Superstat AI insight review | Superstat player insights + AI findings |
| 9 | Three development priorities | severity-ranked, each with drills, measure, reassessment |
| 10 | Recommended improvement measurements | from the priorities |
| 11 | Data limitations & confidence assessment | sample sizes, zone approximations, validation results |
| — | **Team Focus** (insert page, team-level) | Superstat **team** insights + team totals |

Every claim in the AI sections cites the exact statistic, event or insight that supports it.
Badges (GOOD/SUPER/POOR) on the Team Focus page are the app's own editorial classification
against youth benchmarks — the API does not provide them; thresholds are documented in
`src/report/team-focus.ts`.

---

## Architecture

```
Superstat API (13 audited endpoints, Bearer club key)
        │  manual "Sync now" — incremental, raw responses preserved
        ▼
SQLite (node:sqlite) ── teams · players · matches · box scores · events · insights · reports
        │
        ├── stats engine (src/stats)  → weighted aggregates, zones, consistency, confidence
        ├── AI layer (src/ai)         → evidence pack → provider → citation filter
        └── report layer (src/report) → priorities · Team Focus · PDF (pdfkit + pdf-lib footer)
                ▼
        local web UI (web/) — Fastify, 127.0.0.1 only
```

| Path | Role |
|---|---|
| `src/config.ts` | credential loading (env or `%USERPROFILE%\.union-gameplan`), mock-mode seams |
| `src/superstat/` | typed API client (audit-derived), mock fixtures, types |
| `src/store/db.ts` | schema, migrations, raw-response preservation |
| `src/sync/sync.ts` | manual incremental sync; insight generation stays on-demand |
| `src/stats/compute.ts` | §7 engine: aggregates, zones, consistency, confidence, validation |
| `src/ai/` | evidence pack (PII-minimised), citation filter, rule-based + OpenRouter providers |
| `src/report/` | development priorities, Team Focus, PDF generation, snapshot comparison |
| `src/server/http.ts` | local-only Fastify API + static UI |
| `web/` | vanilla-JS selection interface (no build step) |
| `audit/` | Stage 1 capability assessment + the fetched Superstat documentation |

## Data & privacy

- All data (database, raw API responses, PDFs) stays on the coach's PC. Nothing is published;
  the only third parties are the Superstat API and the chosen AI provider, required to operate.
- AI prompts carry the player's **first name and jersey number only** — no contact details,
  no biographical information. Roster emails exist only inside preserved raw responses.
- Report language is development-focused and strengths-based: no shaming, no medical or
  psychological claims.
- **Delete a player** (roster button) permanently removes their profile, box-score rows,
  insights, report snapshots and generated PDFs.
- `data/` is git-ignored — **never commit real player data**.

## Development & testing

| Command | Purpose |
|---|---|
| `npm run build` / `npm start` | compile TypeScript / run the app |
| `npm run typecheck` | strict type check only |
| `node scripts/acceptance-mock.mjs` | 19-check coach-workflow acceptance suite (mock data) |
| `node scripts/live-demo.mjs` | live acceptance against real Superstat data + demo report |
| `node scripts/check-pdf-structure.cjs` | PDF assertions: no blanks/`%%`/badge leaks, sequential page labels, section cohesion |
| `node scripts/readability.cjs <pdf>` | Flesch–Kincaid reading level (prose-only) — target: grade-9 band |
| `node scripts/validate-mock.cjs` | mock events must sum exactly to box scores |
| `node scripts/diagnose-pdf.cjs` / `diagnose-shots.cjs` | text/data diagnostics |

**Safety interlocks**: the acceptance suite refuses to run against a live server and the
live suite refuses a mock server — automated runs can never touch real players.

## API integration notes

All 13 documented endpoints are used exactly as audited (see
[`audit/capability-assessment.md`](audit/capability-assessment.md)). Notable behaviours:
keys are club-scoped; insight generation is a POST + poll (~1–2 min) triggered on demand at
report time; matches list newest-first with no documented pagination; minutes may be null
when court time wasn't tracked; Fast-mode games carry ~85% tagging accuracy.

## Status

- [x] Stage 1 — API & platform audit (documentation + capability assessment)
- [x] Stage 2 — local app, secure API connection, selection interface
- [x] Stage 3 — statistical calculations (validated; sample-size rules)
- [x] Stage 4 — AI analysis (provider-agnostic, citation-enforced)
- [x] Stage 5 — PDF generation (branded, KPI cards, shot chart, Team Focus, footer)
- [x] Stage 6 — historical comparison and progress tracking
- [x] Live acceptance on real Superstat data (attribution, insights, demo report)
- [ ] Ongoing: coach's visual review pass as games accumulate

## Troubleshooting

| Symptom | Fix |
|---|---|
| Mock banner won't go away | key not visible at boot — check the env var *in the starting shell* or the credentials file, then restart |
| `EADDRINUSE :3777` | an old instance is running — stop it or set `UNION_GAMEPLAN_PORT` |
| "insights are still generating" | Superstat insight generation takes 1–2 minutes; regenerate the report |
| Port 3777 blocked | `UNION_GAMEPLAN_PORT=8080 npm start` |

## Branding

Union Elite crest (`UE Logo*.jfif/png` — the white PNG's enclosed interiors are flood-filled
opaque white by `scripts/process-logo-white.mjs`) and colours: Deep Forest green `#1E5A38`,
white `#FFFFFF`, off-white `#F4F5F4`.

---

*Built with plan-driven, stage-gated development — see `plan.md` for the full specification
and `audit/capability-assessment.md` for the API evidence base.*
