# Superstat API Capability Assessment (Stage 1)

Sources: https://help.superstatsport.com/docs/api-reference and the help-centre pages fetched into `audit/md/` and `audit/raw/` (llms.txt / llms-full.txt, changelog through 2026-11-06). Documentation-only audit; no API key used yet.

## 1. Authentication

- Bearer token in the `Authorization` header (`X-Api-Key` also accepted). Key format `ss_live_…`, secret shown once at creation.
- Keys are **club-scoped**: a key reads only that club's teams, rosters, matches and insights. `GET /v1/clubs` returns exactly one club.
- Keys are created by the **club owner** in the Superstat app under **Settings → API keys** (admins/editors cannot). Free, nothing to enable, up to 20 active keys, revocable at any time.
- Errors: JSON envelope `{ data, error }` with `error.code` one of `BAD_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`, `INTERNAL_ERROR`; 404 also means "not in your club" (key scoping).

## 2. Available endpoints (13, all confirmed)

| Endpoint | Notes |
|---|---|
| `GET /v1/clubs` | The key's club (one item). |
| `GET /v1/clubs/{clubId}` | Club details. |
| `GET /v1/clubs/{clubId}/teams` | Active teams: name, ageGroup, gender, competitionLevel, league, division. |
| `GET /v1/teams/{teamId}` | Team details. |
| `GET /v1/teams/{teamId}/roster` | Players sorted by jersey number; `playerId` is the join key for box scores and player insights. |
| `GET /v1/teams/{teamId}/matches` | Every match, newest first, always from this team's perspective. No pagination parameters documented — response is a plain array. |
| `GET /v1/matches/{matchId}` | `playedAt`, `status` (`not_started`/`processing`/`complete`/`failed`), team/opponent names + scores, `recordedBy` (which side uploaded footage), `opponentStatsTracked`, periods (quarter/half with start/end times). |
| `GET /v1/matches/{matchId}/box-score` | Per-player and team totals "already summed from the tagged events"; matches the app's match report. |
| `GET /v1/matches/{matchId}/events` | Full play-by-play in `matchSeconds` order with player attribution and shot locations. |
| `GET /v1/matches/{matchId}/insights` | Team insights with a status lifecycle. |
| `GET /v1/matches/{matchId}/player-insights/{playerId}` | Same structure for one player. |
| `POST /v1/matches/{matchId}/insights` | Generates team insights **and every rostered player's** insights (returns `generating`; poll; typically 1–2 min; no-op unless stale or `regenerate: true`). |
| `POST /v1/matches/{matchId}/player-insights/{playerId}` | Starts the same combined run. |

## 3. Box score fields (per player and team totals)

PTS, FGM/FGA/FG%, 3PM/3PA/3P%, FTM/FTA/FT%, OREB/DREB/REB, AST, STL, BLK, TO, PF.
Player rows additionally: `minutes` (**null when court time was not tracked**; coach's manual corrections are used when entered), `efficiency` (EFF = PTS+REB+AST+STL+BLK−TO−missed FG−missed FT), `trueShootingPercentage` (native, 0–100), `playerId`, `jerseyNumber`, `name`.
Opponent side included when its stats were tracked (`opponentStatsTracked`); opponent `players` empty when only opponent totals were tagged.

## 4. Play-by-play events

- Types: `two_point`, `three_point`, `free_throw`, `offensive_rebound`, `defensive_rebound`, `assist`, `steal`, `block`, `turnover`, `foul`, plus club-defined **custom events** (`customEventName`).
- Each event: `success`, `side` (team/opponent), `matchSeconds`, `periodNumber`/`periodType`/`periodSeconds`, attributed `player` (roster id + jersey), and for shots a `location` (x/y fractions + metres on a standard 28×15 m FIBA court).
- No shot-clock field (period length must be derived from `periods[].startedAt/endedAt`); location is usually null for rebounds, assists, steals, blocks, turnovers and fouls.

## 5. Insights

- Status lifecycle per match: `ready` / `not_generated` / `generating` / `failed` / `unavailable`, plus `stale` (box score changed since last write → POST again).
- Content: `summary.whatsWorked[]` style lists — `whatsWorking[]`, `focusAreas[]`, `suggestions[]` — and six ratings with comments: `shotMix` (% of shots close to basket), `pointsPerShot`, `assistRate` (% of made FGs assisted), `turnovers`, `rebounds`, `defensiveImpact` (steals+blocks combined).
- Insights reflect the footage-uploading side's perspective (`recordedBy`).

## 6. Plan §7 metric feasibility

| Plan metric | Feasible? | How |
|---|---|---|
| Points / minutes per game | ✅ | Box score × matches; minutes may be null → flag per game |
| FG%, 3P%, FT% | ✅ | Provided directly |
| Effective FG% | ✅ | (FGM + 0.5·3PM) / FGA |
| True Shooting % | ✅ | Provided natively (and verifiable from FGM/FTA) |
| Points per FGA | ✅ | PTS / FGA |
| AST, TO per game; AST/TO ratio | ✅ | Box score × matches |
| REB, STL, BLK per game | ✅ | Box score (OREB/DREB split included) |
| Shooting distribution by location | ✅ | Event `location` on FIBA court (shot events only) |
| Consistency across games | ✅ | Per-game dispersion of chosen metrics |
| Changes between periods | ✅ | Compare report snapshots |
| Usage rate | ❌ (correctly forbidden) | No team possession count in API |
| Contested shot % | ❌ (correctly forbidden) | No contested flag |
| Live-ball turnover % | ❌ (correctly forbidden) | No live-ball/dead-ball flag |
| Defensive efficiency | ❌ (correctly forbidden) | No possession/lineup model |

Bonus capabilities the plan didn't list: Superstat's own EFF, native TS%, opponent box-score totals (opposition context), quarter/half splits, custom events tagged by the coach, shot charts.

## 7. Plan §6 AI analysis feasibility

- §6 "Basketball IQ via recorded events" is well supported: turnovers, shot locations, quarter timing, custom events.
- §6 "Superstat's defensive insights" maps to the `defensiveImpact` rating + rebounds + steals + blocks.
- §8's "Superstat AI insight review" section maps 1:1 to `summary` (whatsWorking/focusAreas/suggestions) + `ratings` with comments.
- Our own AI layer receives the evidence pack (validated box scores, event summaries, insights) — consistent with the plan's citation rule.

## 8. Existing Superstat features that overlap the plan (plan §2 requirement)

Already built into the Superstat app (no need to rebuild, but no API for them either):
- **Match report** generation (AI, style/length options, linked plays) and **match PDF export** (report + stats + insights + highlight links).
- **Assistant Coach**: ask questions about completed games, inspect evidence clips.
- **Player reviews & fatigue view**: individual feedback vs event output through a game.
- **Season comparison** of team/player results; per-game **shot maps**.
- Insight generation for matches (in-app and via API POST).

Gap our app still fills: a **multi-game, single-player development report** with tracked development priorities, measurable improvement targets, reassessment periods, and period-over-period progress snapshots. Superstat's reports are per-match; none of these features produce that.

## 9. Limitations and open questions (to verify with a live key)

1. **No documented rate limits** → cache aggressively, manual "Sync now", avoid re-fetching.
2. **No pagination** documented on list endpoints → verify array size behaviour with a full season of matches.
3. **Insights are not automatic** via API: each complete match needs a POST + polling (1–2 min).
4. **Stats are AI-tagged from video**: Fast mode ≈85% accuracy; standard processing is the accuracy benchmark; coach corrections in-app flow back into the API data (box score is summed from tagged events).
5. **Minutes can be null** when court time wasn't tracked; treat per-minute metrics as conditional.
6. **Key management is owner-only** — the request for a key goes to the club owner (Settings → API keys), not Superstat support.
7. Not exposed via API (exists in app only): match PDF export, Assistant Coach, player reviews/fatigue view, vote leaderboards, highlights.
8. Unverified: webhook mentions in docs (4 hits) — purpose and availability unknown until probed with a key.

## 10. Verdict

The API fully supports Stages 2–6 of the plan with **no invented metrics**: every §7 metric is either provided or derivable from documented fields, the §6 analysis has both event-level and insight-level evidence, and the §2 requirement to check existing features is satisfied (§8 above). The single blocker remains the **club API key** (owner-only creation). Documentation-only audit complete; live verification (auth, pagination, insight generation, real box scores) starts once the key exists.
