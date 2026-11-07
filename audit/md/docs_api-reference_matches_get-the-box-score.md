# Get the box score

`GET https://api.superstatsport.com/v1/matches/{matchId}/box-score`

Per-player and team totals already summed from the tagged events: points, shooting splits, rebounds, assists, steals, blocks, turnovers, fouls, minutes and efficiency. Matches what the Superstat app shows on the match report.

## Authorization

- `Authorization` header, required: Club API key, for example `ss_live_…`. Create one in the Superstat app under Settings → API keys.

## Parameters

- `matchId` `string<uuid>`, path, required: Match id.

## Responses

### 200: Success

`application/json`

- `data` `MatchBoxScore`, required
  - `matchId` `string<uuid>`, required
  - `team` `BoxScoreTeam`, required: Your team.
    - `name` `string`, required
    - `totals` `BoxScoreStats`, required
      - `points` `number`, required: PTS
      - `fieldGoalsMade` `number`, required: FGM
      - `fieldGoalsAttempted` `number`, required: FGA
      - `fieldGoalPercentage` `number`, required: FG%, 0 to 100.
      - `threePointersMade` `number`, required: 3PM
      - `threePointersAttempted` `number`, required: 3PA
      - `threePointPercentage` `number`, required: 3P%, 0 to 100.
      - `freeThrowsMade` `number`, required: FTM
      - `freeThrowsAttempted` `number`, required: FTA
      - `freeThrowPercentage` `number`, required: FT%, 0 to 100.
      - `offensiveRebounds` `number`, required: OREB
      - `defensiveRebounds` `number`, required: DREB
      - `rebounds` `number`, required: REB
      - `assists` `number`, required: AST
      - `steals` `number`, required: STL
      - `blocks` `number`, required: BLK
      - `turnovers` `number`, required: TO
      - `fouls` `number`, required: PF
    - `players` `BoxScorePlayer[]`, required: Sorted by efficiency, highest first.
      - `points` `number`, required: PTS
      - `fieldGoalsMade` `number`, required: FGM
      - `fieldGoalsAttempted` `number`, required: FGA
      - `fieldGoalPercentage` `number`, required: FG%, 0 to 100.
      - `threePointersMade` `number`, required: 3PM
      - `threePointersAttempted` `number`, required: 3PA
      - `threePointPercentage` `number`, required: 3P%, 0 to 100.
      - `freeThrowsMade` `number`, required: FTM
      - `freeThrowsAttempted` `number`, required: FTA
      - `freeThrowPercentage` `number`, required: FT%, 0 to 100.
      - `offensiveRebounds` `number`, required: OREB
      - `defensiveRebounds` `number`, required: DREB
      - `rebounds` `number`, required: REB
      - `assists` `number`, required: AST
      - `steals` `number`, required: STL
      - `blocks` `number`, required: BLK
      - `turnovers` `number`, required: TO
      - `fouls` `number`, required: PF
      - `playerId` `object | null`, required: Player id from the team roster. Null for opponent players.
      - `rosterEntryId` `object | null`, required
      - `name` `string`, required
      - `jerseyNumber` `object | null`, required
      - `minutes` `object | null`, required: Minutes on court. Uses a coach’s manual minutes when entered. Null when court time was not tracked.
      - `efficiency` `number`, required: EFF: points + rebounds + assists + steals + blocks − turnovers − missed field goals − missed free throws.
      - `trueShootingPercentage` `number`, required: TS%, 0 to 100.
  - `opponent` `BoxScoreTeam | null`, required: The other team. Null when no opponent events were tagged. players is empty when only opponent totals were tracked.
    - `name` `string`, required
    - `totals` `BoxScoreStats`, required
      - `points` `number`, required: PTS
      - `fieldGoalsMade` `number`, required: FGM
      - `fieldGoalsAttempted` `number`, required: FGA
      - `fieldGoalPercentage` `number`, required: FG%, 0 to 100.
      - `threePointersMade` `number`, required: 3PM
      - `threePointersAttempted` `number`, required: 3PA
      - `threePointPercentage` `number`, required: 3P%, 0 to 100.
      - `freeThrowsMade` `number`, required: FTM
      - `freeThrowsAttempted` `number`, required: FTA
      - `freeThrowPercentage` `number`, required: FT%, 0 to 100.
      - `offensiveRebounds` `number`, required: OREB
      - `defensiveRebounds` `number`, required: DREB
      - `rebounds` `number`, required: REB
      - `assists` `number`, required: AST
      - `steals` `number`, required: STL
      - `blocks` `number`, required: BLK
      - `turnovers` `number`, required: TO
      - `fouls` `number`, required: PF
    - `players` `BoxScorePlayer[]`, required: Sorted by efficiency, highest first.
      - `points` `number`, required: PTS
      - `fieldGoalsMade` `number`, required: FGM
      - `fieldGoalsAttempted` `number`, required: FGA
      - `fieldGoalPercentage` `number`, required: FG%, 0 to 100.
      - `threePointersMade` `number`, required: 3PM
      - `threePointersAttempted` `number`, required: 3PA
      - `threePointPercentage` `number`, required: 3P%, 0 to 100.
      - `freeThrowsMade` `number`, required: FTM
      - `freeThrowsAttempted` `number`, required: FTA
      - `freeThrowPercentage` `number`, required: FT%, 0 to 100.
      - `offensiveRebounds` `number`, required: OREB
      - `defensiveRebounds` `number`, required: DREB
      - `rebounds` `number`, required: REB
      - `assists` `number`, required: AST
      - `steals` `number`, required: STL
      - `blocks` `number`, required: BLK
      - `turnovers` `number`, required: TO
      - `fouls` `number`, required: PF
      - `playerId` `object | null`, required: Player id from the team roster. Null for opponent players.
      - `rosterEntryId` `object | null`, required
      - `name` `string`, required
      - `jerseyNumber` `object | null`, required
      - `minutes` `object | null`, required: Minutes on court. Uses a coach’s manual minutes when entered. Null when court time was not tracked.
      - `efficiency` `number`, required: EFF: points + rebounds + assists + steals + blocks − turnovers − missed field goals − missed free throws.
      - `trueShootingPercentage` `number`, required: TS%, 0 to 100.
- `error` `object | null`, required

Example:

```json
{
  "data": {
    "matchId": "d4e5f6a7-b8c9-4d0e-af12-3b4c5d6e7f80",
    "team": {
      "name": "Northside U16 Boys",
      "totals": {
        "points": 68,
        "fieldGoalsMade": 26,
        "fieldGoalsAttempted": 58,
        "fieldGoalPercentage": 44.8,
        "threePointersMade": 6,
        "threePointersAttempted": 18,
        "threePointPercentage": 33.3,
        "freeThrowsMade": 10,
        "freeThrowsAttempted": 14,
        "freeThrowPercentage": 71.4,
        "offensiveRebounds": 11,
        "defensiveRebounds": 23,
        "rebounds": 34,
        "assists": 15,
        "steals": 9,
        "blocks": 3,
        "turnovers": 12,
        "fouls": 16
      },
      "players": [
        {
          "points": 68,
          "fieldGoalsMade": 26,
          "fieldGoalsAttempted": 58,
          "fieldGoalPercentage": 44.8,
          "threePointersMade": 6,
          "threePointersAttempted": 18,
          "threePointPercentage": 33.3,
          "freeThrowsMade": 10,
          "freeThrowsAttempted": 14,
          "freeThrowPercentage": 71.4,
          "offensiveRebounds": 11,
          "defensiveRebounds": 23,
          "rebounds": 34,
          "assists": 15,
          "steals": 9,
          "blocks": 3,
          "turnovers": 12,
          "fouls": 16,
          "playerId": "f6a7b8c9-d0e1-4f2a-9b34-5d6e7f809102",
          "rosterEntryId": "a7b8c9d0-e1f2-4a3b-8c45-6e7f80910213",
          "name": "Ava Nguyen",
          "jerseyNumber": "7",
          "minutes": 27.4,
          "efficiency": 24,
          "trueShootingPercentage": 58.6
        }
      ]
    },
    "opponent": {
      "name": "Northside U16 Boys",
      "totals": {
        "points": 68,
        "fieldGoalsMade": 26,
        "fieldGoalsAttempted": 58,
        "fieldGoalPercentage": 44.8,
        "threePointersMade": 6,
        "threePointersAttempted": 18,
        "threePointPercentage": 33.3,
        "freeThrowsMade": 10,
        "freeThrowsAttempted": 14,
        "freeThrowPercentage": 71.4,
        "offensiveRebounds": 11,
        "defensiveRebounds": 23,
        "rebounds": 34,
        "assists": 15,
        "steals": 9,
        "blocks": 3,
        "turnovers": 12,
        "fouls": 16
      },
      "players": [
        {
          "points": 68,
          "fieldGoalsMade": 26,
          "fieldGoalsAttempted": 58,
          "fieldGoalPercentage": 44.8,
          "threePointersMade": 6,
          "threePointersAttempted": 18,
          "threePointPercentage": 33.3,
          "freeThrowsMade": 10,
          "freeThrowsAttempted": 14,
          "freeThrowPercentage": 71.4,
          "offensiveRebounds": 11,
          "defensiveRebounds": 23,
          "rebounds": 34,
          "assists": 15,
          "steals": 9,
          "blocks": 3,
          "turnovers": 12,
          "fouls": 16,
          "playerId": "f6a7b8c9-d0e1-4f2a-9b34-5d6e7f809102",
          "rosterEntryId": "a7b8c9d0-e1f2-4a3b-8c45-6e7f80910213",
          "name": "Ava Nguyen",
          "jerseyNumber": "7",
          "minutes": 27.4,
          "efficiency": 24,
          "trueShootingPercentage": 58.6
        }
      ]
    }
  },
  "error": null
}
```

### 401: The API key is missing, invalid, or revoked.

`application/json`

- `data` `object | null`, required
- `error` `ApiError`, required
  - `code` `enum<string>`, required. One of: `BAD_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`, `INTERNAL_ERROR`.
  - `message` `string`, required

Example:

```json
{
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Match not found."
  }
}
```

### 404: No team in your club played this match.

`application/json`

- `data` `object | null`, required
- `error` `ApiError`, required
  - `code` `enum<string>`, required. One of: `BAD_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`, `INTERNAL_ERROR`.
  - `message` `string`, required

Example:

```json
{
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Match not found."
  }
}
```

## Example request

```bash
curl -X GET "https://api.superstatsport.com/v1/matches/3fa85f64-5717-4562-b3fc-2c963f66afa6/box-score" \
  -H "Authorization: Bearer $SUPERSTAT_API_KEY"
```
