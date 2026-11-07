### List the team roster

`GET https://api.superstatsport.com/v1/teams/{teamId}/roster`

Players on the team, sorted by jersey number. Use a player id with player insights and to match box score rows.

---

### List a team’s matches

`GET https://api.superstatsport.com/v1/teams/{teamId}/matches`

Every match the team played, newest first, from that team’s perspective: team is always this team and opponent is the other side.

---

### Get a match

`GET https://api.superstatsport.com/v1/matches/{matchId}`

One match from your team’s perspective. If both teams in a match are in your club, the side that uploaded the footage is treated as team.

---

### Get the box score

`GET https://api.superstatsport.com/v1/matches/{matchId}/box-score`

Per-player and team totals already summed from the tagged events: points, shooting splits, rebounds, assists, steals, blocks, turnovers, fouls, minutes and efficiency. Matches what the Superstat app shows on the match report.

---

### List play-by-play events

`GET https://api.superstatsport.com/v1/matches/{matchId}/events`

Every tagged event in match order, with the match sheet used to attribute them. Use the box score if you only need totals.

---

### Get team insights

`GET https://api.superstatsport.com/v1/matches/{matchId}/insights`

The written insights and ratings for your team in this match. Check status: ready means summary and ratings are included, not_generated means you should POST this URL, generating means a run is in progress and you should poll, failed means the last run failed, and unavailable means the match is not complete yet.

---

### Get player insights

`GET https://api.superstatsport.com/v1/matches/{matchId}/player-insights/{playerId}`

Insights for one of your players in this match. playerId comes from the team roster. status works the same way as team insights. Player insights are written together with the team insights.

---

### Generate team insights

`POST https://api.superstatsport.com/v1/matches/{matchId}/insights`

Writes the team insights and every rostered player’s insights for this match. Returns immediately with status generating; poll the GET until status is ready. Usually takes one to two minutes. Does nothing if insights are already up to date, unless regenerate is true. A match that is not complete returns status unavailable.

---

### Generate player insights

`POST https://api.superstatsport.com/v1/matches/{matchId}/player-insights/{playerId}`

Starts the same run as generating team insights: the team summary and every rostered player, including this one. Returns immediately with status generating. Poll the GET until status is ready.
