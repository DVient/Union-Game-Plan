# List a team’s matches

`GET https://api.superstatsport.com/v1/teams/{teamId}/matches`

Every match the team played, newest first, from that team’s perspective: team is always this team and opponent is the other side.

## Authorization

- `Authorization` header, required: Club API key, for example `ss_live_…`. Create one in the Superstat app under Settings → API keys.

## Parameters

- `teamId` `string<uuid>`, path, required: Team id.

## Responses

### 200: Success

`application/json`

- `data` `Match[]`, required
  - `id` `string<uuid>`, required
  - `playedAt` `string<date-time>`, required: When the match was played.
  - `status` `enum<string>`, required: not_started: no footage yet. processing: stats being produced (includes internal in_progress / in_review stages). complete: ready. failed: could not be processed. One of: `not_started`, `in_progress`, `processing`, `complete`, `failed`.
  - `team` `MatchTeam`, required: Your team, as identified by the team id in the request.
    - `id` `object | null`, required: Null when the opponent is not a team on Superstat.
    - `name` `string`, required
    - `score` `object | null`, required: Final score. Null until the match has been processed.
  - `opponent` `MatchTeam`, required: The other team.
    - `id` `object | null`, required: Null when the opponent is not a team on Superstat.
    - `name` `string`, required
    - `score` `object | null`, required: Final score. Null until the match has been processed.
  - `recordedBy` `enum<string>`, required: Which side uploaded the footage. One of: `team`, `opponent`.
  - `opponentStatsTracked` `boolean`, required: True when the opponent’s individual stats were tagged, so the box score includes opponent players.
  - `thumbnailUrl` `object | null`, required
  - `failureReason` `object | null`, required: Set when status is failed.
  - `periods` `MatchPeriod[]`, required: Periods of footage, in playing order.
    - `id` `string<uuid>`, required: Referenced by events as periodId.
    - `number` `object | null`, required
    - `type` `enum<string> | null`, required. One of: `quarter`, `half`.
    - `startedAt` `object | null`, required
    - `endedAt` `object | null`, required
  - `createdAt` `string<date-time>`, required
- `error` `object | null`, required

Example:

```json
{
  "data": [
    {
      "id": "d4e5f6a7-b8c9-4d0e-af12-3b4c5d6e7f80",
      "playedAt": "2026-03-14T04:00:00.000Z",
      "status": "complete",
      "team": {
        "id": "8c1d5e2f-3a4b-4c6d-9e0f-1a2b3c4d5e6f",
        "name": "Northside U16 Boys",
        "score": 68
      },
      "opponent": {
        "id": "8c1d5e2f-3a4b-4c6d-9e0f-1a2b3c4d5e6f",
        "name": "Northside U16 Boys",
        "score": 68
      },
      "recordedBy": "team",
      "opponentStatsTracked": true,
      "thumbnailUrl": "https://cdn.superstatsport.com/matches/thumb.jpg",
      "failureReason": null,
      "periods": [
        {
          "id": "c9d0e1f2-a3b4-4c5d-9e67-8091021324a5",
          "number": 1,
          "type": "quarter",
          "startedAt": "2026-03-14T04:00:12.000Z",
          "endedAt": "2026-03-14T04:11:48.000Z"
        }
      ],
      "createdAt": "2026-03-14T06:30:00.000Z"
    }
  ],
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

### 404: The team is not in your club.

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
curl -X GET "https://api.superstatsport.com/v1/teams/3fa85f64-5717-4562-b3fc-2c963f66afa6/matches" \
  -H "Authorization: Bearer $SUPERSTAT_API_KEY"
```
