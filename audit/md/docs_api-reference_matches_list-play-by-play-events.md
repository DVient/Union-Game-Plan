# List play-by-play events

`GET https://api.superstatsport.com/v1/matches/{matchId}/events`

Every tagged event in match order, with the match sheet used to attribute them. Use the box score if you only need totals.

## Authorization

- `Authorization` header, required: Club API key, for example `ss_live_…`. Create one in the Superstat app under Settings → API keys.

## Parameters

- `matchId` `string<uuid>`, path, required: Match id.

## Responses

### 200: Success

`application/json`

- `data` `MatchEvents`, required
  - `roster` `MatchRosterEntry[]`, required
    - `rosterEntryId` `string<uuid>`, required: Id of this player’s spot on the match sheet.
    - `playerId` `object | null`, required: Player id from the team roster. Null for opponent players.
    - `firstName` `object | null`, required
    - `lastName` `object | null`, required
    - `jerseyNumber` `object | null`, required
    - `side` `enum<string>`, required. One of: `team`, `opponent`.
  - `events` `MatchEvent[]`, required: Ordered by matchSeconds.
    - `id` `string<uuid>`, required
    - `type` `string`, required: Event type, for example two_point, three_point, free_throw, offensive_rebound, defensive_rebound, assist, steal, block, turnover, foul, or a custom event.
    - `success` `boolean`, required: For shots, whether it went in. True for other events.
    - `side` `enum<string> | null`, required: Which side the event belongs to. Null when unknown. One of: `team`, `opponent`.
    - `matchSeconds` `number`, required: Seconds from the start of the match.
    - `periodId` `string<uuid>`, required
    - `periodNumber` `object | null`, required
    - `periodType` `enum<string> | null`, required. One of: `quarter`, `half`.
    - `periodSeconds` `number`, required: Seconds from the start of the period.
    - `player` `EventPlayer | null`, required
      - `id` `object | null`, required: Player id from the team roster. Null for opponent players.
      - `rosterEntryId` `object | null`, required
      - `name` `object | null`, required
      - `jerseyNumber` `object | null`, required
    - `location` `CourtLocation | null`, required: Where the event happened on a full FIBA court. Null when the event has no court position, which is usual for rebounds, assists, steals, blocks, turnovers and fouls.
      - `court` `CourtDiagram`, required
        - `standard` `string`, required: The court these coordinates are measured on: a full FIBA court, 28 metres long and 15 metres wide, the same diagram Superstat draws shots on.
        - `lengthMetres` `number`, required: Length of the court in metres, baseline to baseline.
        - `widthMetres` `number`, required: Width of the court in metres, sideline to sideline.
      - `x` `number`, required: Fraction of the court length from the left baseline (0) to the right baseline (1), as the court is drawn in Superstat. The diagram is not rotated to the shooting team’s basket.
      - `y` `number`, required: Fraction of the court width from the top sideline (0) to the bottom sideline (1), as the court is drawn in Superstat.
      - `fromLeftBaselineMetres` `number`, required: Metres from the left baseline. x multiplied by the court length.
      - `fromTopSidelineMetres` `number`, required: Metres from the top sideline. y multiplied by the court width.
    - `customEventName` `object | null`, required: Name of the custom event when type is a custom event.
- `error` `object | null`, required

Example:

```json
{
  "data": {
    "roster": [
      {
        "rosterEntryId": "a7b8c9d0-e1f2-4a3b-8c45-6e7f80910213",
        "playerId": "f6a7b8c9-d0e1-4f2a-9b34-5d6e7f809102",
        "firstName": "Ava",
        "lastName": "Nguyen",
        "jerseyNumber": "7",
        "side": "team"
      }
    ],
    "events": [
      {
        "id": "d0e1f2a3-b4c5-4d6e-8f78-91021324a5b6",
        "type": "three_point",
        "success": true,
        "side": "team",
        "matchSeconds": 1432.5,
        "periodId": "c9d0e1f2-a3b4-4c5d-9e67-8091021324a5",
        "periodNumber": 2,
        "periodType": "quarter",
        "periodSeconds": 232.5,
        "player": {
          "id": "f6a7b8c9-d0e1-4f2a-9b34-5d6e7f809102",
          "rosterEntryId": "a7b8c9d0-e1f2-4a3b-8c45-6e7f80910213",
          "name": "Ava Nguyen",
          "jerseyNumber": "7"
        },
        "location": {
          "court": {
            "standard": "FIBA",
            "lengthMetres": 28,
            "widthMetres": 15
          },
          "x": 0.72,
          "y": 0.41,
          "fromLeftBaselineMetres": 20.16,
          "fromTopSidelineMetres": 6.15
        },
        "customEventName": null
      }
    ]
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
curl -X GET "https://api.superstatsport.com/v1/matches/3fa85f64-5717-4562-b3fc-2c963f66afa6/events" \
  -H "Authorization: Bearer $SUPERSTAT_API_KEY"
```
