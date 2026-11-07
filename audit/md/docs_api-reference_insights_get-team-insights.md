# Get team insights

`GET https://api.superstatsport.com/v1/matches/{matchId}/insights`

The written insights and ratings for your team in this match. Check status: ready means summary and ratings are included, not_generated means you should POST this URL, generating means a run is in progress and you should poll, failed means the last run failed, and unavailable means the match is not complete yet.

## Authorization

- `Authorization` header, required: Club API key, for example `ss_live_…`. Create one in the Superstat app under Settings → API keys.

## Parameters

- `matchId` `string<uuid>`, path, required: Match id.

## Responses

### 200: Success

`application/json`

- `data` `MatchInsights`, required
  - `status` `enum<string>`, required: ready: summary and ratings are included. not_generated: the match is complete but insights have not been written — POST this URL to generate them. generating: a generation is in progress — poll this URL. failed: the last generation failed; the message says why, and any previous insights are still included. unavailable: the match is not complete yet, so insights cannot be written. One of: `ready`, `not_generated`, `generating`, `failed`, `unavailable`.
  - `message` `string`, required: What the status means and what to do next.
  - `stale` `boolean`, required: True when status is ready or generating and the box score has changed since these insights were written. POST the same URL to regenerate them.
  - `recordedBy` `enum<string>`, required: Which side uploaded the footage. One of: `team`, `opponent`.
  - `summary` `InsightSummary | null`, required: Null until insights have been written at least once.
    - `whatsWorking` `string[]`, required
    - `focusAreas` `string[]`, required
    - `suggestions` `string[]`, required
  - `ratings` `InsightRatings | null`, required: Null until the ratings have been written.
    - `shotMix` `InsightRating`, required: Share of shots taken close to the basket, as a percentage.
      - `value` `number`, required: The metric’s value. Units depend on the metric.
      - `comment` `string`, required
    - `pointsPerShot` `InsightRating`, required: Points per shot.
      - `value` `number`, required: The metric’s value. Units depend on the metric.
      - `comment` `string`, required
    - `assistRate` `InsightRating`, required: Share of made field goals that were assisted, as a percentage.
      - `value` `number`, required: The metric’s value. Units depend on the metric.
      - `comment` `string`, required
    - `turnovers` `InsightRating`, required: Turnovers.
      - `value` `number`, required: The metric’s value. Units depend on the metric.
      - `comment` `string`, required
    - `rebounds` `InsightRating`, required: Rebounds.
      - `value` `number`, required: The metric’s value. Units depend on the metric.
      - `comment` `string`, required
    - `defensiveImpact` `InsightRating`, required: Steals and blocks combined.
      - `value` `number`, required: The metric’s value. Units depend on the metric.
      - `comment` `string`, required
  - `generatedAt` `object | null`, required: When the included insights were written. Null when there are none.
- `error` `object | null`, required

Example:

```json
{
  "data": {
    "status": "ready",
    "message": "Insights are up to date.",
    "stale": false,
    "recordedBy": "team",
    "summary": {
      "whatsWorking": [
        "Paint touches created open threes."
      ],
      "focusAreas": [
        "Live-ball turnovers came in transition."
      ],
      "suggestions": [
        "Run the drag screen earlier in the shot clock."
      ]
    },
    "ratings": {
      "shotMix": {
        "value": 42,
        "comment": "More of the offence came from the paint."
      },
      "pointsPerShot": {
        "value": 42,
        "comment": "More of the offence came from the paint."
      },
      "assistRate": {
        "value": 42,
        "comment": "More of the offence came from the paint."
      },
      "turnovers": {
        "value": 42,
        "comment": "More of the offence came from the paint."
      },
      "rebounds": {
        "value": 42,
        "comment": "More of the offence came from the paint."
      },
      "defensiveImpact": {
        "value": 42,
        "comment": "More of the offence came from the paint."
      }
    },
    "generatedAt": "2026-03-14T07:02:11.000Z"
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
curl -X GET "https://api.superstatsport.com/v1/matches/3fa85f64-5717-4562-b3fc-2c963f66afa6/insights" \
  -H "Authorization: Bearer $SUPERSTAT_API_KEY"
```
