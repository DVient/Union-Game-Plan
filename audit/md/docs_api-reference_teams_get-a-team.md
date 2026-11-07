# Get a team

`GET https://api.superstatsport.com/v1/teams/{teamId}`

## Authorization

- `Authorization` header, required: Club API key, for example `ss_live_…`. Create one in the Superstat app under Settings → API keys.

## Parameters

- `teamId` `string<uuid>`, path, required: Team id.

## Responses

### 200: Success

`application/json`

- `data` `Team`, required
  - `id` `string<uuid>`, required
  - `clubId` `string<uuid>`, required
  - `name` `string`, required
  - `ageGroup` `string`, required
  - `gender` `object | null`, required
  - `competitionLevel` `object | null`, required
  - `league` `object | null`, required
  - `division` `object | null`, required
  - `createdAt` `string<date-time>`, required
- `error` `object | null`, required

Example:

```json
{
  "data": {
    "id": "8c1d5e2f-3a4b-4c6d-9e0f-1a2b3c4d5e6f",
    "clubId": "3f7c2a6e-9d1b-4f0e-8a5c-2b6d7e8f9a01",
    "name": "Northside U16 Boys",
    "ageGroup": "u16",
    "gender": "boys",
    "competitionLevel": "representative",
    "league": "Victorian Junior Basketball League",
    "division": "division_1",
    "createdAt": "2025-02-14T03:25:44.000Z"
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
curl -X GET "https://api.superstatsport.com/v1/teams/3fa85f64-5717-4562-b3fc-2c963f66afa6" \
  -H "Authorization: Bearer $SUPERSTAT_API_KEY"
```
