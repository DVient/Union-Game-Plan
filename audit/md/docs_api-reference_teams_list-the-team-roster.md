# List the team roster

`GET https://api.superstatsport.com/v1/teams/{teamId}/roster`

Players on the team, sorted by jersey number. Use a player id with player insights and to match box score rows.

## Authorization

- `Authorization` header, required: Club API key, for example `ss_live_…`. Create one in the Superstat app under Settings → API keys.

## Parameters

- `teamId` `string<uuid>`, path, required: Team id.

## Responses

### 200: Success

`application/json`

- `data` `RosterPlayer[]`, required
  - `id` `string<uuid>`, required: Player id. Use it for player insights and to match box score rows.
  - `firstName` `string`, required
  - `lastName` `string`, required
  - `jerseyNumber` `string`, required
  - `email` `object | null`, required
  - `createdAt` `string<date-time>`, required
- `error` `object | null`, required

Example:

```json
{
  "data": [
    {
      "id": "f6a7b8c9-d0e1-4f2a-9b34-5d6e7f809102",
      "firstName": "Ava",
      "lastName": "Nguyen",
      "jerseyNumber": "7",
      "email": "ava.nguyen@example.com",
      "createdAt": "2025-02-20T09:12:00.000Z"
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
curl -X GET "https://api.superstatsport.com/v1/teams/3fa85f64-5717-4562-b3fc-2c963f66afa6/roster" \
  -H "Authorization: Bearer $SUPERSTAT_API_KEY"
```
